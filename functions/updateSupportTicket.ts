import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, data } = await req.json();

    if (!id) {
      return Response.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    // Update the ticket using service role
    const updatedTicket = await base44.asServiceRole.entities.SupportTicket.update(id, data);

    return Response.json({ 
      success: true,
      ticket: updatedTicket
    });

  } catch (error) {
    console.error('Update support ticket error:', error);
    return Response.json({ 
      error: error.message || 'Failed to update support ticket' 
    }, { status: 500 });
  }
});