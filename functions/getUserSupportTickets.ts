import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user's support tickets using service role to bypass RLS
    const allTickets = await base44.asServiceRole.entities.SupportTicket.list('-created_date');
    const userTickets = allTickets.filter(ticket => ticket.user_email === user.email);

    return Response.json({ 
      success: true,
      tickets: userTickets
    });

  } catch (error) {
    console.error('Get user support tickets error:', error);
    return Response.json({ 
      error: error.message || 'Failed to fetch support tickets' 
    }, { status: 500 });
  }
});