import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
    const currentUser = dbUsers[0] || user;
    const schoolId = currentUser.school_id || currentUser.data?.school_id;

    if (!schoolId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admins = await base44.asServiceRole.entities.User.filter({
      school_id: schoolId,
      role: 'admin'
    });

    return Response.json({ 
      success: true, 
      admins: admins.map((admin) => ({
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role,
      }))
    });
  } catch (error) {
    console.error('Error fetching school admins:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});