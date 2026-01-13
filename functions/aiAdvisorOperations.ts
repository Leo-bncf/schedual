import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data, id, query } = await req.json();
    const schoolId = user.school_id;

    switch (action) {
      case 'list':
        const logs = await base44.asServiceRole.entities.AIAdvisorLog.filter({ 
          school_id: schoolId,
          ...(query || {})
        });
        return Response.json({ success: true, data: logs });

      case 'create':
        const newLog = await base44.asServiceRole.entities.AIAdvisorLog.create({
          ...data,
          school_id: schoolId
        });
        return Response.json({ success: true, data: newLog });

      case 'update':
        if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
        
        const existing = await base44.asServiceRole.entities.AIAdvisorLog.filter({ 
          id, school_id: schoolId 
        });
        if (existing.length === 0) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        const updated = await base44.asServiceRole.entities.AIAdvisorLog.update(id, {
          ...data,
          school_id: schoolId
        });
        return Response.json({ success: true, data: updated });

      case 'delete':
        if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
        
        const toDelete = await base44.asServiceRole.entities.AIAdvisorLog.filter({ 
          id, school_id: schoolId 
        });
        if (toDelete.length === 0) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        await base44.asServiceRole.entities.AIAdvisorLog.delete(id);
        return Response.json({ success: true });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('AIAdvisorLog operation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});