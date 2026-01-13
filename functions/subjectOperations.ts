import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.school_id) {
      return Response.json({ error: 'No school assigned' }, { status: 403 });
    }

    const { action, data, id } = await req.json();

    // ALL operations are filtered by user's school_id
    const schoolId = user.school_id;

    switch (action) {
      case 'list':
        // List all subjects for this school only
        const subjects = await base44.asServiceRole.entities.Subject.filter({ 
          school_id: schoolId 
        });
        return Response.json({ success: true, data: subjects });

      case 'create':
        // Create with school_id enforced
        const newSubject = await base44.asServiceRole.entities.Subject.create({
          ...data,
          school_id: schoolId // Force user's school_id
        });
        return Response.json({ success: true, data: newSubject });

      case 'update':
        // First verify this subject belongs to user's school
        if (!id) {
          return Response.json({ error: 'ID required' }, { status: 400 });
        }
        
        const existing = await base44.asServiceRole.entities.Subject.filter({ 
          id, 
          school_id: schoolId 
        });
        
        if (existing.length === 0) {
          return Response.json({ error: 'Subject not found or access denied' }, { status: 404 });
        }

        const updated = await base44.asServiceRole.entities.Subject.update(id, {
          ...data,
          school_id: schoolId // Prevent school_id change
        });
        return Response.json({ success: true, data: updated });

      case 'delete':
        // First verify this subject belongs to user's school
        if (!id) {
          return Response.json({ error: 'ID required' }, { status: 400 });
        }
        
        const toDelete = await base44.asServiceRole.entities.Subject.filter({ 
          id, 
          school_id: schoolId 
        });
        
        if (toDelete.length === 0) {
          return Response.json({ error: 'Subject not found or access denied' }, { status: 404 });
        }

        await base44.asServiceRole.entities.Subject.delete(id);
        return Response.json({ success: true });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Subject operation error:', error);
    return Response.json({ 
      error: error.message || 'Unknown error',
      stack: error.stack 
    }, { status: 500 });
  }
});