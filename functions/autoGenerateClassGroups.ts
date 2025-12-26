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

    // Create ClassGroups for each year_group
    for (const [yearGroup, students] of Object.entries(studentsByYear)) {
      const ibProgramme = students[0].ib_programme;
      const batchSize = 20;
      const numBatches = Math.ceil(students.length / batchSize);

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

    // Create all ClassGroups
    const createdClassGroups = await base44.asServiceRole.entities.ClassGroup.bulkCreate(classGroupsToCreate);

    // Update students with their ClassGroup IDs
    for (const classGroup of createdClassGroups) {
      for (const studentId of classGroup.student_ids) {
        await base44.asServiceRole.entities.Student.update(studentId, {
          classgroup_id: classGroup.id
        });
      }
    }

    return Response.json({
      success: true,
      message: `Created ${createdClassGroups.length} ClassGroups`,
      classGroupsCreated: createdClassGroups.length,
      studentsAssigned: studentsWithoutClassGroup.length,
      classGroups: createdClassGroups
    });

  } catch (error) {
    console.error('Error generating ClassGroups:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});