import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createHmac } from 'node:crypto';

function base32Decode(encoded: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = [];
  for (const char of encoded.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

function generateTOTP(secret: string, window = 0): string {
  const key = base32Decode(secret);
  const time = Math.floor(Date.now() / 1000 / 30) + window;
  const timeBuffer = new ArrayBuffer(8);
  const view = new DataView(timeBuffer);
  view.setUint32(4, time, false);
  const hmac = createHmac('sha1', Buffer.from(key));
  hmac.update(Buffer.from(timeBuffer));
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) |
               ((digest[offset + 1] & 0xff) << 16) |
               ((digest[offset + 2] & 0xff) << 8) |
               (digest[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { code, enable } = await req.json();
    if (!code) return Response.json({ error: 'Code is required' }, { status: 400 });

    if (!user.totp_secret) {
      return Response.json({ error: 'No 2FA secret found. Please run setup first.' }, { status: 400 });
    }

    // Accept codes from current window ±1 step to handle clock skew
    const valid = [-1, 0, 1].some(w => generateTOTP(user.totp_secret, w) === String(code).trim());

    if (!valid) {
      return Response.json({ error: 'Invalid authentication code' }, { status: 400 });
    }

    if (enable) {
      await base44.auth.updateMe({ totp_enabled: true });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[verify2FA] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
