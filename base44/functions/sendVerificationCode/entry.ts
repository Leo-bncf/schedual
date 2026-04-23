import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (String(email).trim().toLowerCase() !== String(user.email || '').trim().toLowerCase()) {
      return Response.json({ error: 'Forbidden: invalid email' }, { status: 403 });
    }

    // Check if there's a recent code (rate limiting)
    const recentCodes = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      user_email: email,
      verified: false
    }, '-created_date', 1);

    if (recentCodes.length > 0) {
      const lastCode = recentCodes[0];
      const timeSinceLastCode = Date.now() - new Date(lastCode.created_date).getTime();
      
      // Rate limit: 60 seconds between requests
      if (timeSinceLastCode < 60000) {
        return Response.json({ 
          error: 'Please wait before requesting a new code',
          retryAfter: Math.ceil((60000 - timeSinceLastCode) / 1000)
        }, { status: 429 });
      }
    }

    // Generate and hash the code
    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete old codes for this email
    const oldCodes = await base44.asServiceRole.entities.EmailVerificationCode.filter({
      user_email: email
    });
    
    for (const oldCode of oldCodes) {
      await base44.asServiceRole.entities.EmailVerificationCode.delete(oldCode.id);
    }

    // Store the hashed code
    await base44.asServiceRole.entities.EmailVerificationCode.create({
      user_email: email,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
      verified: false
    });

    // Send email via Base44 integration
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: 'Verify your Schedual account',
      body: `
        <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:10px;">Schedual</div>
              <h2 style="margin:0;font-size:28px;line-height:1.2;">Verify your email address</h2>
              <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88);">Use the code below to complete your registration.</p>
            </div>
            <div style="padding:28px;">
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#334155;">Thank you for signing up for Schedual. To complete your registration, please enter this verification code:</p>
              <div style="margin:24px 0;padding:24px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#1d4ed8;margin-bottom:10px;">Verification code</div>
                <div style="font-size:40px;line-height:1;letter-spacing:10px;font-weight:700;color:#0f172a;">${code}</div>
              </div>
              <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;color:#475569;font-size:14px;line-height:1.7;">
                This code will expire in 10 minutes.<br />If you didn’t request this code, you can safely ignore this email.
              </div>
            </div>
            <div style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;">
              <img src="https://media.base44.com/images/public/69458d4b7ddbdbf0a082832e/690ba3d1f_schedual_pro_logo.png" alt="Schedual Pro" style="max-width:320px;width:100%;height:auto;display:block;margin:0 auto;" />
            </div>
          </div>
        </div>
      `
    });

    return Response.json({ 
      success: true,
      message: 'Verification code sent to your email'
    });

  } catch (error) {
    console.error('Send verification error:', error);
    return Response.json({ 
      error: error.message || 'Failed to send verification code' 
    }, { status: 500 });
  }
});