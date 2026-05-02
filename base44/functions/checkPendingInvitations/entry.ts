import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for pending invitations
    const pendingInvites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email: user.email
    });

    if (!pendingInvites || pendingInvites.length === 0) {
      return Response.json({ 
        hasPendingInvite: false,
        message: 'No pending invitations found'
      });
    }

    // Prefer non-expired invites for schools with active/trialing subscriptions, otherwise most recent
    const now = new Date();
    const unexpired = pendingInvites.filter((inv) => !inv.expires_at || new Date(inv.expires_at) > now);

    let bestInvite = null;
    let candidates = unexpired.length > 0 ? unexpired : pendingInvites;

    // Score invites by school subscription status and recency
    const scored = [];
    for (const inv of candidates) {
      let score = 0;
      // Fetch school to check subscription status
      const schools = await base44.asServiceRole.entities.School.filter({ id: inv.school_id });
      const school = schools[0] || null;
      if (school && (school.subscription_status === 'active' || school.subscription_status === 'trialing')) {
        score += 10; // prefer active/trialing schools
      }
      const exp = inv.expires_at ? new Date(inv.expires_at).getTime() : 0;
      scored.push({ inv, score, exp });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.exp - a.exp; // most recent expiry last
    });

    bestInvite = scored[0]?.inv || null;

    if (!bestInvite) {
      return Response.json({ 
        hasPendingInvite: false,
        message: 'No valid invitations available'
      });
    }

    // Check if expired
    if (bestInvite.expires_at && new Date(bestInvite.expires_at) < new Date()) {
      await base44.asServiceRole.entities.PendingInvitation.delete(bestInvite.id);
      return Response.json({ 
        hasPendingInvite: false,
        message: 'Invitation expired'
      });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: user.id });
    const currentUser = dbUsers[0] || user;
    const schoolId = currentUser.school_id || currentUser.data?.school_id;

    // Check if user already has a school assigned
    if (schoolId) {
      return Response.json({ 
        hasPendingInvite: false,
        message: 'You are already assigned to a school'
      });
    }

    // Assign user to school and grant admin role
    await base44.asServiceRole.entities.User.update(user.id, {
      school_id: bestInvite.school_id,
      role: 'admin',
    });

    // Delete pending invitation
    await base44.asServiceRole.entities.PendingInvitation.delete(bestInvite.id);

    // Get school name
    const schools = await base44.asServiceRole.entities.School.filter({ id: bestInvite.school_id });
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