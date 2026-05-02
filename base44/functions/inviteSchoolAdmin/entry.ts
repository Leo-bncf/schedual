import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
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
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const csrfToken = req.headers.get('x-csrf-token');
    if (!csrfToken) {
      return Response.json({ error: 'CSRF token required' }, { status: 403 });
    }

    const sessions = await base44.asServiceRole.entities.LoginSession.filter({
      user_email: user.email,
      csrf_token: csrfToken,
      verified: true,
    });

    if (sessions.length === 0) {
      return Response.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    if (new Date(sessions[0].expires_at) < new Date()) {
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }

    const schoolId = user.school_id || user.data?.school_id;

    if (!schoolId) {
      return Response.json({ error: 'User not assigned to a school' }, { status: 400 });
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const schools = await base44.entities.School.filter({ id: schoolId });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const currentAdmins = await base44.asServiceRole.entities.User.filter({ school_id: schoolId, role: 'admin' });
    const maxSeats = getAdminSeatLimit(school.subscription_tier, school.max_admin_seats ?? 3);

    if (maxSeats !== null && currentAdmins.length >= maxSeats) {
      return Response.json({
        error: `Maximum admin seats reached (${currentAdmins.length}/${maxSeats}) for your current tier.`
      }, { status: 400 });
    }

    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });

    if (existingUsers.length === 0) {
      return Response.json({
        error: 'This user must create an account first before they can be added as an administrator. Please ask them to register first.'
      }, { status: 400 });
    }

    const existingUser = existingUsers[0];

    if ((existingUser.school_id || existingUser.data?.school_id) === schoolId) {
      return Response.json({
        error: 'This user is already an administrator of your school'
      }, { status: 400 });
    }

    if (existingUser.school_id || existingUser.data?.school_id) {
      return Response.json({
        error: 'This user is already assigned to another school'
      }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(existingUser.id, {
      school_id: schoolId,
      role: 'admin'
    });

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: 'You have been added as a school administrator',
      body: `
        <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:10px;">Schedual</div>
              <h2 style="margin:0;font-size:28px;line-height:1.2;">Administrator access granted</h2>
              <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88);">You have been added to a school workspace.</p>
            </div>
            <div style="padding:28px;">
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#334155;">You have been added as an administrator for <strong style="color:#0f172a;">${school.name}</strong>.</p>
              <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#475569;font-size:14px;line-height:1.7;">
                You can now log in and access the school management features.
              </div>
            </div>
            <div style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;">
              <p style="margin:0 0 14px 0;color:#64748b;font-size:13px;">Best regards, The Schedual Team</p>
              <img src="https://media.base44.com/images/public/69458d4b7ddbdbf0a082832e/690ba3d1f_schedual_pro_logo.png" alt="Schedual Pro" style="max-width:320px;width:100%;height:auto;display:block;margin:0 auto;" />
            </div>
          </div>
        </div>
      `
    });

    return Response.json({
      success: true,
      message: 'User added as administrator successfully'
    });
  } catch (error) {
    console.error('Invitation error:', error);
    return Response.json({ error: error.message || 'Failed to send invitation' }, { status: 500 });
  }
});