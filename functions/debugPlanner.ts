import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = { school_id: '696e113f47bd4dd652e12917' };
    const schedule_version_id = '69a6185adc65bc2b8a116442';
    
    const [teachingGroups, subjects, students] = await Promise.all([
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id, is_active: true }),
    ]);

    const activeSubjectOriginalIds = new Set(teachingGroups.map(tg => tg.subject_id));
    
    const missingChoices = [];
    
    // Check if any student is in a teaching group but doesn't have it in their subject choices
    teachingGroups.forEach(tg => {
        if (!tg.student_ids) return;
        const subject = subjects.find(s => s.id === tg.subject_id);
        
        tg.student_ids.forEach(studentId => {
            const student = students.find(s => s.id === studentId);
            if (!student) return;
            
            const hasChoice = student.subject_choices && student.subject_choices.some(c => c.subject_id === tg.subject_id);
            if (!hasChoice) {
                missingChoices.push({
                    student: student.full_name,
                    subject: subject ? subject.name : tg.subject_id,
                    isCore: subject?.is_core
                });
            }
        });
    });

    return Response.json({
        missingChoicesCount: missingChoices.length,
        missingChoicesSample: missingChoices.slice(0, 10)
    });
  } catch (e) {
    return Response.json({ error: e.stack });
  }
});