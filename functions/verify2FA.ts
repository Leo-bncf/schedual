import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

// Base32 decode
function base32Decode(encoded) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  
  for (const char of encoded.toUpperCase().replace(/=+$/, '')) {
    const val = alphabet.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  
  return new Uint8Array(bytes);
}

// Generate TOTP code
function generateTOTP(secret, timeStep = 30) {
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / timeStep);
  
  const secretBytes = base32Decode(secret);
  const counterBuffer = new ArrayBuffer(8);
  const counterView = new DataView(counterBuffer);
  counterView.setBigUint64(0, BigInt(counter), false);
  
  const key = createHmac('sha1', secretBytes);
  key.update(new Uint8Array(counterBuffer));
  const hmac = key.digest();
  
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = 
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  
  const otp = (binary % 1000000).toString().padStart(6, '0');
  return otp;
}

// Verify TOTP with time window
function verifyTOTP(secret, token, window = 1) {
  for (let i = -window; i <= window; i++) {
    const timeStep = Math.floor(Date.now() / 1000 / 30) + i;
    const epoch = timeStep * 30;
    const counter = Math.floor(epoch / 30);
    
    const secretBytes = base32Decode(secret);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setBigUint64(0, BigInt(counter), false);
    
    const key = createHmac('sha1', secretBytes);
    key.update(new Uint8Array(counterBuffer));
    const hmac = key.digest();
    
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = 
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    
    const otp = (binary % 1000000).toString().padStart(6, '0');
    
    if (otp === token) {
      return true;
    }
  }
  return false;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code, enable } = await req.json();

    if (!code || code.length !== 6) {
      return Response.json({ error: 'Invalid code format' }, { status: 400 });
    }

    if (!user.totp_secret) {
      return Response.json({ error: '2FA not setup' }, { status: 400 });
    }

    // Verify the code
    const isValid = verifyTOTP(user.totp_secret, code);

    if (!isValid) {
      return Response.json({ 
        success: false, 
        error: 'Invalid code' 
      }, { status: 400 });
    }

    // If enabling, update user record
    if (enable !== undefined) {
      await base44.auth.updateMe({ totp_enabled: enable });
    }

    return Response.json({
      success: true,
      message: enable ? '2FA enabled successfully' : 'Code verified'
    });

  } catch (error) {
    console.error('Error verifying 2FA:', error);
    return Response.json({ 
      error: error.message || 'Failed to verify code' 
    }, { status: 500 });
  }
});