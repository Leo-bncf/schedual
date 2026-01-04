import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { code, sessionToken } = await req.json();

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email;

    if (!code || !sessionToken) {
      return Response.json({ error: 'Code and session token are required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return Response.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Find verification code
    const records = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      user_email: email,
      verified: false
    }, '-created_date', 1);

    if (records.length === 0) {
      return Response.json({ error: 'No verification code found' }, { status: 404 });
    }

    const record = records[0];

    // Check expiration
    if (new Date(record.expires_at) < new Date()) {
      await base44.asServiceRole.entities.EmailVerificationCode.delete(record.id);
      return Response.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    // Check attempts - lock for 5 minutes after 5 failed attempts
    if (record.attempts >= 5) {
      const lockUntil = new Date(Date.now() + 5 * 60 * 1000);
      await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, {
        locked_until: lockUntil.toISOString()
      });
      return Response.json({ 
        error: 'Account locked for 5 minutes due to too many failed attempts.',
        lockedUntil: lockUntil.toISOString()
      }, { status: 429 });
    }

    // Verify code
    const codeHash = hashCode(code);
    
    if (codeHash !== record.code_hash) {
      await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, {
        attempts: record.attempts + 1
      });
      
      const remainingAttempts = 5 - (record.attempts + 1);
      return Response.json({ 
        error: 'Invalid code',
        remainingAttempts 
      }, { status: 400 });
    }

    // Mark session as verified
    const sessions = await base44.asServiceRole.entities.LoginSession.filter({
      user_email: email,
      session_token: sessionToken
    });

    if (sessions.length === 0) {
      return Response.json({ error: 'Invalid session' }, { status: 400 });
    }

    await base44.asServiceRole.entities.LoginSession.update(sessions[0].id, {
      verified: true
    });

    // Clean up verification code
    await base44.asServiceRole.entities.EmailVerificationCode.delete(record.id);

    return Response.json({ 
      success: true,
      message: 'Login verified successfully'
    });

  } catch (error) {
    console.error('Verify login code error:', error);
    return Response.json({ 
      error: error.message || 'Failed to verify code' 
    }, { status: 500 });
  }
});