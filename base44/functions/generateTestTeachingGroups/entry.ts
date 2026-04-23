import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auto-generates TEST/DS teaching groups for each cohort (DP1, DP2, MYP, PYP)
 * - Creates one TEST group per year_group with supervisor teacher
 * - Configurable periods/minutes from env vars
 * - Marks students in each cohort for test scheduling
 */

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized or no school assigned' }, { status: 403 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const school_id = user.school_id;

    // Configuration from env vars
    const testPeriodsPerWeek = Number(Deno.env.get('TEST_PERIODS_PER_WEEK') || 2);
    const testMinutesPerWeek = Number(Deno.env.get('TEST_MINUTES_PER_WEEK') || 120);

    // Fetch existing data
    const [school, subjects, students, teachers, existingTestGroups] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(r => r?.[0] || null),
      base44.entities.Subject.filter({ school_id }),
      base44.entities.Student.filter({ school_id }),
      base44.entities.Teacher.filter({ school_id }),
      base44.entities.TeachingGroup.filter({ school_id }).then(tgs => 
        tgs.filter(tg => {
          const subj = subjects.find(s => s.id === tg.subject_id);
          return subj && String(subj.code || subj.name || '').toUpperCase().includes('TEST');
        })
      )
    ]);

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Find or create TEST subject
    let testSubject = subjects.find(s => 
      String(s.code || s.name || '').toUpperCase() === 'TEST'
    );

    if (!testSubject) {
      testSubject = await base44.entities.Subject.create({
        school_id,
        name: 'Test / Assessment',
        code: 'TEST',
        ib_level: 'DP',
        is_active: true,
        color: '#9333ea',
        supervisor_teacher_id: teachers.find(t => t.is_active)?.id || null
      });
    }

    // Find supervisor teacher (or use first active teacher)
    const supervisorTeacher = teachers.find(t => t.id === testSubject.supervisor_teacher_id) 
      || teachers.find(t => t.is_active);

    // Group students by year_group
    const studentsByYearGroup = {};
    for (const student of students) {
      const yg = student.year_group || 'UNKNOWN';
      if (!studentsByYearGroup[yg]) studentsByYearGroup[yg] = [];
      studentsByYearGroup[yg].push(student);
    }

    const createdGroups = [];
    const skippedGroups = [];

    // Create TEST group for each year group
    for (const [yearGroup, cohortStudents] of Object.entries(studentsByYearGroup)) {
      if (cohortStudents.length === 0) continue;

      // Check if TEST group already exists for this year group
      const existing = existingTestGroups.find(tg => tg.year_group === yearGroup);
      if (existing) {
        skippedGroups.push({
          year_group: yearGroup,
          reason: 'already_exists',
          existing_id: existing.id
        });
        continue;
      }

      // Create TEST teaching group
      const testGroup = await base44.entities.TeachingGroup.create({
        school_id,
        name: `TEST - ${yearGroup}`,
        subject_id: testSubject.id,
        year_group: yearGroup,
        teacher_id: supervisorTeacher?.id || null,
        student_ids: cohortStudents.map(s => s.id),
        minutes_per_week: testMinutesPerWeek,
        periods_per_week: testPeriodsPerWeek,
        is_active: true,
        max_students: cohortStudents.length,
        min_students: 1
      });

      createdGroups.push({
        id: testGroup.id,
        name: testGroup.name,
        year_group: yearGroup,
        student_count: cohortStudents.length,
        minutes_per_week: testMinutesPerWeek,
        periods_per_week: testPeriodsPerWeek
      });
    }

    return Response.json({
      success: true,
      created: createdGroups.length,
      skipped: skippedGroups.length,
      testSubjectId: testSubject.id,
      configuration: {
        testPeriodsPerWeek,
        testMinutesPerWeek
      },
      createdGroups,
      skippedGroups
    });

  } catch (error) {
    console.error('[generateTestTeachingGroups] Error:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});