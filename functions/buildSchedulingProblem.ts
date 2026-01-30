import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Build scheduling problem exclusively from subjectRequirements
// Input JSON:
// {
//   schedule_version_id: string,
//   subjectRequirements: Array<{
//     subject_id?: string,      // Base44 subject id (preferred)
//     subject_code?: string,    // Fallback: raw code or name to normalize
//     teaching_group_id?: string,
//     classgroup_id?: string,
//     student_group?: string,   // Free label if not using ids
//     weeklyCount: number,      // REQUIRED: number of weekly sessions
//     requiredCapacity?: number,
//     teacher_id?: string,
//     room_id?: string
//   }>
// }
// Output: { success, problem: { timeslots, rooms, teachers, lessons }, stats }
// Notes:
// - lessons[] is created by duplicating a single entry weeklyCount times with unique IDs
// - subjects sent to solver are Base44-normalized codes (e.g., "AN A" -> "AN_A")
// - reverse mapping to subject_id is handled downstream (callORToolScheduler) using DB subjects
// - We DO NOT derive lessons from ScheduleSlots or any other logic

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_) {
      user = null;
    }

    const body = await req.json();
    const schedule_version_id = body?.schedule_version_id; // may be used to derive school_id when no user
    const subjectRequirements = Array.isArray(body?.subjectRequirements) ? body.subjectRequirements : null;
    const overrideSchoolId = body?.school_id || null;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }


    let school_id = overrideSchoolId || user?.school_id || null;
    if (!school_id) {
      if (!schedule_version_id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const sv = await base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version_id });
      school_id = sv?.[0]?.school_id;
      if (!school_id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Choose client based on access to the target school
    const client = (user && user.school_id === school_id) ? base44 : base44.asServiceRole;
    console.log('[buildSchedulingProblem] context', { usingServiceRole: client === base44.asServiceRole, receivedOverrideSchoolId: overrideSchoolId, school_id });

    // Fetch school + resources for mapping (rooms/teachers for numeric IDs, subjects for code normalization)
    const [school, roomsDb, teachersDb, subjectsDb, teachingGroupsDb] = await Promise.all([
              client.entities.School.filter({ id: school_id }).then((r) => r[0]),
              client.entities.Room.filter({ school_id, is_active: true }),
              client.entities.Teacher.filter({ school_id, is_active: true }),
              client.entities.Subject.filter({ school_id, is_active: true }),
              client.entities.TeachingGroup.filter({ school_id, is_active: true }),
            ]);

    // Logs: filters used
    console.log('[buildSchedulingProblem] filtersUsed', {
      subjects: { school_id, is_active: true },
      teachingGroups: { school_id, is_active: true },
      dpCriteria: { ib_level: 'DP', year_group_includes: 'DP' }
    });

    // Logs: subjects found + TOK/CAS/EE sample
    const _coreSubjSample = ['TOK','CAS','EE'].map(code => {
      const subj = subjectsDb.find(s => String(s.code || s.name || '').toUpperCase().includes(code));
      return subj ? { id: subj.id, code: String(subj.code || subj.name || '').toUpperCase() } : null;
    }).filter(Boolean);
    console.log('[buildSchedulingProblem] subjectsFoundForSchool', { count: subjectsDb.length, sample_core: _coreSubjSample });
    if (subjectsDb.length === 0) {
      try {
        const schools = await base44.asServiceRole.entities.School.list();
        console.log('[buildSchedulingProblem] School.list sample', (schools || []).slice(0,5).map(s => ({ id: s.id, name: s.name, created_date: s.created_date })));
      } catch(e) { console.warn('[buildSchedulingProblem] School.list sample fetch failed', e?.message); }
    }

    // Logs: DP TeachingGroups sample
    const _dpTGs = teachingGroupsDb.filter(tg => {
      const subj = subjectsDb.find(s => s.id === tg.subject_id);
      return tg.is_active === true && (String(tg.year_group || '').toUpperCase().includes('DP') || subj?.ib_level === 'DP');
    });
    const _dpSample = _dpTGs.slice(0,3).map(tg => {


      const subj = subjectsDb.find(s => s.id === tg.subject_id);
      return { id: tg.id, name: tg.name, subject_id: tg.subject_id, hours_per_week: tg.hours_per_week, is_active: tg.is_active, ib_level: subj?.ib_level, year_group: tg.year_group, school_id: tg.school_id };
    });
    console.log('[buildSchedulingProblem] dpTeachingGroupsFound', { count: _dpTGs.length, sample: _dpSample });
    if (_dpTGs.length === 0) {
      try {
        const schools = await base44.asServiceRole.entities.School.list();
        console.log('[buildSchedulingProblem] School.list sample', (schools || []).slice(0,5).map(s => ({ id: s.id, name: s.name, created_date: s.created_date })));
      } catch(e) { console.warn('[buildSchedulingProblem] School.list sample fetch failed', e?.message); }
    }

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Helpers
    const normalizeSubjectCode = (raw) => {
      if (!raw) return null;
      const s = String(raw)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      return s || null;
    };

    // Build subject id -> normalized code map
    const subjectIdToCode = {};
    const subjectRawCode = {};
    subjectsDb.forEach((subj) => {
      const raw = (subj.code || subj.name || subj.id).toString().trim();
      subjectRawCode[subj.id] = raw;
      subjectIdToCode[subj.id] = normalizeSubjectCode(raw); // e.g., AN A -> AN_A
    });

    // Build code -> subject.id map with aliases (space/underscore + raw uppercase)
    const subjectIdByCode = {};
    subjectsDb.forEach((subj) => {
      const raw = subjectRawCode[subj.id] || '';
      const upperRaw = raw.toUpperCase(); // preserve original spacing if any
      const normUnderscore = subjectIdToCode[subj.id]; // AN_A
      const spaceAlias = normUnderscore ? normUnderscore.replace(/_/g, ' ') : null; // AN A
      const keys = new Set([upperRaw, normUnderscore, spaceAlias].filter(Boolean));
      keys.forEach((k) => { subjectIdByCode[k] = subj.id; });
    });

    // Subject lookup by id
    const subjectById = {};
    subjectsDb.forEach((s) => { subjectById[s.id] = s; });

    // Build timeslots up to 18:00 using school config
    const period_duration = school.period_duration_minutes || 60;
    const school_start = school.school_start_time || '08:00';
    const school_end = '18:00';

    const [startHour, startMin] = school_start.split(':').map(Number);
    const [endHour, endMin] = school_end.split(':').map(Number);
    const schoolStartMinutes = startHour * 60 + startMin;
    const schoolEndMinutes = endHour * 60 + endMin;

    const totalMinutes = schoolEndMinutes - schoolStartMinutes;
    const periods_per_day = Math.max(1, Math.ceil(totalMinutes / period_duration));

    const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const timeslots = [];
    let timeslotId = 1;
    console.log('[buildSchedulingProblem] periods_per_day computed =', periods_per_day, 'start', school_start, 'duration', period_duration);
    for (const day of DAYS) {
      for (let p = 0; p < periods_per_day; p++) {
        const periodStart = schoolStartMinutes + p * period_duration;
        const periodEnd = periodStart + period_duration;
        const startTime = `${String(Math.floor(periodStart / 60)).padStart(2, '0')}:${String(periodStart % 60).padStart(2, '0')}`;
        const endTime = `${String(Math.floor(periodEnd / 60)).padStart(2, '0')}:${String(periodEnd % 60).padStart(2, '0')}`;
        timeslots.push({ id: timeslotId++, dayOfWeek: day, startTime, endTime });
      }
    }

    // Rooms/Teachers in numeric-id format (keep order stable for downstream mapping by index)
    const rooms = roomsDb.map((r, idx) => ({ id: idx + 1, name: r.name || `Room ${idx + 1}`, capacity: r.capacity || 0 }));
    const teachers = teachersDb.map((t, idx) => ({ id: idx + 1, name: t.full_name || `Teacher ${idx + 1}` }));

    // Build id -> numeric maps for teacher/room
    const teacherIdToNumeric = teachersDb.reduce((acc, t, idx) => {
      acc[t.id] = idx + 1;
      return acc;
    }, {});
    const roomIdToNumeric = roomsDb.reduce((acc, r, idx) => {
      acc[r.id] = idx + 1;
      return acc;
    }, {});

    // Build lessons exclusively from TeachingGroups (active)
    const lessons = [];
    let lessonId = 1;
    const dpTargetPeriodsPerDay = Number((body?.dp_target_periods_per_day ?? Deno.env.get('DP_TARGET_PERIODS_PER_DAY') ?? 8));
    const dpDaysPerWeek = 5;
    const studyTargetWeekly = Number(Deno.env.get('DP_STUDY_WEEKLY') || 0);
    let dpGroupsCount = 0;
    const perSubjectCount = {};

    // Numeric → Base44 ID maps for solver payload
    const teacherNumericIdToBase44Id = {};
    const roomNumericIdToBase44Id = {};
    teachersDb.forEach((t, idx) => { teacherNumericIdToBase44Id[idx + 1] = t.id; });
    roomsDb.forEach((r, idx) => { roomNumericIdToBase44Id[idx + 1] = r.id; });

    // Optional external references for traceability (solver/debug)
    const teacherNumericIdToExternalRef = {};
    const roomNumericIdToExternalRef = {};
    teachersDb.forEach((t, idx) => { 
      teacherNumericIdToExternalRef[idx + 1] = t.external_id || t.externalId || t.employee_id || t.id; 
    });
    roomsDb.forEach((r, idx) => { 
      roomNumericIdToExternalRef[idx + 1] = r.external_id || r.externalId || r.id; 
    });

    for (let i = 0; i < teachingGroupsDb.length; i++) {
      const tg = teachingGroupsDb[i];
      if (!tg?.is_active) continue;

      const subjectCode = subjectIdToCode[tg.subject_id];
      if (!subjectCode) continue; // skip if subject not resolvable

      const weeklyCount = Number(tg.hours_per_week || 1);
      const teacherNumericId = tg.teacher_id ? (teacherIdToNumeric[tg.teacher_id] || null) : null;
      const roomNumericId = tg.preferred_room_id ? (roomIdToNumeric[tg.preferred_room_id] || null) : null;

      const studentGroup = `TG_${tg.id}`;
      const capacity = 20; // keep default; can be enhanced later

      // Real lessons from the teaching group
      for (let k = 0; k < weeklyCount; k++) {
        lessons.push({
          id: lessonId++,
          subject: subjectCode, // canonical subject code
          studentGroup,
          requiredCapacity: capacity,
          timeslotId: null,
          roomId: roomNumericId || null,
          teacherId: teacherNumericId || null,
        });
      }
      perSubjectCount[subjectCode] = (perSubjectCount[subjectCode] || 0) + weeklyCount;

      // STUDY filler for DP only (hybrid weekly target)
      const isDP = String(tg.year_group || '').toUpperCase().includes('DP') || ((subjectById[tg.subject_id]?.ib_level || '') === 'DP');
      if (isDP) { dpGroupsCount++; }
      if (isDP) {
        const realTotal = weeklyCount;
        const studyWeeklyCount = Math.max(0, studyTargetWeekly - realTotal);
        for (let s = 0; s < studyWeeklyCount; s++) {
          lessons.push({
            id: lessonId++,
            subject: 'STUDY',
            studentGroup,
            requiredCapacity: capacity,
            timeslotId: null,
            roomId: null,
            teacherId: null,
            isStudy: true,
            softConstraints: { maxConsecutive: 2, preferAfternoon: true }
          });
        }
        if (studyWeeklyCount > 0) {
          perSubjectCount['STUDY'] = (perSubjectCount['STUDY'] || 0) + studyWeeklyCount;
        }
      }
    }

    // Logs required: total lessons + count by subject code (before POST /solve)
    const uniqueLessonSubjects = Array.from(new Set(lessons.map(l => l.subject))).sort();
    const mappingKeys = Object.keys(subjectIdByCode).sort();
    const missingSubjects = uniqueLessonSubjects.filter(s => s !== 'STUDY' && !subjectIdByCode[s]);

    // Expected vs created lessons by subject
    const expectedLessonsBySubject = {};
    for (const tg of teachingGroupsDb) {
      if (!tg?.is_active) continue;
      const code = subjectIdToCode[tg.subject_id];
      if (!code) continue;
      const weeklyCount = Number(tg.hours_per_week || 0);
      expectedLessonsBySubject[code] = (expectedLessonsBySubject[code] || 0) + weeklyCount;
    }
    const lessonsCreatedBySubject = {};
    for (const l of lessons) {
      const code = l.subject;
      lessonsCreatedBySubject[code] = (lessonsCreatedBySubject[code] || 0) + 1;
    }
    const coreCodes = ['TOK','CAS','EE'];
    const missingCoreSubjects = coreCodes.filter(c => (lessonsCreatedBySubject[c] || 0) === 0);

    console.log('[buildSchedulingProblem] lessonsCreatedFromTG', { count: lessons.length, breakdown: perSubjectCount });
    console.log('[buildSchedulingProblem] lessons total =', lessons.length);
    console.log('[buildSchedulingProblem] lessons per subject =', perSubjectCount);
    console.log('[buildSchedulingProblem] expectedLessonsBySubject =', expectedLessonsBySubject);
    console.log('[buildSchedulingProblem] lessonsCreatedBySubject =', lessonsCreatedBySubject);
    console.log('[buildSchedulingProblem] subjectIdByCode size =', mappingKeys.length);
    console.log('[buildSchedulingProblem] lesson subjects =', uniqueLessonSubjects);
    console.log('[buildSchedulingProblem] mapping keys =', mappingKeys);
    if (missingSubjects.length > 0) {
      console.warn('[buildSchedulingProblem] UNMAPPED subjects =', missingSubjects);
    }
    if (missingCoreSubjects.length > 0) {
      console.warn('[buildSchedulingProblem] missingCoreSubjects =', missingCoreSubjects);
    }

    const problem = { 
      timeslots, 
      rooms, 
      teachers, 
      lessons, 
      subjectIdByCode,
      teacherNumericIdToBase44Id,
      roomNumericIdToBase44Id,
      teacherNumericIdToExternalRef,
      roomNumericIdToExternalRef
    };
    // Debug summary for core subjects
    const dbgCreatedCore = { TOK: lessons.filter(l => l.subject === 'TOK').length, CAS: lessons.filter(l => l.subject === 'CAS').length, EE: lessons.filter(l => l.subject === 'EE').length };
    console.log('[buildSchedulingProblem] core lessons created =', dbgCreatedCore);

    return Response.json({
      success: true,
      problem,
      subjectIdByCode,
      stats: {
        timeslots: timeslots.length,
        rooms: rooms.length,
        teachers: teachers.length,
        lessons: lessons.length,
        perSubjectCount,
        periods_per_day,
        dp_groups_count: dpGroupsCount,
        dp_target_periods_per_day: dpTargetPeriodsPerDay,
        expected_lessons_for_dp: dpGroupsCount * dpTargetPeriodsPerDay * dpDaysPerWeek,
        underfilled: lessons.length < (dpGroupsCount * dpTargetPeriodsPerDay * dpDaysPerWeek),
        expectedLessonsBySubject,
        lessonsCreatedBySubject,
        missingCoreSubjects
      },
    });
  } catch (error) {
    console.error('buildSchedulingProblem error:', error);
    return Response.json({ error: error.message || 'Failed to build scheduling problem' }, { status: 500 });
  }
});