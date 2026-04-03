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

      const tierDefinitions = {
        tier1: {
          max_admin_seats: 1,
          student_count_limit: 200,
          generation_limit: 3,
          saved_versions_limit: 3,
          support_level: 'Email support (48h)',
          onboarding_call_included: false,
        },
        tier2: {
          max_admin_seats: 3,
          student_count_limit: 600,
          generation_limit: null,
          saved_versions_limit: null,
          support_level: 'Email support (24h)',
          onboarding_call_included: false,
        },
        tier3: {
          max_admin_seats: null,
          student_count_limit: 1200,
          generation_limit: null,
          saved_versions_limit: null,
          support_level: 'Priority support (same day)',
          onboarding_call_included: true,
        },
      };
      const tier = data.subscription_tier || 'tier2';
      const limits = tierDefinitions[tier] || tierDefinitions.tier2;
      const created = await svc.create({
        ...data,
        max_admin_seats: limits.max_admin_seats,
        settings: {
          ...(data.settings || {}),
          student_count_limit: limits.student_count_limit,
          generation_limit: limits.generation_limit,
          saved_versions_limit: limits.saved_versions_limit,
          support_level: limits.support_level,
          onboarding_call_included: limits.onboarding_call_included,
        },
      });
      return Response.json({ success: true, school: created });
    }

    if (action === 'update') {
      if (!resolvedId || !data) return Response.json({ error: 'Missing id or data' }, { status: 400 });

      let nextData = data;
      if (data.subscription_tier) {
        const tierDefinitions = {
          tier1: {
            max_admin_seats: 1,
            student_count_limit: 200,
            generation_limit: 3,
            saved_versions_limit: 3,
            support_level: 'Email support (48h)',
            onboarding_call_included: false,
          },
          tier2: {
            max_admin_seats: 3,
            student_count_limit: 600,
            generation_limit: null,
            saved_versions_limit: null,
            support_level: 'Email support (24h)',
            onboarding_call_included: false,
          },
          tier3: {
            max_admin_seats: null,
            student_count_limit: 1200,
            generation_limit: null,
            saved_versions_limit: null,
            support_level: 'Priority support (same day)',
            onboarding_call_included: true,
          },
        };
        const limits = tierDefinitions[data.subscription_tier] || tierDefinitions.tier2;
        nextData = {
          ...data,
          max_admin_seats: limits.max_admin_seats,
          settings: {
            ...(data.settings || {}),
            student_count_limit: limits.student_count_limit,
            generation_limit: limits.generation_limit,
            saved_versions_limit: limits.saved_versions_limit,
            support_level: limits.support_level,
            onboarding_call_included: limits.onboarding_call_included,
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