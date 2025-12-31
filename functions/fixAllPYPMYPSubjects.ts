import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'No school assigned' }, { status: 400 });
    }

    const schoolId = user.school_id;

    // Get ALL PYP and MYP subjects
    const allSubjects = await base44.asServiceRole.entities.Subject.filter({ 
      school_id: schoolId 
    });

    const pypSubjects = allSubjects
      .filter(s => s.ib_level === 'PYP' && s.is_active !== false)
      .map(s => ({ subject_id: s.id, ib_group: s.ib_group }));

    const mypSubjects = allSubjects
      .filter(s => s.ib_level === 'MYP' && s.is_active !== false)
      .map(s => ({ subject_id: s.id, ib_group: s.ib_group }));

    console.log(`Found ${pypSubjects.length} PYP subjects and ${mypSubjects.length} MYP subjects`);

    // Get ALL PYP and MYP students
    const allStudents = await base44.asServiceRole.entities.Student.filter({ 
      school_id: schoolId 
    });

    const pypStudents = allStudents.filter(s => s.ib_programme === 'PYP');
    const mypStudents = allStudents.filter(s => s.ib_programme === 'MYP');

    console.log(`Found ${pypStudents.length} PYP students and ${mypStudents.length} MYP students`);

    let fixed = 0;

    // Fix ALL PYP students - assign ALL PYP subjects
    for (const student of pypStudents) {
      await base44.asServiceRole.entities.Student.update(student.id, {
        subject_choices: pypSubjects
      });
      fixed++;
      console.log(`Fixed ${student.full_name}: assigned ${pypSubjects.length} PYP subjects`);
    }

    // Fix ALL MYP students - assign ALL MYP subjects
    for (const student of mypStudents) {
      await base44.asServiceRole.entities.Student.update(student.id, {
        subject_choices: mypSubjects
      });
      fixed++;
      console.log(`Fixed ${student.full_name}: assigned ${mypSubjects.length} MYP subjects`);
    }

    return Response.json({
      success: true,
      fixed_students: fixed,
      pyp_students: pypStudents.length,
      myp_students: mypStudents.length,
      pyp_subjects_assigned: pypSubjects.length,
      myp_subjects_assigned: mypSubjects.length
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});