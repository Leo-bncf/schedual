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
    const schoolIdFromUser = user?.school_id || user?.data?.school_id;
    const role = user?.role || user?.data?.role;

    if (!user || !schoolIdFromUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Allow limited service-mode bypass (no persistence) when explicitly requested
    const body = await req.json().catch(() => ({}));
    const inputSchoolId = body?.school_id || body?.schoolId || null;
    const run_solver = body?.run_solver === true;
    const bypass_service = !!body?.bypass_service;

    console.log('[diagCoreScheduling] input params', { inputSchoolId, bypass_service, run_solver });

    let school_id = inputSchoolId; // FIX: Changed from const to let (can be reassigned in fallback)
    if (!school_id) {
      return Response.json({ error: 'school_id required in payload' }, { status: 400 });
    }
    console.log('[diagCoreScheduling] schoolIdInput', inputSchoolId, 'schoolIdUsed', school_id);
    const isAdmin = !!(user && user.school_id && user.role === 'admin');
    // Always use service role to ensure deterministic access by school_id
    const client = base44.asServiceRole;
    console.log('[diagCoreScheduling] context', { isAdmin, usingServiceRole: true, school_id_final: school_id });
    if (!client) {
      return Response.json({ error: 'Admin access required or set bypass_service=true' }, { status: 403 });
    }

    // Fetch subjects (active)
    const subjects = await client.entities.Subject.filter({ school_id, is_active: true });
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

    // Logs: subjects found and filters used
    const _coreSubjSample = ['TOK','CAS','EE'].map(code => {
      const subj = subjects.find(s => String(s.code || s.name || '').toUpperCase().includes(code));
      return subj ? { id: subj.id, code: String(subj.code || subj.name || '').toUpperCase() } : null;
    }).filter(Boolean);
    console.log('[diagCoreScheduling] subjectsFoundForSchool', { count: subjects.length, sample_core: _coreSubjSample });
    if ((subjects.length === 0)) {
      try {
        const schools = await base44.asServiceRole.entities.School.list();
        console.log('[diagCoreScheduling] School.list sample', (schools || []).slice(0,5).map(s => ({ id: s.id, name: s.name, created_date: s.created_date })));
      } catch(e) { console.warn('[diagCoreScheduling] School.list sample fetch failed', e?.message); }
    }
    console.log('[diagCoreScheduling] filtersUsed', {
      subjects: { school_id, is_active: true },
      teachingGroups: { school_id, is_active: true },
      dpCriteria: { ib_level: 'DP', year_group_includes: 'DP' }
    });

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
      const tgs = await client.entities.TeachingGroup.filter({ school_id, subject_id: subj.id });
      const active = (tgs || []).filter(tg => tg.is_active === true);
      const summary = active.map(tg => ({ id: tg.id, hours_per_week: tg.hours_per_week, year_group: tg.year_group }));
      verification[key] = { found: true, subject_id: subj.id, subject_code: codeOf(subj), active_count: active.length, active_summary: summary };
    }

    // Always create a fresh draft version for diagnostic (no persistence of slots)
    const createdVersion = await base44.asServiceRole.entities.ScheduleVersion.create({
      school_id,
      name: `Draft (auto)`,
      status: 'draft',
      notes: 'Auto-created for diagnostic preview'
    });
    const schedule_version_id = createdVersion.id;

    // Build scheduling problem (try function; fallback to local build if forbidden)
    let problem, stats;
    try {
      const buildRes = await base44.asServiceRole.functions.invoke('previewOptaPayload', { schedule_version_id });
      const preview = buildRes.data;
      problem = {
        lessons: preview?.payload?.lessons || preview?.filtered?.lessons || [],
        timeslots: [],
      };
      stats = {
        lessonsCreatedBySubject: (preview?.payload?.lessons || preview?.filtered?.lessons || []).reduce((acc, l) => {
          const code = norm(l.subject || '');
          acc[code] = (acc[code] || 0) + 1;
          return acc;
        }, {}),
      };
    } catch (e) {
      // Local fallback (no persistence)
      let schoolArr = await base44.asServiceRole.entities.School.filter({ id: school_id });
      let school = schoolArr?.[0];
      if (!school) {
        const schools = await base44.asServiceRole.entities.School.list();
        if (!schools || schools.length === 0) {
          return Response.json({ error: 'No schools available for fallback builder' }, { status: 404 });
        }
        schools.sort((a,b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        school = schools[0];
        school_id = school.id;
      }

      const [roomsDb, teachersDb, teachingGroupsDb] = await Promise.all([
        client.entities.Room.filter({ school_id, is_active: true }),
        client.entities.Teacher.filter({ school_id, is_active: true }),
        client.entities.TeachingGroup.filter({ school_id, is_active: true })
      ]);

      // Timeslots up to 18:00
      const period_duration = school.period_duration_minutes || 60;
      const school_start = school.school_start_time || '08:00';
      const [sh, sm] = school_start.split(':').map(Number);
      const startM = sh * 60 + sm;
      const endM = 18 * 60; // 18:00
      const totalM = Math.max(endM - startM, period_duration);
      const periods_per_day = Math.max(1, Math.ceil(totalM / period_duration));
      const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
      const timeslots = [];
      let tsId = 1;
      for (const d of DAYS) {
        for (let p = 0; p < periods_per_day; p++) {
          const st = startM + p * period_duration;
          const et = st + period_duration;
          const stH = String(Math.floor(st/60)).padStart(2,'0');
          const stm = String(st%60).padStart(2,'0');
          const etH = String(Math.floor(et/60)).padStart(2,'0');
          const etm = String(et%60).padStart(2,'0');
          timeslots.push({ id: tsId++, dayOfWeek: d, startTime: `${stH}:${stm}`, endTime: `${etH}:${etm}` });
        }
      }

      // Numeric maps for teachers/rooms
      const teacherIdToNumeric = teachersDb.reduce((acc, t, idx) => { acc[t.id] = idx+1; return acc; }, {});
      const roomIdToNumeric = roomsDb.reduce((acc, r, idx) => { acc[r.id] = idx+1; return acc; }, {});
      const teacherNumericIdToBase44Id = {};
      const roomNumericIdToBase44Id = {};
      teachersDb.forEach((t, idx) => { teacherNumericIdToBase44Id[idx+1] = t.id; });
      roomsDb.forEach((r, idx) => { roomNumericIdToBase44Id[idx+1] = r.id; });

      // Lessons from teaching groups
      const lessons = [];
      let lessonId = 1;
      const perSubjectCount = {};
      for (const tg of teachingGroupsDb) {
        if (!tg?.is_active) continue;
        const subj = subjectById[tg.subject_id];
        if (!subj) continue;
        const code = codeOf(subj);
        const weekly = Number(tg.periods_per_week ?? tg.hours_per_week ?? 0); // FIX: Use periods_per_week (migration from hours)
        const teacherNum = tg.teacher_id ? (teacherIdToNumeric[tg.teacher_id] || null) : null;
        const roomNum = tg.preferred_room_id ? (roomIdToNumeric[tg.preferred_room_id] || null) : null;
        for (let k = 0; k < weekly; k++) {
          lessons.push({
            id: lessonId++,
            subject: code,
            studentGroup: `TG_${tg.id}`,
            requiredCapacity: 20,
            timeslotId: null,
            roomId: roomNum,
            teacherId: teacherNum
          });
        }
        perSubjectCount[code] = (perSubjectCount[code] || 0) + weekly;
      }

      problem = { timeslots, lessons, subjectIdByCode, teacherNumericIdToBase44Id, roomNumericIdToBase44Id };

      // Minimal stats for recap
      const expected = {};
      for (const tg of teachingGroupsDb) {
        if (!tg?.is_active) continue;
        const subj = subjectById[tg.subject_id];
        if (!subj) continue;
        const code = codeOf(subj);
        expected[code] = (expected[code] || 0) + Number(tg.hours_per_week || 0);
      }
      const created = {};
      for (const l of lessons) { created[l.subject] = (created[l.subject] || 0) + 1; }
      const missingCore = ['TOK','CAS','EE'].filter(c => (created[c] || 0) === 0);
      stats = {
        timeslots: timeslots.length,
        lessons: lessons.length,
        perSubjectCount,
        periods_per_day,
        expectedLessonsBySubject: expected,
        lessonsCreatedBySubject: created,
        missingCoreSubjects: missingCore
      };
    }
    // If buildSchedulingProblem returned no problem, fallback locally
    if (!problem || !Array.isArray(problem.lessons)) {
      let schoolArr = await base44.asServiceRole.entities.School.filter({ id: school_id });
      let school = schoolArr?.[0];
      if (!school) {
        const schools = await base44.asServiceRole.entities.School.list();
        if (!schools || schools.length === 0) {
          return Response.json({ error: 'No schools available for fallback builder' }, { status: 404 });
        }
        schools.sort((a,b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
        school = schools[0];
        school_id = school.id;
      }

      const [roomsDb, teachersDb, teachingGroupsDb] = await Promise.all([
        client.entities.Room.filter({ school_id, is_active: true }),
        client.entities.Teacher.filter({ school_id, is_active: true }),
        client.entities.TeachingGroup.filter({ school_id, is_active: true })
      ]);

      const period_duration = school.period_duration_minutes || 60;
      const school_start = school.school_start_time || '08:00';
      const [sh, sm] = school_start.split(':').map(Number);
      const startM = sh * 60 + sm;
      const endM = 18 * 60;
      const totalM = Math.max(endM - startM, period_duration);
      const periods_per_day = Math.max(1, Math.ceil(totalM / period_duration));
      const DAYS = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
      const timeslots = [];
      let tsId = 1;
      for (const d of DAYS) {
        for (let p = 0; p < periods_per_day; p++) {
          const st = startM + p * period_duration;
          const et = st + period_duration;
          const stH = String(Math.floor(st/60)).padStart(2,'0');
          const stm = String(st%60).padStart(2,'0');
          const etH = String(Math.floor(et/60)).padStart(2,'0');
          const etm = String(et%60).padStart(2,'0');
          timeslots.push({ id: tsId++, dayOfWeek: d, startTime: `${stH}:${stm}`, endTime: `${etH}:${etm}` });
        }
      }

      const teacherIdToNumeric = teachersDb.reduce((acc, t, idx) => { acc[t.id] = idx+1; return acc; }, {});
      const roomIdToNumeric = roomsDb.reduce((acc, r, idx) => { acc[r.id] = idx+1; return acc; }, {});
      const teacherNumericIdToBase44Id = {};
      const roomNumericIdToBase44Id = {};
      teachersDb.forEach((t, idx) => { teacherNumericIdToBase44Id[idx+1] = t.id; });
      roomsDb.forEach((r, idx) => { roomNumericIdToBase44Id[idx+1] = r.id; });

      const lessons = [];
      let lessonId = 1;
      const perSubjectCount = {};
      const tgsLocal = await client.entities.TeachingGroup.filter({ school_id, is_active: true });
      for (const tg of tgsLocal) {
        if (!tg?.is_active) continue;
        const subj = subjectById[tg.subject_id];
        if (!subj) continue;
        const code = codeOf(subj);
        const weekly = Number(tg.periods_per_week ?? tg.hours_per_week ?? 0); // FIX: Use periods_per_week (migration from hours)
        const teacherNum = tg.teacher_id ? (teacherIdToNumeric[tg.teacher_id] || null) : null;
        const roomNum = tg.preferred_room_id ? (roomIdToNumeric[tg.preferred_room_id] || null) : null;
        for (let k = 0; k < weekly; k++) {
          lessons.push({
            id: lessonId++,
            subject: code,
            studentGroup: `TG_${tg.id}`,
            requiredCapacity: 20,
            timeslotId: null,
            roomId: roomNum,
            teacherId: teacherNum
          });
        }
        perSubjectCount[code] = (perSubjectCount[code] || 0) + weekly;
      }

      problem = { timeslots, lessons, subjectIdByCode, teacherNumericIdToBase44Id, roomNumericIdToBase44Id };
      // Log fallback results
      console.log('[diagCoreScheduling] lessonsCreatedFromTG', { count: lessons.length, breakdown: perSubjectCount });
    }

     // Derive expected/created if not provided
    let expectedLessonsBySubject = stats.expectedLessonsBySubject;
    if (!expectedLessonsBySubject) {
      expectedLessonsBySubject = {};
    }
    if (Object.keys(expectedLessonsBySubject).length === 0) {
      const acc = {};
      const teachingGroupsDb = await client.entities.TeachingGroup.filter({ school_id, is_active: true });
      // DP TGs log sample
      const _dpTGs1 = teachingGroupsDb.filter(tg => {
        const subj = subjectById[tg.subject_id];
        return tg.is_active === true && (String(tg.year_group || '').toUpperCase().includes('DP') || subj?.ib_level === 'DP');
      });
      const _dpSample1 = _dpTGs1.slice(0,3).map(tg => ({ id: tg.id, name: tg.name, subject_id: tg.subject_id, hours_per_week: tg.hours_per_week, is_active: tg.is_active, ib_level: subjectById[tg.subject_id]?.ib_level, year_group: tg.year_group, school_id: tg.school_id }));
      console.log('[diagCoreScheduling] dpTeachingGroupsFound', { count: _dpTGs1.length, sample: _dpSample1 });
      if (_dpTGs1.length === 0) {
        try {
          const schools = await base44.asServiceRole.entities.School.list();
          console.log('[diagCoreScheduling] School.list sample', (schools || []).slice(0,5).map(s => ({ id: s.id, name: s.name, created_date: s.created_date })));
        } catch(e) { console.warn('[diagCoreScheduling] School.list sample fetch failed', e?.message); }
      }
      for (const tg of teachingGroupsDb) {
        const subj = subjectById[tg.subject_id];
        if (!subj) continue;
        const code = codeOf(subj);
        const weekly = Number(tg.periods_per_week ?? tg.hours_per_week ?? 0); // FIX: Use periods_per_week (migration from hours)
        acc[code] = (acc[code] || 0) + weekly;
      }
      expectedLessonsBySubject = acc;
    }

    let lessonsCreatedBySubject = stats.lessonsCreatedBySubject;
    if (!lessonsCreatedBySubject) {
      lessonsCreatedBySubject = {};
    }
    if (Object.keys(lessonsCreatedBySubject).length === 0) {
      const acc = {};
      for (const l of (problem?.lessons || [])) {
        const code = norm(l.subject || '');
        acc[code] = (acc[code] || 0) + 1;
      }
      lessonsCreatedBySubject = acc;
      console.log('[diagCoreScheduling] lessonsCreatedFromTG', { count: (problem?.lessons?.length || 0), breakdown: lessonsCreatedBySubject });
    }

    const missingCoreSubjects = stats.missingCoreSubjects || (['TOK','CAS','EE'].filter(k => (lessonsCreatedBySubject[k] || 0) === 0));

    // Compute DP totals and underfilled_days (approximation without solver)
    const dpTarget = 9; // as requested for diagnostic
    const dpDaysPerWeek = 5;
    const teachingGroupsDb = await client.entities.TeachingGroup.filter({ school_id, is_active: true });
    const isDPGroup = (tg) => String(tg.year_group || '').toUpperCase().includes('DP') || (subjectById[tg.subject_id]?.ib_level === 'DP');
    const dpTgIds = new Set(teachingGroupsDb.filter(isDPGroup).map(t => t.id));

    // created lessons for DP (from problem.lessons using TG_ prefix)
    let createdLessonsForDp = 0;
    const perGroupWeekly = {};
    for (const l of (problem?.lessons || [])) {
      const sg = String(l.studentGroup || '');
      if (sg.startsWith('TG_')) {
        const id = sg.slice(3);
        if (dpTgIds.has(id)) {
          createdLessonsForDp += 1;
          perGroupWeekly[id] = (perGroupWeekly[id] || 0) + 1;
        }
      }
    }
    const targetPerGroupWeekly = dpTarget * dpDaysPerWeek;
    const underfilledDays = Object.values(perGroupWeekly).reduce((acc, weekly) => {
      const deficit = Math.max(0, targetPerGroupWeekly - weekly);
      const days = Math.ceil(deficit / dpTarget);
      return acc + days;
    }, 0);

    // Sample core lessons from problem (pre-solver)
    let coreSamples = { TOK: [], CAS: [], EE: [] }; // FIX: Changed from const to let (can be reassigned after solver)
    for (const l of (problem?.lessons || [])) {
      const code = norm(l.subject || '');
      if (coreSamples[code] && coreSamples[code].length < 5) {
        coreSamples[code].push({ subject: code, studentGroup: l.studentGroup, teacherId: l.teacherId, roomId: l.roomId });
      }
    }

    // Off-by-one check per subject against expected
    const offByOneIssues = {};
    for (const [code, exp] of Object.entries(expectedLessonsBySubject)) {
      const got = lessonsCreatedBySubject[code] || 0;
      const diff = got - exp;
      if (diff !== 0) offByOneIssues[code] = { expected: exp, created: got, diff };
    }

    // Optionally run solver and then compute inserted counts per subject
    let insertedCountBySubject = null;
    if (run_solver) {
      await base44.asServiceRole.functions.invoke('generateSchedule', { schedule_version_id });
      const allSlots = await client.entities.ScheduleSlot.filter({ school_id, schedule_version: schedule_version_id });
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
      school_id,
      dp_target_periods_per_day: 9,
      recap: {
        expected_lessons_for_dp: stats.expected_lessons_for_dp,
        created_lessons_for_dp: createdLessonsForDp,
        missing_core_subjects: missingCoreSubjects,
        underfilled_days: underfilledDays,
        core_lessons_sample: coreSamples,
        off_by_one_issues: offByOneIssues
      },
      details: {
        expectedLessonsBySubject,
        lessonsCreatedBySubject
      },
      insertedCountBySubject
    });
  } catch (error) {
    console.error('diagCoreScheduling error:', error);
    return Response.json({ error: error.message || 'Failed to run diagnostics' }, { status: 500 });
  }
});