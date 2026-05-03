import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const superAdmins = (Deno.env.get('SUPER_ADMIN_EMAILS') || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isSuperAdmin = superAdmins.includes((user.email || '').toLowerCase());

    const { id, data } = await req.json();
    if (!id || !data) {
      return Response.json({ error: 'id and data are required' }, { status: 400 });
    }

    // Fetch the ticket to verify ownership / access
    const tickets = await base44.asServiceRole.entities.SupportTicket.filter({ id });
    if (tickets.length === 0) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }
    const ticket = tickets[0];

    // School admins can only update their own tickets (and only status/description)
    if (!isSuperAdmin) {
      const dbUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
      const dbUser = dbUsers[0] || user;
      const schoolId = dbUser.school_id || dbUser.data?.school_id;
      if (ticket.school_id !== schoolId) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      // Non-super-admins may only close their own tickets
      const allowedFields = new Set(['status', 'description']);
      for (const key of Object.keys(data)) {
        if (!allowedFields.has(key)) {
          return Response.json({ error: `Field "${key}" cannot be updated` }, { status: 403 });
        }
      }
    }

    const updated = await base44.asServiceRole.entities.SupportTicket.update(id, data);

    return Response.json({ success: true, ticket: updated });
  } catch (error) {
    console.error('[updateSupportTicket] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
