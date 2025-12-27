import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;
    console.log('Starting class group generation for school:', schoolId);

    // Fetch all students for this school
    const students = await base44.asServiceRole.entities.Student.filter(
      { school_id: schoolId },
      '-created_date',
      500
    );
    
    console.log(`Found ${students.length} students`);

    if (students.length === 0) {
      return Response.json({ 
        error: 'No students found for this school',
        schoolId 
      }, { status: 400 });
    }

    // Delete existing class groups
    const existingGroups = await base44.asServiceRole.entities.ClassGroup.filter(
      { school_id: schoolId },
      '-created_date',
      500
    );
    
    console.log(`Deleting ${existingGroups.length} existing class groups`);
    for (const group of existingGroups) {
      await base44.asServiceRole.entities.ClassGroup.delete(group.id);
    }

    // Filter eligible students (must have year_group and programme)
    const eligibleStudents = students.filter(s => s.year_group && s.ib_programme);
    const ineligibleCount = students.length - eligibleStudents.length;
    
    console.log(`Eligible: ${eligibleStudents.length}, Ineligible: ${ineligibleCount}`);

    // Group students by programme + year_group
    const groups = {};
    eligibleStudents.forEach(student => {
      const key = `${student.ib_programme}_${student.year_group}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(student);
    });

    // Create class groups and build assignment map
    const createdGroups = [];
    const studentAssignments = {}; // studentId -> classgroupId

    for (const [key, studentList] of Object.entries(groups)) {
      const [programme, yearGroup] = key.split('_');
      const batchSize = 20;
      const numBatches = Math.ceil(studentList.length / batchSize);

      console.log(`Creating ${numBatches} batches for ${yearGroup} (${studentList.length} students)`);

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i);
        const batchStudents = studentList.slice(i * batchSize, (i + 1) * batchSize);
        const studentIds = batchStudents.map(s => s.id);

        const group = await base44.asServiceRole.entities.ClassGroup.create({
          school_id: schoolId,
          name: `${yearGroup}-Batch-${batchLetter}`,
          year_group: yearGroup,
          ib_programme: programme,
          batch_letter: batchLetter,
          student_ids: studentIds,
          max_students: 20,
          is_active: true
        });

        createdGroups.push(group);
        console.log(`Created: ${group.name} with ${studentIds.length} students`);

        // Map each student to this group
        batchStudents.forEach(student => {
          studentAssignments[student.id] = group.id;
        });
      }
    }

    // Update all students with their classgroup_id sequentially with retry logic
    console.log(`Updating ${Object.keys(studentAssignments).length} students...`);
    
    const entries = Object.entries(studentAssignments);
    let updated = 0;
    let failed = 0;
    
    for (const [studentId, groupId] of entries) {
      let attempts = 0;
      let success = false;
      
      while (attempts < 3 && !success) {
        try {
          await base44.asServiceRole.entities.Student.update(studentId, {
            classgroup_id: groupId
          });
          updated++;
          success = true;
          if (updated % 10 === 0) {
            console.log(`Updated ${updated}/${entries.length} students...`);
          }
        } catch (err) {
          attempts++;
          console.error(`Attempt ${attempts} failed for student ${studentId}:`, err.message);
          if (attempts < 3) {
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            failed++;
          }
        }
      }
      
      // Delay between each student to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Finished: ${updated} updated, ${failed} failed`);

    return Response.json({
      success: true,
      message: `Created ${createdGroups.length} class groups with ${eligibleStudents.length} students`,
      totalStudents: students.length,
      assignedStudents: eligibleStudents.length,
      ineligibleStudents: ineligibleCount,
      groups: createdGroups.map(g => ({
        name: g.name,
        year_group: g.year_group,
        programme: g.ib_programme,
        studentCount: g.student_ids.length
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});