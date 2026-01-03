import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.school_id) {
      return Response.json({ error: 'No school assigned' }, { status: 403 });
    }

    const [teachers, students, subjects, rooms, scheduleVersions, aiLogs] = await Promise.all([
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.ScheduleVersion.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.AIAdvisorLog.filter({ school_id: user.school_id, status: 'pending' })
    ]);

    return Response.json({
      teachers,
      students,
      subjects,
      rooms,
      scheduleVersions,
      aiLogs: aiLogs.slice(0, 5)
    });
  } catch (error) {
    console.error('Error in getDashboardData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});