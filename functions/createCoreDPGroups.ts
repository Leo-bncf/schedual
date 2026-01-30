import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Create DP TeachingGroups for core subjects TOK/CAS/EE with fixed weekly quotas
// TOK=2h, CAS=1h, EE=1h; year_group: "DP1+DP2"; teacher/room optional
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'NO_USER' }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ error: 'Forbidden: user missing school_id', code: 'NO_SCHOOL_ON_USER' }, { status: 403 });
    }

    const client = base44;
    const school_id = user.school_id;

    // Fetch core subjects for DP
    const subjects = await client.entities.Subject.filter({ school_id, is_active: true });
    const subjectByCode = new Map();
    for (const s of subjects) {
      const code = String(s.code || '').trim().toUpperCase();
      subjectByCode.set(code, s);
    }

    const quotas = { TOK: 2, CAS: 1, EE: 1 };
    const targets = Object.keys(quotas);

    const missing = targets.filter(code => !subjectByCode.has(code));
    const subjects_created = [];
    if (missing.length > 0) {
      for (const code of missing) {
        const nameByCode = { TOK: 'Theory of Knowledge', CAS: 'Creativity, Activity, Service', EE: 'Extended Essay' };
        const created = await client.entities.Subject.create({
          school_id,
          name: nameByCode[code] || code,
          code,
          ib_level: 'DP',
          is_core: true,
          is_active: true
        });
        subjectByCode.set(code, created);
        subjects_created.push({ code, id: created.id });
        console.log('[createCoreDPGroups] created Subject', { code, id: created.id });
      }
    }

    // Check existing TGs and create if absent
    const created = [];
    const updated = [];
    const skipped = [];

    for (const code of targets) {
      const subj = subjectByCode.get(code);
      const existing = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      let updatedAny = false;
      if (existing && existing.length > 0) {
        for (const tg of existing) {
          const needsUpdate = (tg.is_active !== true) || (!tg.hours_per_week || tg.hours_per_week < quotas[code]);
          if (needsUpdate) {
            await client.entities.TeachingGroup.update(tg.id, { is_active: true, hours_per_week: quotas[code] });
            console.log('[createCoreDPGroups] updated TG', { code, id: tg.id, hours_per_week: quotas[code] });
            updatedAny = true;
          }
        }
        if (updatedAny) {
          updated.push({ code, updated_count: existing.length });
        } else {
          skipped.push({ code, reason: 'already_satisfies_quota', existing_count: existing.length });
        }
        continue;
      }

      const tg = await client.entities.TeachingGroup.create({
        school_id,
        name: `${subj.name} - DP1+DP2`,
        subject_id: subj.id,
        year_group: 'DP1+DP2',
        hours_per_week: quotas[code],
        is_active: true
        // teacher_id optional (omit)
        // preferred_room_id optional (omit)
      });
      console.log('[createCoreDPGroups] created TG', { code, id: tg.id, hours_per_week: quotas[code] });
      created.push({ code, teaching_group_id: tg.id });
    }

    // Auto-enroll all DP students into core TGs (TOK/CAS/EE)
    const dpStudents = await client.entities.Student.filter({ school_id, ib_programme: 'DP', is_active: true });
    // Include both DP1 and DP2 regardless of classgroup membership
    const dpStudentIds = (dpStudents || []).map(s => s.id);
    const coreSubjectIds = targets.map(code => subjectByCode.get(code)?.id).filter(Boolean);
    const allTGs = await client.entities.TeachingGroup.filter({ school_id, is_active: true });
    let enrollUpdated = 0;
    for (const tg of (allTGs || [])) {
      if (!coreSubjectIds.includes(tg.subject_id)) continue;
      const current = Array.isArray(tg.student_ids) ? tg.student_ids : [];
      const merged = Array.from(new Set([...(current || []), ...dpStudentIds]));
      if (merged.length !== current.length) {
        await client.entities.TeachingGroup.update(tg.id, { student_ids: merged });
        enrollUpdated++;
      }
    }
    console.log('[createCoreDPGroups] auto-enroll DP students into core TGs', { dp_students: dpStudentIds.length, groups_updated: enrollUpdated });

    // Verification logs
    const verification = {};
    for (const code of targets) {
      const subj = subjectByCode.get(code);
      const tgs = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      const active = (tgs || []).filter(tg => tg.is_active === true);
      const summary = active.map(tg => ({ id: tg.id, hours_per_week: tg.hours_per_week, year_group: tg.year_group }));
      verification[code] = { subject_id: subj.id, subject_ib_level: subj.ib_level, total: (tgs || []).length, active_count: active.length, active_summary: summary };
      console.log('[createCoreDPGroups] verification', code, verification[code]);
    }

    return Response.json({
      success: true,
      created_count: created.length,
      updated_count: updated.length,
      created,
      updated,
      skipped,
      verification
    });
  } catch (error) {
    console.error('createCoreDPGroups error:', error);
    return Response.json({ error: error.message || 'Failed to create core DP groups' }, { status: 500 });
  }
});