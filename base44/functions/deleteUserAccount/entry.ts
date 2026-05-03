import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const user = dbUsers[0] || authUser;
    const userId = user.id || authUser.id;
    const schoolId = user.school_id || user.data?.school_id;
    const userEmail = user.email || authUser.email;

    if (!userId) {
      return Response.json({ error: 'Could not determine user ID' }, { status: 400 });
    }

    // Block deletion if this user is the sole admin of their school
    if (schoolId) {
      const admins = await base44.asServiceRole.entities.User.filter({ school_id: schoolId, role: 'admin' });
      if (admins.length <= 1 && admins.some((a: any) => a.id === userId)) {
        return Response.json({
          error: 'Cannot delete account: you are the only admin of your school. Transfer admin rights to another user first.',
        }, { status: 400 });
      }
    }

    // Clean up pending invitations sent to this user's email
    if (userEmail) {
      try {
        const invitations = await base44.asServiceRole.entities.PendingInvitation.filter({ email: userEmail });
        for (const inv of invitations) {
          await base44.asServiceRole.entities.PendingInvitation.delete(inv.id);
        }
      } catch (_) { /* entity may not have any records */ }
    }

    // Clean up unverified email codes for this user
    if (userEmail) {
      try {
        const codes = await base44.asServiceRole.entities.EmailVerificationCode.filter({ user_email: userEmail });
        for (const c of codes) {
          await base44.asServiceRole.entities.EmailVerificationCode.delete(c.id);
        }
      } catch (_) {}
    }

    // Clean up open login sessions for this user
    if (userEmail) {
      try {
        const sessions = await base44.asServiceRole.entities.LoginSession.filter({ user_email: userEmail, verified: false });
        for (const s of sessions) {
          await base44.asServiceRole.entities.LoginSession.delete(s.id);
        }
      } catch (_) {}
    }

    // Soft-delete: anonymise personal data, detach from school
    await base44.asServiceRole.entities.User.update(userId, {
      is_active: false,
      full_name: '[Deleted User]',
      email: `deleted_${userId}@deleted.invalid`,
      school_id: null,
      role: 'user',
    });

    return Response.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    console.error('[deleteUserAccount] error:', error);
    return Response.json({ error: (error as Error).message || 'Failed to delete account' }, { status: 500 });
  }
});
