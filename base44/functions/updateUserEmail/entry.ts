import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { newEmail } = await req.json();
    if (!newEmail || !String(newEmail).includes('@')) {
      return Response.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const normalizedNew = String(newEmail).trim().toLowerCase();
    const currentEmail = String(user.email || '').trim().toLowerCase();

    if (normalizedNew === currentEmail) {
      return Response.json({ error: 'New email must be different from current email' }, { status: 400 });
    }

    // Check new email not already in use
    const existing = await base44.asServiceRole.entities.User.filter({ email: normalizedNew });
    if (existing.length > 0) {
      return Response.json({ error: 'Email address is already in use' }, { status: 409 });
    }

    // Rate limit: one request per 60 seconds per user
    const recent = await base44.asServiceRole.entities.EmailVerificationCode.filter(
      { user_email: currentEmail, verified: false }, '-created_date', 1
    );
    if (recent.length > 0) {
      const elapsed = Date.now() - new Date(recent[0].created_date).getTime();
      if (elapsed < 60_000) {
        return Response.json({
          error: 'Please wait before requesting a new code',
          retryAfter: Math.ceil((60_000 - elapsed) / 1000),
        }, { status: 429 });
      }
    }

    // Delete any old pending codes for this user
    const old = await base44.asServiceRole.entities.EmailVerificationCode.filter({ user_email: currentEmail });
    for (const r of old) {
      await base44.asServiceRole.entities.EmailVerificationCode.delete(r.id);
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.EmailVerificationCode.create({
      user_email: currentEmail,
      code_hash: hashCode(code),
      expires_at: expiresAt,
      attempts: 0,
      verified: false,
      pending_email: normalizedNew,
    });

    // Send code to the NEW email address to prove ownership
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: normalizedNew,
      subject: 'Confirm your new email address — Schedual',
      body: `
        <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:10px;">Schedual</div>
              <h2 style="margin:0;font-size:28px;line-height:1.2;">Confirm new email</h2>
              <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88);">A request was made to change your Schedual account email to this address.</p>
            </div>
            <div style="padding:28px;">
              <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#334155;">Enter this code to confirm your new email address:</p>
              <div style="margin:24px 0;padding:24px;border-radius:18px;background:#eff6ff;border:1px solid #bfdbfe;text-align:center;">
                <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.16em;color:#1d4ed8;margin-bottom:10px;">Confirmation code</div>
                <div style="font-size:40px;line-height:1;letter-spacing:10px;font-weight:700;color:#0f172a;">${code}</div>
              </div>
              <div style="padding:16px;border:1px solid #fecaca;border-radius:14px;background:#fef2f2;color:#991b1b;font-size:14px;line-height:1.7;">
                This code expires in 10 minutes.<br /><strong>If you didn't request this, ignore this email — your current address (${esc(currentEmail)}) is unchanged.</strong>
              </div>
            </div>
            <div style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;">
              <img src="https://media.base44.com/images/public/69458d4b7ddbdbf0a082832e/690ba3d1f_schedual_pro_logo.png" alt="Schedual Pro" style="max-width:200px;width:100%;height:auto;display:block;margin:0 auto;" />
            </div>
          </div>
        </div>
      `,
    });

    return Response.json({ pending: true, message: 'Verification code sent to your new email address' });
  } catch (error) {
    console.error('[updateUserEmail] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
