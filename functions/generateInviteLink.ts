import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check if user already exists and is assigned to a school
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.school_id) {
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
      school_id: user.school_id
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
        school_id: user.school_id,
        invited_by: user.email,
        expires_at: expiresAt.toISOString()
      });
    }

    // Generate invitation URL
    const appUrl = Deno.env.get('APP_URL') || req.headers.get('origin') || 'https://app.schedual-pro.com';
    const inviteUrl = `${appUrl}/accept-invite?email=${encodeURIComponent(email)}&school=${user.school_id}`;

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