import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Create DP TeachingGroups for core subjects TOK/CAS/EE with fixed weekly quotas
// TOK=2h, CAS=1h, EE=1h; year_group: "DP1+DP2"; teacher/room optional
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    let user = null;
    try { user = await base44.auth.me(); } catch (_) { user = null; }

    const { bypass_service = false, school_id: inputSchoolId } = await req.json().catch(() => ({ bypass_service: false }));

    let client = null;
    let school_id = user?.school_id || null;

    if (user && user.school_id && user.role === 'admin') {
      client = base44;
    } else if (bypass_service) {
      client = base44.asServiceRole;
      school_id = school_id || inputSchoolId || null;
      if (!school_id) {
        const schools = await client.entities.School.list();
        if (!schools || schools.length === 0) {
          return Response.json({ error: 'No schools available' }, { status: 404 });
        }
        schools.sort((a,b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        school_id = schools[0].id;
      }
    } else {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

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
    if (missing.length > 0) {
      return Response.json({
        success: false,
        message: 'Missing DP core subjects in this school',
        missing_codes: missing
      }, { status: 400 });
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