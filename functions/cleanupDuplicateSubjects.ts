import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting duplicate subject cleanup...');
    
    // Fetch all students
    const students = await base44.asServiceRole.entities.Student.filter({ 
      school_id: user.school_id 
    });

    let studentsFixed = 0;
    const fixDetails = [];

    for (const student of students) {
      if (!student.subject_choices || student.subject_choices.length === 0) continue;

      // Remove duplicates: keep only first occurrence of each subject_id
      const seenSubjects = new Set();
      const uniqueChoices = [];
      let hasDuplicates = false;

      for (const choice of student.subject_choices) {
        if (!seenSubjects.has(choice.subject_id)) {
          seenSubjects.add(choice.subject_id);
          uniqueChoices.push(choice);
        } else {
          hasDuplicates = true;
          console.log(`Found duplicate: ${student.full_name} - subject ${choice.subject_id}`);
        }
      }

      if (hasDuplicates) {
        // Update student with cleaned subject_choices
        await base44.asServiceRole.entities.Student.update(student.id, {
          subject_choices: uniqueChoices
        });

        studentsFixed++;
        fixDetails.push({
          name: student.full_name,
          before: student.subject_choices.length,
          after: uniqueChoices.length,
          removed: student.subject_choices.length - uniqueChoices.length
        });

        console.log(`✅ Fixed ${student.full_name}: ${student.subject_choices.length} → ${uniqueChoices.length} subjects`);
      }
    }

    return Response.json({
      success: true,
      students_checked: students.length,
      students_fixed: studentsFixed,
      details: fixDetails
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});