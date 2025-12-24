import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const { data: adminData } = await base44.functions.invoke('getSuperAdminEmails');
    const isSuperAdmin = adminData?.isSuperAdmin || false;

    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Fetch all support tickets using service role
    const tickets = await base44.asServiceRole.entities.SupportTicket.list('-created_date');

    return Response.json({ 
      success: true,
      tickets
    });

  } catch (error) {
    console.error('Get all support tickets error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch support tickets' 
    }, { status: 500 });
  }
});