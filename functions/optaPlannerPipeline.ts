import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_version_id, constraints } = await req.json();
    if (!schedule_version_id) {
      return Response.json({ ok: false, error: 'Missing schedule_version_id' }, { status: 400 });
    }

    const OPTAPLANNER_ENDPOINT = Deno.env.get('OPTAPLANNER_ENDPOINT');
    const OPTAPLANNER_API_KEY = Deno.env.get('OPTAPLANNER_API_KEY');

    if (!OPTAPLANNER_ENDPOINT || !OPTAPLANNER_API_KEY) {
      return Response.json({ ok: false, error: 'OptaPlanner not configured' }, { status: 500 });
    }

    // Fetch data
    const [scheduleVersion, teachers, students, rooms, teachingGroups, subjects, school] = await Promise.all([
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id }),
      base44.entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.Student.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.Room.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.School.filter({ id: user.school_id })
    ]);

    if (!scheduleVersion?.[0]) {
      return Response.json({ ok: false, error: 'Schedule version not found' }, { status: 404 });
    }

    const schoolData = school[0];
    
    // Determine program type
    let programType = 'DP'; 
    const vName = scheduleVersion[0].name.toUpperCase();
    if (vName.includes('MYP') || vName.includes('PYP')) {
        programType = vName.includes('MYP') ? 'MYP' : 'PYP';
    } else if (constraints?.programType) {
        programType = constraints.programType;
    }

    // 1. Map ID -> Numeric ID for solver
    let numIdGen = 1;
    const generateNum = () => numIdGen++;
    
    const roomIdMap = {};
    const mappedRooms = rooms.map(r => {
        const numId = generateNum();
        roomIdMap[r.id] = numId;
        return { id: numId, code: String(r.id), name: String(r.name), capacity: Number(r.capacity || 30) };
    });

    const teacherIdMap = {};
    const mappedTeachers = teachers.map(t => {
        const numId = generateNum();
        teacherIdMap[t.id] = numId;
        
        const unavailableSlotIds = [];
        const unavailableDays = [];
        const preferredDays = [];
        const avoidDays = [];
        
        if (t.preferred_free_day) avoidDays.push(t.preferred_free_day.toUpperCase());
        if (t.preferences) {
           if (Array.isArray(t.preferences.unavailableDays)) unavailableDays.push(...t.preferences.unavailableDays);
           if (Array.isArray(t.preferences.preferredDays)) preferredDays.push(...t.preferences.preferredDays);
           if (Array.isArray(t.preferences.avoidDays)) avoidDays.push(...t.preferences.avoidDays);
        }

        if (t.unavailable_slots && t.unavailable_slots.length > 0) {
            const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
            const periodsPerDay = schoolData.periods_per_day || 10;
            t.unavailable_slots.forEach(us => {
                if (!us.day) return;
                const dayIdx = dayNames.indexOf(us.day.toUpperCase());
                if (dayIdx === -1) return;
                if ((us.type === 'period' || !us.type) && us.period) {
                    unavailableSlotIds.push((dayIdx * periodsPerDay) + us.period);
                }
            });
        }

        return {
            id: numId,
            code: String(t.id),
            name: String(t.full_name),
            maxPeriodsPerWeek: Number(t.max_hours_per_week || 25),
            unavailableSlotIds,
            unavailableDays,
            preferredDays,
            avoidDays
        };
    });

    const subjectIdMap = {};
    const mappedSubjects = subjects.map(s => {
        const numId = generateNum();
        subjectIdMap[s.id] = numId;
        return { id: numId, code: String(s.id), name: String(s.name || s.code) };
    });

    // 2. Build Teaching Groups and Lessons
    const mappedTeachingGroups = [];
    const mappedLessons = [];
    const subjectRequirements = [];
    let lessonIdCounter = 1;

    const activeTGs = teachingGroups.filter(tg => tg.is_active && tg.year_group && !tg.year_group.includes(','));
    
    activeTGs.forEach(tg => {
        const numId = generateNum();
        const subject = subjects.find(s => s.id === tg.subject_id);
        if (!subject) return;

        let requiredMinutes = tg.minutes_per_week || 180;
        if (subject.ib_level === 'DP') {
            requiredMinutes = tg.level === 'HL' ? (subject.hoursPerWeekHL || 5) * 60 : (subject.hoursPerWeekSL || 3) * 60;
        } else if (subject.pyp_myp_minutes_per_week_default) {
            requiredMinutes = subject.pyp_myp_minutes_per_week_default;
        }

        const periodDuration = schoolData.period_duration_minutes || 60;
        const numLessons = Math.ceil(requiredMinutes / periodDuration);
        
        const tgLessonIds = [];
        
        subjectRequirements.push({
            studentGroup: String(tg.year_group),
            teachingGroupId: numId,
            sectionId: `sec_${tg.id}`,
            subject: String(subject.name || subject.code),
            minutesPerWeek: requiredMinutes
        });

        for (let i = 0; i < numLessons; i++) {
            const lessonNumId = lessonIdCounter++;
            tgLessonIds.push(lessonNumId);
            
            const studentIds = (tg.student_ids || []).filter(sid => students.some(s => s.id === sid));

            mappedLessons.push({
                id: lessonNumId,
                code: `lesson_${tg.id}_${i}`,
                subject: String(subject.name || subject.code),
                studentGroup: String(tg.year_group),
                teachingGroupId: numId,
                sectionId: `sec_${tg.id}`,
                subjectId: subjectIdMap[subject.id],
                level: String(tg.level || 'SL'),
                yearGroup: String(tg.year_group),
                studentIds: studentIds,
                requiredCapacity: Math.max(1, studentIds.length),
                blockId: tg.block_id ? String(tg.block_id) : null,
                teacherId: tg.teacher_id ? teacherIdMap[tg.teacher_id] : null,
                timeslotId: null,
                roomId: null
            });
        }

        mappedTeachingGroups.push({
            id: numId,
            code: String(tg.id),
            sectionId: `sec_${tg.id}`,
            studentGroup: String(tg.year_group),
            subjectId: subjectIdMap[subject.id],
            level: String(tg.level || 'SL'),
            requiredMinutesPerWeek: requiredMinutes,
            lessonIds: tgLessonIds
        });
    });

    // 3. Build Student Subject Choices (only for DP)
    const studentSubjectChoices = [];
    if (programType === 'DP') {
        students.filter(s => s.is_active).forEach(student => {
            if (student.subject_choices) {
                student.subject_choices.forEach(choice => {
                    const subject = subjects.find(sub => sub.id === choice.subject_id);
                    if (subject) {
                        studentSubjectChoices.push({
                            studentId: String(student.id),
                            subjectId: String(subject.id),
                            subject: String(subject.name || subject.code),
                            level: String(choice.level || 'SL'),
                            yearGroup: String(student.year_group || 'DP1')
                        });
                    }
                });
            }
        });
    }

    // 4. Extract LLM Soft Constraints
    let softConstraints = {
        teacherPreferredDaysWeight: 1.0,
        teacherAvoidDaysWeight: 1.0,
        minimizeGapsWeight: 1.0,
        balanceLoadWeight: 1.0,
        morningPreferenceWeight: 1.0,
        afternoonPreferenceWeight: 1.0,
        maxConsecutivePeriods: 4
    };

    if (constraints?.aiPreferences && constraints.aiPreferences.trim().length > 0) {
        try {
            const llmPrompt = `Extract soft constraints and teacher preferences from: "${constraints.aiPreferences}". Format as JSON fitting constraints.soft schema.`;
            const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: llmPrompt,
                response_json_schema: {
                    type: "object",
                    properties: {
                        softConstraints: { type: "object" }
                    }
                }
            });
            if (llmResponse?.softConstraints) {
                softConstraints = { ...softConstraints, ...llmResponse.softConstraints };
            }
        } catch (e) {
            console.error('[Pipeline] LLM constraint extraction failed:', e);
        }
    }

    // 5. Construct Payload
    const basePayload = {
        schoolId: String(user.school_id),
        timezone: schoolData.timezone || "UTC",
        calendar: { academicYear: schoolData.academic_year || "2025-2026", termId: "T1" },
        scheduleVersion: scheduleVersion[0]?.name || "Draft",
        scheduleVersionId: String(schedule_version_id),
        scheduleSettings: {
            daysPerWeek: schoolData.days_of_week?.length || 5,
            periodsPerDay: Number(schoolData.periods_per_day || 10),
            periodDurationMinutes: Number(schoolData.period_duration_minutes || 60),
            dayStartTime: String(schoolData.day_start_time || "08:00"),
            dayEndTime: String(schoolData.day_end_time || "18:00"),
            daysOfWeek: schoolData.days_of_week || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            breaks: schoolData.breaks || []
        },
        rooms: mappedRooms,
        teachers: mappedTeachers,
        subjects: mappedSubjects,
        teachingGroups: mappedTeachingGroups,
        lessons: mappedLessons,
        subjectRequirements: subjectRequirements,
        blockedSlotIds: [],
        randomSeed: 123456,
        randomizeSearch: true,
        numSearchWorkers: 1,
        shuffleInputOrder: false,
        constraints: {
            hard: {
                spreadAcrossDaysPerTeachingGroupSection: true,
                avoidSamePeriodRepetition: constraints?.maxSameSubjectPerDayHardEnabled !== false,
                avoidTeacherLatePeriods: true,
                respectTeacherUnavailability: true,
                enforceRoomCapacity: true
            },
            soft: softConstraints
        }
    };

    let finalPayload = {};
    if (programType === 'DP') {
        finalPayload = {
            ...basePayload,
            payloadType: "individual_payload",
            programType: "DP",
            studentSubjectChoices: studentSubjectChoices.length > 0 ? studentSubjectChoices : [{ studentId: "dummy", subjectId: "dummy", subject: "dummy", level: "SL", yearGroup: "DP1" }]
        };
    } else {
        // Strip studentIds from lessons for cohort payload
        const cohortLessons = mappedLessons.map(l => {
            const { studentIds, ...rest } = l;
            return rest;
        });
        finalPayload = {
            ...basePayload,
            payloadType: "cohort_payload",
            programType: programType,
            lessons: cohortLessons
        };
    }

    const multiPayload = {
        organizationId: `org_${user.school_id}`,
        runId: `run_${schedule_version_id}`,
        schools: [ finalPayload ]
    };

    // 6. Call Solver
    let endpointUrl = OPTAPLANNER_ENDPOINT;
    if (endpointUrl.includes('/solve-and-push')) {
        endpointUrl = endpointUrl.replace('/solve-and-push', '/solve/multi');
    } else if (!endpointUrl.endsWith('/solve/multi')) {
        endpointUrl = endpointUrl.replace(/\/$/, '') + '/solve/multi';
    }

    console.log('[Pipeline] Calling OptaPlanner:', endpointUrl);

    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': OPTAPLANNER_API_KEY
        },
        body: JSON.stringify(multiPayload)
    });

    let responseText = await response.text();
    if (!response.ok) {
        console.error('[Pipeline] OptaPlanner error:', responseText);
        let errorDetails;
        try { errorDetails = JSON.parse(responseText); } catch { errorDetails = responseText; }
        
        if (errorDetails.assignments && errorDetails.assignments.length > 0) {
            console.warn('[Pipeline] OptaPlanner failed but returned partial assignments.');
            responseText = JSON.stringify(errorDetails);
        } else {
            return Response.json({
                ok: false,
                error: `OptaPlanner validation failed`,
                details: errorDetails
            }, { status: 400 });
        }
    }

    let result = {};
    try { result = JSON.parse(responseText); } catch(e) {}

    // 7. Process Results & Save
    const existingSlots = await base44.entities.ScheduleSlot.filter({
        school_id: user.school_id,
        schedule_version: schedule_version_id
    });
    if (existingSlots.length > 0) {
        for (const slot of existingSlots) await base44.entities.ScheduleSlot.delete(slot.id);
    }

    let finalAssignments = [];
    if (result.schoolResults && Array.isArray(result.schoolResults)) {
        result.schoolResults.forEach(sr => {
            if (sr.result?.assignments) finalAssignments = finalAssignments.concat(sr.result.assignments);
            else if (sr.result?.lessons) finalAssignments = finalAssignments.concat(sr.result.lessons);
        });
    } else {
        finalAssignments = result.lessons || result.assignments || (Array.isArray(result) ? result : []);
    }

    // Reverse maps
    const revTeacherMap = Object.fromEntries(Object.entries(teacherIdMap).map(([k, v]) => [v, k]));
    const revRoomMap = Object.fromEntries(Object.entries(roomIdMap).map(([k, v]) => [v, k]));
    const safeLessonMap = Object.fromEntries(mappedLessons.map(l => [l.id, l]));

    const slotsToInsert = [];
    
    for (const lesson of finalAssignments) {
        const lessonId = lesson.id || lesson.lessonId || lesson.lesson_id;
        const originalLesson = safeLessonMap[lessonId];
        
        if (originalLesson && lesson.timeslotId != null) {
            const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
            const periodsPerDay = schoolData.periods_per_day || 10;
            const dayIndex = Math.floor((lesson.timeslotId - 1) / periodsPerDay);
            const day = lesson.dayOfWeek || days[dayIndex] || 'MONDAY';
            const periodIndex = lesson.periodIndex != null ? lesson.periodIndex : (lesson.timeslotId - 1) % periodsPerDay;

            const subjectNameStr = String(lesson.subject || '').toUpperCase();
            const isBreak = subjectNameStr === 'LUNCH' || subjectNameStr === 'BREAK';

            const tId = lesson.teacherId || lesson.teacher?.id;
            const rId = lesson.roomId || lesson.room?.id;
            
            let realTgId = null;
            const tgNumId = originalLesson.teachingGroupId;
            const tg = mappedTeachingGroups.find(g => g.id === tgNumId);
            if (tg) realTgId = tg.code;

            slotsToInsert.push({
                school_id: user.school_id,
                schedule_version: schedule_version_id,
                teaching_group_id: realTgId,
                teacher_id: tId ? revTeacherMap[tId] : null,
                room_id: rId ? revRoomMap[rId] : null,
                timeslot_id: lesson.timeslotId,
                day: day || 'Monday',
                period: periodIndex + 1,
                status: 'scheduled',
                is_break: isBreak,
                notes: isBreak ? (lesson.subject || 'Break') : undefined
            });
        }
    }

    if (slotsToInsert.length > 0) {
        await base44.entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    let scoreToSave = 0;
    if (result.schoolResults && Array.isArray(result.schoolResults)) {
        let totalHard = 0;
        result.schoolResults.forEach(sr => {
            const s = sr.result?.score || "0hard/0soft";
            const match = String(s).match(/(-?\d+)hard/);
            if (match) totalHard += parseInt(match[1], 10);
        });
        scoreToSave = totalHard;
    } else if (typeof result.score === 'string') {
        const match = result.score.match(/(-?\d+)hard/);
        if (match) scoreToSave = parseInt(match[1], 10);
    } else {
        scoreToSave = result.score || 0;
    }

    await base44.entities.ScheduleVersion.update(schedule_version_id, {
        score: scoreToSave,
        generated_at: new Date().toISOString()
    });

    return Response.json({
        ok: true,
        result: {
            slotsInserted: slotsToInsert.length,
            score: scoreToSave,
            hardScoreNegative: scoreToSave < 0
        }
    });

  } catch (error) {
    console.error('[Pipeline] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});