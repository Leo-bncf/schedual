import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
    const currentUser = dbUsers[0] || user;
    const schoolId = currentUser.school_id || currentUser.data?.school_id;

    if (!schoolId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if ((currentUser.role || currentUser.data?.role) !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check if user already exists and is assigned to a school
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      const existingUserSchoolId = existingUser.school_id || existingUser.data?.school_id;
      if (existingUserSchoolId) {
        return Response.json({ 
          error: 'This user is already assigned to a school' 
        }, { status: 400 });
      }
    }

    // Generate secure token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create or update pending invitation
    const existingInvites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email,
      school_id: schoolId
    });

    if (existingInvites.length > 0) {
      // Update existing invitation
      await base44.asServiceRole.entities.PendingInvitation.update(existingInvites[0].id, {
        invited_by: user.email,
        expires_at: expiresAt.toISOString()
      });
    } else {
      // Create new invitation
      await base44.asServiceRole.entities.PendingInvitation.create({
        email,
        school_id: schoolId,
        invited_by: user.email,
        expires_at: expiresAt.toISOString()
      });
    }

    // Generate invitation URL
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'https://app.schedual-pro.com';
    const inviteUrl = `${origin}?invitation=pending&email=${encodeURIComponent(email)}`;

    return Response.json({
      success: true,
      inviteUrl,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Error generating invite link:', error);
    return Response.json({ error: error.message || 'Failed to generate invite link' }, { status: 500 });
  }
});