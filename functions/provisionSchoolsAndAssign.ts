import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function slugCode(name) {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 16);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const caller = await base44.auth.me();
    if (!caller) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Allow school admins and superadmins
    let isSuperAdmin = false;
    try {
      const { data } = await base44.functions.invoke('getSuperAdminEmails');
      isSuperAdmin = !!data?.isSuperAdmin;
    } catch (_) {
      // ignore
    }
    if (caller.role !== 'admin' && !isSuperAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    const schoolsInput = body.schools ?? [
      { name: 'EPBI', code: 'EPBI', email: 'leo.bancroft@outlook.fr' },
      { name: 'Isn Nice', code: 'ISN', email: 'support@schedual-pro.com' },
    ];

    const subscriptionStatus = body.subscription_status ?? 'active';
    const subscriptionTier = body.subscription_tier ?? 'tier2';
    const makeAdmin = body.make_admin ?? true;
    const inviteIfMissing = body.invite_if_missing ?? true;

    const results = [];

    for (const item of schoolsInput) {
      const name = item.name?.trim();
      const code = (item.code?.trim() || slugCode(name));
      const email = (item.email || '').trim().toLowerCase();
      if (!name || !code || !email) {
        results.push({ name, code, email, success: false, error: 'Missing name/code/email' });
        continue;
      }

      // Upsert School
      let school = null;
      const byCode = await base44.asServiceRole.entities.School.filter({ code });
      school = byCode?.[0] || null;
      if (!school) {
        const byName = await base44.asServiceRole.entities.School.filter({ name });
        school = byName?.[0] || null;
      }

      if (school) {
        school = await base44.asServiceRole.entities.School.update(school.id, {
          subscription_status: subscriptionStatus,
          subscription_tier: subscriptionTier,
        });
      } else {
        school = await base44.asServiceRole.entities.School.create({
          name,
          code,
          subscription_status: subscriptionStatus,
          subscription_tier: subscriptionTier,
        });
      }

      // Assign user to the school
      const users = await base44.asServiceRole.entities.User.filter({ email });
      const user = users?.[0] || null;

      if (user) {
        const updated = await base44.asServiceRole.entities.User.update(user.id, {
          school_id: school.id,
          role: makeAdmin ? 'admin' : (user.role || 'user'),
        });
        results.push({ name, code, email, success: true, action: 'updated_user', school_id: school.id, user_id: updated.id });
      } else {
        // If user doesn't exist, optionally invite and create pending invitation for auto-link on signup/login
        if (inviteIfMissing) {
          try {
            await base44.users.inviteUser(email, makeAdmin ? 'admin' : 'user');
          } catch (e) {
            // log but continue
            console.error('Invite error:', e?.message || e);
          }
        }
        try {
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await base44.asServiceRole.entities.PendingInvitation.create({
            email,
            school_id: school.id,
            invited_by: caller.email,
            expires_at: expiresAt,
          });
        } catch (e) {
          // log but continue
          console.error('PendingInvitation error:', e?.message || e);
        }
        results.push({ name, code, email, success: true, action: 'invited_and_linked_on_login', school_id: school.id });
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('provisionSchoolsAndAssign error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});