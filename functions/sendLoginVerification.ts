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

    // Check if user is super admin - skip 2FA for super admins
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    
    if (superAdminEmails.includes(email.toLowerCase())) {
      // Create verified session for super admin
      const sessionToken = randomBytes(32).toString('hex');
      const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      await base44.asServiceRole.entities.LoginSession.create({
        user_email: email,
        session_token: sessionToken,
        verified: true,
        expires_at: sessionExpiresAt.toISOString()
      });

      return Response.json({ 
        success: true,
        sessionToken,
        superAdmin: true,
        message: 'Super admin - verification skipped'
      });
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
    console.log(`Sending verification code to ${email}...`);
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: 'Login verification code - Schedual',
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">Verify your login</h2>
            <p>A login attempt was made to your Schedual account. To continue, please enter this verification code:</p>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <h1 style="color: #1e3a8a; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
            </div>
            <p style="color: #64748b;">This code will expire in 10 minutes.</p>
            <p style="color: #ef4444; font-size: 14px;"><strong>If you didn't attempt to log in, please secure your account immediately.</strong></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #94a3b8; font-size: 12px;">Schedual - Intelligent IB Scheduling</p>
          </div>
        `
      });
      console.log(`✅ Verification code sent successfully to ${email}`);
    } catch (emailError) {
      console.error(`❌ Failed to send email to ${email}:`, emailError);
      throw new Error(`Failed to send verification email: ${emailError.message}`);
    }

    // Create unverified session
    const sessionToken = randomBytes(32).toString('hex');
    const sessionExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await base44.asServiceRole.entities.LoginSession.create({
      user_email: email,
      session_token: sessionToken,
      verified: false,
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