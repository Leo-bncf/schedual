import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin - they don't need invitations
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    
    if (superAdminEmails.includes(user.email.toLowerCase())) {
      return Response.json({ 
        hasPendingInvite: false,
        message: 'Super admin - no invitations needed'
      });
    }

    // Check for pending invitations
    const pendingInvites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email: user.email
    });

    if (pendingInvites.length === 0) {
      return Response.json({ 
        hasPendingInvite: false,
        message: 'No pending invitations found'
      });
    }

    const invite = pendingInvites[0];

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      await base44.asServiceRole.entities.PendingInvitation.delete(invite.id);
      return Response.json({ 
        hasPendingInvite: false,
        message: 'Invitation expired'
      });
    }

    // Check if user already has a school assigned
    if (user.school_id) {
      return Response.json({ 
        hasPendingInvite: false,
        message: 'You are already assigned to a school'
      });
    }

    // Assign user to school
    await base44.asServiceRole.entities.User.update(user.id, {
      school_id: invite.school_id
    });

    // Delete pending invitation
    await base44.asServiceRole.entities.PendingInvitation.delete(invite.id);

    // Get school name
    const schools = await base44.asServiceRole.entities.School.filter({ id: invite.school_id });
    const schoolName = schools[0]?.name || 'the school';

    return Response.json({ 
      hasPendingInvite: true,
      schoolAssigned: true,
      schoolName,
      message: `Welcome! You've been added as an administrator for ${schoolName}`
    });

  } catch (error) {
    console.error('Check pending invitations error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});