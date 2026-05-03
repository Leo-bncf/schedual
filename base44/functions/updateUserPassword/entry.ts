import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'Current password and new password are required' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return Response.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    // Delegate to auth — base44 SDK handles password verification internally
    await base44.auth.updatePassword({ currentPassword, newPassword });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[updateUserPassword] error:', error);
    const status = error.message?.includes('incorrect') || error.message?.includes('wrong') ? 400 : 500;
    return Response.json({ error: error.message || 'Failed to update password' }, { status });
  }
});
