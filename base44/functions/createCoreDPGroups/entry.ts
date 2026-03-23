import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Create DP TeachingGroups for core subjects TOK/CAS/EE with fixed weekly quotas
// TOK=2h, CAS=1h, EE=1h; year_group: "DP1+DP2"; teacher/room optional
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const bodyText = await req.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const providedSchoolId = body.school_id;

    const user = await base44.auth.me();
    if (!user && !providedSchoolId) {
      return Response.json({ error: 'Unauthorized', code: 'NO_USER' }, { status: 401 });
    }

    const client = base44;
    const school_id = providedSchoolId || user?.school_id;
    if (!school_id) {
      return Response.json({ error: 'Forbidden: user missing school_id', code: 'NO_SCHOOL_ON_USER' }, { status: 403 });
    }

    // Fetch core subjects for DP
    const subjects = await client.entities.Subject.filter({ school_id, is_active: true });
    const subjectByCode = new Map();
    for (const s of subjects) {
      const code = String(s.code || '').trim().toUpperCase();
      subjectByCode.set(code, s);
    }

    // Minutes per week for core subjects
    const quotas = { TOK: 60, CAS: 60, EE: 60 }; // 1h each
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
          hoursPerWeekHL: 1,
          hoursPerWeekSL: 1,
          combine_dp1_dp2: false,
          is_active: true
        });
        subjectByCode.set(code, created);
        subjects_created.push({ code, id: created.id });
        console.log('[createCoreDPGroups] created Subject', { code, id: created.id });
      }
    }

    // Fetch DP students by year group for separate TGs
    const dp1Students = await client.asServiceRole.entities.Student.filter({ school_id, year_group: 'DP1', is_active: true });
    const dp2Students = await client.asServiceRole.entities.Student.filter({ school_id, year_group: 'DP2', is_active: true });
    const dp1StudentIds = (dp1Students || []).map(s => s.id);
    const dp2StudentIds = (dp2Students || []).map(s => s.id);

    const created = [];
    const updated = [];
    const skipped = [];

    for (const code of targets) {
      const subj = subjectByCode.get(code);
      const existing = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      
      // Delete old combined groups (year_group='DP1,DP2')
      for (const tg of (existing || [])) {
        if (tg.year_group === 'DP1,DP2' || tg.year_group === 'DP1+DP2') {
          await client.asServiceRole.entities.TeachingGroup.delete(tg.id);
          console.log('[createCoreDPGroups] deleted old combined TG', { code, id: tg.id });
        }
      }

      // Create separate DP1 and DP2 groups
      const yearGroups = [
        { year: 'DP1', studentIds: dp1StudentIds },
        { year: 'DP2', studentIds: dp2StudentIds }
      ];

      for (const { year, studentIds } of yearGroups) {
        if (studentIds.length === 0) continue; // Skip if no students

        const existingForYear = await client.entities.TeachingGroup.filter({ 
          school_id, 
          subject_id: subj.id,
          year_group: year
        });

        if (existingForYear && existingForYear.length > 0) {
          // Update existing
          for (const tg of existingForYear) {
            await client.asServiceRole.entities.TeachingGroup.update(tg.id, { 
              is_active: true, 
              minutes_per_week: quotas[code],
              student_ids: studentIds
            });
            console.log('[createCoreDPGroups] updated TG', { code, year, id: tg.id, students: studentIds.length });
          }
          updated.push({ code, year, updated_count: existingForYear.length });
        } else {
          // Create new
          const tg = await client.entities.TeachingGroup.create({
            school_id,
            name: `${subj.name} - ${year}`,
            subject_id: subj.id,
            year_group: year,
            level: 'Standard',
            minutes_per_week: quotas[code],
            student_ids: studentIds,
            is_active: true
          });
          console.log('[createCoreDPGroups] created TG', { code, year, id: tg.id, students: studentIds.length });
          created.push({ code, year, teaching_group_id: tg.id });
        }
      }
    }

    // Verification logs
    const verification = {};
    for (const code of targets) {
      const subj = subjectByCode.get(code);
      const tgs = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      const active = (tgs || []).filter(tg => tg.is_active === true);
      const summary = active.map(tg => ({ id: tg.id, minutes_per_week: tg.minutes_per_week, year_group: tg.year_group }));
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