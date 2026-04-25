import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    
    const isSuperAdmin = superAdminEmails.includes(user.email.toLowerCase());

    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch all support tickets using service role
    const tickets = await base44.asServiceRole.entities.SupportTicket.list();

    return Response.json({ 
      success: true,
      tickets: tickets || []
    });

  } catch (error) {
    console.error('Get all support tickets error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch support tickets' 
    }, { status: 500 });
  }
});