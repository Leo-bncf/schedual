import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getTierDefinition(tierId) {
  const tierMap = {
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

  return tierMap[tierId] || tierMap.tier2;
}

function getTierSettings(tierId, existingSettings = {}) {
  const tier = getTierDefinition(tierId);

  return {
    ...existingSettings,
    generation_limit: tier.generation_limit,
    saved_versions_limit: tier.saved_versions_limit,
    student_count_limit: tier.student_count_limit,
    support_level: tier.support_level,
    onboarding_call_included: tier.onboarding_call_included,
  };
}

async function cascadeDeleteSchool(base44, schoolId: string) {
  const svc = base44.asServiceRole;

  // Delete dependent entities in safe order (slots before versions, etc.)
  const entityNames = [
    'ScheduleSlot',
    'OptimizationRun',
    'ConflictReport',
    'ScheduleVersion',
    'TeachingGroup',
    'ClassGroup',
    'Constraint',
    'Subject',
    'Room',
    'Student',
    'Teacher',
    'PendingInvitation',
    'SupportTicket',
    'AuditLog',
  ];

  for (const entityName of entityNames) {
    try {
      const records = await svc.entities[entityName].filter({ school_id: schoolId });
      for (let i = 0; i < records.length; i += 20) {
        await Promise.all(
          records.slice(i, i + 20).map((r) => svc.entities[entityName].delete(r.id))
        );
      }
      if (records.length > 0) {
        console.log(`[cascade] Deleted ${records.length} ${entityName} records for school ${schoolId}`);
      }
    } catch (e) {
      console.warn(`[cascade] Failed to delete ${entityName} for school ${schoolId}:`, e.message);
    }
  }

  // Unassign users — preserve their accounts, just remove school membership
  try {
    const users = await svc.entities.User.filter({ school_id: schoolId });
    for (let i = 0; i < users.length; i += 20) {
      await Promise.all(
        users.slice(i, i + 20).map((u) =>
          svc.entities.User.update(u.id, { school_id: null, role: 'user' })
        )
      );
    }
    if (users.length > 0) {
      console.log(`[cascade] Unassigned ${users.length} users from school ${schoolId}`);
    }
  } catch (e) {
    console.warn(`[cascade] Failed to unassign users for school ${schoolId}:`, e.message);
  }

  await svc.entities.School.delete(schoolId);
}

async function logAction(base44, actorEmail: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      user_email: actorEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
  } catch (e) {
    console.warn('[audit] Failed to write audit log:', e.message);
  }
}

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

    const superAdminEmailsStr = Deno.env.get('SUPER_ADMIN_EMAILS') || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const isSuperAdmin = superAdminEmails.includes((user.email || '').toLowerCase());

    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    const svc = base44.asServiceRole.entities.School;

    if (action === 'list') {
      const schools = await svc.filter(query || {});
      return Response.json({ success: true, schools });
    }

    if (action === 'create') {
      if (!data) return Response.json({ error: 'Missing data' }, { status: 400 });

      const tier = data.subscription_tier || 'tier2';
      const limits = getTierDefinition(tier);
      const created = await svc.create({
        ...data,
        max_admin_seats: limits.max_admin_seats,
        settings: getTierSettings(tier, data.settings || {}),
      });
      logAction(base44, user.email, 'create_school', 'School', created.id, { name: created.name, tier });
      return Response.json({ success: true, school: created });
    }

    if (action === 'update') {
      if (!resolvedId || !data) return Response.json({ error: 'Missing id or data' }, { status: 400 });

      let nextData = data;
      if (data.subscription_tier) {
        const limits = getTierDefinition(data.subscription_tier);
        nextData = {
          ...data,
          max_admin_seats: limits.max_admin_seats,
          settings: getTierSettings(data.subscription_tier, data.settings || {}),
        };
      }

      const updated = await svc.update(resolvedId, nextData);
      logAction(base44, user.email, 'update_school', 'School', resolvedId, { changes: Object.keys(data) });
      return Response.json({ success: true, school: updated });
    }

    if (action === 'delete') {
      if (!resolvedId) return Response.json({ error: 'Missing id' }, { status: 400 });
      const [school] = await svc.filter({ id: resolvedId });
      const schoolName = school?.name || resolvedId;
      await cascadeDeleteSchool(base44, resolvedId);
      // Log after deletion since AuditLog for this school was also deleted; use no school_id
      logAction(base44, user.email, 'delete_school', 'School', resolvedId, { name: schoolName });
      return Response.json({ success: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('adminManageSchool error:', error);
    const msg = error?.message || 'Internal Server Error';
    return Response.json({ error: msg }, { status: 500 });
  }
});
