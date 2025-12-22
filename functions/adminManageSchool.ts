import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get SuperAdmin emails from environment
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);

    // Check if current user is SuperAdmin
    const isSuperAdmin = superAdminEmails.includes(user.email.toLowerCase());
    
    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    const { action, schoolId, data } = await req.json();

    switch (action) {
      case 'create':
        const newSchool = await base44.asServiceRole.entities.School.create(data);
        return Response.json({ success: true, school: newSchool });

      case 'update':
        await base44.asServiceRole.entities.School.update(schoolId, data);
        return Response.json({ success: true });

      case 'delete':
        await base44.asServiceRole.entities.School.delete(schoolId);
        return Response.json({ success: true });

      case 'list':
        const schools = await base44.asServiceRole.entities.School.list();
        return Response.json({ success: true, schools });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in adminManageSchool:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});