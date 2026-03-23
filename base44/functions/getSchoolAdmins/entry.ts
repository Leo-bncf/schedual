import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all users with the same school_id
    const admins = await base44.asServiceRole.entities.User.filter({ 
      school_id: user.school_id 
    });

    return Response.json({ 
      success: true, 
      admins: admins.map(a => ({
        id: a.id,
        email: a.email,
        full_name: a.full_name
      }))
    });

  } catch (error) {
    console.error('Error fetching school admins:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});