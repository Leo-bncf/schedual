import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];
const SAVED_VERSIONS_LIMITS: Record<string, number | null> = { tier1: 3, tier2: null, tier3: null };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const user = dbUsers[0] || authUser;
    const schoolId = user.school_id || user.data?.school_id;
    const role = user.role || user.data?.role;

    if (!schoolId) return Response.json({ error: 'No school assigned' }, { status: 403 });
    if (role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const body = await req.json();
    const { name, academic_year, term } = body;
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 });

    const schools = await base44.asServiceRole.entities.School.filter({ id: schoolId });
    const school = schools[0];
    if (!school) return Response.json({ error: 'School not found' }, { status: 404 });

    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes(school.subscription_status)) {
      return Response.json(
        { error: 'Your subscription is not active. Please renew your plan.' },
        { status: 403 }
      );
    }

    const existingVersions = await base44.asServiceRole.entities.ScheduleVersion.filter({ school_id: schoolId });
    const limit = SAVED_VERSIONS_LIMITS[school.subscription_tier] ?? 3;

    if (limit !== null && existingVersions.length >= limit) {
      return Response.json(
        { error: `Saved version limit reached for your plan (${existingVersions.length}/${limit}). Delete an existing version or upgrade.` },
        { status: 400 }
      );
    }

    const newVersion = await base44.asServiceRole.entities.ScheduleVersion.create({
      name,
      academic_year: academic_year || '2025-2026',
      term: term || 'Fall',
      school_id: schoolId,
      status: 'draft',
    });

    return Response.json({ success: true, data: newVersion });
  } catch (error) {
    console.error('[createScheduleVersion] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
