import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Diagnostic function to verify core subjects (TOK/CAS/EE) flow end-to-end
// - Verifies TeachingGroups for core subjects (active, hours/week)
// - Builds scheduling problem and reports expected vs created lessons per subject
// - Optionally triggers solver and then reports inserted slots by subject (with core samples)
//
// Request body (all optional):
// { schedule_version_id?: string, run_solver?: boolean }
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.school_id || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    const school_id = user.school_id;

    const { schedule_version_id: bodyVid, run_solver = false } = await req.json().catch(() => ({ run_solver: false }));

    // Fetch subjects (active)
    const subjects = await base44.entities.Subject.filter({ school_id, is_active: true });
    const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const codeOf = (subj) => norm(subj.code || subj.name || subj.id);

    const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));
    const subjectIdByCode = {};
    for (const s of subjects) {
      const c1 = (s.code || '').toUpperCase();
      const c2 = codeOf(s);
      const c3 = c2.replace(/_/g, ' ');
      [c1, c2, c3].filter(Boolean).forEach(k => { subjectIdByCode[k] = s.id; });
    }

    // Identify TOK/CAS/EE by code heuristics or is_core flag
    const coreTargetCodes = ['TOK','CAS','EE'];
    const coreSubjects = {};
    for (const s of subjects) {
      const code = codeOf(s);
      if (coreTargetCodes.some(k => code.includes(k)) || s.is_core === true) {
        if (code.includes('TOK')) coreSubjects['TOK'] = s;
        if (code.includes('CAS')) coreSubjects['CAS'] = s;
        if (code.includes('EE')) coreSubjects['EE'] = s;
      }
    }

    // TeachingGroup verification
    const verification = {};
    for (const key of coreTargetCodes) {
      const subj = coreSubjects[key];
      if (!subj) {
        verification[key] = { found: false };
        continue;
      }
      const tgs = await base44.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      const active = (tgs || []).filter(tg => tg.is_active === true);
      const summary = active.map(tg => ({ id: tg.id, hours_per_week: tg.hours_per_week, year_group: tg.year_group }));
      verification[key] = { found: true, subject_id: subj.id, subject_code: codeOf(subj), active_count: active.length, active_summary: summary };
    }

    // Determine schedule version: use provided or latest for school
    let schedule_version_id = bodyVid || null;
    if (!schedule_version_id) {
      const versions = await base44.entities.ScheduleVersion.filter({ school_id });
      versions.sort((a,b) => new Date(b.created_date || b.generated_at || 0) - new Date(a.created_date || a.generated_at || 0));
      schedule_version_id = versions[0]?.id || null;
    }

    if (!schedule_version_id) {
      return Response.json({
        success: true,
        note: 'No ScheduleVersion found for school',
        verification
      });
    }

    // Build scheduling problem
    const buildRes = await base44.functions.invoke('buildSchedulingProblem', { schedule_version_id });
    const problem = buildRes.data.problem;
    const stats = buildRes.data.stats || {};

    // Derive expected/created if not provided
    let expectedLessonsBySubject = stats.expectedLessonsBySubject;
    if (!expectedLessonsBySubject) {
      const acc = {};
      const teachingGroupsDb = await base44.entities.TeachingGroup.filter({ school_id, is_active: true });
      for (const tg of teachingGroupsDb) {
        const subj = subjectById[tg.subject_id];
        if (!subj) continue;
        const code = codeOf(subj);
        const weekly = Number(tg.hours_per_week || 0);
        acc[code] = (acc[code] || 0) + weekly;
      }
      expectedLessonsBySubject = acc;
    }

    let lessonsCreatedBySubject = stats.lessonsCreatedBySubject;
    if (!lessonsCreatedBySubject) {
      const acc = {};
      for (const l of (problem?.lessons || [])) {
        const code = norm(l.subject || '');
        acc[code] = (acc[code] || 0) + 1;
      }
      lessonsCreatedBySubject = acc;
    }

    const missingCoreSubjects = stats.missingCoreSubjects || (['TOK','CAS','EE'].filter(k => (lessonsCreatedBySubject[k] || 0) === 0));

    // Optionally run solver and then compute inserted counts per subject
    let insertedCountBySubject = null;
    let coreSamples = null;
    if (run_solver) {
      await base44.functions.invoke('callORToolScheduler', { schedule_version_id });
      const allSlots = await base44.entities.ScheduleSlot.filter({ school_id, schedule_version: schedule_version_id });
      const codeBySubjectId = {};
      Object.entries(subjectIdByCode).forEach(([code, id]) => { codeBySubjectId[id] = code; });
      insertedCountBySubject = {};
      coreSamples = { TOK: [], CAS: [], EE: [] };
      for (const s of allSlots) {
        const code = s.subject_id ? (codeBySubjectId[s.subject_id] || 'UNKNOWN') : (s.notes?.includes('Study') ? 'STUDY' : 'UNKNOWN');
        insertedCountBySubject[code] = (insertedCountBySubject[code] || 0) + 1;
        if (coreSamples[code] && coreSamples[code].length < 5) {
          coreSamples[code].push({ day: s.day, period: s.period, teacher_id: s.teacher_id, room_id: s.room_id, teaching_group_id: s.teaching_group_id });
        }
      }
    }

    return Response.json({
      success: true,
      schedule_version_id,
      verification,
      expectedLessonsBySubject,
      lessonsCreatedBySubject,
      missingCoreSubjects,
      insertedCountBySubject,
      coreSamples
    });
  } catch (error) {
    console.error('diagCoreScheduling error:', error);
    return Response.json({ error: error.message || 'Failed to run diagnostics' }, { status: 500 });
  }
});