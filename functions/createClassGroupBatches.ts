import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper to batch operations with delays and retry logic
async function batchProcess(items, batchSize, processor, delayMs = 300) {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    // Process each item in batch sequentially to avoid rate limits
    for (const item of batch) {
      let retries = 3;
      while (retries > 0) {
        try {
          const result = await processor(item);
          results.push(result);
          await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between each item
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait longer on error
        }
      }
    }
    
    // Delay between batches
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return results;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Step 1: Delete ALL existing ClassGroups (batched)
    const existingGroups = await base44.asServiceRole.entities.ClassGroup.filter({
      school_id: schoolId
    });
    
    if (existingGroups.length > 0) {
      await batchProcess(
        existingGroups, 
        5, 
        (group) => base44.asServiceRole.entities.ClassGroup.delete(group.id),
        400
      );
    }

    // Step 2: Get all active students and clear their classgroup_ids (batched)
    const allStudents = await base44.asServiceRole.entities.Student.filter({
      school_id: schoolId,
      is_active: true
    });

    const studentsToUpdate = allStudents.filter(s => s.classgroup_id);
    if (studentsToUpdate.length > 0) {
      await batchProcess(
        studentsToUpdate,
        5,
        (student) => base44.asServiceRole.entities.Student.update(student.id, {
          classgroup_id: null
        }),
        400
      );
    }

    // Step 3: Filter students with year_group and sort by name
    const eligibleStudents = allStudents
      .filter(s => s.year_group)
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

    // Step 4: Group by programme + year_group
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
    const classGroupsToCreate = [];
    
    for (const [key, data] of Object.entries(groups)) {
      const { ib_programme, year_group, students } = data;
      const batchSize = 20;
      const numBatches = Math.ceil(students.length / batchSize);

      for (let i = 0; i < numBatches; i++) {
        const batchLetter = String.fromCharCode(65 + i);
        const batchStudents = students.slice(i * batchSize, (i + 1) * batchSize);
        
        classGroupsToCreate.push({
          school_id: schoolId,
          name: `${year_group}-Batch-${batchLetter}`,
          year_group: year_group,
          ib_programme: ib_programme,
          batch_letter: batchLetter,
          student_ids: batchStudents.map(s => s.id),
          max_students: 20,
          is_active: true
        });
      }
    }

    // Step 6: Create all ClassGroups
    const createdGroups = await base44.asServiceRole.entities.ClassGroup.bulkCreate(classGroupsToCreate);

    // Step 7: Update students with their new classgroup_id (batched)
    const studentsToAssign = [];
    for (const group of createdGroups) {
      for (const studentId of group.student_ids) {
        studentsToAssign.push({ studentId, groupId: group.id });
      }
    }

    await batchProcess(
      studentsToAssign,
      5,
      (item) => base44.asServiceRole.entities.Student.update(item.studentId, {
        classgroup_id: item.groupId
      }),
      400
    );

    return Response.json({
      success: true,
      message: `Created ${createdGroups.length} class groups with ${studentsToAssign.length} students assigned`,
      groups: createdGroups.map(g => ({
        name: g.name,
        year_group: g.year_group,
        programme: g.ib_programme,
        students: g.student_ids.length
      }))
    });

  } catch (error) {
    console.error('Error creating class groups:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});