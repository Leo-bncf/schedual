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
        const allSubjects = await base44.asServiceRole.entities.Subject.list();
        const filtered = allSubjects.filter(s => s.school_id === user.school_id);
        return Response.json(filtered);
      }

      case 'create': {
        const subjectData = { ...data, school_id: user.school_id };
        const result = await base44.asServiceRole.entities.Subject.create(subjectData);
        return Response.json(result);
      }

      case 'update': {
        // Verify ownership before update
        const existing = await base44.asServiceRole.entities.Subject.list();
        const subject = existing.find(s => s.id === id && s.school_id === user.school_id);
        
        if (!subject) {
          return Response.json({ error: 'Subject not found or access denied' }, { status: 404 });
        }

        const result = await base44.asServiceRole.entities.Subject.update(id, data);
        return Response.json(result);
      }

      case 'delete': {
        // Verify ownership before delete
        const existing = await base44.asServiceRole.entities.Subject.list();
        const subject = existing.find(s => s.id === id && s.school_id === user.school_id);
        
        if (!subject) {
          return Response.json({ error: 'Subject not found or access denied' }, { status: 404 });
        }

        await base44.asServiceRole.entities.Subject.delete(id);
        return Response.json({ success: true });
      }

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});