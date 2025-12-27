import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Step 1: Fetch ALL students (no is_active filter)
    let allStudents = [];
    let skip = 0;
    const batchSize = 100;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.Student.filter(
        { school_id: schoolId },
        '-created_date',
        batchSize,
        skip
      );
      
      if (batch.length === 0) break;
      allStudents = allStudents.concat(batch);
      
      if (batch.length < batchSize) break;
      skip += batchSize;
    }

    console.log(`Total students fetched: ${allStudents.length}`);

    // Step 2: Delete ALL existing ClassGroups
    let existingGroups = [];
    skip = 0;
    
    while (true) {
      const batch = await base44.asServiceRole.entities.ClassGroup.filter(
        { school_id: schoolId },
        '-created_date',
        100,
        skip
      );
      
      if (batch.length === 0) break;
      existingGroups = existingGroups.concat(batch);
      
      if (batch.length < 100) break;
      skip += 100;
    }
    
    console.log(`Deleting ${existingGroups.length} existing class groups`);
    
    for (const group of existingGroups) {
      await base44.asServiceRole.entities.ClassGroup.delete(group.id);
    }

    // Step 3: Clear ALL student classgroup_ids (batch updates)
    console.log(`Clearing classgroup_ids for ${allStudents.length} students`);
    
    const updatePromises = allStudents.map(student => 
      base44.asServiceRole.entities.Student.update(student.id, {
        classgroup_id: null
      }).catch(err => {
        console.error(`Failed to clear classgroup_id for student ${student.id}:`, err);
        return null;
      })
    );
    
    await Promise.all(updatePromises);

    // Step 4: Group students by programme + year_group
    const eligibleStudents = allStudents.filter(s => s.year_group && s.ib_programme);
    const ineligibleStudents = allStudents.filter(s => !s.year_group || !s.ib_programme);
    
    const groups = {};
    eligibleStudents.forEach(student => {
      const key = `${student.ib_programme}_${student.year_group}`;
      if (!groups[key]) {
        groups[key] = {
          ib_programme: student.ib_programme,
          year_group: student.year_group,
          students: []
        };
      }
      groups[key].students.push(student);
    });

    // Step 5: Create ClassGroups (20 students per batch)
    const createdGroups = [];
    
    for (const [key, data] of Object.entries(groups)) {
      const { ib_programme, year_group, students } = data;
      const batchSize = 20;
      const numBatches = Math.ceil(students.length / batchSize);

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i);
        const batchStudents = students.slice(i * batchSize, (i + 1) * batchSize);
        
        const group = await base44.asServiceRole.entities.ClassGroup.create({
          school_id: schoolId,
          name: `${year_group}-Batch-${batchLetter}`,
          year_group: year_group,
          ib_programme: ib_programme,
          batch_letter: batchLetter,
          student_ids: batchStudents.map(s => s.id),
          max_students: 20,
          is_active: true
        });
        
        createdGroups.push(group);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Created ${createdGroups.length} class groups`);

    // Step 6: Assign EACH student to their ClassGroup (in smaller batches)
    console.log(`Assigning students to ${createdGroups.length} class groups`);
    console.log('Group details:', createdGroups.map(g => ({ id: g.id, name: g.name, studentCount: g.student_ids?.length || 0 })));
    
    let assignedCount = 0;
    let failedCount = 0;
    const failedDetails = [];
    
    // Process in smaller batches to avoid rate limiting
    const chunkSize = 10;
    
    for (const group of createdGroups) {
      if (!group.student_ids || group.student_ids.length === 0) {
        console.log(`Group ${group.name} has no student_ids!`);
        continue;
      }
      
      console.log(`Assigning ${group.student_ids.length} students to ${group.name} (group id: ${group.id})`);
      
      for (let i = 0; i < group.student_ids.length; i += chunkSize) {
        const chunk = group.student_ids.slice(i, i + chunkSize);
        
        const results = await Promise.all(
          chunk.map(studentId => 
            base44.asServiceRole.entities.Student.update(studentId, {
              classgroup_id: group.id
            }).then((updated) => {
              console.log(`✓ Assigned student ${studentId} to group ${group.id}`);
              return { success: true, studentId };
            })
            .catch(err => {
              console.error(`✗ Failed to assign student ${studentId}:`, err.message, err);
              failedDetails.push({ studentId, groupId: group.id, error: err.message });
              return { success: false, studentId, error: err.message };
            })
          )
        );
        
        assignedCount += results.filter(r => r.success).length;
        failedCount += results.filter(r => !r.success).length;
        
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Successfully assigned ${assignedCount} students, ${failedCount} failed`);
    if (failedDetails.length > 0) {
      console.log('Failed assignment details:', failedDetails);
    }

    return Response.json({
      success: true,
      message: `Created ${createdGroups.length} class groups with ${assignedCount} students assigned`,
      totalStudents: allStudents.length,
      eligibleStudents: eligibleStudents.length,
      ineligibleStudents: ineligibleStudents.length,
      assignedStudents: assignedCount,
      failedStudents: failedCount,
      missingYearGroupStudents: ineligibleStudents.map(s => ({
        id: s.id,
        name: s.full_name,
        programme: s.ib_programme,
        year_group: s.year_group
      })),
      groups: createdGroups.map(g => ({
        name: g.name,
        year_group: g.year_group,
        programme: g.ib_programme,
        students: g.student_ids?.length || 0
      }))
    });

  } catch (error) {
    console.error('Error creating class groups:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});