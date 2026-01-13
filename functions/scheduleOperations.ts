import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entity, action, data, id, query } = await req.json();
    const schoolId = user.school_id;

    // Handle ScheduleSlot, ScheduleVersion, ConflictReport, OptimizationRun
    const entityMap = {
      'ScheduleSlot': base44.asServiceRole.entities.ScheduleSlot,
      'ScheduleVersion': base44.asServiceRole.entities.ScheduleVersion,
      'ConflictReport': base44.asServiceRole.entities.ConflictReport,
      'OptimizationRun': base44.asServiceRole.entities.OptimizationRun,
      'Constraint': base44.asServiceRole.entities.Constraint,
      'AuditLog': base44.asServiceRole.entities.AuditLog
    };

    const entityRef = entityMap[entity];
    if (!entityRef) {
      return Response.json({ error: 'Invalid entity' }, { status: 400 });
    }

    switch (action) {
      case 'list':
        const items = await entityRef.filter({ 
          school_id: schoolId,
          ...(query || {})
        });
        return Response.json({ success: true, data: items });

      case 'create':
        const newItem = await entityRef.create({
          ...data,
          school_id: schoolId
        });
        return Response.json({ success: true, data: newItem });

      case 'update':
        if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
        
        const existing = await entityRef.filter({ 
          id, school_id: schoolId 
        });
        if (existing.length === 0) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        const updated = await entityRef.update(id, {
          ...data,
          school_id: schoolId
        });
        return Response.json({ success: true, data: updated });

      case 'delete':
        if (!id) return Response.json({ error: 'ID required' }, { status: 400 });
        
        const toDelete = await entityRef.filter({ 
          id, school_id: schoolId 
        });
        if (toDelete.length === 0) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }

        await entityRef.delete(id);
        return Response.json({ success: true });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Schedule operation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});