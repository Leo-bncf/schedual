import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active verified session
    const sessions = await base44.entities.LoginSession.filter({
      user_email: user.email,
      verified: true
    }, '-created_date', 1);

    if (sessions.length === 0) {
      return Response.json({ error: 'No active session' }, { status: 404 });
    }

    const session = sessions[0];
    
    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }

    return Response.json({ 
      csrfToken: session.csrf_token 
    });

  } catch (error) {
    console.error('Get CSRF token error:', error);
    return Response.json({ 
      error: error.message || 'Failed to get CSRF token' 
    }, { status: 500 });
  }
});