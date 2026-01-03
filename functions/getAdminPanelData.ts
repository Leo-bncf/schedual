import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    const isSuperAdmin = superAdminEmails.includes(user.email.toLowerCase());
    
    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    const [schools, users, teachers, students, schedules] = await Promise.all([
      base44.asServiceRole.entities.School.filter({}),
      base44.asServiceRole.entities.User.filter({}),
      base44.asServiceRole.entities.Teacher.filter({}),
      base44.asServiceRole.entities.Student.filter({}),
      base44.asServiceRole.entities.ScheduleVersion.filter({})
    ]);

    return Response.json({
      schools,
      users,
      teachers,
      students,
      schedules
    });
  } catch (error) {
    console.error('Error in getAdminPanelData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});