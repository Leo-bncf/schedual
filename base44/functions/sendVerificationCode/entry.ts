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
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email is required' }, { status: 400 });
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e3a8a;">Verify your email address</h2>
          <p>Thank you for signing up for Schedual. To complete your registration, please enter this verification code:</p>
          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h1 style="color: #1e3a8a; font-size: 36px; letter-spacing: 8px; margin: 0;">${code}</h1>
          </div>
          <p style="color: #64748b;">This code will expire in 10 minutes.</p>
          <p style="color: #64748b; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
          <p style="color: #94a3b8; font-size: 12px;">Schedual - Intelligent IB Scheduling</p>
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