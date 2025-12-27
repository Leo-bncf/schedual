import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Step 1: Fetch ALL students (no limit)
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
    let allGroups = [];
    let groupSkip = 0;
    
    while (true) {
      const groupBatch = await base44.asServiceRole.entities.ClassGroup.filter({
        school_id: schoolId
      }, '-created_date', 100, groupSkip);
      
      if (groupBatch.length === 0) break;
      allGroups = allGroups.concat(groupBatch);
      
      if (groupBatch.length < 100) break;
      groupSkip += 100;
    }
    
    for (const group of allGroups) {
      await base44.asServiceRole.entities.ClassGroup.delete(group.id);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Step 3: Clear ALL student classgroup_ids
    for (const student of allStudents) {
      if (student.classgroup_id) {
        await base44.asServiceRole.entities.Student.update(student.id, {
          classgroup_id: null
        });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

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

    // Step 6: Assign EACH student to their ClassGroup
    let assignedCount = 0;
    for (const group of createdGroups) {
      for (const studentId of group.student_ids) {
        await base44.asServiceRole.entities.Student.update(studentId, {
          classgroup_id: group.id
        });
        assignedCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`Assigned ${assignedCount} students`);

    return Response.json({
      success: true,
      message: `Created ${createdGroups.length} class groups with ${assignedCount} students assigned`,
      totalStudents: allStudents.length,
      eligibleStudents: eligibleStudents.length,
      ineligibleStudents: ineligibleStudents.length,
      assignedStudents: assignedCount,
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
        students: g.student_ids.length
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