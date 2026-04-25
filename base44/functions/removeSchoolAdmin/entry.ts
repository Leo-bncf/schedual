import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
      return Response.json({ error: 'No school assigned' }, { status: 403 });
    }

    if ((currentUser.role || currentUser.data?.role) !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { admin_id } = await req.json();

    if (!admin_id) {
      return Response.json({ error: 'Admin ID is required' }, { status: 400 });
    }

    // Prevent removing yourself
    if (admin_id === user.id) {
      return Response.json({ error: 'Cannot remove yourself as admin' }, { status: 400 });
    }

    // Get the admin to remove
    const adminToRemove = await base44.asServiceRole.entities.User.filter({ id: admin_id });
    
    if (!adminToRemove || adminToRemove.length === 0) {
      return Response.json({ error: 'Admin not found' }, { status: 404 });
    }

    const admin = adminToRemove[0];
    const adminSchoolId = admin.school_id || admin.data?.school_id;

    // Verify the admin belongs to the same school
    if (adminSchoolId !== schoolId) {
      return Response.json({ error: 'Admin does not belong to your school' }, { status: 403 });
    }

    // Remove school assignment
    await base44.asServiceRole.entities.User.update(admin_id, { school_id: null });

    return Response.json({ 
      success: true,
      message: 'Administrator removed successfully'
    });

  } catch (error) {
    console.error('Error removing admin:', error);
    return Response.json({ error: error.message || 'Failed to remove administrator' }, { status: 500 });
  }
});