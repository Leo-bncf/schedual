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
        const allSlots = await base44.asServiceRole.entities.ScheduleSlot.list();
        const filtered = allSlots.filter(s => s.school_id === user.school_id);
        return Response.json(filtered);
      }

      case 'create': {
        const slotData = { ...data, school_id: user.school_id };
        const result = await base44.asServiceRole.entities.ScheduleSlot.create(slotData);
        return Response.json(result);
      }

      case 'update': {
        const existing = await base44.asServiceRole.entities.ScheduleSlot.list();
        const slot = existing.find(s => s.id === id && s.school_id === user.school_id);
        
        if (!slot) {
          return Response.json({ error: 'ScheduleSlot not found or access denied' }, { status: 404 });
        }

        const result = await base44.asServiceRole.entities.ScheduleSlot.update(id, data);
        return Response.json(result);
      }

      case 'delete': {
        const existing = await base44.asServiceRole.entities.ScheduleSlot.list();
        const slot = existing.find(s => s.id === id && s.school_id === user.school_id);
        
        if (!slot) {
          return Response.json({ error: 'ScheduleSlot not found or access denied' }, { status: 404 });
        }

        await base44.asServiceRole.entities.ScheduleSlot.delete(id);
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});