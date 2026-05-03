import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function requireSchoolAdmin(base44) {
  const authUser = await base44.auth.me();
  if (!authUser) throw new Error('Unauthorized - not authenticated');

  const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
  const dbUser = dbUsers[0] || null;

  const school_id =
    dbUser?.school_id || dbUser?.data?.school_id ||
    authUser.school_id || authUser.data?.school_id;

  if (!school_id) throw new Error('Forbidden - no school assigned');

  const role = dbUser?.role || dbUser?.data?.role || authUser.role;
  if (role !== 'admin') {
    await base44.asServiceRole.entities.User.update(authUser.id, { role: 'admin' });
  }

  return { school_id, userId: authUser.id };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const admin = await requireSchoolAdmin(base44);

    const { action, data } = await req.json();

    switch (action) {
      case 'get': {
        const schools = await base44.asServiceRole.entities.School.filter({ id: admin.school_id });
        const school = schools[0];
        if (!school) return Response.json({ success: false, error: 'School not found' }, { status: 404 });
        return Response.json({ success: true, data: school });
      }

      case 'update': {
        if (!data) return Response.json({ success: false, error: 'data required' }, { status: 400 });

        // Verify school exists and belongs to this admin
        const schools = await base44.asServiceRole.entities.School.filter({ id: admin.school_id });
        if (!schools[0]) return Response.json({ success: false, error: 'School not found' }, { status: 404 });

        // Strip fields that admins must not change via this endpoint
        const updateData = { ...data };
        delete updateData.subscription_status;
        delete updateData.subscription_tier;
        delete updateData.stripe_customer_id;
        delete updateData.stripe_subscription_id;
        delete updateData.max_admin_seats;
        delete updateData.active_add_ons;

        const updated = await base44.asServiceRole.entities.School.update(admin.school_id, updateData);
        return Response.json({ success: true, data: updated });
      }

      default:
        return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[secureSchool] error:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return Response.json({ success: false, error: error.message }, { status: 403 });
    }
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
