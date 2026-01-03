import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validates that a user is authenticated and has a school_id
 * Super admins (checked via SUPER_ADMIN_EMAILS) bypass school_id requirement
 * 
 * @param {Request} req - The incoming request
 * @returns {Promise<{user: Object, isSuperAdmin: boolean, base44: Object}>}
 * @throws {Response} Returns 401/403 error response if validation fails
 */
export async function validateUserAuth(req) {
  const base44 = createClientFromRequest(req);
  
  try {
    const user = await base44.auth.me();
    
    if (!user) {
      throw new Response(JSON.stringify({ error: 'Unauthorized: Please log in' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if user is super admin
    const superAdminEmails = (Deno.env.get('SUPER_ADMIN_EMAILS') || '').split(',').map(e => e.trim());
    const isSuperAdmin = superAdminEmails.includes(user.email);

    // If not super admin, must have school_id
    if (!isSuperAdmin && !user.school_id) {
      throw new Response(JSON.stringify({ 
        error: 'Forbidden: No school access. Please activate a subscription or wait for an invitation.',
        code: 'NO_SCHOOL_ACCESS'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return { user, isSuperAdmin, base44 };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    throw new Response(JSON.stringify({ error: 'Authentication failed', details: error.message }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Validates that data being created/updated belongs to the user's school
 * Super admins bypass this check
 * 
 * @param {Object} data - Data object with school_id
 * @param {Object} user - User object from validateUserAuth
 * @param {boolean} isSuperAdmin - Whether user is super admin
 * @throws {Response} Returns 403 error if school_id doesn't match
 */
export function validateSchoolAccess(data, user, isSuperAdmin) {
  if (isSuperAdmin) return; // Super admins can access any school

  if (data.school_id && data.school_id !== user.school_id) {
    throw new Response(JSON.stringify({ 
      error: 'Forbidden: Cannot access data from another school',
      code: 'CROSS_SCHOOL_ACCESS_DENIED'
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Sanitizes response data by removing sensitive fields
 * Removes: stripe IDs, 2FA secrets, internal tokens
 * 
 * @param {Object|Array} data - Data to sanitize
 * @param {Object} user - Current user
 * @param {boolean} isSuperAdmin - Whether user is super admin
 * @returns {Object|Array} Sanitized data
 */
export function sanitizeSensitiveFields(data, user, isSuperAdmin) {
  // Super admins see everything
  if (isSuperAdmin) return data;

  const sensitiveFields = [
    'stripe_customer_id',
    'stripe_subscription_id',
    'two_factor_secret',
    'session_token',
    'code_hash'
  ];

  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    const sanitized = { ...obj };
    
    // Remove sensitive fields
    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });
    
    return sanitized;
  };

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(sanitize);
  }
  
  return sanitize(data);
}

/**
 * Comprehensive security check for backend functions
 * Validates auth, school access, and returns sanitized data
 * 
 * @param {Request} req - The incoming request
 * @param {Object} data - Data being processed (optional)
 * @returns {Promise<{user: Object, isSuperAdmin: boolean, base44: Object}>}
 */
export async function securityCheck(req, data = null) {
  const { user, isSuperAdmin, base44 } = await validateUserAuth(req);
  
  if (data) {
    validateSchoolAccess(data, user, isSuperAdmin);
  }
  
  return { user, isSuperAdmin, base44 };
}