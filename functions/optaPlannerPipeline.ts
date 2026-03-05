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
        const normalized = String(subj.name || subj.code || "SUBJ")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .substring(0, 15);
            
        return `${normalized}${String(subj.id).slice(-6).toUpperCase()}`;
    };

    // 2. Build Teaching Groups and Lessons
    const mappedTeachingGroups = [];
    const mappedLessons = [];
    const subjectRequirements = [];
    let lessonIdCounter = 1;

    const activeTGs = teachingGroups.filter(tg => {
        if (!tg.is_active || !tg.year_group || tg.year_group.includes(',')) return false;
        
        // Put aside Core subjects (TOK, CAS, EE)
        const subject = subjects.find(s => s.id === tg.subject_id);
        if (!subject) return false;
        if (subject.is_core) return false;
        
        const nameUpper = String(subject.name || '').toUpperCase();
        if (nameUpper === 'TOK' || nameUpper.includes('THEORY OF KNOWLEDGE') || 
            nameUpper === 'CAS' || nameUpper.includes('CREATIVITY, ACTIVITY, SERVICE') || 
            nameUpper.includes('EXTENDED ESSAY') || nameUpper === 'EE') {
            return false;
        }
        
        return true;
    });
    
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
        
        if (numLessons <= 0) return; // Skip zero-lesson groups completely
        
        const tgLessonIds = [];
        
        subjectRequirements.push({
            studentGroup: String(tg.year_group),
            teachingGroupId: numId,
            sectionId: `sec_${tg.id}`,
            subject: getSafeSubjectName(subject),
            originalSubjectId: String(subject.id), // explicit string ID
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
                originalSubjectId: String(subject.id), // explicit string ID
                level: String(tg.level || 'SL'),
                yearGroup: String(tg.year_group),
                studentIds: studentIds,
                requiredCapacity: Math.max(1, studentIds.length),
                blockId: tg.block_id ? String(tg.block_id) : null,
                teacherId: tg.teacher_id ? teacherIdMap[tg.teacher_id] : null,
                timeslotId: null,
                roomId: null,
                originalTgId: tg.id
            });
        }

        mappedTeachingGroups.push({
            id: numId,
            code: String(tg.id),
            sectionId: `sec_${tg.id}`,
            studentGroup: String(tg.year_group),
            originalSubjectId: String(subject.id), // explicit string ID
            level: String(tg.level || 'SL'),
            requiredMinutesPerWeek: requiredMinutes,
            lessonIds: tgLessonIds
        });
    });

    // Determine exactly which subjects are actively used in generated lessons
    const activeSubjectOriginalIds = new Set(mappedLessons.map(l => l.originalSubjectId));

    // 3. Build Student Subject Choices (only for DP)
    const studentSubjectChoices = [];
    if (programType === 'DP') {
        const studentChoiceSet = new Set();
        
        // 1. First add explicit student choices
        students.filter(s => s.is_active).forEach(student => {
            if (student.subject_choices) {
                student.subject_choices.forEach(choice => {
                    const choiceSubId = String(choice.subject_id);
                    if (activeSubjectOriginalIds.has(choiceSubId)) {
                        const subject = subjects.find(sub => String(sub.id) === choiceSubId);
                        if (subject) {
                            studentChoiceSet.add(`${student.id}_${choiceSubId}`);
                            studentSubjectChoices.push({
                                studentId: String(student.id),
                                originalSubjectId: choiceSubId,
                                subject: getSafeSubjectName(subject),
                                level: String(choice.level || 'SL'),
                                yearGroup: String(student.year_group || 'DP1')
                            });
                        }
                    }
                });
            }
        });

        // 2. Inject missing choices based on actual lessons (for Core subjects like TOK/EE/CAS or misconfigured students)
        mappedLessons.forEach(lesson => {
            const subId = lesson.originalSubjectId;
            const subject = subjects.find(sub => String(sub.id) === subId);
            if (!subject) return;

            (lesson.studentIds || []).forEach(studentId => {
                const key = `${studentId}_${subId}`;
                if (!studentChoiceSet.has(key)) {
                    studentChoiceSet.add(key);
                    const student = students.find(s => s.id === studentId);
                    studentSubjectChoices.push({
                        studentId: String(studentId),
                        originalSubjectId: subId,
                        subject: getSafeSubjectName(subject),
                        level: String(lesson.level || 'SL'), // fallback to lesson level
                        yearGroup: String(student?.year_group || lesson.yearGroup || 'DP1')
                    });
                }
            });
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
            if (!mock_school_id) {
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
            }
        } catch (e) {
            console.error('[Pipeline] LLM constraint extraction failed:', e);
        }
    }

    // 5. Construct Payload
    
    // If no active subjects, we can't solve
    if (activeSubjectOriginalIds.size === 0) {
        return Response.json({ ok: false, error: 'No active lessons or subjects to schedule. Please check Teaching Groups.' }, { status: 400 });
    }

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
        subjects: subjects
            .filter(sub => activeSubjectOriginalIds.has(String(sub.id)))
            .map((sub) => ({
                id: String(sub.id),
                code: getSafeSubjectName(sub),
                name: String(sub.name || sub.code || getSafeSubjectName(sub)),
                ...(programType === 'DP' ? { 
                    hoursPerWeekHL: Number(sub.hoursPerWeekHL || 5), 
                    hoursPerWeekSL: Number(sub.hoursPerWeekSL || 3) 
                } : {})
            })),
        teaching_groups: mappedTeachingGroups.map(tg => ({
            id: `tg_${tg.code}`,
            sectionId: tg.sectionId,
            student_group: tg.studentGroup,
            subject_id: String(tg.originalSubjectId),
            ...(programType === 'DP' ? { level: tg.level } : {}),
            requiredMinutesPerWeek: tg.requiredMinutesPerWeek
        })),
        lessons: mappedLessons.map(l => ({
            id: l.id,
            subject: l.subject, // must match subjects[].code
            studentGroup: l.studentGroup,
            teachingGroupId: `tg_${mappedTeachingGroups.find(tg => tg.id === l.teachingGroupId)?.code || l.teachingGroupId}`,
            sectionId: l.sectionId,
            yearGroup: l.yearGroup,
            requiredCapacity: l.requiredCapacity,
            teacherId: l.teacherId,
            ...(programType === 'DP' ? { 
                studentIds: l.studentIds.map(sid => String(sid)),
                level: l.level
            } : {})
        })),
        subject_requirements: subjectRequirements.map(req => ({
            studentGroup: req.studentGroup || "Unknown",
            teachingGroupId: `tg_${mappedTeachingGroups.find(tg => tg.id === req.teachingGroupId)?.code || req.teachingGroupId}`,
            sectionId: req.sectionId,
            subject: req.subject, // must match subjects[].code
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
            studentSubjectChoices: studentSubjectChoices.map(c => ({
                studentId: c.studentId,
                subjectId: c.originalSubjectId,
                subject: c.subject, // matches subjects[].code
                level: c.level,
                yearGroup: c.yearGroup
                })),
            llmSoftConstraints: {
                studentWindows: []
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
                teacherPreferences: []
            },
            mypConfig: {
                campus: "Main",
                notes: `Auto-generated ${programType} schedule`
            }
        };
        finalPayload.lessons.forEach(l => delete l.studentIds);
    }
    
    // Ensure all references are using correctly prefixed IDs as in template
    console.log('[Pipeline] Generated Payload Type:', finalPayload.payloadType);

    // Purge core subjects (TOK, EE, CAS) from payload entirely
    const isCoreByMeta = (s) => {
        const n = String(s?.name || s?.code || '').toUpperCase();
        return Boolean(s?.is_core) ||
            n === 'TOK' || n.includes('THEORY OF KNOWLEDGE') ||
            n === 'CAS' || n.includes('CREATIVITY, ACTIVITY, SERVICE') ||
            n === 'EE' || n.includes('EXTENDED ESSAY');
    };
    const corePrefixedIds = new Set(
        (subjects || []).filter(isCoreByMeta).map(s => `sub_${s.id}`)
    );
    const isCoreName = (str) => {
        const u = String(str || '').toUpperCase();
        return u.includes('TOK') || u.includes('EXTENDEDESSAY') || u.includes('THEORYOFKNOWLEDGE') ||
               u.includes('CAS') || u.includes('CREATIVITYACTIVITYSERVICE') || u === 'EE';
    };

    const beforeCounts = {
        subjects: (finalPayload.subjects || []).length,
        lessons: (finalPayload.lessons || []).length,
        subject_requirements: (finalPayload.subject_requirements || []).length,
        choices: (finalPayload.studentSubjectChoices || []).length,
        teaching_groups: (finalPayload.teaching_groups || []).length
    };

    finalPayload.subjects = (finalPayload.subjects || []).filter(s => !isCoreName(s.code || s.name));
    finalPayload.lessons = (finalPayload.lessons || []).filter(l => !isCoreName(l.subject));
    finalPayload.subject_requirements = (finalPayload.subject_requirements || []).filter(r => !isCoreName(r.subject));
    finalPayload.teaching_groups = (finalPayload.teaching_groups || []).filter(tg => {
        const subj = (finalPayload.subjects || []).find(s => s.id === tg.subject_id);
        return subj ? !isCoreName(subj.code || subj.name) : true;
    });
    if (finalPayload.payloadType === 'individual_payload') {
        finalPayload.studentSubjectChoices = (finalPayload.studentSubjectChoices || []).filter(c => !isCoreName(c.subject));
    }

    const afterCounts = {
        subjects: (finalPayload.subjects || []).length,
        lessons: (finalPayload.lessons || []).length,
        subject_requirements: (finalPayload.subject_requirements || []).length,
        choices: (finalPayload.studentSubjectChoices || []).length,
        teaching_groups: (finalPayload.teaching_groups || []).length
    };
    if (Object.values(beforeCounts).some((v, i) => v !== Object.values(afterCounts)[i])) {
        console.log('[Pipeline] Core subjects purged from payload:', { beforeCounts, afterCounts, corePrefixedIds: Array.from(corePrefixedIds) });
    }

    // Build direct maps based on subjects list
    const idToCode = Object.fromEntries((finalPayload.subjects || []).map(s => [s.id, s.code || s.name]));
    const codeToId = Object.fromEntries((finalPayload.subjects || []).map(s => [s.code || s.name, s.id]));
    // expose for solver consumption
    finalPayload.subjectIdByCode = codeToId;

    console.log('[Pipeline] Subject map ready:', { subjects: (finalPayload.subjects || []).length });

    // Ensure subject_requirements align with lesson scopes (positive minutes when lessons exist)
    (() => {
        const pdur = Number(basePayload.scheduleSettings.periodDurationMinutes || 60);
        const key = (o) => `${o.teachingGroupId || ''}|${o.sectionId || ''}|${o.studentGroup || ''}|${o.subject || ''}`;
        const reqs = finalPayload.subject_requirements || [];
        const reqMap = new Map(reqs.map(r => [key(r), r]));

        // Build lessons map per scope
        const lessonsByKey = new Map();
        (finalPayload.lessons || []).forEach(l => {
            const k = key(l);
            const arr = lessonsByKey.get(k) || [];
            arr.push(l);
            lessonsByKey.set(k, arr);
        });

        const ensured = [];
        lessonsByKey.forEach((arr, k) => {
            const l0 = arr[0];
            let req = reqMap.get(k);
            const inferredMinutes = arr.length * pdur;
            if (!req) {
                req = {
                    studentGroup: l0.studentGroup || 'Unknown',
                    teachingGroupId: l0.teachingGroupId,
                    sectionId: l0.sectionId,
                    subject: l0.subject,
                    minutesPerWeek: inferredMinutes
                };
                ensured.push(req);
            } else if (Number(req.minutesPerWeek || 0) <= 0) {
                // If lessons exist, requirement must be positive
                req.minutesPerWeek = inferredMinutes;
            }
        });

        if (ensured.length > 0) {
            finalPayload.subject_requirements = [...reqs, ...ensured];
        } else {
            finalPayload.subject_requirements = reqs;
        }
    })();

    // Ensure all subject strings are canonical (use code)
    finalPayload.lessons = (finalPayload.lessons || []).map(l => ({
        ...l,
        subject: l.subject && idToCode[finalPayload.subjectIdByCode[l.subject]] ? l.subject : l.subject
    }));
    finalPayload.subject_requirements = (finalPayload.subject_requirements || []).map(r => ({
        ...r,
        subject: r.subject && idToCode[finalPayload.subjectIdByCode[r.subject]] ? r.subject : r.subject
    }));
    if (finalPayload.payloadType === 'individual_payload') {
        finalPayload.studentSubjectChoices = (finalPayload.studentSubjectChoices || []).map(c => ({
            ...c,
            subject: c.subject && idToCode[finalPayload.subjectIdByCode[c.subject]] ? c.subject : c.subject
        }));
    }



    // Pre-validate subjects using codes and real IDs
    const definedSubjectIds = new Set((finalPayload.subjects || []).map(s => s.id));
    const definedSubjectCodes = new Set((finalPayload.subjects || []).map(s => s.code || s.name));
    const lessonCodes = new Set((finalPayload.lessons || []).map(l => l.subject).filter(Boolean));
    const reqCodes = new Set((finalPayload.subject_requirements || []).map(r => r.subject).filter(Boolean));
    const invalidLessonCodes = Array.from(lessonCodes).filter(c => !definedSubjectCodes.has(c));
    const invalidReqCodes = Array.from(reqCodes).filter(c => !definedSubjectCodes.has(c));
    const invalidTgSubjects = (finalPayload.teaching_groups || []).filter(tg => tg.subject_id && !definedSubjectIds.has(tg.subject_id)).map(tg => ({ tg_id: tg.id, subject_id: tg.subject_id }));
    if (invalidLessonCodes.length > 0 || invalidReqCodes.length > 0 || invalidTgSubjects.length > 0) {
        return Response.json({
            ok: false,
            error: 'Pre-validation failed: invalid subjects',
            details: {
                invalid_lesson_subjects: invalidLessonCodes,
                invalid_requirement_subjects: invalidReqCodes,
                invalid_teaching_group_subject_ids: invalidTgSubjects
            },
            debug_payload_preview: {
                subjects: (finalPayload.subjects || []).slice(0, 5),
                lessons: (finalPayload.lessons || []).slice(0, 3),
                subject_requirements: (finalPayload.subject_requirements || []).slice(0, 3)
            }
        }, { status: 400 });
    }

    // Also validate subject string names (code/name) alignment across payload
    const definedSubjectNames = new Set((finalPayload.subjects || []).map(s => (s.code || s.name)));
    const isCoreNameStrict = (str) => {
        const u = String(str || '').toUpperCase().replace(/\s+/g, '');
        return u === 'TOK' || u.includes('THEORYOFKNOWLEDGE') || u === 'CAS' || u.includes('CREATIVITYACTIVITYSERVICE') || u === 'EE' || u.includes('EXTENDEDESSAY');
    };
    const referencedSubjectNames = new Set();
    (finalPayload.lessons || []).forEach(l => { if (l.subject) referencedSubjectNames.add(l.subject); });
    (finalPayload.subject_requirements || []).forEach(r => { if (r.subject) referencedSubjectNames.add(r.subject); });
    let missingSubjectNames = Array.from(referencedSubjectNames).filter(n => !definedSubjectNames.has(n));
    missingSubjectNames = missingSubjectNames.filter(n => !isCoreNameStrict(n));

    // Build a compact subject mapping hint to help fix data quickly
    const subjectNameHints = (finalPayload.subjects || []).map(s => ({ id: s.id, code: s.code, name: s.name })).slice(0, 50);

    if (missingSubjectNames.length > 0) {
        console.warn('[Pipeline] Auto-corrected subject names count:', missingSubjectNames.length);
        // Do not hard-fail here; names were already aligned to IDs above.
    }

    // Validate uniqueness and id<->code alignment
    const subjectCodes = (finalPayload.subjects || []).map(s => s.code || s.name).filter(Boolean);
    const duplicateCodes = [...new Set(subjectCodes.filter((c, i, arr) => arr.indexOf(c) !== i))];
    if (duplicateCodes.length > 0) {
        return Response.json({ ok:false, error:'Pre-validation failed: duplicate subject codes', details: { duplicate_codes: duplicateCodes } }, { status:400 });
    }

    if (mock_school_id) {
        return Response.json({ ok: true, payload: finalPayload });
    }

    // 6. Call Solver
    // Force exact endpoint as requested
    const endpointUrl = 'http://87.106.27.27:8080/base44/ingest';

    // The backend expects a single payload object per request, not wrapped in a multi-school array
    finalPayload.organizationId = `org_${user.school_id}`;
    finalPayload.runId = `run_${schedule_version_id}`;

    // Final sanitize: remove any prefilled timeslotId to avoid scope duplicates entirely
    (() => {
      if (!finalPayload.lessons || finalPayload.lessons.length === 0) return;
      finalPayload.lessons = finalPayload.lessons.map(l => {
        const { timeslotId, ...rest } = l;
        return rest; // strip timeslotId key completely
      });
    })();



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
            const subjectDiagnostics = (() => {
                const subjectsList = (finalPayload.subjects || []).map(s => ({ id: s.id, code: s.code || s.name }));
                const refIds = [];
                const refNames = [];
                (finalPayload.lessons || []).forEach(l => { if (l.subjectId != null) refIds.push(l.subjectId); if (l.subject) refNames.push(l.subject); });
                (finalPayload.subject_requirements || []).forEach(r => { if (r.subjectId != null) refIds.push(r.subjectId); if (r.subject) refNames.push(r.subject); });
                if (finalPayload.payloadType === 'individual_payload') {
                    (finalPayload.studentSubjectChoices || []).forEach(c => { if (c.subjectId != null) refIds.push(c.subjectId); if (c.subject) refNames.push(c.subject); });
                }
                const definedIds = new Set(subjectsList.map(s => s.id));
                const definedNames = new Set(subjectsList.map(s => s.code));
                const missingIds = Array.from(new Set(refIds.filter(id => !definedIds.has(id))));
                const missingNames = Array.from(new Set(refNames.filter(n => !definedNames.has(n))));
                const nonNumericIds = Array.from(new Set(refIds.filter(id => typeof id !== 'number')));
                return { subjectsList: subjectsList.slice(0, 50), missingIds, missingNames: missingNames.slice(0, 50), nonNumericIds: nonNumericIds.slice(0, 50) };
            })();

            return Response.json({
                ok: false,
                error: `OptaPlanner validation failed`,
                details: errorDetails,
                subject_diagnostics: subjectDiagnostics,
                debug_payload_preview: {
                    subjects: (finalPayload.subjects || []).slice(0, 5),
                    lessons: (finalPayload.lessons || []).slice(0, 3),
                    subject_requirements: (finalPayload.subject_requirements || []).slice(0, 3)
                }
            }, { status: 400 });
        }
    }

    let result = {};
    try { result = JSON.parse(responseText); } catch(e) {}

    // Check if OptaPlanner returned a logical error within a 200 OK response
    if (result.ok === false || result.errorCode || result.errorMessage || (Array.isArray(result.validationErrors) && result.validationErrors.length > 0)) {
        console.error('[Pipeline] OptaPlanner validation/logical error:', result.errorMessage, result.validationErrors);
        const subjectDiagnostics = (() => {
            const subjectsList = (finalPayload.subjects || []).map(s => ({ id: s.id, code: s.code || s.name }));
            const refIds = [];
            const refNames = [];
            (finalPayload.lessons || []).forEach(l => { if (l.subjectId != null) refIds.push(l.subjectId); if (l.subject) refNames.push(l.subject); });
            (finalPayload.subject_requirements || []).forEach(r => { if (r.subjectId != null) refIds.push(r.subjectId); if (r.subject) refNames.push(r.subject); });
            if (finalPayload.payloadType === 'individual_payload') {
                (finalPayload.studentSubjectChoices || []).forEach(c => { if (c.subjectId != null) refIds.push(c.subjectId); if (c.subject) refNames.push(c.subject); });
            }
            const definedIds = new Set(subjectsList.map(s => s.id));
            const definedNames = new Set(subjectsList.map(s => s.code));
            const missingIds = Array.from(new Set(refIds.filter(id => !definedIds.has(id))));
            const missingNames = Array.from(new Set(refNames.filter(n => !definedNames.has(n))));
            const nonNumericIds = Array.from(new Set(refIds.filter(id => typeof id !== 'number')));
            return { subjectsList: subjectsList.slice(0, 50), missingIds, missingNames: missingNames.slice(0, 50), nonNumericIds: nonNumericIds.slice(0, 50) };
        })();

        return Response.json({
            ok: false,
            error: result.title || result.errorMessage || result.message || 'OptaPlanner Validation Error',
            details: result.validationErrors || result.details || result,
            subject_diagnostics: subjectDiagnostics,
            debug_payload: finalPayload // Inject payload so we can see it on error
        }, { status: 400 });
    }

    // 7. Process Results & Save
    // Clear any old/cached assignments for this version before inserting new ones
    const existingSlots = await b44Entities.ScheduleSlot.filter({
        school_id: user.school_id,
        schedule_version: schedule_version_id
    });
    if (existingSlots.length > 0) {
        for (const slot of existingSlots) await b44Entities.ScheduleSlot.delete(slot.id);
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
        await b44Entities.ScheduleSlot.bulkCreate(slotsToInsert);
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

    await b44Entities.ScheduleVersion.update(schedule_version_id, {
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