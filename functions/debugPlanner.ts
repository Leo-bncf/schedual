import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = { school_id: '696e113f47bd4dd652e12917' };
    const schedule_version_id = '69a6185adc65bc2b8a116442';
    
    const [scheduleVersion, teachers, students, rooms, teachingGroups, subjects, school] = await Promise.all([
      base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version_id }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.School.filter({ id: user.school_id })
    ]);

    const schoolData = school[0];
    let programType = 'DP'; 

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
        return {
            id: numId,
            code: String(t.id),
            name: String(t.full_name),
            maxPeriodsPerWeek: Number(t.max_hours_per_week || 25),
            unavailableSlotIds: [],
            unavailableDays: [],
            preferredDays: [],
            avoidDays: []
        };
    });

    const getSafeSubjectName = (subj) => {
        const normalized = String(subj.name || subj.code || "SUBJ")
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9]/g, '')
            .toUpperCase()
            .substring(0, 15);
        return `${normalized}_${String(subj.id).slice(-6).toUpperCase()}`;
    };

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
        const periodDuration = schoolData.period_duration_minutes || 60;
        const numLessons = Math.ceil(requiredMinutes / periodDuration);
        
        if (numLessons <= 0) return; 
        
        const tgLessonIds = [];
        
        subjectRequirements.push({
            studentGroup: String(tg.year_group),
            teachingGroupId: numId,
            sectionId: `sec_${tg.id}`,
            subject: getSafeSubjectName(subject),
            originalSubjectId: String(subject.id),
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
                originalSubjectId: String(subject.id),
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
            originalSubjectId: String(subject.id),
            level: String(tg.level || 'SL'),
            requiredMinutesPerWeek: requiredMinutes,
            lessonIds: tgLessonIds
        });
    });

    const activeSubjectOriginalIds = new Set(mappedLessons.map(l => l.originalSubjectId));

    const studentSubjectChoices = [];
    if (programType === 'DP') {
        students.filter(s => s.is_active).forEach(student => {
            if (student.subject_choices) {
                student.subject_choices.forEach(choice => {
                    const choiceSubId = String(choice.subject_id);
                    if (activeSubjectOriginalIds.has(choiceSubId)) {
                        const subject = subjects.find(sub => String(sub.id) === choiceSubId);
                        if (subject) {
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
    }

    const basePayload = {
        subjects: subjects
            .filter(sub => activeSubjectOriginalIds.has(String(sub.id)))
            .map(sub => ({
                id: `sub_${sub.id}`,
                code: getSafeSubjectName(sub),
                name: getSafeSubjectName(sub)
            })),
        lessons: mappedLessons.map(l => ({
            id: l.id,
            subject: l.subject,
            studentGroup: l.studentGroup,
            teachingGroupId: `tg_${mappedTeachingGroups.find(tg => tg.id === l.teachingGroupId)?.code || l.teachingGroupId}`,
            sectionId: l.sectionId,
            subjectId: `sub_${l.originalSubjectId}`,
            yearGroup: l.yearGroup,
            requiredCapacity: l.requiredCapacity,
            teacherId: l.teacherId,
            ...(programType === 'DP' ? { 
                studentIds: l.studentIds.map(sid => String(sid)),
                level: l.level
            } : {})
        })),
        studentSubjectChoices: studentSubjectChoices.map(c => ({
            studentId: c.studentId,
            subjectId: `sub_${c.originalSubjectId}`,
            subject: c.subject,
            level: c.level,
            yearGroup: c.yearGroup
        })),
        subjectRequirements: subjectRequirements.map(req => ({
            studentGroup: req.studentGroup || "Unknown",
            teachingGroupId: `tg_${mappedTeachingGroups.find(tg => tg.id === req.teachingGroupId)?.code || req.teachingGroupId}`,
            subject: req.subject,
            subjectId: `sub_${req.originalSubjectId}`,
            minutesPerWeek: req.minutesPerWeek
        }))
    };

    // check if any lesson, requirement, or choice references a subject NOT in subjects array
    const subjectIdsInPayload = new Set(basePayload.subjects.map(s => s.id));
    const subjectNamesInPayload = new Set(basePayload.subjects.map(s => s.name));
    
    const missingSubjects = [];
    const missingNames = [];

    basePayload.lessons.forEach(l => {
        if (!subjectIdsInPayload.has(l.subjectId)) missingSubjects.push(l.subjectId);
        if (!subjectNamesInPayload.has(l.subject)) missingNames.push(l.subject);
    });
    basePayload.studentSubjectChoices.forEach(c => {
        if (!subjectIdsInPayload.has(c.subjectId)) missingSubjects.push(c.subjectId);
        if (!subjectNamesInPayload.has(c.subject)) missingNames.push(c.subject);
    });
    basePayload.subjectRequirements.forEach(req => {
        if (!subjectIdsInPayload.has(req.subjectId)) missingSubjects.push(req.subjectId);
        if (!subjectNamesInPayload.has(req.subject)) missingNames.push(req.subject);
    });

    return Response.json({
        subjectsArrayCount: basePayload.subjects.length,
        missingSubjects: [...new Set(missingSubjects)],
        missingNames: [...new Set(missingNames)],
        sampleSubjectInArray: basePayload.subjects[0],
        sampleLesson: basePayload.lessons[0],
        sampleChoice: basePayload.studentSubjectChoices[0],
        sampleReq: basePayload.subjectRequirements[0]
    });
  } catch (e) {
    return Response.json({ error: e.stack });
  }
});