import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { student_id, classgroup_id, subject_choices } = await req.json();

    if (!student_id && !classgroup_id) {
      return Response.json({ error: 'student_id or classgroup_id required' }, { status: 400 });
    }

    let targetClassGroupId = classgroup_id;
    let subjectsToSync = subject_choices;

    // If student_id provided, get their classgroup and subjects
    if (student_id) {
      const student = await base44.asServiceRole.entities.Student.filter({ 
        id: student_id,
        school_id: user.school_id 
      });
      
      if (!student || student.length === 0) {
        return Response.json({ error: 'Student not found' }, { status: 404 });
      }

      targetClassGroupId = student[0].classgroup_id;
      subjectsToSync = subject_choices || student[0].subject_choices || [];
    }

    if (!targetClassGroupId) {
      return Response.json({ error: 'No ClassGroup found' }, { status: 400 });
    }

    // Get all students in this ClassGroup
    const studentsInGroup = await base44.asServiceRole.entities.Student.filter({
      school_id: user.school_id,
      classgroup_id: targetClassGroupId,
      is_active: true
    });

    console.log(`Syncing ${subjectsToSync.length} subjects to ${studentsInGroup.length} students in ClassGroup ${targetClassGroupId}`);

    // Update all students with the same subject choices
    let updatedCount = 0;
    for (const student of studentsInGroup) {
      // Skip if student_id was provided and this is the same student
      if (student_id && student.id === student_id) {
        continue;
      }

      await base44.asServiceRole.entities.Student.update(student.id, {
        subject_choices: subjectsToSync
      });
      updatedCount++;
    }

    // Auto-assign teaching groups
    await base44.asServiceRole.functions.invoke('autoAssignPYPMYPGroups');

    return Response.json({
      success: true,
      classgroup_id: targetClassGroupId,
      students_updated: updatedCount,
      total_students: studentsInGroup.length,
      subjects_synced: subjectsToSync.length
    });

  } catch (error) {
    console.error('Error syncing ClassGroup subjects:', error);
    return Response.json({ 
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});