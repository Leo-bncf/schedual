import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { schedule_version_id, constraints, mock_school_id } = body;
    
    let user = null;
    let b44Entities = base44.entities;

    if (mock_school_id) {
        user = { school_id: mock_school_id };
        b44Entities = base44.asServiceRole.entities;
    } else {
        user = await base44.auth.me();
        if (!user?.school_id) {
          return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
    }
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
      b44Entities.ScheduleVersion.filter({ id: schedule_version_id }),
      b44Entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.Student.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.Room.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.School.filter({ id: user.school_id })
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
    
    // Fix subjectId mapping logic to use UUID strings as required by the template
    const subjectIdMap = {};
    subjects.forEach(s => {
        subjectIdMap[s.id] = s.id; // use original string ID
    });
    
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

    const getSafeSubjectName = (subj) => {
        // Optaplanner est très strict, on ne va garder QUE les lettres majuscules du nom
        // Si le nom contient des accents, on les enlève. On limite à 15 caractères.
        const normalized = String(subj.name || subj.code)
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z]/g, '')
            .toUpperCase()
            .substring(0, 15);
            
        // On ajoute un hash court de l'ID pour garantir l'unicité
        return `${normalized}${String(subj.id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase()}`;
    };

    const mappedSubjects = subjects.map(s => {
        return { id: s.id, code: String(s.id), name: getSafeSubjectName(s) };
    });

    // 2. Build Teaching Groups and Lessons
    const mappedTeachingGroups = [];
    const mappedLessons = [];
    const subjectRequirements = [];
    let lessonIdCounter = 1;

    const activeTGs = teachingGroups.filter(tg => tg.is_active && tg.year_group && !tg.year_group.includes(','));
    
    activeTGs.forEach(tg => {
        const numId = generateNum();
        const tgId = tg.id;
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
            subject: getSafeSubjectName(subject),
            minutesPerWeek: requiredMinutes
        });

        for (let i = 0; i < numLessons; i++) {
            const lessonNumId = lessonIdCounter++;
            tgLessonIds.push(lessonNumId);
            
            const studentIds = (tg.student_ids || []).filter(sid => students.some(s => s.id === sid));

            mappedLessons.push({
                id: lessonNumId,
                code: `lesson_${tg.id}_${i}`,
                subject: getSafeSubjectName(subject),
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
                roomId: null,
                // Keep original ID for reverse mapping later
                originalTgId: tg.id
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
        const activeSubjectIdsWithLessons = new Set(mappedLessons.map(l => l.subjectId));

        students.filter(s => s.is_active).forEach(student => {
            if (student.subject_choices) {
                student.subject_choices.forEach(choice => {
                    const subject = subjects.find(sub => sub.id === choice.subject_id);
                    if (subject && activeSubjectIdsWithLessons.has(subject.id)) {
                        studentSubjectChoices.push({
                            studentId: String(student.id),
                            subjectId: String(subject.id),
                            subject: getSafeSubjectName(subject),
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
            breaks: (schoolData.breaks || []).map(b => ({
                startTime: b.start,
                endTime: b.end
            }))
        },
        rooms: mappedRooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity, externalId: r.code })),
        teachers: mappedTeachers.map(t => ({
            id: t.id,
            name: t.name,
            unavailableSlotIds: t.unavailableSlotIds,
            preferredDays: t.preferredDays,
            avoidDays: t.avoidDays,
            externalId: t.code
        })),
        subjects: mappedSubjects.map(s => {
            const subject = subjects.find(sub => sub.id === s.code);
            return {
                id: `sub_${s.code}`,
                code: s.name,
                name: s.name,
                ...(programType === 'DP' ? { 
                    hoursPerWeekHL: subject?.hoursPerWeekHL || 5, 
                    hoursPerWeekSL: subject?.hoursPerWeekSL || 3 
                } : {})
            };
        }),
        teachingGroups: mappedTeachingGroups.map(tg => ({
            id: `tg_${tg.code}`,
            sectionId: tg.sectionId,
            studentGroup: tg.studentGroup,
            subjectId: `sub_${Object.keys(subjectIdMap).find(key => subjectIdMap[key] === tg.subjectId) || tg.subjectId}`,
            ...(programType === 'DP' ? { level: tg.level } : {}),
            requiredMinutesPerWeek: tg.requiredMinutesPerWeek
        })),
        lessons: mappedLessons.map(l => ({
            id: l.id,
            subject: l.subject,
            studentGroup: l.studentGroup,
            teachingGroupId: `tg_${mappedTeachingGroups.find(tg => tg.id === l.teachingGroupId)?.code || l.teachingGroupId}`,
            sectionId: l.sectionId,
            subjectId: `sub_${Object.keys(subjectIdMap).find(key => subjectIdMap[key] === l.subjectId) || l.subjectId}`,
            yearGroup: l.yearGroup,
            requiredCapacity: l.requiredCapacity,
            teacherId: l.teacherId,
            ...(programType === 'DP' ? { 
                studentIds: l.studentIds.map(sid => String(sid)),
                level: l.level
            } : {})
        })),
        subjectRequirements: subjectRequirements.map(req => ({
            studentGroup: req.studentGroup || "Unknown",
            ...(programType === 'DP' ? { teachingGroupId: `tg_${mappedTeachingGroups.find(tg => tg.id === req.teachingGroupId)?.code || req.teachingGroupId}` } : {}),
            subject: req.subject,
            minutesPerWeek: req.minutesPerWeek
        })),
        blockedSlotIds: [],
        constraints: {
            spreadAcrossDaysPerTeachingGroupSection: true,
            avoidSamePeriodRepetition: constraints?.maxSameSubjectPerDayHardEnabled !== false,
            avoidTeacherLatePeriods: true
        }
    };

    let finalPayload = {};
    if (programType === 'DP') {
        finalPayload = {
            ...basePayload,
            payloadType: "individual_payload",
            programType: "DP",
            studentSubjectChoices: studentSubjectChoices.length > 0 ? studentSubjectChoices.map(c => ({
                studentId: c.studentId,
                subjectId: `sub_${c.subjectId}`,
                subject: c.subject,
                level: c.level,
                yearGroup: c.yearGroup
            })) : [], // No dummy! Dummy causes missing subject error
            llmSoftConstraints: {
                studentWindows: [] // Populate from LLM if needed
            },
            dpConfig: {
                blocks: [],
                notes: "Auto-generated DP schedule"
            }
        };
    } else {
        finalPayload = {
            ...basePayload,
            payloadType: "cohort_payload",
            programType: programType,
            llmSoftConstraints: {
                teacherPreferences: [] // Populate from LLM if needed
            },
            mypConfig: {
                campus: "Main",
                notes: `Auto-generated ${programType} schedule`
            }
        };
        // Ensure studentIds are removed (already handled by ternary map above, but double check)
        finalPayload.lessons.forEach(l => delete l.studentIds);
    }
    
    // Ensure all references are using correctly prefixed IDs as in template
    console.log('[Pipeline] Generated Payload Type:', finalPayload.payloadType);

    // 6. Call Solver
    // Force exact endpoint as requested
    const endpointUrl = 'http://87.106.27.27:8080/base44/ingest';

    // The backend expects a single payload object per request, not wrapped in a multi-school array
    finalPayload.organizationId = `org_${user.school_id}`;
    finalPayload.runId = `run_${schedule_version_id}`;

    const requestBody = JSON.stringify(finalPayload);
    
    console.log('[Pipeline] === OPTAPLANNER REQUEST ===');
    console.log(`[Pipeline] URL: ${endpointUrl}`);
    console.log(`[Pipeline] Method: POST`);
    console.log(`[Pipeline] Request body present: ${!!requestBody}`);
    console.log(`[Pipeline] Body length: ${requestBody.length} chars`);
    console.log('[Pipeline] ==============================');

    const response = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': OPTAPLANNER_API_KEY
        },
        body: requestBody
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

    // Check if OptaPlanner returned a logical error within a 200 OK response
    if (result.ok === false || result.errorCode || result.errorMessage || (Array.isArray(result.validationErrors) && result.validationErrors.length > 0)) {
        console.error('[Pipeline] OptaPlanner validation/logical error:', result.errorMessage, result.validationErrors);
        return Response.json({
            ok: false,
            error: result.title || result.errorMessage || result.message || 'OptaPlanner Validation Error',
            details: result.validationErrors || result.details || result
        }, { status: 400 });
    }

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
            else if (sr.result?.assignedLessons) finalAssignments = finalAssignments.concat(sr.result.assignedLessons);
        });
    } else {
        finalAssignments = result.assignedLessons || result.lessons || result.assignments || (Array.isArray(result) ? result : []);
    }
    
    console.log(`[Pipeline] Found ${finalAssignments.length} assignments to process.`);
    if (finalAssignments.length > 0) {
        console.log(`[Pipeline] Sample assignment:`, JSON.stringify(finalAssignments[0]));
    } else {
        console.log(`[Pipeline] Result keys:`, Object.keys(result));
    }

    // Reverse maps
    const revTeacherMap = Object.fromEntries(Object.entries(teacherIdMap).map(([k, v]) => [v, k]));
    const revRoomMap = Object.fromEntries(Object.entries(roomIdMap).map(([k, v]) => [v, k]));
    const safeLessonMap = Object.fromEntries(mappedLessons.map(l => [l.id, l]));

    const slotsToInsert = [];
    
    for (const lesson of finalAssignments) {
        const lessonId = lesson.id || lesson.lessonId || lesson.lesson_id;
        const originalLesson = safeLessonMap[lessonId];
        
        const timeslotId = lesson.timeslotId != null ? lesson.timeslotId : (lesson.timeslot?.id != null ? lesson.timeslot.id : null);
        
        if (originalLesson && timeslotId != null) {
            const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
            const periodsPerDay = schoolData.periods_per_day || 10;
            const dayIndex = Math.floor((timeslotId - 1) / periodsPerDay);
            const day = lesson.dayOfWeek || lesson.timeslot?.dayOfWeek || days[dayIndex] || 'MONDAY';
            const periodIndex = lesson.periodIndex != null ? lesson.periodIndex : (timeslotId - 1) % periodsPerDay;

            const subjectNameStr = String(lesson.subject || '').toUpperCase();
            const isBreak = subjectNameStr === 'LUNCH' || subjectNameStr === 'BREAK';

            const tId = lesson.teacherId || lesson.teacher?.id;
            const rId = lesson.roomId || lesson.room?.id;

            let realTgId = originalLesson.originalTgId; // Extracted directly from our safemap

            if (!realTgId && originalLesson.teachingGroupId) {
                const numTg = mappedTeachingGroups.find(g => g.id === originalLesson.teachingGroupId);
                if (numTg) realTgId = numTg.code;
            }

            slotsToInsert.push({
                school_id: user.school_id,
                schedule_version: schedule_version_id,
                teaching_group_id: realTgId,
                teacher_id: tId ? revTeacherMap[tId] : null,
                room_id: rId ? revRoomMap[rId] : null,
                timeslot_id: timeslotId,
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
            hardScoreNegative: scoreToSave < 0,
            debug: {
                assignmentsFound: finalAssignments.length,
                sampleAssignment: finalAssignments.length > 0 ? finalAssignments[0] : null,
                resultKeys: Object.keys(result)
            }
        }
    });

  } catch (error) {
    console.error('[Pipeline] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});