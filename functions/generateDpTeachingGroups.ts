import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { school_id } = await req.json();

    if (school_id !== user.school_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch DP students
    const students = await base44.asServiceRole.entities.Student.filter({
      school_id,
      ib_programme: 'DP'
    });

    const subjects = await base44.asServiceRole.entities.Subject.filter({
      school_id,
      ib_level: 'DP'
    });

    const generatedGroups = [];

    // Group students by subject + level combinations
    for (const subject of subjects) {
      for (const level of subject.available_levels || ['HL', 'SL']) {
        const studentsWithSubject = students.filter(s =>
          s.subject_choices?.some(sc => sc.subject_id === subject.id && sc.level === level)
        );

        if (studentsWithSubject.length > 0) {
          // Create teaching group
          const groupName = `${subject.name} ${level} - Group A`;
          const requiredHours = level === 'HL' ? subject.hl_hours_per_week : subject.sl_hours_per_week;

          const groupData = {
            school_id,
            name: groupName,
            subject_id: subject.id,
            level,
            year_group: 'DP1', // Default year
            teacher_id: null, // Will be assigned later
            student_ids: studentsWithSubject.map(s => s.id),
            hours_per_week: requiredHours,
            max_students: 20,
            min_students: 1
          };

          const created = await base44.asServiceRole.entities.TeachingGroup.create(groupData);
          generatedGroups.push(created);
        }
      }
    }

    return Response.json({
      success: true,
      generatedCount: generatedGroups.length,
      groups: generatedGroups
    });
  } catch (error) {
    console.error('DP group generation error:', error);
    return Response.json({
      error: error.message || 'Failed to generate DP teaching groups'
    }, { status: 500 });
  }
});