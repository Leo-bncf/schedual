import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = { school_id: '696e113f47bd4dd652e12917' };
    const schedule_version_id = '69a6185adc65bc2b8a116442';
    
    const [teachingGroups, subjects, students, lessons] = await Promise.all([
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version_id }) // just dummy fetch to keep same layout
    ]);

    const activeSubjectOriginalIds = new Set(teachingGroups.map(tg => tg.subject_id));
    const activeSubjects = subjects.filter(s => activeSubjectOriginalIds.has(s.id));

    // For each student subject choice, check if there is a teaching group for that subject AND level
    const validationErrors = [];
    const missingLevelGroups = [];
    
    students.forEach(student => {
        if (!student.is_active || !student.subject_choices) return;
        student.subject_choices.forEach(choice => {
            if (!activeSubjectOriginalIds.has(choice.subject_id)) return; // Skipped if not scheduled
            
            const subject = subjects.find(s => s.id === choice.subject_id);
            const level = choice.level || 'SL';
            
            const matchingTg = teachingGroups.find(tg => tg.subject_id === choice.subject_id && tg.level === level);
            if (!matchingTg) {
                const tgLevelsForSubject = [...new Set(teachingGroups.filter(tg => tg.subject_id === choice.subject_id).map(tg => tg.level))];
                missingLevelGroups.push({
                    student: student.full_name,
                    subject: subject ? subject.name : choice.subject_id,
                    requestedLevel: level,
                    availableLevels: tgLevelsForSubject
                });
            }
        });
    });

    return Response.json({
        missingLevelGroups
    });
  } catch (e) {
    return Response.json({ error: e.stack });
  }
});