import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calls OR-Tool scheduling service and processes results
 * 
 * Sends clean schedule_problem_v1 payload
 * Receives schedule_solution_v1 response
 * Maps assignments back to Base44 entities (ScheduleSlot)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    let requestedSchoolId = null;
    let scheduleVersionSchoolId = null;
    const whoami = user ? { userId: user.id, role: user.role, school_id: user.school_id || null } : null;

    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'NO_USER', guardFailureCode: 'NOT_AUTHENTICATED', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ error: 'Forbidden: user missing school_id', code: 'NO_SCHOOL_ON_USER', guardFailureCode: 'NO_SCHOOL_ON_USER', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }

    const body = await req.json();
    const schedule_version_id = body?.schedule_version_id;
    const dpStudyWeekly = body?.dp_study_weekly ?? 6; // default per user request
    const dpMinEndTime = body?.dp_min_end_time ?? '14:30';
    requestedSchoolId = body?.school_id || null;
    const schoolId = requestedSchoolId || user.school_id;
    try {
      if (schedule_version_id) {
        const sv = await base44.entities.ScheduleVersion.filter({ id: schedule_version_id });
        scheduleVersionSchoolId = sv?.[0]?.school_id || null;
      }
    } catch (_) {}
    if (requestedSchoolId && requestedSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: Cross-school access', guardFailureCode: 'CROSS_SCHOOL', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }
    const errors = [];

    // Step 1: Build scheduling problem
    const buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
      schedule_version_id,
      school_id: schoolId,
      dp_study_weekly: dpStudyWeekly,
      dp_min_end_time: dpMinEndTime
    });

    if (!buildResponse.data.success) {
      return Response.json({ 
        error: 'Failed to build scheduling problem',
        details: buildResponse.data 
      }, { status: 500 });
    }

    const problem = buildResponse.data.problem;
    const expectedLessonsBySubject = (buildResponse.data?.stats?.expectedLessonsBySubject) || {};
    const expectedMinutesBySubject = (buildResponse.data?.stats?.expectedMinutesBySubject) || null;
    const problemLessonsCreated = (buildResponse.data?.stats?.lessonsCreatedBySubject) || {};
    const scheduleSettingsSent = {
      day_start_time: problem?.scheduleSettings?.dayStartTime || problem?.scheduleSettings?.schoolStartTime || null,
      day_end_time: problem?.scheduleSettings?.dayEndTime || null,
      period_duration_minutes: problem?.scheduleSettings?.periodDurationMinutes || null,
      days_of_week: problem?.scheduleSettings?.daysOfWeek || null,
      breaks: problem?.scheduleSettings?.breaks || [],
      min_periods_per_day: problem?.scheduleSettings?.minPeriodsPerDay || null,
      target_periods_per_day: problem?.scheduleSettings?.targetPeriodsPerDay || (buildResponse?.data?.stats?.dp_target_periods_per_day || null),
    };

    // Step 2: Call OR-Tool service
    const OR_TOOL_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT');
    const OR_TOOL_API_KEY = Deno.env.get('OR_TOOL_API_KEY');

    if (!OR_TOOL_ENDPOINT) {
      console.error('[callORToolScheduler] Missing OR_TOOL_ENDPOINT');
      return Response.json({ 
        error: 'OR-Tool endpoint missing: set OR_TOOL_ENDPOINT to http://87.106.27.27:8080/solve-and-push'
      }, { status: 503 });
    }
    if (!OR_TOOL_API_KEY) {
      console.error('[callORToolScheduler] Missing OR_TOOL_API_KEY');
      return Response.json({ 
        error: 'OR-Tool API key missing: set OR_TOOL_API_KEY'
      }, { status: 503 });
    }

    const orToolEndpointUsed = OR_TOOL_ENDPOINT;
    console.log('[callORToolScheduler] Calling OR-Tool at', orToolEndpointUsed);

    let solverResponse;
    try {
      solverResponse = await fetch(orToolEndpointUsed, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OR_TOOL_API_KEY}`
        },
        body: JSON.stringify(problem)
      });
    } catch (e) {
      console.error('OR-Tool network error:', e);
      return Response.json({
        error: 'Unable to connect to OR-Tool endpoint',
        endpoint: OR_TOOL_ENDPOINT,
        details: String(e?.message || e)
      }, { status: 502 });
    }

    if (!solverResponse.ok) {
      const errorText = await solverResponse.text();
      console.error('OR-Tool error:', errorText);
      return Response.json({ 
        error: 'OR-Tool scheduling failed',
        endpoint: orToolEndpointUsed,
        details: errorText 
      }, { status: 500 });
    }

    const solution = await solverResponse.json();
    console.log('[callORToolScheduler] solver score =', solution.score);

    // Step 3: Validate solution format (support lessons or legacy assignments)
    const solvedLessons = Array.isArray(solution.lessons)
      ? solution.lessons
      : (Array.isArray(solution.assignments) ? solution.assignments : null);
    if (!solvedLessons) {
      return Response.json({ 
        error: 'Invalid solution format from OR-Tool (expected lessons[] or assignments[])',
        solution 
      }, { status: 500 });
    }
    const assignmentsReturnedBySubject = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      assignmentsReturnedBySubject[subj] = (assignmentsReturnedBySubject[subj] || 0) + 1;
    }
    console.log('[callORToolScheduler] assignmentsReturnedBySubject =', assignmentsReturnedBySubject);
    const assignedBySubjectCode = {};
    const unassignedBySubjectCode = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (l.timeslotId) {
        assignedBySubjectCode[subj] = (assignedBySubjectCode[subj] || 0) + 1;
      } else {
        unassignedBySubjectCode[subj] = (unassignedBySubjectCode[subj] || 0) + 1;
      }
    }
    console.log('[callORToolScheduler] assignedBySubjectCode =', assignedBySubjectCode);
    console.log('[callORToolScheduler] unassignedBySubjectCode =', unassignedBySubjectCode);
    const coreKeys = ['TOK','CAS','EE'];
    const coreAssignmentSummary = {};
    for (const k of coreKeys) {
      coreAssignmentSummary[k] = {
        assigned: assignedBySubjectCode[k] || 0,
        unassigned: unassignedBySubjectCode[k] || 0,
        total: (assignedBySubjectCode[k] || 0) + (unassignedBySubjectCode[k] || 0)
      };
    }
    console.log('[callORToolScheduler] coreAssignmentSummary =', coreAssignmentSummary);

    // Step 4: Get Base44 entities to reverse-map IDs
    const [subjects, teachingGroups, rooms, teachers] = await Promise.all([
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.TeachingGroup.filter({ school_id: schoolId }),
      base44.entities.Room.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId })
    ]);

    // Use mappings provided by the problem payload (no DB index ordering)
    const subjectIdByCode = problem.subjectIdByCode || {};
    const numericToRoomId = problem.roomNumericIdToBase44Id || {};
    const numericToTeacherId = problem.teacherNumericIdToBase44Id || {};



    // Map timeslot ID → day/period
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const dayMapping = {
      'MONDAY': 'Monday',
      'TUESDAY': 'Tuesday',
      'WEDNESDAY': 'Wednesday',
      'THURSDAY': 'Thursday',
      'FRIDAY': 'Friday'
    };

    // Build per-day timeslot index for flexible days/periods
    const cfgDays = (problem.scheduleSettings && Array.isArray(problem.scheduleSettings.daysOfWeek) && problem.scheduleSettings.daysOfWeek.length)
      ? problem.scheduleSettings.daysOfWeek
      : days;
    const timeslotsByDay = {};
    cfgDays.forEach(d => {
      timeslotsByDay[d] = (problem.timeslots || [])
        .filter(t => t.dayOfWeek === d)
        .sort((a,b) => String(a.startTime||'').localeCompare(String(b.startTime||'')));
    });
    const timeslotIndexInDay = {};
    Object.values(timeslotsByDay).forEach(arr => {
      arr.forEach((t, i) => { timeslotIndexInDay[t.id] = i + 1; });
    });
    const periodsPerDayComputed = Math.max(0, ...Object.values(timeslotsByDay).map(arr => arr.length));

    // Core assignments (TOK/CAS/EE) with timeslotId + mapped day/period
    const periodsPerDay = periodsPerDayComputed;
    const coreAssignments = { TOK: [], CAS: [], EE: [] };
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (!['TOK','CAS','EE'].includes(subj)) continue;
      let day = null, period = null;
      if (l.timeslotId) {
        const ts = problem.timeslots.find(t => t.id === l.timeslotId) || null;
        if (ts) {
          day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
          period = timeslotIndexInDay[ts.id] || 1;
        }
      }
      coreAssignments[subj].push({
        subject: subj,
        studentGroup: l.studentGroup || null,
        timeslotId: l.timeslotId || null,
        day, period,
        teacherId: l.teacherId || null,
        roomId: l.roomId || null
      });
    }

    // After solve: compute max period used by day + last endTime actually used per day
    const maxPeriodUsedByDay = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    const endTimeUsedByDay = { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null };
    const periodsPerDayLocal = periodsPerDayComputed;
    for (const l of solvedLessons) {
      if (!l.timeslotId) continue;
      const ts = problem.timeslots.find(t => t.id === l.timeslotId);
      if (!ts) continue;
      const day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
      const period = timeslotIndexInDay[ts.id] || 1;
      if (maxPeriodUsedByDay[day] === undefined || period > maxPeriodUsedByDay[day]) {
        maxPeriodUsedByDay[day] = period;
        endTimeUsedByDay[day] = ts.endTime || null;
      }
    }
    console.log('[callORToolScheduler] maxPeriodUsedByDay =', maxPeriodUsedByDay);
    console.log('[callORToolScheduler] endTimeUsedByDay =', endTimeUsedByDay);

    // Compute latest timeslot actually used and dominant cause for early stop
    const usedTimeslotIds = solvedLessons.filter(l => l.timeslotId).map(l => l.timeslotId);
    const maxUsedTimeslotId = usedTimeslotIds.length ? Math.max(...usedTimeslotIds) : null;
    const latestUsedTimeslot = maxUsedTimeslotId ? (problem.timeslots.find(t => t.id === maxUsedTimeslotId) || null) : null;
    const latestTimeslotAvailable = problem.timeslots[problem.timeslots.length - 1] || null;
    const periodsPerDayLocal2 = periodsPerDayComputed;
    const underfilled = !!(buildResponse?.data?.stats?.underfilled);
    const maxUsedPeriod = Math.max(...Object.values(maxPeriodUsedByDay || { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0 }));
    const dpTarget = (buildResponse?.data?.stats?.dp_target_periods_per_day) || null;
    let earlyStopCause = 'CONSTRAINT_PUSHING_EARLY';
    if (underfilled) {
      earlyStopCause = 'NOT_ENOUGH_LESSONS';
    } else if (dpTarget && dpTarget < (periodsPerDayLocal2 - 2)) {
      earlyStopCause = 'DP_TARGET_PERIODS_PER_DAY_TOO_LOW';
    } else if (maxUsedPeriod <= Math.ceil(periodsPerDayLocal2 / 2)) {
      earlyStopCause = 'FILTER_DROPPED_PM_SLOTS';
    }

    // Step 5: Map OptaPlanner solution back to Base44 ScheduleSlot entities
    const periods_per_day = periodsPerDayComputed; // derived from schedule settings
    let lessonsWithoutTimeslot = 0;
    let missingRoomCount = 0;
    let missingTeacherCount = 0;
    const slots = [];
    
    for (const lesson of solvedLessons) {
      if (!lesson.timeslotId) { lessonsWithoutTimeslot++; continue; } // Skip if no timeslot assigned

      const timeslot = problem.timeslots.find(ts => ts.id === lesson.timeslotId);
      if (!timeslot) continue;

      const normalizedSubject = String(lesson.subject || lesson.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const subjectId = subjectIdByCode[normalizedSubject] || null;
      const teacherId = lesson.teacherId ? numericToTeacherId[lesson.teacherId] : null;
      const roomId = numericToRoomId[lesson.roomId] || null;
      const tgIdFromGroup = (lesson.studentGroup && lesson.studentGroup.startsWith('TG_')) ? lesson.studentGroup.slice(3) : null;
      
      // Allow null room for STUDY and any DP core subject (based on is_core or well-known codes)
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      const isCore = (() => {
        const subjId = subjectId;
        const byFlag = subjId && subjects.some(s => s.id === subjId && s.is_core === true);
        return byFlag || allowNullRoomSubjects.has(normalizedSubject);
      })();
      if (!roomId) { missingRoomCount++; }
      if (!teacherId) { missingTeacherCount++; }
      
      // Calculate period from timeslot ID: ((id - 1) % periods_per_day) + 1
      const period = timeslotIndexInDay[timeslot.id] || 1;

      slots.push({
        school_id: schoolId,
        schedule_version: schedule_version_id,
        teaching_group_id: tgIdFromGroup || null,
        subject_id: subjectId || null,
        teacher_id: teacherId,
        room_id: roomId,
        day: dayMapping[timeslot.dayOfWeek] || timeslot.dayOfWeek,
        period: period,
        is_double_period: false,
        status: 'scheduled',
        notes: normalizedSubject === 'STUDY' ? 'Study / Free Period' : undefined
      });
    }

    // Log slots prepared by subject and sample core slots
    const codeBySubjectId = {};
    Object.entries(subjectIdByCode || {}).forEach(([code, id]) => { codeBySubjectId[id] = code; });
    const slotsPreparedBySubject = {};
    for (const s of slots) {
      const code = s.subject_id ? (codeBySubjectId[s.subject_id] || 'UNKNOWN') : (s.notes?.includes('Study') ? 'STUDY' : 'UNKNOWN');
      slotsPreparedBySubject[code] = (slotsPreparedBySubject[code] || 0) + 1;
    }
    console.log('[callORToolScheduler] slotsPreparedBySubject =', slotsPreparedBySubject);

    // Test slots counters (solver-based). DP breakdown unavailable in solver payload; provide totals.
    const testSlotsInsertedCount = {
      DP1: 0,
      DP2: 0,
      total_from_solver: assignmentsReturnedBySubject['TEST'] || 0,
      prepared_for_insert: slotsPreparedBySubject['TEST'] || 0
    };

    // Counts by subject_id
    const slotsToInsertBySubjectId = {};
    for (const s of slots) {
      const key = s.subject_id || 'null';
      slotsToInsertBySubjectId[key] = (slotsToInsertBySubjectId[key] || 0) + 1;
    }
    console.log('[callORToolScheduler] slotsToInsertBySubjectId =', slotsToInsertBySubjectId);

    // Full JSON samples for TOK/CAS/EE
    const sampleTok = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TOK') || null;
    const sampleCas = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'CAS') || null;
    const sampleEe  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'EE')  || null;
    const sampleTest  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TEST')  || null;
    console.log('[callORToolScheduler] sampleSlot.TOK =', sampleTok);
    console.log('[callORToolScheduler] sampleSlot.CAS =', sampleCas);
    console.log('[callORToolScheduler] sampleSlot.EE  =', sampleEe);
    // Prepare core verification helpers
    let coreSlotsInsertedCount = { TOK: 0, CAS: 0, EE: 0 };
    let sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
    console.log('[callORToolScheduler] coreSlotsInsertedCount (init) =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);

    // Step 6: Delete existing slots for this version
    const existingSlots = await base44.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });
    const deletedCount = existingSlots.length;
    for (const slot of existingSlots) {
      try {
        await base44.entities.ScheduleSlot.delete(slot.id);
      } catch (e) {
        errors.push(`delete:${slot.id}:${e?.message || 'error'}`);
      }
    }

    // Step 7: Create new slots
    let insertedCount = 0;
    let sampleSlotsInserted = null;
    if (slots.length > 0) {
      const inserted = await base44.entities.ScheduleSlot.bulkCreate(slots);
      const createdIds = Array.isArray(inserted) ? inserted.map(r => r.id) : null;
      insertedCount = Array.isArray(inserted) ? inserted.length : slots.length;
      console.log('[callORToolScheduler] insertedCount =', insertedCount);
      console.log('[callORToolScheduler] insertedCountBySubject =', slotsPreparedBySubject);
      if (createdIds) {
        console.log('[callORToolScheduler] createdIds (first 20) =', createdIds.slice(0, 20));
      }
      // Build sampleSlotsInserted (5 max, ensure one core if exists)
      if (Array.isArray(inserted)) {
        const getCoreKey = (sid) => {
          const subj = subjects.find(s => s.id === sid);
          const label = String((subj?.code || subj?.name || '')).toUpperCase();
          if (label.includes('TOK') || label.includes('THEORY OF KNOWLEDGE')) return 'TOK';
          if (label.includes('CAS')) return 'CAS';
          if (label.includes('EXTENDED ESSAY') || label === 'EE' || label.includes(' EE')) return 'EE';
          return null;
        };
        const coreList = inserted.filter(s => s.subject_id && getCoreKey(s.subject_id));
        const nonCore = inserted.filter(s => !(s.subject_id && getCoreKey(s.subject_id)));
        sampleSlotsInserted = [...coreList.slice(0,1), ...nonCore.slice(0,4)];
        coreSlotsInsertedCount = { TOK: 0, CAS: 0, EE: 0 };
        inserted.forEach(s => {
          const k = s.subject_id ? getCoreKey(s.subject_id) : null;
          if (k) coreSlotsInsertedCount[k]++;
        });
        sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
        console.log('[callORToolScheduler] coreSlotsInsertedCount =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);
      } else {
        coreSlotsInsertedCount = {
          TOK: slotsPreparedBySubject['TOK'] || 0,
          CAS: slotsPreparedBySubject['CAS'] || 0,
          EE: slotsPreparedBySubject['EE'] || 0,
        };
        sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
        console.log('[callORToolScheduler] coreSlotsInsertedCount (from prepared) =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);
      }
    }

    // Step 8: Create conflict reports for unassigned lessons
    const unassignedLessons = solvedLessons.filter(l => {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      const subjId = (problem.subjectIdByCode && problem.subjectIdByCode[subj]) || null;
      const isCore = (subjId && subjects.some(s => s.id === subjId && s.is_core === true)) || allowNullRoomSubjects.has(subj);
      return !l.timeslotId || (!l.roomId && !isCore);
    });
    if (unassignedLessons.length > 0) {
      for (const lesson of unassignedLessons) {
        await base44.entities.ConflictReport.create({
          school_id: user.school_id,
          schedule_version_id,
          conflict_type: 'insufficient_hours',
          severity: 'critical',
          description: `Lesson "${lesson.subject} - ${lesson.studentGroup}" could not be scheduled. No valid time slots found.`,
          affected_entities: {
            subject_code: lesson.subject,
            student_group: lesson.studentGroup
          },
          suggested_resolution: 'Try adding more rooms, adjusting teacher availability, or reducing required sessions.',
          status: 'unresolved'
        });
      }
    }

    // Step 9: Off-by-one mismatch check and warnings
            const offByOneIssues = {};
            for (const [code, exp] of Object.entries(expectedLessonsBySubject || {})) {
              const got = assignedBySubjectCode[code] || 0;
              if (got !== exp) {
                offByOneIssues[code] = { expected: exp, assigned: got, diff: got - exp };
              }
            }
            console.log('[callORToolScheduler] offByOneIssues =', offByOneIssues);
            let warningsCount = Object.keys(offByOneIssues).length;
            if (warningsCount > 0) {
              for (const [code, info] of Object.entries(offByOneIssues)) {
                try {
                  await base44.entities.ConflictReport.create({
                    school_id: user.school_id,
                    schedule_version_id,
                    conflict_type: info.assigned < info.expected ? 'insufficient_hours' : 'ib_requirement_violation',
                    severity: 'medium',
                    description: `Subject ${code}: assigned ${info.assigned} vs expected ${info.expected} (diff ${info.diff >= 0 ? '+' : ''}${info.diff})`,
                    affected_entities: { subject_code: code },
                    status: 'unresolved'
                  });
                } catch (e) {
                  errors.push(`warn:${code}:${e?.message || 'error'}`);
                }
              }
            }
            // Step 9: Update schedule version metadata
            await base44.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      score: solution.score || 0,
      conflicts_count: unassignedLessons.length,
      warnings_count: warningsCount
      });

    console.log('[callORToolScheduler] persistence diagnostics', { lessonsWithoutTimeslot, missingRoomCount, missingTeacherCount });
    const buildMeta = {
      schoolIdInput: requestedSchoolId,
      schoolIdUsed: schoolId,
      timeslotsCount: problem.timeslots.length,
      periodsPerDay: periodsPerDayComputed,
      lastTimeslot: problem.timeslots[problem.timeslots.length - 1] || null,
      dpTargetPeriodsPerDay: (buildResponse?.data?.stats?.dp_target_periods_per_day) || null,
      periodDurationMinutes: (problem?.scheduleSettings?.periodDurationMinutes) || null,
    };
    console.log('[callORToolScheduler] buildMeta =', buildMeta);

    const totalExpectedLessons = Object.values(expectedLessonsBySubject || {}).reduce((a,b)=>a+(b||0),0);
    const totalAssignedLessons = Object.values(assignedBySubjectCode || {}).reduce((a,b)=>a+(b||0),0);
    const totalUnassignedLessons = Object.values(unassignedBySubjectCode || {}).reduce((a,b)=>a+(b||0),0);
    const totalTimeslots = problem.timeslots.length;
    const periodsPerDayOut = periodsPerDayComputed;
    let underfillReason = earlyStopCause;
    if (totalExpectedLessons < totalTimeslots) {
      underfillReason = 'BUILDER_NOT_ENOUGH_LESSONS';
    } else if (totalUnassignedLessons > 0) {
      underfillReason = 'SOLVER_UNASSIGNED_LESSONS';
    }
    const isUnderfilled = totalAssignedLessons < totalTimeslots;

    return Response.json({
      success: true,
      school_id: user.school_id,
      schedule_version_id,
      orToolEndpointUsed,
      expectedLessonsBySubject,
      assignedBySubjectCode,
      assignmentsBySubjectCode: assignedBySubjectCode,
      unassignedBySubjectCode,
      coreAssignments,
      maxPeriodUsedByDay,
      endTimeUsedByDay,
      timeslotsCount: problem.timeslots.length,
      lastTimeslotUsed: latestUsedTimeslot ? { dayOfWeek: latestUsedTimeslot.dayOfWeek, startTime: latestUsedTimeslot.startTime, endTime: latestUsedTimeslot.endTime, id: latestUsedTimeslot.id } : null,
      scheduleSettingsSent,
      expectedMinutesBySubject,
      assignedLessonsBySubject: assignedBySubjectCode,
      unassignedLessonsBySubject: unassignedBySubjectCode,
      sampleCoreSlots: { TOK: sampleTok, CAS: sampleCas, EE: sampleEe, TEST: sampleTest },
      underfill: {
        underfilled: isUnderfilled,
        totalExpectedLessons,
        totalAssignedLessons,
        totalTimeslots,
        periodsPerDay: periodsPerDayOut,
        reason: underfillReason,
        study: {
          assigned_in_solver: assignedBySubjectCode['STUDY'] || 0,
          total_from_solver: assignmentsReturnedBySubject['STUDY'] || 0,
          prepared_for_insert: slotsPreparedBySubject['STUDY'] || 0
        }
      },
      slotsToInsertBySubjectId,
      insertedCount,
      deletedCount: typeof deletedCount === 'number' ? deletedCount : 0,
      slotsInserted: insertedCount,
      slotsDeleted: typeof deletedCount === 'number' ? deletedCount : 0,
      performedInsertion: insertedCount > 0,
      performedDeletion: (typeof deletedCount === 'number' ? deletedCount : 0) > 0,
      errors,
      offByOneIssues,
      sampleSlotsInserted,
      coreSlotsInsertedCount,
      sampleCoreSlot,
      diagnostics: {
        lessonsWithoutTimeslot,
        missingRoomCount,
        missingTeacherCount,
      },
      buildMeta,
      problemLessonsCreated,
      solutionAssignmentsReturned: assignmentsReturnedBySubject,
      slotsPreparedForInsert: slotsPreparedBySubject,
      testSlotsInsertedCount,
      whyStopsEarly: {
        latestTimeslotAvailable: latestTimeslotAvailable ? { dayOfWeek: latestTimeslotAvailable.dayOfWeek, endTime: latestTimeslotAvailable.endTime } : null,
        latestTimeslotActuallyUsed: latestUsedTimeslot ? { dayOfWeek: latestUsedTimeslot.dayOfWeek, endTime: latestUsedTimeslot.endTime } : null,
        cause: earlyStopCause
      },
      message: 'Schedule generated successfully',
      stats: {
        slots_created: slots.length,
        unassigned_lessons: unassignedLessons.length,
        score: solution.score || 0
      }
    });

  } catch (error) {
    console.error('OR-Tool scheduler error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate schedule' 
    }, { status: 500 });
  }
});