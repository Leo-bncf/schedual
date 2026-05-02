import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get SuperAdmin emails + hard-allow override
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);

    // Check if current user is SuperAdmin
    const isSuperAdmin = superAdminEmails.includes((user.email || '').toLowerCase());
    
    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    const { entityType } = await req.json();

    const allowedEntities = ['Teacher', 'Student', 'ScheduleVersion', 'LoginSession', 'AuditLog'];
    if (!allowedEntities.includes(entityType)) {
      return Response.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const records = await base44.asServiceRole.entities[entityType].list();
    
    return Response.json({ success: true, records });
  } catch (error) {
    console.error('Error in adminGetAllData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});