import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

// Generate TOTP secret (32 character base32 string)
function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 32; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

// Generate QR code data URL for Google Authenticator
function generateQRCodeDataURL(secret, email, issuer = 'Schedual') {
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
  
  // Generate QR code as SVG
  const size = 200;
  const qrMatrix = generateQRMatrix(otpauthUrl);
  const moduleSize = size / qrMatrix.length;
  
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${qrMatrix.length} ${qrMatrix.length}">`;
  svg += `<rect width="${qrMatrix.length}" height="${qrMatrix.length}" fill="white"/>`;
  
  for (let y = 0; y < qrMatrix.length; y++) {
    for (let x = 0; x < qrMatrix.length; x++) {
      if (qrMatrix[y][x]) {
        svg += `<rect x="${x}" y="${y}" width="1" height="1" fill="black"/>`;
      }
    }
  }
  svg += '</svg>';
  
  const base64 = btoa(svg);
  return `data:image/svg+xml;base64,${base64}`;
}

// Simple QR code generation (for demo - in production use a library)
function generateQRMatrix(data) {
  // This is a simplified version - in production, use a proper QR library
  // For now, return a placeholder pattern
  const size = 33;
  const matrix = Array(size).fill().map(() => Array(size).fill(false));
  
  // Add finder patterns (corners)
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
        matrix[i][j] = true;
        matrix[i][size - 1 - j] = true;
        matrix[size - 1 - i][j] = true;
      }
    }
  }
  
  // Add some data pattern (simplified)
  const dataHash = data.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  for (let i = 8; i < size - 8; i++) {
    for (let j = 8; j < size - 8; j++) {
      matrix[i][j] = ((i * j + dataHash) % 3) === 0;
    }
  }
  
  return matrix;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate new TOTP secret
    const secret = generateSecret();
    
    // Generate QR code
    const qrCodeDataURL = generateQRCodeDataURL(secret, user.email);

    // Store secret in user record (not enabled yet until verified)
    await base44.auth.updateMe({ 
      totp_secret: secret,
      totp_enabled: false 
    });

    return Response.json({
      success: true,
      secret,
      qrCodeDataURL,
      manualEntryCode: secret.match(/.{1,4}/g).join(' ') // Format for manual entry
    });

  } catch (error) {
    console.error('Error setting up 2FA:', error);
    return Response.json({ 
      error: error.message || 'Failed to setup 2FA' 
    }, { status: 500 });
  }
});