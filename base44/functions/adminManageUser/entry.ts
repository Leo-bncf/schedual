import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
async function logAction(base44, actorEmail: string, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      user_email: actorEmail,
      action,
      entity_type: 'User',
      entity_id: entityId,
      metadata,
    });
  } catch (e) {
    console.warn('[audit] Failed to write audit log:', e.message);
  }
}

function getAdminSeatLimit(tierId, fallback = 3) {
  const tierMap = {
    tier1: 1,
    tier2: 3,
    tier3: null,
  };

  const limit = tierMap[tierId];
  return limit === null ? null : (limit ?? fallback);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get SuperAdmin emails + hard-allow override
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);

    // Check if current user is SuperAdmin
    const isSuperAdmin = superAdminEmails.includes((user.email || '').toLowerCase());
    
    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    const { action, userId, data } = await req.json();


    switch (action) {
      case 'update':
        const previousUser = await base44.asServiceRole.entities.User.filter({ id: userId });
        const nextSchoolId = data?.school_id;
        const nextRole = data?.role;

        if (nextSchoolId && nextRole === 'admin') {
          const schools = await base44.asServiceRole.entities.School.filter({ id: nextSchoolId });
          const school = schools[0];
          if (!school) {
            return Response.json({ error: 'School not found' }, { status: 404 });
          }

          const seatLimit = getAdminSeatLimit(school.subscription_tier, school.max_admin_seats ?? 3);
          const existingAdmins = await base44.asServiceRole.entities.User.filter({ school_id: nextSchoolId, role: 'admin' });
          const isAlreadyAdminInSchool = existingAdmins.some((admin) => admin.id === userId);

          if (seatLimit !== null && !isAlreadyAdminInSchool && existingAdmins.length >= seatLimit) {
            return Response.json({ error: `Admin seat limit reached for this school (${existingAdmins.length}/${seatLimit})` }, { status: 400 });
          }
        }

        const ALLOWED_USER_FIELDS = ['role', 'school_id', 'is_active', 'full_name', 'email'];
        const safeData = Object.fromEntries(
          Object.entries(data).filter(([key]) => ALLOWED_USER_FIELDS.includes(key))
        );
        await base44.asServiceRole.entities.User.update(userId, safeData);
        logAction(base44, user.email, 'assign_user', userId, { changes: Object.keys(safeData), school_id: data.school_id });

        if (previousUser.length > 0 && previousUser[0].school_id !== data.school_id && data.school_id) {
          return Response.json({
            success: true,
            requiresReauth: true,
            message: 'School assigned. User must log out and log back in to access school features.'
          });
        }

        return Response.json({ success: true });

      case 'delete':
        const [targetUser] = await base44.asServiceRole.entities.User.filter({ id: userId });
        await base44.asServiceRole.entities.User.delete(userId);
        logAction(base44, user.email, 'delete_user', userId, { email: targetUser?.email });
        return Response.json({ success: true });

      case 'list':
        const users = await base44.asServiceRole.entities.User.filter({});
        return Response.json({ success: true, users });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in adminManageUser:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});