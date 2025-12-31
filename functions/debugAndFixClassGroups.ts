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
    
    // Delete all existing ClassGroups for this school to start fresh
    const existingClassGroups = await base44.asServiceRole.entities.ClassGroup.filter({
      school_id: schoolId
    });
    
    for (const cg of existingClassGroups) {
      await base44.asServiceRole.entities.ClassGroup.delete(cg.id);
    }
    
    // Clear all students' classgroup_ids
    for (const student of eligibleStudents) {
      await base44.asServiceRole.entities.Student.update(student.id, {
        classgroup_id: null
      });
    }

    // Group by year_group and ib_programme, then sort by student name
    const studentsByYear = {};
    eligibleStudents
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
      .forEach(student => {
        const key = `${student.ib_programme}_${student.year_group}`;
        if (!studentsByYear[key]) {
          studentsByYear[key] = {
            year_group: student.year_group,
            ib_programme: student.ib_programme,
            students: []
          };
        }
        studentsByYear[key].students.push(student);
      });

    const classGroupsToCreate = [];

    // Create ClassGroups (up to 20 students per group)
    for (const [key, groupData] of Object.entries(studentsByYear)) {
      const { year_group, ib_programme, students } = groupData;
      const batchSize = 20;
      const numBatches = Math.ceil(students.length / batchSize);

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i); // A, B, C, etc.
        const startIdx = i * batchSize;
        const endIdx = Math.min((i + 1) * batchSize, students.length);
        const batchStudents = students.slice(startIdx, endIdx);
        
        const classGroup = {
          school_id: schoolId,
          name: `${year_group}-Batch-${batchLetter}`,
          year_group: year_group,
          ib_programme: ib_programme,
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

    // For PYP/MYP: Get ALL subjects for each programme and assign to ALL students
    const allSubjects = await base44.asServiceRole.entities.Subject.filter({ school_id: schoolId });
    
    const programmeSubjects = {
      PYP: allSubjects
        .filter(s => s.ib_level === 'PYP' && s.is_active !== false)
        .map(s => ({ subject_id: s.id, ib_group: s.ib_group })),
      MYP: allSubjects
        .filter(s => s.ib_level === 'MYP' && s.is_active !== false)
        .map(s => ({ subject_id: s.id, ib_group: s.ib_group }))
    };

    console.log(`Found ${programmeSubjects.PYP.length} PYP subjects and ${programmeSubjects.MYP.length} MYP subjects`);

    // Update students with their ClassGroup IDs AND ALL programme subjects
    let successfulUpdates = 0;
    
    for (const classGroup of createdClassGroups) {
      for (const studentId of classGroup.student_ids) {
        try {
          const updateData = { classgroup_id: classGroup.id };
          
          // For PYP/MYP: Assign ALL subjects for their programme
          if (classGroup.ib_programme === 'PYP' || classGroup.ib_programme === 'MYP') {
            updateData.subject_choices = programmeSubjects[classGroup.ib_programme];
          }
          
          await base44.asServiceRole.entities.Student.update(studentId, updateData);
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