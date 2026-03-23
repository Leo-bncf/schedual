import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email || !user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const currentAdmins = await base44.asServiceRole.entities.User.filter({ school_id: user.school_id });
    const maxSeats = Number(school.max_admin_seats || 3);

    if (currentAdmins.length >= maxSeats) {
      return Response.json({
        error: `Maximum admin seats reached (${currentAdmins.length}/${maxSeats}). Purchase more seats to invite additional admins.`
      }, { status: 400 });
    }

    const existingUsers = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    const existingUser = existingUsers[0] || null;

    if (existingUser?.school_id === user.school_id) {
      return Response.json({ error: 'This user is already an administrator of your school' }, { status: 400 });
    }

    if (existingUser?.school_id && existingUser.school_id !== user.school_id) {
      return Response.json({ error: 'This user is already assigned to another school' }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const existingInvites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email: normalizedEmail,
      school_id: user.school_id,
    });

    if (existingInvites.length > 0) {
      await base44.asServiceRole.entities.PendingInvitation.update(existingInvites[0].id, {
        invited_by: user.email,
        expires_at: expiresAt,
      });
    } else {
      await base44.asServiceRole.entities.PendingInvitation.create({
        email: normalizedEmail,
        school_id: user.school_id,
        invited_by: user.email,
        expires_at: expiresAt,
      });
    }

    const origin = req.headers.get('origin')
      || req.headers.get('referer')?.split('/').slice(0, 3).join('/')
      || 'https://schedual-pro.com';
    const inviteUrl = `${origin}?invitation=pending&email=${encodeURIComponent(normalizedEmail)}`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedEmail,
      subject: `You're invited to join ${school.name}`,
      body: `Hello,\n\n${user.full_name || user.email} invited you to join ${school.name} as a school administrator.\n\nAccept your invitation here:\n${inviteUrl}\n\nThis invitation expires in 7 days.\n\nBest regards,\nSchedual`,
    });

    return Response.json({
      success: true,
      message: 'Invitation sent successfully',
      inviteUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('inviteSchoolAdmin error:', error);
    return Response.json({ error: error.message || 'Failed to send invitation' }, { status: 500 });
  }
});