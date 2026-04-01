import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

    if (!user.school_id) {
      return Response.json({ error: 'User not assigned to a school' }, { status: 400 });
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const schools = await base44.entities.School.filter({ id: user.school_id });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const currentAdmins = await base44.asServiceRole.entities.User.filter({ school_id: user.school_id });
    const tierSeatLimits = {
      tier1: 1,
      tier2: 3,
      tier3: null,
    };
    const maxSeats = tierSeatLimits[school.subscription_tier] ?? school.max_admin_seats ?? 3;

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

    if (existingUser.school_id === user.school_id) {
      return Response.json({
        error: 'This user is already an administrator of your school'
      }, { status: 400 });
    }

    if (existingUser.school_id) {
      return Response.json({
        error: 'This user is already assigned to another school'
      }, { status: 400 });
    }

    await base44.asServiceRole.entities.User.update(existingUser.id, {
      school_id: user.school_id
    });

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: 'You have been added as a school administrator',
      body: `Hello,\n\nYou have been added as an administrator for ${school.name}.\n\nYou can now log in and access the school management features.\n\nBest regards,\nThe Schedual Team`
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