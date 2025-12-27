import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;
    console.log('=== STARTING CLASS GROUP GENERATION ===');
    console.log('User:', user.email, 'School ID:', schoolId);

    // Step 1: Fetch ALL students - try without filter first to debug
    console.log('Fetching ALL students from database (no filter)...');
    const allStudentsNoFilter = await base44.asServiceRole.entities.Student.list('-created_date', 500);
    console.log(`Found ${allStudentsNoFilter.length} total students in database`);
    console.log('Sample student school_ids:', allStudentsNoFilter.slice(0, 5).map(s => ({ 
      name: s.full_name, 
      school_id: s.school_id,
      matches: s.school_id === schoolId
    })));
    
    // Now filter for this school
    console.log(`Filtering for school_id: ${schoolId}`);
    const allStudents = allStudentsNoFilter.filter(s => s.school_id === schoolId);
    
    console.log(`✓ Total students for this school: ${allStudents.length}`);
    
    if (allStudents.length === 0) {
      return Response.json({ 
        error: 'No students found for this school',
        schoolId: schoolId,
        userEmail: user.email,
        totalStudentsInDB: allStudentsNoFilter.length,
        debug: {
          userSchoolId: schoolId,
          sampleSchoolIds: allStudentsNoFilter.slice(0, 10).map(s => s.school_id)
        }
      }, { status: 400 });
    }

    // Step 2: Delete ALL existing ClassGroups
    let existingGroups = [];
    let skip = 0;
    
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
    const groupToStudentMap = new Map(); // Track which students belong to which group
    
    for (const [key, data] of Object.entries(groups)) {
      const { ib_programme, year_group, students } = data;
      const batchSize = 20;
      const numBatches = Math.ceil(students.length / batchSize);

      console.log(`Creating ${numBatches} batches for ${year_group} ${ib_programme} (${students.length} students)`);

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i);
        const batchStudents = students.slice(i * batchSize, (i + 1) * batchSize);
        
        console.log(`Creating ${year_group}-Batch-${batchLetter} with ${batchStudents.length} students`);
        
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
        
        // Store the mapping
        groupToStudentMap.set(group.id, batchStudents.map(s => s.id));
        createdGroups.push(group);
        
        console.log(`✓ Created group ${group.id}: ${group.name}`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Created ${createdGroups.length} class groups`);
    console.log(`Total students to assign: ${Array.from(groupToStudentMap.values()).flat().length}`);

    // Step 6: Assign EACH student to their ClassGroup using the map
    console.log(`Assigning students to ${createdGroups.length} class groups`);
    
    let assignedCount = 0;
    let failedCount = 0;
    const failedDetails = [];
    
    // Process in smaller batches to avoid rate limiting
    const chunkSize = 10;
    
    for (const group of createdGroups) {
      const studentIds = groupToStudentMap.get(group.id);
      
      if (!studentIds || studentIds.length === 0) {
        console.log(`⚠ Group ${group.name} (${group.id}) has no students in map!`);
        continue;
      }
      
      console.log(`Assigning ${studentIds.length} students to ${group.name} (${group.id})`);
      
      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize);
        
        const results = await Promise.all(
          chunk.map(studentId => 
            base44.asServiceRole.entities.Student.update(studentId, {
              classgroup_id: group.id
            }).then((updated) => {
              console.log(`✓ Student ${studentId} → Group ${group.id}`);
              return { success: true, studentId };
            })
            .catch(err => {
              console.error(`✗ Failed student ${studentId}:`, err.message);
              failedDetails.push({ studentId, groupId: group.id, error: err.message });
              return { success: false, studentId, error: err.message };
            })
          )
        );
        
        assignedCount += results.filter(r => r.success).length;
        failedCount += results.filter(r => !r.success).length;
        
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`✓ Assigned ${assignedCount} students successfully`);
    if (failedCount > 0) {
      console.log(`✗ Failed to assign ${failedCount} students`);
      console.log('Details:', failedDetails);
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