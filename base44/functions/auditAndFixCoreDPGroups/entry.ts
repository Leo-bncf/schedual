import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Audit + fix DP core TeachingGroups (TOK/CAS/EE) for a given school, then rebuild and report breakdown
// Request body: { school_id: string }
// Response: { success, subjects, teaching_groups: {...}, created, updated, breakdown }
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const school_id = body?.school_id || body?.schoolId || user.school_id || null;

    if (!school_id) {
      return Response.json({ error: 'school_id required in payload' }, { status: 400 });
    }

    // Always use service role for deterministic access by school
    const client = base44.asServiceRole;
    console.log('[auditAndFixCoreDPGroups] schoolIdInput', school_id);

    // 1) Fetch core subjects (TOK, CAS, EE)
    const subjectsAll = await client.entities.Subject.filter({ school_id, is_active: true });
    const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

    const coreCodes = ['TOK','CAS','EE'];
    const coreSubjects = {};
    for (const s of subjectsAll) {
      const code = norm(s.code || s.name || '');
      if (coreCodes.includes(code)) {
        coreSubjects[code] = s;
      }
    }

    console.log('[auditAndFixCoreDPGroups] subjectsFoundForSchool', {
      count: subjectsAll.length,
      sample_core: coreCodes.map(c => coreSubjects[c] ? { id: coreSubjects[c].id, code: norm(coreSubjects[c].code || coreSubjects[c].name) } : null).filter(Boolean)
    });

    // 2) Query TeachingGroups for TOK/CAS/EE (IN semantics via multiple queries)
    const quotas = { TOK: 2, CAS: 1, EE: 1 };
    const tgsByCode = { TOK: [], CAS: [], EE: [] };

    for (const code of coreCodes) {
      const subj = coreSubjects[code];
      if (!subj) continue;
      const rows = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      // Map details with derived subject ib_level
      tgsByCode[code] = (rows || []).map(tg => ({
        id: tg.id,
        name: tg.name,
        subject_id: tg.subject_id,
        hours_per_week: tg.hours_per_week,
        is_active: tg.is_active,
        // ib_level not in TG schema; derive from subject
        ib_level: subj.ib_level || null,
        year_group: tg.year_group,
        teacher_id: tg.teacher_id || null,
        room_id: tg.preferred_room_id || tg.room_id || null,
      }));
    }

    console.log('[auditAndFixCoreDPGroups] teachingGroups (before)', {
      TOK: { count: tgsByCode.TOK.length, list: tgsByCode.TOK },
      CAS: { count: tgsByCode.CAS.length, list: tgsByCode.CAS },
      EE:  { count: tgsByCode.EE.length,  list: tgsByCode.EE }
    });

    // 3) Create/activate/adjust quotas if missing/incorrect
    const created = [];
    const updated = [];

    for (const code of coreCodes) {
      const subj = coreSubjects[code];
      if (!subj) continue;
      const rows = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });

      if (!rows || rows.length === 0) {
        const tg = await client.entities.TeachingGroup.create({
          school_id,
          name: `${subj.name || code} - DP1+DP2`,
          subject_id: subj.id,
          year_group: 'DP1+DP2',
          hours_per_week: quotas[code],
          is_active: true,
        });
        created.push({ code, teaching_group_id: tg.id });
        console.log('[auditAndFixCoreDPGroups] created TG', { code, id: tg.id, hours_per_week: quotas[code] });
      } else {
        let anyUpdate = false;
        for (const tg of rows) {
          const needsUpdate = (tg.is_active !== true) || (Number(tg.hours_per_week || 0) < quotas[code]) || !String(tg.year_group || '').toUpperCase().includes('DP');
          if (needsUpdate) {
            await client.entities.TeachingGroup.update(tg.id, {
              is_active: true,
              hours_per_week: quotas[code],
              year_group: String(tg.year_group || '').toUpperCase().includes('DP') ? tg.year_group : 'DP1+DP2'
            });
            anyUpdate = true;
            console.log('[auditAndFixCoreDPGroups] updated TG', { code, id: tg.id, hours_per_week: quotas[code] });
          }
        }
        if (anyUpdate) updated.push({ code, updated_count: rows.length });
      }
    }

    // Re-query after modifications
    for (const code of coreCodes) {
      const subj = coreSubjects[code];
      if (!subj) continue;
      const rows = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      const subjIb = subj.ib_level || null;
      tgsByCode[code] = (rows || []).map(tg => ({
        id: tg.id,
        name: tg.name,
        subject_id: tg.subject_id,
        hours_per_week: tg.hours_per_week,
        is_active: tg.is_active,
        ib_level: subjIb,
        year_group: tg.year_group,
        teacher_id: tg.teacher_id || null,
        room_id: tg.preferred_room_id || tg.room_id || null,
      }));
    }

    console.log('[auditAndFixCoreDPGroups] teachingGroups (after)', {
      TOK: { count: tgsByCode.TOK.length, list: tgsByCode.TOK },
      CAS: { count: tgsByCode.CAS.length, list: tgsByCode.CAS },
      EE:  { count: tgsByCode.EE.length,  list: tgsByCode.EE }
    });

    // 4) Rebuild scheduling problem and pull breakdown
    const { data: build } = await base44.asServiceRole.functions.invoke('buildSchedulingProblem', {
      schedule_version_id: `audit_${school_id}`,
      school_id,
    });

    const lessonsCreatedBySubject = build?.stats?.lessonsCreatedBySubject || build?.problem?.lessons?.reduce((acc, l) => {
      const code = norm(l.subject || '');
      acc[code] = (acc[code] || 0) + 1;
      return acc;
    }, {}) || {};

    const breakdown = {
      TOK: lessonsCreatedBySubject['TOK'] || 0,
      CAS: lessonsCreatedBySubject['CAS'] || 0,
      EE: lessonsCreatedBySubject['EE'] || 0,
    };

    return Response.json({
      success: true,
      subjects: Object.fromEntries(coreCodes.map(c => [c, coreSubjects[c] ? { id: coreSubjects[c].id, name: coreSubjects[c].name, ib_level: coreSubjects[c].ib_level } : null ])),
      teaching_groups: {
        TOK: { count: tgsByCode.TOK.length, list: tgsByCode.TOK },
        CAS: { count: tgsByCode.CAS.length, list: tgsByCode.CAS },
        EE:  { count: tgsByCode.EE.length,  list: tgsByCode.EE },
      },
      created,
      updated,
      breakdown
    });
  } catch (error) {
    console.error('auditAndFixCoreDPGroups error:', error);
    return Response.json({ error: error.message || 'Failed to audit/fix core DP groups' }, { status: 500 });
  }
});