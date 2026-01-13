import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ error: 'No school assigned' }, { status: 403 });
    }

    const { action, data, id } = await req.json();

    switch (action) {
      case 'list': {
        const allLogs = await base44.asServiceRole.entities.AuditLog.list();
        const filtered = allLogs.filter(l => l.school_id === user.school_id);
        return Response.json(filtered);
      }

      case 'create': {
        const logData = { ...data, school_id: user.school_id };
        const result = await base44.asServiceRole.entities.AuditLog.create(logData);
        return Response.json(result);
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});