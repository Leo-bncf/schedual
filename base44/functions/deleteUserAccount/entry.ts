import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch full user record
    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const user = dbUsers[0] || authUser;
    const userId = user.id || authUser.id;
    const schoolId = user.school_id || user.data?.school_id;

    if (!userId) {
      return Response.json({ error: 'Could not determine user ID' }, { status: 400 });
    }

    // If this user is the only admin of their school, block deletion
    if (schoolId) {
      const admins = await base44.asServiceRole.entities.User.filter({ school_id: schoolId, role: 'admin' });
      if (admins.length <= 1 && admins.some((a: any) => a.id === userId)) {
        return Response.json({
          error: 'Cannot delete account: you are the only admin of your school. Transfer admin rights to another user first.'
        }, { status: 400 });
      }
    }

    // Soft-delete: clear personal data and deactivate
    await base44.asServiceRole.entities.User.update(userId, {
      is_active: false,
      full_name: '[Deleted User]',
      email: `deleted_${userId}@deleted.invalid`,
      school_id: null,
      role: 'user',
    });

    return Response.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('Delete account error:', error);
    return Response.json({
      error: (error as Error).message || 'Failed to delete account'
    }, { status: 500 });
  }
});
