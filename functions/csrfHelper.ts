// CSRF validation helper for backend functions
// Use this ONLY for user-initiated state-changing operations
// DO NOT use for: webhooks, service-role operations, or public endpoints

export async function validateCSRF(req, base44, user) {
  // Skip CSRF for service role operations (backend-to-backend)
  if (!user) {
    return { valid: true }; // Let auth middleware handle this
  }

  const csrfToken = req.headers.get('x-csrf-token');
  
  if (!csrfToken) {
    return { 
      valid: false, 
      error: 'CSRF token required',
      status: 403 
    };
  }

  // Validate token against user's session
  const sessions = await base44.asServiceRole.entities.LoginSession.filter({
    user_email: user.email,
    csrf_token: csrfToken,
    verified: true
  });

  if (sessions.length === 0) {
    return { 
      valid: false, 
      error: 'Invalid CSRF token',
      status: 403 
    };
  }

  const session = sessions[0];
  
  // Check session expiration
  if (new Date(session.expires_at) < new Date()) {
    return { 
      valid: false, 
      error: 'Session expired',
      status: 401 
    };
  }

  return { valid: true };
}