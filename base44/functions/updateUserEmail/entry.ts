import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { newEmail } = await req.json();
    if (!newEmail || !newEmail.includes('@')) {
      return Response.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const normalizedEmail = String(newEmail).trim().toLowerCase();
    if (normalizedEmail === String(user.email || '').trim().toLowerCase()) {
      return Response.json({ error: 'New email must be different from current email' }, { status: 400 });
    }

    // Check if email is already in use
    const existing = await base44.asServiceRole.entities.User.filter({ email: normalizedEmail });
    if (existing.length > 0) {
      return Response.json({ error: 'Email address is already in use' }, { status: 409 });
    }

    await base44.auth.updateMe({ email: normalizedEmail, email_verified: false });

    return Response.json({ success: true, email: normalizedEmail });
  } catch (error) {
    console.error('[updateUserEmail] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
