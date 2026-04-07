import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash, randomBytes } from 'node:crypto';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Must be authenticated to request login verification
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email;

    // Check if account is locked
    const existingRecords = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      user_email: email
    }, '-created_date', 1);

    if (existingRecords.length > 0 && existingRecords[0].locked_until) {
      const lockExpiry = new Date(existingRecords[0].locked_until);
      if (lockExpiry > new Date()) {
        const remainingSeconds = Math.ceil((lockExpiry - new Date()) / 1000);
        return Response.json({ 
          error: `Account locked due to too many failed attempts. Try again in ${Math.ceil(remainingSeconds / 60)} minutes.`,
          retryAfter: remainingSeconds
        }, { status: 429 });
      }
    }

    // Check for recent codes (rate limiting)
    const recentCodes = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      user_email: email,
      verified: false
    }, '-created_date', 1);

    if (recentCodes.length > 0) {
      const lastCode = recentCodes[0];
      const timeSinceLastCode = Date.now() - new Date(lastCode.created_date).getTime();
      
      if (timeSinceLastCode < 60000) {
        return Response.json({ 
          error: 'Please wait before requesting a new code',
          retryAfter: Math.ceil((60000 - timeSinceLastCode) / 1000)
        }, { status: 429 });
      }
    }

    // Generate verification code
    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Delete old codes
    const oldCodes = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      user_email: email
    });
    
    for (const oldCode of oldCodes) {
      await base44.asServiceRole.entities.EmailVerificationCode.delete(oldCode.id);
    }

    // Store new code
    await base44.asServiceRole.entities.EmailVerificationCode.create({
      user_email: email,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified: false
    });

    // Send email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Login verification code - Schedual',
      body: `
        <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:10px;">Schedual</div>
              <h2 style="margin:0;font-size:28px;line-height:1.2;">Verify your login</h2>
              <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88);">A login attempt was made to your account.</p>
            </div>
            <div style="padding:28px;">
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#334155;">To continue, please enter this verification code:</p>
              <div style="margin:24px 0;padding:24px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#1d4ed8;margin-bottom:10px;">Login code</div>
                <div style="font-size:40px;line-height:1;letter-spacing:10px;font-weight:700;color:#0f172a;">${code}</div>
              </div>
              <div style="padding:16px;border:1px solid #fecaca;border-radius:14px;background:#fef2f2;color:#991b1b;font-size:14px;line-height:1.7;">
                This code will expire in 10 minutes.<br /><strong>If you didn’t attempt to log in, please secure your account immediately.</strong>
              </div>
            </div>
            <div style="padding:18px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#64748b;font-size:13px;">
              Schedual · Intelligent IB Scheduling
            </div>
          </div>
        </div>
      `
    });

    // Get IP address and user agent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Create unverified session with CSRF token
    const sessionToken = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await base44.asServiceRole.entities.LoginSession.create({
      user_email: email,
      session_token: sessionToken,
      csrf_token: csrfToken,
      verified: false,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: sessionExpiresAt.toISOString()
    });

    return Response.json({ 
      success: true,
      sessionToken,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('Send login verification error:', error);
    return Response.json({ 
      error: error.message || 'Failed to send verification code' 
    }, { status: 500 });
  }
});