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
        const allConstraints = await base44.asServiceRole.entities.Constraint.list();
        const filtered = allConstraints.filter(c => c.school_id === user.school_id);
        return Response.json(filtered);
      }

      case 'create': {
        const constraintData = { ...data, school_id: user.school_id };
        const result = await base44.asServiceRole.entities.Constraint.create(constraintData);
        return Response.json(result);
      }

      case 'update': {
        const existing = await base44.asServiceRole.entities.Constraint.list();
        const constraint = existing.find(c => c.id === id && c.school_id === user.school_id);
        
        if (!constraint) {
          return Response.json({ error: 'Constraint not found or access denied' }, { status: 404 });
        }

        const result = await base44.asServiceRole.entities.Constraint.update(id, data);
        return Response.json(result);
      }

      case 'delete': {
        const existing = await base44.asServiceRole.entities.Constraint.list();
        const constraint = existing.find(c => c.id === id && c.school_id === user.school_id);
        
        if (!constraint) {
          return Response.json({ error: 'Constraint not found or access denied' }, { status: 404 });
        }

        await base44.asServiceRole.entities.Constraint.delete(id);
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});