import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const explicitSchoolId = body?.school_id;
    const schoolId = explicitSchoolId || user.school_id;

    if (explicitSchoolId && user?.role !== 'admin' && explicitSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: cannot run for another school' }, { status: 403 });
    }

    console.log('Starting class group generation for school:', schoolId);

    // Fetch students for this school (up to 10k)
    const students = await base44.asServiceRole.entities.Student.filter(
      { school_id: schoolId },
      '-created_date',
      10000
    );

    console.log(`Found ${students.length} students`);

    // Diagnostics summary
    const programmeYearCounts = {};
    for (const s of students) {
      const prog = s.ib_programme || 'unknown';
      const yr = s.year_group || 'unknown';
      const key = `${prog}:${yr}`;
      programmeYearCounts[key] = (programmeYearCounts[key] || 0) + 1;
    }
    const sampleStudentIds = students.slice(0, 5).map(s => s.id);

    if (students.length === 0) {
      // Extra diagnostics: show counts by school_id across all students and subject counts for this school
      const allStudents = await base44.asServiceRole.entities.Student.list().catch(() => []);
      const otherSchoolCounts = {};
      const sampleStudentIdBySchool = {};
      for (const s of allStudents) {
        const sid = s.school_id || 'null';
        otherSchoolCounts[sid] = (otherSchoolCounts[sid] || 0) + 1;
        if (!sampleStudentIdBySchool[sid]) sampleStudentIdBySchool[sid] = s.id;
      }
      const subjectsForSchool = await base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }).catch(() => []);

      return Response.json({ 
        success: true,
        message: 'No students found for this school. Please add/import students first.',
        classGroupsCreated: 0,
        totalStudents: 0,
        diagnostics: {
          schoolId,
          programmeYearCounts,
          sampleStudentIds,
          otherSchoolCounts,
          sampleStudentIdBySchool,
          subjectsForSchoolCount: subjectsForSchool.length,
          sampleSubjectIds: subjectsForSchool.slice(0,5).map(s => s.id)
        }
      });
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

    // Update students in small batches to avoid timeouts
    console.log(`Updating ${Object.keys(studentAssignments).length} students...`);
    
    const entries = Object.entries(studentAssignments);
    let updated = 0;
    let failed = 0;
    const batchUpdateSize = 10;
    
    for (let i = 0; i < entries.length; i += batchUpdateSize) {
      const batch = entries.slice(i, i + batchUpdateSize);
      
      await Promise.all(batch.map(async ([studentId, groupId]) => {
        try {
          await base44.asServiceRole.entities.Student.update(studentId, {
            classgroup_id: groupId
          });
          updated++;
        } catch (err) {
          console.error(`Failed to update student ${studentId}:`, err.message);
          failed++;
        }
      }));
      
      if ((i + batchUpdateSize) % 50 === 0) {
        console.log(`Updated ${updated}/${entries.length} students...`);
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`Finished: ${updated} updated, ${failed} failed`);

    return Response.json({
      success: true,
      message: `Created ${createdGroups.length} class groups with ${eligibleStudents.length} students`,
      totalStudents: students.length,
      assignedStudents: eligibleStudents.length,
      ineligibleStudents: ineligibleCount,
      diagnostics: {
        schoolId,
        programmeYearCounts,
        sampleStudentIds
      },
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