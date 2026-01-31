import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/*
Build scheduling problem from TeachingGroups using minutes/week + school schedule settings
Request body:
{
  schedule_version_id: string,
  school_id?: string,
  dp_study_weekly?: number,
  dp_min_end_time?: string, // e.g. "14:30"
}
Response:
{
  success: true,
  problem: {
    timeslots: [...],
    rooms: [...],
    teachers: [...],
    lessons: [...],
    subjectIdByCode: {...},
    teacherNumericIdToBase44Id: {...},
    roomNumericIdToBase44Id: {...},
    teacherNumericIdToExternalRef: {...},
    roomNumericIdToExternalRef: {...},
    studentGroupSoftPreferences: {...},
    // NEW
    scheduleSettings: {
      periodDurationMinutes,
      dayStartTime,
      dayEndTime,
      daysOfWeek,
      breaks,
      minPeriodsPerDay,
      targetPeriodsPerDay
    },
    teachingGroups: [
      { id, subject_id, minutesPerWeek, teacher_id, room_id, ib_level }
    ]
  },
  meta: {...},
  stats: {...}
}
*/

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    const body = await req.json();
    const schedule_version_id = body?.schedule_version_id;
    const requestedSchoolId = body?.school_id || body?.schoolId || user?.school_id || null;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    const whoami = user ? { userId: user.id, role: user.role, school_id: user.school_id || null } : null;
    let scheduleVersionSchoolId = null;

    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'NO_USER', guardFailureCode: 'NOT_AUTHENTICATED', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ error: 'Forbidden: user missing school_id', code: 'NO_SCHOOL_ON_USER', guardFailureCode: 'NO_SCHOOL_ON_USER', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }
    if (requestedSchoolId && requestedSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: Cross-school access', code: 'CROSS_SCHOOL', guardFailureCode: 'CROSS_SCHOOL', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }

    const school_id = user.school_id;

    // Fetch school + resources
    const [school, roomsDb, teachersDb, subjectsDb, teachingGroupsDb] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(r => r[0]),
      base44.entities.Room.filter({ school_id, is_active: true }),
      base44.entities.Teacher.filter({ school_id, is_active: true }),
      base44.entities.Subject.filter({ school_id, is_active: true }),
      base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
    ]);

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Helpers
    const normalizeSubjectCode = (raw) => {
      if (!raw) return null;
      const s = String(raw).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      return s || null;
    };

    // Subject id->code and lookups
    const subjectIdToCode = {};
    const subjectIdByCode = {};
    const subjectById = {};
    for (const subj of subjectsDb) {
      subjectById[subj.id] = subj;
      const raw = (subj.code || subj.name || subj.id).toString();
      const norm = normalizeSubjectCode(raw);
      subjectIdToCode[subj.id] = norm;
      const aliases = new Set([raw.toUpperCase(), norm, norm?.replace(/_/g, ' ')]);
      aliases.forEach((k) => { if (k) subjectIdByCode[k] = subj.id; });
    }

    // Schedule settings from School (top-level fields)
    const periodDurationMinutes = Number(school.period_duration_minutes || 60);
    const dayStartTime = String(school.day_start_time || school.school_start_time || '08:00');
    const dayEndTime = String(school.day_end_time || '18:00');
    const daysOfWeek = Array.isArray(school.days_of_week) && school.days_of_week.length > 0
      ? school.days_of_week
      : ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
    const breaks = Array.isArray(school.breaks) ? school.breaks : [];
    const minPeriodsPerDay = Number(school.min_periods_per_day || 10);
    const targetPeriodsPerDay = Number(school.target_periods_per_day || 10);

    // Build timeslots across dayStart->dayEnd, step by periodDuration, skip break overlaps
    const timeToMin = (hhmm) => {
      const [h,m] = String(hhmm).split(':').map(Number);
      return (h||0) * 60 + (m||0);
    };
    const overlapsBreak = (start, end) => {
      for (const b of breaks) {
        if (!b?.start || !b?.end) continue;
        const bs = timeToMin(b.start), be = timeToMin(b.end);
        if (Math.max(start, bs) < Math.min(end, be)) return true;
      }
      return false;
    };

    const startMin = timeToMin(dayStartTime);
    const endMin = timeToMin(dayEndTime);
    const timeslots = [];
    let tsId = 1;
    for (const day of daysOfWeek) {
      for (let cur = startMin; cur + periodDurationMinutes <= endMin; cur += periodDurationMinutes) {
        const s = cur, e = cur + periodDurationMinutes;
        if (overlapsBreak(s, e)) continue;
        const sh = String(Math.floor(s/60)).padStart(2,'0');
        const sm = String(s%60).padStart(2,'0');
        const eh = String(Math.floor(e/60)).padStart(2,'0');
        const em = String(e%60).padStart(2,'0');
        timeslots.push({ id: tsId++, dayOfWeek: day, startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` });
      }
    }

    // Rooms/Teachers numeric format & maps
    const rooms = roomsDb.map((r, idx) => ({ id: idx + 1, name: r.name || `Room ${idx+1}`, capacity: r.capacity || 0 }));
    const teachers = teachersDb.map((t, idx) => ({ id: idx + 1, name: t.full_name || `Teacher ${idx+1}` }));
    const roomNumericIdToBase44Id = {};
    const teacherNumericIdToBase44Id = {};
    roomsDb.forEach((r, idx) => { roomNumericIdToBase44Id[idx+1] = r.id; });
    teachersDb.forEach((t, idx) => { teacherNumericIdToBase44Id[idx+1] = t.id; });
    const roomNumericIdToExternalRef = {};
    const teacherNumericIdToExternalRef = {};
    roomsDb.forEach((r, idx) => { roomNumericIdToExternalRef[idx+1] = r.external_id || r.externalId || r.id; });
    teachersDb.forEach((t, idx) => { teacherNumericIdToExternalRef[idx+1] = t.external_id || t.externalId || t.employee_id || t.id; });

    // Compute lessons from minutes/week
    const lessons = [];
    let lessonId = 1;
    const perSubjectCount = {};
    const expectedLessonsBySubject = {};
    const expectedMinutesBySubject = {};
    const teachingGroupsFilteredOut = [];
    let teachingGroupsIncludedCount = 0;

    const teachingGroupFilteredPush = (tg, reason) => {
      const subjCode = subjectIdToCode[tg.subject_id] || null;
      const has_students = Array.isArray(tg.student_ids) && tg.student_ids.length > 0;
      teachingGroupsFilteredOut.push({
        tg_id: tg.id,
        name: tg.name || null,
        subject_code: subjCode,
        minutes_per_week: typeof tg.minutes_per_week === 'number' ? tg.minutes_per_week : null,
        ib_level: subjectById[tg.subject_id]?.ib_level || null,
        year_group: tg.year_group || null,
        is_active: !!tg.is_active,
        has_students,
        teacher_id: tg.teacher_id || null,
        room_id: tg.preferred_room_id || null,
        reason
      });
    };

    const minutesForTG = (tg) => {
      if (typeof tg.minutes_per_week === 'number' && tg.minutes_per_week > 0) return tg.minutes_per_week;
      if (typeof tg.hours_per_week === 'number' && tg.hours_per_week > 0) return Math.round(tg.hours_per_week * 60);
      const subj = subjectById[tg.subject_id];
      const level = String(tg.level || '').toUpperCase();
      if (subj?.ib_level === 'DP') {
        if (level === 'HL') return Number(subj.hl_minutes_per_week_default || 300);
        if (level === 'SL') return Number(subj.sl_minutes_per_week_default || 180);
        return Number(subj.sl_minutes_per_week_default || 180);
      }
      return Number(subj?.pyp_myp_minutes_per_week_default || 180);
    };

    const minutesToPeriods = (m) => Math.max(0, Math.ceil(m / periodDurationMinutes));

    // Study filler for DP groups
    const dpStudyWeekly = Number(body?.dp_study_weekly ?? Deno.env.get('DP_STUDY_WEEKLY') ?? 0);
    const dpMinEndTime = String(body?.dp_min_end_time || Deno.env.get('DP_MIN_END_TIME') || '14:30');
    const studentGroupSoftPreferences = {};

    for (const tg of teachingGroupsDb) {
      if (!tg?.is_active) {
        teachingGroupFilteredPush(tg, 'INACTIVE');
        continue;
      }
      const subjCode = subjectIdToCode[tg.subject_id];
      if (!subjCode) {
        teachingGroupFilteredPush(tg, 'MISSING_SUBJECT');
        continue;
      }

      const minutesUsed = minutesForTG(tg);
      const weeklyCount = minutesToPeriods(minutesUsed);
      const minutesOrig = typeof tg.minutes_per_week === 'number' ? tg.minutes_per_week : null;
      if (!weeklyCount || weeklyCount <= 0) {
        teachingGroupFilteredPush(tg, minutesOrig === 0 ? 'ZERO_MINUTES' : 'MISSING_MINUTES');
        continue;
      }

      teachingGroupsIncludedCount++;

      const studentGroup = `TG_${tg.id}`;
      const cap = 20;
      const teacherNumeric = tg.teacher_id ? (teachersDb.findIndex(t => t.id === tg.teacher_id) + 1 || null) : null;
      const roomNumeric = tg.preferred_room_id ? (roomsDb.findIndex(r => r.id === tg.preferred_room_id) + 1 || null) : null;

      // Expected + created counters
      expectedLessonsBySubject[subjCode] = (expectedLessonsBySubject[subjCode] || 0) + weeklyCount;
      expectedMinutesBySubject[subjCode] = (expectedMinutesBySubject[subjCode] || 0) + minutesUsed;

      for (let i = 0; i < weeklyCount; i++) {
        lessons.push({
          id: lessonId++,
          subject: subjCode,
          studentGroup,
          requiredCapacity: cap,
          timeslotId: null,
          roomId: roomNumeric || null,
          teacherId: teacherNumeric || null,
        });
      }
      perSubjectCount[subjCode] = (perSubjectCount[subjCode] || 0) + weeklyCount;

      // DP preferences + Study blocks
      const subj = subjectById[tg.subject_id];
      const isDP = (String(tg.year_group || '').toUpperCase().includes('DP')) || (subj?.ib_level === 'DP');
      if (isDP) {
        studentGroupSoftPreferences[studentGroup] = { minEndTime: dpMinEndTime, penalty: 5 };
        const studyCount = Math.max(0, dpStudyWeekly - weeklyCount);
        for (let s = 0; s < studyCount; s++) {
          lessons.push({
            id: lessonId++,
            subject: 'STUDY',
            studentGroup,
            requiredCapacity: cap,
            timeslotId: null,
            roomId: null,
            teacherId: null,
            isStudy: true,
            softConstraints: { maxConsecutive: 2, preferAfternoon: true }
          });
        }
        if (studyCount > 0) perSubjectCount['STUDY'] = (perSubjectCount['STUDY'] || 0) + studyCount;
      }
    }

    const lessonsCreatedBySubject = {};
    for (const l of lessons) {
      lessonsCreatedBySubject[l.subject] = (lessonsCreatedBySubject[l.subject] || 0) + 1;
    }

    const daysCount = daysOfWeek.length || 5;
    const periodsPerDay = Math.floor(timeslots.length / Math.max(1, daysCount));

    const problem = {
      timeslots,
      rooms,
      teachers,
      lessons,
      subjectIdByCode,
      teacherNumericIdToBase44Id,
      roomNumericIdToBase44Id,
      teacherNumericIdToExternalRef,
      roomNumericIdToExternalRef,
      studentGroupSoftPreferences,
      scheduleSettings: {
        periodDurationMinutes,
        dayStartTime,
        dayEndTime,
        daysOfWeek,
        breaks,
        minPeriodsPerDay,
        targetPeriodsPerDay
      },
      teachingGroups: teachingGroupsDb.map((tg) => ({
        id: tg.id,
        subject_id: tg.subject_id,
        minutesPerWeek: minutesForTG(tg),
        teacher_id: tg.teacher_id || null,
        room_id: tg.preferred_room_id || null,
        ib_level: subjectById[tg.subject_id]?.ib_level || null
      }))
    };

    const lastTimeslot = timeslots[timeslots.length - 1] || null;

    return Response.json({
      success: true,
      problem,
      subjectIdByCode,
      // Debug summary
      schoolIdUsed: school_id,
      scheduleVersionIdUsed: schedule_version_id,
      periodDurationMinutes,
      dayStartTime,
      dayEndTime,
      daysOfWeek,
      breaks,
      timeslotsCount: timeslots.length,
      periodsPerDay,
      subjectsIncludedCodes: Object.keys(expectedLessonsBySubject || {}),
      teachingGroupsIncludedCount,
      teachingGroupsFilteredOutCount: teachingGroupsFilteredOut.length,
      teachingGroupsFilteredOut: teachingGroupsFilteredOut.slice(0, 200),
      expectedMinutesBySubject,
      expectedLessonsBySubject,
      totalRequiredMinutes: (Object.values(expectedMinutesBySubject || {}).reduce((a,b)=>a+b,0)),
      totalRequiredPeriods: (Object.values(expectedLessonsBySubject || {}).reduce((a,b)=>a+b,0)),
      meta: {
        schoolIdInput: requestedSchoolId,
        schoolIdUsed: school_id,
        timeslotsCount: timeslots.length,
        periodsPerDay,
        lastTimeslot,
        periodDurationMinutes,
      },
      stats: {
        timeslots: timeslots.length,
        rooms: rooms.length,
        teachers: teachers.length,
        lessons: lessons.length,
        perSubjectCount,
        periods_per_day: periodsPerDay,
        expectedLessonsBySubject,
        expectedMinutesBySubject,
        totalRequiredMinutes: (Object.values(expectedMinutesBySubject || {}).reduce((a,b)=>a+b,0)),
        totalRequiredPeriods: (Object.values(expectedLessonsBySubject || {}).reduce((a,b)=>a+b,0)),
        lessonsCreatedBySubject
      }
    });
  } catch (error) {
    console.error('buildSchedulingProblem error:', error);
    return Response.json({ error: error.message || 'Failed to build scheduling problem' }, { status: 500 });
  }
});