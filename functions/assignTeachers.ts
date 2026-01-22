import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auto-assigns qualified teachers to teaching groups
 * Matches based on subject qualifications and availability
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const school_id = user.school_id;

    // Fetch teaching groups and teachers
    const [teachingGroups, teachers] = await Promise.all([
      base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
      base44.entities.Teacher.filter({ school_id, is_active: true })
    ]);

    if (teachingGroups.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No teaching groups to assign',
        assigned: 0 
      });
    }

    let assignedCount = 0;

    // Assign teachers to groups
    for (const group of teachingGroups) {
      // Skip if already assigned
      if (group.teacher_id) continue;

      // Find qualified teachers for this subject
      const qualifiedTeachers = teachers.filter(t => 
        t.subjects && t.subjects.includes(group.subject_id)
      );

      if (qualifiedTeachers.length === 0) continue;

      // Simple assignment: pick first qualified teacher
      // TODO: Enhance with load balancing
      const assignedTeacher = qualifiedTeachers[0];

      await base44.asServiceRole.entities.TeachingGroup.update(group.id, {
        teacher_id: assignedTeacher.id
      });

      assignedCount++;
    }

    return Response.json({ 
      success: true,
      assigned: assignedCount,
      message: `Assigned teachers to ${assignedCount} teaching groups`
    });

  } catch (error) {
    console.error('Assign teachers error:', error);
    return Response.json({ 
      error: error.message || 'Failed to assign teachers' 
    }, { status: 500 });
  }
});