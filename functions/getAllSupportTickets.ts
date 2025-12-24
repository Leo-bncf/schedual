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

    // Fetch all support tickets - use direct read_entities
    const response = await fetch(`${Deno.env.get('BASE44_API_URL') || 'https://api.base44.com'}/v1/apps/${Deno.env.get('BASE44_APP_ID')}/entities/SupportTicket/records`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('BASE44_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tickets: ${response.statusText}`);
    }

    const tickets = await response.json();

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