import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHash } from 'node:crypto';

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, code } = await req.json();

    if (!email || !code) {
      return Response.json({ error: 'Email and code are required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(code)) {
      return Response.json({ error: 'Invalid code format' }, { status: 400 });
    }

    // Find the verification record
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

    // Check max attempts
    if (record.attempts >= 5) {
      await base44.asServiceRole.entities.EmailVerificationCode.delete(record.id);
      return Response.json({ error: 'Too many attempts. Please request a new code.' }, { status: 400 });
    }

    // Verify the code
    const codeHash = hashCode(code);
    
    if (codeHash !== record.code_hash) {
      // Increment attempts
      await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, {
        attempts: record.attempts + 1
      });
      
      const remainingAttempts = 5 - (record.attempts + 1);
      return Response.json({ 
        error: 'Invalid code',
        remainingAttempts 
      }, { status: 400 });
    }

    // Mark as verified
    await base44.asServiceRole.entities.EmailVerificationCode.update(record.id, {
      verified: true
    });

    // Update user's email_verified field if they exist
    try {
      const users = await base44.asServiceRole.entities.User.filter({ email });
      if (users.length > 0) {
        await base44.asServiceRole.entities.User.update(users[0].id, {
          email_verified: true
        });
      }
    } catch (error) {
      console.error('Error updating user:', error);
      // Continue anyway since verification was successful
    }

    // Clean up - delete the used code
    await base44.asServiceRole.entities.EmailVerificationCode.delete(record.id);

    return Response.json({ 
      success: true,
      message: 'Email verified successfully'
    });

  } catch (error) {
    console.error('Verify code error:', error);
    return Response.json({ 
      error: error.message || 'Failed to verify code' 
    }, { status: 500 });
  }
});