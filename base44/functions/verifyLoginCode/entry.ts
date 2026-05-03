import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHash } from 'node:crypto';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, sessionToken } = await req.json();
    if (!code || !sessionToken) {
      return Response.json({ error: 'Code and sessionToken are required' }, { status: 400 });
    }

    const email = user.email;

    // Fetch the stored code record
    const records = await base44.asServiceRole.entities.EmailVerificationCode.filter(
      { user_email: email, verified: false }, '-created_date', 1
    );

    if (records.length === 0) {
      return Response.json({ error: 'No verification code found. Please request a new one.' }, { status: 400 });
    }

    const record = records[0];

    // Check lock
    if (record.locked_until) {
      const lockExpiry = new Date(record.locked_until);
      if (lockExpiry > new Date()) {
        const remaining = Math.ceil((lockExpiry.getTime() - Date.now()) / 1000);
        return Response.json({
          error: `Too many failed attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
          retryAfter: remaining,
        }, { status: 429 });
      }
    }

    // Check expiry
    if (new Date(record.expires_at) < new Date()) {
      await base44.asServiceRole.entities.EmailVerificationCode.delete(record.id);
      return Response.json({ error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
    }

    const attempts = (record.attempts ?? 0) + 1;
    const codeHash = hashCode(String(code).trim());

    if (codeHash !== record.code_hash) {
      if (attempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
        await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, {
          attempts,
          locked_until: lockedUntil,
        });
        return Response.json({
          error: 'Too many failed attempts. Account locked for 15 minutes.',
          retryAfter: LOCK_DURATION_MS / 1000,
        }, { status: 429 });
      }
      await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, { attempts });
      return Response.json({
        error: `Incorrect code. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining.`,
        attemptsLeft: MAX_ATTEMPTS - attempts,
      }, { status: 400 });
    }

    // Mark code as verified and mark login session verified
    await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, { verified: true });

    const sessions = await base44.asServiceRole.entities.LoginSession.filter({
      user_email: email,
      session_token: sessionToken,
    }, '-created_date', 1);

    if (sessions.length > 0) {
      await base44.asServiceRole.entities.LoginSession.update(sessions[0].id, { verified: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[verifyLoginCode] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
