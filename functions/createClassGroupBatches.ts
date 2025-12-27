import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Step 1: Delete ALL existing ClassGroups
    const existingGroups = await base44.asServiceRole.entities.ClassGroup.filter({
      school_id: schoolId
    });
    
    for (const group of existingGroups) {
      await base44.asServiceRole.entities.ClassGroup.delete(group.id);
    }

    // Step 2: Get all active students and clear their classgroup_ids
    const allStudents = await base44.asServiceRole.entities.Student.filter({
      school_id: schoolId,
      is_active: true
    });

    for (const student of allStudents) {
      if (student.classgroup_id) {
        await base44.asServiceRole.entities.Student.update(student.id, {
          classgroup_id: null
        });
      }
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

    // Step 7: Update students with their new classgroup_id
    let updated = 0;
    for (const group of createdGroups) {
      for (const studentId of group.student_ids) {
        await base44.asServiceRole.entities.Student.update(studentId, {
          classgroup_id: group.id
        });
        updated++;
      }
    }

    return Response.json({
      success: true,
      message: `Created ${createdGroups.length} class groups with ${updated} students`,
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