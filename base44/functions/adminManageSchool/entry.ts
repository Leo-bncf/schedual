import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, data, id, schoolId, query } = body || {};
    const resolvedId = id || schoolId;

    // Superadmin check (with hard-allow override)
    const superAdminEmailsStr = Deno.env.get('SUPER_ADMIN_EMAILS') || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const hardAllowed = ['leo.bancroft34@icloud.com'];
    const isSuperAdmin = hardAllowed.includes((user.email || '').toLowerCase()) || superAdminEmails.includes((user.email || '').toLowerCase());

    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    // Use service role to bypass RLS for admin operations
    const svc = base44.asServiceRole.entities.School;

    if (action === 'list') {
      const schools = await svc.filter(query || {});
      return Response.json({ success: true, schools });
    }

    if (action === 'create') {
      if (!data) return Response.json({ error: 'Missing data' }, { status: 400 });

      const tierSeatLimits = {
        tier1: 1,
        tier2: 3,
        tier3: null,
      };
      const tierStudentLimits = {
        tier1: 200,
        tier2: 600,
        tier3: 1200,
      };
      const tierGenerationLimits = {
        tier1: 3,
        tier2: null,
        tier3: null,
      };
      const tier = data.subscription_tier || 'tier2';
      const created = await svc.create({
        ...data,
        max_admin_seats: tierSeatLimits[tier],
        settings: {
          ...(data.settings || {}),
          student_count_limit: tierStudentLimits[tier],
          generation_limit: tierGenerationLimits[tier],
          saved_versions_limit: tierGenerationLimits[tier],
        },
      });
      return Response.json({ success: true, school: created });
    }

    if (action === 'update') {
      if (!resolvedId || !data) return Response.json({ error: 'Missing id or data' }, { status: 400 });

      let nextData = data;
      if (data.subscription_tier) {
        const tierSeatLimits = {
          tier1: 1,
          tier2: 3,
          tier3: null,
        };
        const tierStudentLimits = {
          tier1: 200,
          tier2: 600,
          tier3: 1200,
        };
        const tierGenerationLimits = {
          tier1: 3,
          tier2: null,
          tier3: null,
        };
        nextData = {
          ...data,
          max_admin_seats: tierSeatLimits[data.subscription_tier],
          settings: {
            ...(data.settings || {}),
            student_count_limit: tierStudentLimits[data.subscription_tier],
            generation_limit: tierGenerationLimits[data.subscription_tier],
            saved_versions_limit: tierGenerationLimits[data.subscription_tier],
          },
        };
      }

      const updated = await svc.update(resolvedId, nextData);
      return Response.json({ success: true, school: updated });
    }

    if (action === 'delete') {
      if (!resolvedId) return Response.json({ error: 'Missing id' }, { status: 400 });
      await svc.delete(resolvedId);
      return Response.json({ success: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('adminManageSchool error:', error);
    const msg = error?.message || 'Internal Server Error';
    return Response.json({ error: msg }, { status: 500 });
  }
});