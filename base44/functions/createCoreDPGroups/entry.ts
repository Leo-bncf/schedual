import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Create DP TeachingGroups for core subjects TOK/EE with fixed weekly quotas
// year_group: "DP1+DP2"; teacher/room optional
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
    const getSubjectMinutes = (subject) => {
      const sessionsPerWeek = Number(subject?.sessions_per_week || 0);
      const hoursPerSession = Number(subject?.hours_per_session || 0);
      if (sessionsPerWeek > 0 && hoursPerSession > 0) return sessionsPerWeek * hoursPerSession * 60;
      if (Number(subject?.standard_hours_per_week || 0) > 0) return Number(subject.standard_hours_per_week) * 60;
      return 60;
    };
    const targets = ['TOK', 'EE'];

    const missing = targets.filter(code => !subjectByCode.has(code));
    const subjects_created = [];
    if (missing.length > 0) {
      for (const code of missing) {
        const nameByCode = { TOK: 'Theory of Knowledge', EE: 'Extended Essay' };
        const created = await client.entities.Subject.create({
          school_id,
          name: nameByCode[code] || code,
          code,
          ib_level: 'DP',
          standard_hours_per_week: 1,
          sessions_per_week: 0,
          hours_per_session: 0,
          is_core: true,
          combine_dp1_dp2: false,
          is_active: true
        });
        subjectByCode.set(code, created);
        subjects_created.push({ code, id: created.id });
        console.log('[createCoreDPGroups] created Subject', { code, id: created.id });
      }
    }

    const casSubject = subjectByCode.get('CAS');
    if (casSubject) {
      const casTeachingGroups = await client.asServiceRole.entities.TeachingGroup.filter({ school_id, subject_id: casSubject.id });
      const casSlots = await client.asServiceRole.entities.ScheduleSlot.filter({ school_id, subject_id: casSubject.id });

      await Promise.all((casSlots || []).map((slot) => client.asServiceRole.entities.ScheduleSlot.delete(slot.id)));
      await Promise.all((casTeachingGroups || []).map((tg) => client.asServiceRole.entities.TeachingGroup.delete(tg.id)));
      await client.asServiceRole.entities.Subject.delete(casSubject.id);
      subjectByCode.delete('CAS');
      console.log('[createCoreDPGroups] deleted CAS subject and related records', {
        subjectId: casSubject.id,
        teachingGroups: casTeachingGroups.length,
        scheduleSlots: casSlots.length,
      });
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
              teacher_id: subj.supervisor_teacher_id || null,
              minutes_per_week: getSubjectMinutes(subj),
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
            teacher_id: subj.supervisor_teacher_id || null,
            minutes_per_week: getSubjectMinutes(subj),
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