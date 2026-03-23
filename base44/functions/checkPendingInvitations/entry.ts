import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pendingInvites = await base44.asServiceRole.entities.PendingInvitation.filter({
      email: user.email,
    });

    if (!pendingInvites.length) {
      return Response.json({
        hasPendingInvite: false,
        message: 'No pending invitations found',
      });
    }

    const now = new Date();
    const unexpired = pendingInvites.filter((inv) => !inv.expires_at || new Date(inv.expires_at) > now);
    const candidates = unexpired.length > 0 ? unexpired : pendingInvites;

    const scored = [];
    for (const inv of candidates) {
      let score = 0;
      const schools = await base44.asServiceRole.entities.School.filter({ id: inv.school_id });
      const school = schools[0] || null;
      if (school && (school.subscription_status === 'active' || school.subscription_status === 'trialing')) {
        score += 10;
      }
      const exp = inv.expires_at ? new Date(inv.expires_at).getTime() : 0;
      scored.push({ inv, score, exp });
    }

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.exp - a.exp;
    });

    const bestInvite = scored[0]?.inv || null;

    if (!bestInvite) {
      return Response.json({
        hasPendingInvite: false,
        message: 'No valid invitations available',
      });
    }

    if (bestInvite.expires_at && new Date(bestInvite.expires_at) <= now) {
      await base44.asServiceRole.entities.PendingInvitation.delete(bestInvite.id);
      return Response.json({
        hasPendingInvite: false,
        message: 'Invitation expired',
      });
    }

    if (user.school_id) {
      return Response.json({
        hasPendingInvite: false,
        message: 'You are already assigned to a school',
      });
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      school_id: bestInvite.school_id,
    });

    await base44.asServiceRole.entities.PendingInvitation.delete(bestInvite.id);

    const schools = await base44.asServiceRole.entities.School.filter({ id: bestInvite.school_id });
    const schoolName = schools[0]?.name || 'the school';

    return Response.json({
      hasPendingInvite: true,
      schoolAssigned: true,
      schoolName,
      message: `Welcome! You've been added as an administrator for ${schoolName}`,
    });
  } catch (error) {
    console.error('checkPendingInvitations error:', error);
    return Response.json({ error: error.message || 'Failed to process invitation' }, { status: 500 });
  }
});