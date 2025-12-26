import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Get all students without ClassGroups
    const allStudents = await base44.entities.Student.filter({ school_id: schoolId });
    const studentsWithoutClassGroup = allStudents.filter(s => !s.classgroup_id && s.is_active);

    if (studentsWithoutClassGroup.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'All students already assigned to ClassGroups',
        classGroupsCreated: 0
      });
    }

    // Group students by year_group
    const studentsByYear = {};
    studentsWithoutClassGroup.forEach(student => {
      const key = student.year_group;
      if (!studentsByYear[key]) {
        studentsByYear[key] = [];
      }
      studentsByYear[key].push(student);
    });

    const classGroupsToCreate = [];
    const studentUpdates = [];

    // Create ClassGroups for each year_group (exactly 20 students per group)
    for (const [yearGroup, students] of Object.entries(studentsByYear)) {
      const ibProgramme = students[0].ib_programme;
      const batchSize = 20;
      const numBatches = Math.floor(students.length / batchSize); // Only create full batches

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i); // A, B, C, etc.
        const batchStudents = students.slice(i * batchSize, (i + 1) * batchSize);
        
        const classGroup = {
          school_id: schoolId,
          name: `${yearGroup}-Batch-${batchLetter}`,
          year_group: yearGroup,
          ib_programme: ibProgramme,
          batch_letter: batchLetter,
          student_ids: batchStudents.map(s => s.id),
          max_students: batchSize,
          is_active: true
        };

        classGroupsToCreate.push(classGroup);
      }
    }

    // Create all ClassGroups (if any to create)
    if (classGroupsToCreate.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'Not enough students to form complete ClassGroups (need groups of 20)',
        classGroupsCreated: 0
      });
    }

    const createdClassGroups = await base44.asServiceRole.entities.ClassGroup.bulkCreate(classGroupsToCreate);

    // Update students with their ClassGroup IDs - one at a time to avoid rate limits
    let successfulUpdates = 0;
    let failedUpdates = 0;
    
    for (const classGroup of createdClassGroups) {
      for (const studentId of classGroup.student_ids) {
        try {
          await base44.asServiceRole.entities.Student.update(studentId, {
            classgroup_id: classGroup.id
          });
          successfulUpdates++;
          // Small delay between each update
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (updateError) {
          console.error(`Failed to update student ${studentId}:`, updateError.message);
          failedUpdates++;
          // Wait longer on error before retrying next student
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    return Response.json({
      success: true,
      message: `Created ${createdClassGroups.length} ClassGroups`,
      classGroupsCreated: createdClassGroups.length,
      studentsAssigned: successfulUpdates,
      studentUpdatesFailed: failedUpdates,
      classGroups: createdClassGroups
    });

  } catch (error) {
    console.error('Error generating ClassGroups:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});