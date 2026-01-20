import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { school_id, teaching_group_ids } = await req.json();

    if (school_id !== user.school_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch teaching groups that need assignment
    const groupsToAssign = teaching_group_ids && teaching_group_ids.length > 0
      ? await Promise.all(
          teaching_group_ids.map(id => 
            base44.asServiceRole.entities.TeachingGroup.filter({ id })
              .then(groups => groups[0])
          )
        )
      : await base44.asServiceRole.entities.TeachingGroup.filter({
          school_id,
          teacher_id: null
        });

    const teachers = await base44.asServiceRole.entities.Teacher.filter({
      school_id,
      is_active: true
    });

    const subjects = await base44.asServiceRole.entities.Subject.filter({
      school_id
    });

    const assignments = [];
    const unassigned = [];

    // Assign teachers to groups based on qualifications
    for (const group of groupsToAssign) {
      if (!group) continue;

      const subject = subjects.find(s => s.id === group.subject_id);
      if (!subject) continue;

      // Find qualified teacher with lowest workload
      const qualified = teachers
        .filter(t => 
          t.qualifications?.some(q => 
            q.subject_id === subject.id && 
            q.ib_levels?.includes(subject.ib_level)
          )
        )
        .sort((a, b) => (a.max_hours_per_week || 25) - (b.max_hours_per_week || 25));

      if (qualified.length > 0) {
        const teacher = qualified[0];
        const updated = await base44.asServiceRole.entities.TeachingGroup.update(
          group.id,
          { teacher_id: teacher.id }
        );
        assignments.push({ group_id: group.id, teacher_id: teacher.id });
      } else {
        unassigned.push(group.id);
      }
    }

    return Response.json({
      success: true,
      assignedCount: assignments.length,
      unassignedCount: unassigned.length,
      assignments,
      unassigned
    });
  } catch (error) {
    console.error('Teacher assignment error:', error);
    return Response.json({
      error: error.message || 'Failed to assign teachers'
    }, { status: 500 });
  }
});