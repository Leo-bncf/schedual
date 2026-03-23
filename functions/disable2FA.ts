import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Disable 2FA
    await base44.auth.updateMe({ 
      totp_enabled: false,
      totp_secret: null
    });

    return Response.json({
      success: true,
      message: '2FA disabled successfully'
    });

  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return Response.json({ 
      error: error.message || 'Failed to disable 2FA' 
    }, { status: 500 });
  }
});