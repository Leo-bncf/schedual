import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const { id } = await req.json();
    
    if (!id) {
      return Response.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    // Delete the ticket using service role
    await base44.asServiceRole.entities.SupportTicket.delete(id);

    return Response.json({ 
      success: true,
      message: 'Ticket deleted successfully'
    });

  } catch (error) {
    console.error('Delete support ticket error:', error);
    return Response.json({ 
      error: error.message || 'Failed to delete support ticket' 
    }, { status: 500 });
  }
});