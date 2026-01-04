/**
 * Security Helper for School Data Isolation
 * Validates that users can only access data from their own school
 * SuperAdmins bypass all restrictions
 */

export async function validateSchoolAccess(base44, entitySchoolId) {
  if (!entitySchoolId) {
    throw new Error('Missing school_id on entity');
  }

  const user = await base44.auth.me();
  if (!user) {
    throw new Error('Unauthorized: Not authenticated');
  }

  // Check if user is SuperAdmin
  try {
    const { data } = await base44.functions.invoke('getSuperAdminEmails');
    if (data?.isSuperAdmin) {
      return true; // SuperAdmins can access all schools
    }
  } catch (error) {
    console.error('SuperAdmin check failed:', error);
  }

  // Regular users must match school_id
  if (user.school_id !== entitySchoolId) {
    throw new Error('Unauthorized: Cannot access data from other schools');
  }

  return true;
}

/**
 * Filters entities to only include those matching user's school_id
 * For bulk operations
 */
export async function filterByUserSchool(base44, entities) {
  const user = await base44.auth.me();
  if (!user) return [];

  // Check if SuperAdmin
  try {
    const { data } = await base44.functions.invoke('getSuperAdminEmails');
    if (data?.isSuperAdmin) {
      return entities; // SuperAdmins see all
    }
  } catch (error) {
    console.error('SuperAdmin check failed:', error);
  }

  // Filter to user's school only
  return entities.filter(entity => entity.school_id === user.school_id);
}

/**
 * Gets user's school_id or throws error if not assigned
 */
export async function getUserSchoolId(base44) {
  const user = await base44.auth.me();
  if (!user) {
    throw new Error('Unauthorized: Not authenticated');
  }

  if (!user.school_id) {
    throw new Error('User not assigned to a school');
  }

  return user.school_id;
}