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
      const subjCode = subjectIdToCode[tg.subject_id];
      
      // CRITICAL FIX: Default minutes for core subjects if not set
      if (subjCode && ['TOK', 'CAS', 'EE'].includes(subjCode)) {
        return 60; // 1 hour/week default for DP core
      }
      
      const level = String(tg.level || '').toUpperCase();
      if (subj?.ib_level === 'DP') {
        if (level === 'HL') return Number(subj.hl_minutes_per_week_default || 300);
        if (level === 'SL') return Number(subj.sl_minutes_per_week_default || 180);
        return Number(subj.sl_minutes_per_week_default || 180);
      }
      return Number(subj?.pyp_myp_minutes_per_week_default || 180);
    };

    const minutesToPeriods = (m) => Math.max(0, Math.ceil(m / periodDurationMinutes));

    // DIAGNOSTIC 1: Log all subjects before core check
    console.log('[buildSchedulingProblem] All subjects in DB:', subjectsDb.map(s => ({ 
      id: s.id, 
      code: s.code, 
      name: s.name, 
      normalized: normalizeSubjectCode(s.code || s.name),
      is_core: s.is_core,
      ib_level: s.ib_level
    })));

    // DIAGNOSTIC 2: Check DP students and their core assignments
    const dpStudents = await base44.entities.Student.filter({ school_id, ib_programme: 'DP', is_active: true });
    console.log('[buildSchedulingProblem] DP Students check:', {
      total: dpStudents.length,
      sample: dpStudents.slice(0, 3).map(s => ({
        id: s.id,
        name: s.full_name,
        year: s.year_group,
        core_components: s.core_components,
        subject_choices: s.subject_choices?.length || 0,
        assigned_groups: s.assigned_groups?.length || 0
      }))
    });

    // CRITICAL: Ensure core DP subjects (TOK/CAS/EE) have active TeachingGroups
    // If not, create them automatically for all DP students
    const coreSubjectsToEnsure = ['TOK', 'CAS', 'EE'];
    console.log('[buildSchedulingProblem] Starting core subjects check...');
    
    for (const coreCode of coreSubjectsToEnsure) {
      console.log(`[buildSchedulingProblem] Checking ${coreCode}...`);
      
      const coreSubject = subjectsDb.find(s => {
        const normCode = normalizeSubjectCode(s.code);
        const normName = normalizeSubjectCode(s.name);
        const match = normCode === coreCode || normName === coreCode;
        if (match) {
          console.log(`[buildSchedulingProblem] Found ${coreCode} subject:`, { id: s.id, code: s.code, name: s.name, normCode, normName });
        }
        return match;
      });
      
      if (!coreSubject) {
        console.error(`[buildSchedulingProblem] ❌ Core subject ${coreCode} NOT FOUND in database!`);
        continue;
      }

      // Check if there are any active TeachingGroups for this core subject
      const coreGroups = teachingGroupsDb.filter(tg => tg.subject_id === coreSubject.id && tg.is_active);
      console.log(`[buildSchedulingProblem] ${coreCode}: found ${coreGroups.length} active TeachingGroups`);
      
      // DIAGNOSTIC 3: Check student membership in core groups
      if (coreGroups.length > 0) {
        const sampleGroup = coreGroups[0];
        console.log(`[buildSchedulingProblem] ${coreCode} sample group:`, {
          id: sampleGroup.id,
          name: sampleGroup.name,
          student_count: Array.isArray(sampleGroup.student_ids) ? sampleGroup.student_ids.length : 0,
          minutes: sampleGroup.minutes_per_week,
          teacher: sampleGroup.teacher_id
        });
      }
      
      if (coreGroups.length === 0) {
        console.log(`[buildSchedulingProblem] No active TeachingGroup for ${coreCode}, creating one...`);
        
        // Get all DP students
        const students = await base44.entities.Student.filter({ school_id, ib_programme: 'DP', is_active: true });
        console.log(`[buildSchedulingProblem] Found ${students.length} DP students for ${coreCode}`);

        const dpStudentIds = students.map(s => s.id);
        
        if (dpStudentIds.length > 0) {
          try {
            const newGroup = await base44.entities.TeachingGroup.create({
              school_id,
              name: `${coreCode} - All DP`,
              subject_id: coreSubject.id,
              level: 'Standard',
              year_group: 'DP1,DP2',
              student_ids: dpStudentIds,
              minutes_per_week: 60,
              is_active: true
            });
            console.log(`[buildSchedulingProblem] ✅ Created TeachingGroup for ${coreCode}: ${newGroup.id}`);
            // Reload teachingGroupsDb to include new group
            teachingGroupsDb.push(newGroup);
          } catch (e) {
            console.error(`[buildSchedulingProblem] ❌ Failed to create TeachingGroup for ${coreCode}:`, e);
          }
        } else {
          console.warn(`[buildSchedulingProblem] ⚠️ No DP students found, cannot create ${coreCode} TeachingGroup`);
        }
      } else {
        console.log(`[buildSchedulingProblem] ✅ ${coreCode} already has ${coreGroups.length} active TeachingGroup(s):`, coreGroups.map(g => ({ id: g.id, name: g.name, minutes: g.minutes_per_week })));
      }
    }
    
    console.log('[buildSchedulingProblem] Core subjects check complete. Total TeachingGroups:', teachingGroupsDb.length);

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

      let minutesUsed = minutesForTG(tg);
      const minutesOrig = typeof tg.minutes_per_week === 'number' ? tg.minutes_per_week : null;
      
      // CRITICAL: Core subjects (TOK/CAS/EE) MUST have minutes, force fallback BEFORE calculating weeklyCount
      const isCoreSubject = subjCode && ['TOK', 'CAS', 'EE'].includes(subjCode);
      if ((!minutesUsed || minutesUsed <= 0) && isCoreSubject) {
        minutesUsed = 60; // Force 60 min/week for core
        console.warn(`[buildSchedulingProblem] Core subject ${subjCode} TG ${tg.id} has 0/missing minutes, forcing 60 min/week`);
      }

      const weeklyCount = minutesToPeriods(minutesUsed);

      if (!weeklyCount || weeklyCount <= 0) {
        if (isCoreSubject) {
          // This should never happen after forcing 60 min, but safeguard
          console.error(`[buildSchedulingProblem] CRITICAL: Core subject ${subjCode} still has 0 weeklyCount after fallback!`);
        }
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

    // Diagnostic 1: Core Teaching Groups Detection
    const coreSubjectsSet = new Set(['TOK', 'CAS', 'EE']);
    const coreTeachingGroupsDetected = teachingGroupsDb
      .filter(tg => {
        const code = subjectIdToCode[tg.subject_id];
        return code && coreSubjectsSet.has(code);
      })
      .map(tg => ({
        id: tg.id,
        subject_code: subjectIdToCode[tg.subject_id],
        minutes_per_week: minutesForTG(tg),
        dp_year: tg.year_group,
        is_active: tg.is_active,
        has_students: Array.isArray(tg.student_ids) && tg.student_ids.length > 0,
        student_count: Array.isArray(tg.student_ids) ? tg.student_ids.length : 0
      }));

    // Diagnostic 2: Core Requirements Generated
    const coreRequirementsGeneratedByCode = {};
    for (const code of coreSubjectsSet) {
      coreRequirementsGeneratedByCode[code] = subjectRequirements.filter(r => r.subject === code).length;
    }

    // Build subjects[] and subjectRequirements[] for solver validation
    const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ''));
    const subjectCodesInLessons = Array.from(new Set(lessons.map(l => l.subject).filter(Boolean)));
    const subjectsList = subjectCodesInLessons.map(code => {
      const subjId = subjectIdByCode[code] || null;
      const subj = subjId ? subjectById[subjId] : null;
      // Ensure valid MongoDB ObjectId format
      const validId = subjId && isValidMongoId(subjId) ? subjId : '000000000000000000000000';
      return {
        id: validId,
        code: code,
        name: subj?.name || code
      };
    });
    
    const subjectRequirements = [];
    console.log('[buildSchedulingProblem] Building subjectRequirements from', teachingGroupsDb.length, 'TeachingGroups...');
    
    for (const tg of teachingGroupsDb) {
      const subjCode = subjectIdToCode[tg.subject_id];
      const isCoreSubject = subjCode && ['TOK', 'CAS', 'EE'].includes(subjCode);
      
      if (!tg?.is_active) {
        if (isCoreSubject) console.warn(`[buildSchedulingProblem] ⚠️ Core TG ${tg.id} (${subjCode}) is INACTIVE, skipping`);
        continue;
      }
      
      if (!subjCode) {
        if (isCoreSubject) console.error(`[buildSchedulingProblem] ❌ Core TG ${tg.id} has NO SUBJECT CODE!`);
        continue;
      }
      
      // Option A: Use teaching_group.minutes_per_week or fallback 60 for all subjects (including core)
      let minutesUsed = minutesForTG(tg);
      
      // RULE: Core subjects (TOK/CAS/EE) are MANDATORY and never skip
      // If minutes_per_week is missing/invalid, use fallback 60
      if ((!minutesUsed || minutesUsed <= 0) && !isCoreSubject) {
        // Skip non-core subjects with zero minutes
        continue;
      }
      if ((!minutesUsed || minutesUsed <= 0) && isCoreSubject) {
        // Core subjects: force 60 min/week fallback
        minutesUsed = 60;
        console.log(`[buildSchedulingProblem] ✅ Core ${subjCode} TG ${tg.id}: 0/missing minutes, forcing fallback 60 min/week`);
      }
      
      if (isCoreSubject) {
        console.log(`[buildSchedulingProblem] ✅ Adding core requirement: ${subjCode} (TG ${tg.id}), ${minutesUsed} min/week`);
      }
      
      subjectRequirements.push({
        studentGroup: `TG_${tg.id}`,
        subject: subjCode,
        minutesPerWeek: minutesUsed
      });
    }
    
    console.log('[buildSchedulingProblem] Total subjectRequirements:', subjectRequirements.length);
    console.log('[buildSchedulingProblem] Core requirements:', subjectRequirements.filter(r => ['TOK','CAS','EE'].includes(r.subject)));

    const problem = {
      timeslots,
      rooms,
      teachers,
      lessons,
      subjects: subjectsList,
      subjectRequirements,
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

    // Filter out STUDY and TEST from subjects/lessons/requirements for solver
    // These will be injected post-solver to fill empty slots
    const excludeFromSolver = new Set(['STUDY', 'TEST']);
    const problemSubjectsFiltered = problem.subjects.filter(s => !excludeFromSolver.has(s.code));
    const problemLessonsFiltered = problem.lessons.filter(l => !excludeFromSolver.has(l.subject));
    const problemRequirementsFiltered = problem.subjectRequirements.filter(r => !excludeFromSolver.has(r.subject));

    console.log('[buildSchedulingProblem] Filtered for solver:', {
      subjects: { before: problem.subjects.length, after: problemSubjectsFiltered.length },
      lessons: { before: problem.lessons.length, after: problemLessonsFiltered.length },
      requirements: { before: problem.subjectRequirements.length, after: problemRequirementsFiltered.length }
    });

    const problemForSolver = {
      ...problem,
      subjects: problemSubjectsFiltered,
      lessons: problemLessonsFiltered,
      subjectRequirements: problemRequirementsFiltered
    };

    return Response.json({
      success: true,
      problem: problemForSolver,
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
        lessonsCreatedBySubject,
        coreTeachingGroupsDetected,
        coreRequirementsGeneratedByCode,
        coreExpectedLessons: {
          TOK: expectedLessonsBySubject['TOK'] || 0,
          CAS: expectedLessonsBySubject['CAS'] || 0,
          EE: expectedLessonsBySubject['EE'] || 0
        }
      }
    });
  } catch (error) {
    console.error('buildSchedulingProblem error:', error);
    return Response.json({ error: error.message || 'Failed to build scheduling problem' }, { status: 500 });
  }
});