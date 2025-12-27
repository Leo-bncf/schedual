import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { student_id, subject_choices } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Get the student to find their classgroup
    const students = await base44.asServiceRole.entities.Student.filter({ 
      id: student_id,
      school_id: user.school_id 
    });
    
    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];
    
    // Check if student is PYP or MYP
    if (student.ib_programme !== 'PYP' && student.ib_programme !== 'MYP') {
      return Response.json({ 
        success: true, 
        message: 'Student is not PYP/MYP, no sync needed' 
      });
    }

    // If no classgroup, we can't sync
    if (!student.classgroup_id) {
      return Response.json({ 
        success: true,
        message: 'Student has no ClassGroup, no sync needed'
      });
    }

    const targetClassGroupId = student.classgroup_id;
    const subjectsToSync = subject_choices || [];

    console.log(`[SYNC] Syncing ${subjectsToSync.length} subjects to ClassGroup ${targetClassGroupId}`);

    // Get all students in this ClassGroup
    const allStudents = await base44.asServiceRole.entities.Student.filter({
      school_id: user.school_id
    });

    const studentsInGroup = allStudents.filter(s => 
      s.classgroup_id === targetClassGroupId && 
      s.is_active !== false
    );

    console.log(`[SYNC] Found ${studentsInGroup.length} students in ClassGroup`);

    // Update all students (including the original one for consistency)
    let updatedCount = 0;
    for (const studentInGroup of studentsInGroup) {
      await base44.asServiceRole.entities.Student.update(studentInGroup.id, {
        subject_choices: subjectsToSync
      });
      updatedCount++;
      console.log(`[SYNC] Updated student ${studentInGroup.full_name} (${studentInGroup.id})`);
    }

    console.log(`[SYNC] Updated ${updatedCount} students with ${subjectsToSync.length} subjects`);

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