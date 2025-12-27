import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Get ALL students
    const allStudents = await base44.entities.Student.filter({ school_id: schoolId });
    
    // Debug info
    const debugInfo = {
      totalStudents: allStudents.length,
      studentsWithClassGroup: allStudents.filter(s => s.classgroup_id).length,
      studentsWithoutClassGroup: allStudents.filter(s => !s.classgroup_id).length,
      inactiveStudents: allStudents.filter(s => s.is_active === false).length,
      studentsByYearGroup: {}
    };

    // Count students by year_group
    allStudents.forEach(s => {
      const year = s.year_group || 'NO_YEAR_GROUP';
      debugInfo.studentsByYearGroup[year] = (debugInfo.studentsByYearGroup[year] || 0) + 1;
    });

    // Filter students eligible for class groups (active students with year_group)
    const eligibleStudents = allStudents.filter(s => 
      s.is_active !== false && 
      s.year_group
    );

    if (eligibleStudents.length === 0) {
      return Response.json({ 
        success: false,
        message: 'No eligible students found for class group generation',
        debug: debugInfo
      });
    }
    
    // Clear existing classgroup_ids to regenerate fresh batches
    for (const student of eligibleStudents) {
      if (student.classgroup_id) {
        await base44.asServiceRole.entities.Student.update(student.id, {
          classgroup_id: null
        });
      }
    }

    // Group by year_group
    const studentsByYear = {};
    eligibleStudents.forEach(student => {
      const key = student.year_group;
      if (!studentsByYear[key]) {
        studentsByYear[key] = [];
      }
      studentsByYear[key].push(student);
    });

    const classGroupsToCreate = [];

    // Create ClassGroups (up to 20 students per group)
    for (const [yearGroup, students] of Object.entries(studentsByYear)) {
      const ibProgramme = students[0].ib_programme;
      const batchSize = 20;
      const numBatches = Math.ceil(students.length / batchSize); // Create partial batches too

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i); // A, B, C, etc.
        const startIdx = i * batchSize;
        const endIdx = Math.min((i + 1) * batchSize, students.length);
        const batchStudents = students.slice(startIdx, endIdx);
        
        const classGroup = {
          school_id: schoolId,
          name: `${yearGroup}-Batch-${batchLetter}`,
          year_group: yearGroup,
          ib_programme: ibProgramme,
          batch_letter: batchLetter,
          student_ids: batchStudents.map(s => s.id),
          max_students: 20,
          is_active: true
        };

        classGroupsToCreate.push(classGroup);
      }
    }

    if (classGroupsToCreate.length === 0) {
      return Response.json({ 
        success: false,
        message: 'No class groups could be created',
        debug: debugInfo,
        eligibleStudents: eligibleStudents.length
      });
    }

    // Create ClassGroups
    const createdClassGroups = await base44.asServiceRole.entities.ClassGroup.bulkCreate(classGroupsToCreate);

    // Update students with their ClassGroup IDs
    let successfulUpdates = 0;
    
    for (const classGroup of createdClassGroups) {
      for (const studentId of classGroup.student_ids) {
        try {
          await base44.asServiceRole.entities.Student.update(studentId, {
            classgroup_id: classGroup.id
          });
          successfulUpdates++;
        } catch (updateError) {
          console.error(`Failed to update student ${studentId}:`, updateError.message);
        }
      }
    }

    return Response.json({
      success: true,
      message: `Created ${createdClassGroups.length} ClassGroups with ${successfulUpdates} students`,
      classGroupsCreated: createdClassGroups.length,
      studentsAssigned: successfulUpdates,
      debug: debugInfo,
      classGroups: createdClassGroups.map(cg => ({
        name: cg.name,
        year_group: cg.year_group,
        student_count: cg.student_ids.length
      }))
    });

  } catch (error) {
    console.error('Error in debugAndFixClassGroups:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});