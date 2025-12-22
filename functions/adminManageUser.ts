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

    const { action, userId, data } = await req.json();

    switch (action) {
      case 'update':
        await base44.asServiceRole.entities.User.update(userId, data);
        return Response.json({ success: true });

      case 'delete':
        await base44.asServiceRole.entities.User.delete(userId);
        return Response.json({ success: true });

      case 'list':
        const users = await base44.asServiceRole.entities.User.filter({});
        return Response.json({ success: true, users });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in adminManageUser:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});