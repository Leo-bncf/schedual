// Authorization helper functions for backend
// These ensure school admins can only access their own school's data

/**
 * Verify user is authenticated and has a school_id
 * @param {Object} base44 - Base44 client instance
 * @returns {Promise<Object>} - User object with school_id
 * @throws {Error} - If user is not authenticated or has no school
 */
export async function requireSchoolAdmin(base44) {
  const user = await base44.auth.me();

  if (!user) {
    throw new Error('Unauthorized - not authenticated');
  }

  const school_id = user.school_id || user.data?.school_id;
  if (!school_id) {
    throw new Error('Forbidden - no school assigned');
  }

  return {
    ...user,
    school_id,
    data: {
      ...(user.data || {}),
      school_id,
    },
  };
}

/**
 * Verify user owns the school_id in the data
 * @param {Object} user - User object with school_id
 * @param {string} dataSchoolId - The school_id from the entity
 * @throws {Error} - If school_ids don't match
 */
export function verifySchoolOwnership(user, dataSchoolId) {
  if (user.school_id !== dataSchoolId) {
    throw new Error('Forbidden - cannot access data from another school');
  }
}

/**
 * Filter query to only include user's school data
 * @param {Object} user - User object with school_id
 * @param {Object} query - Query object
 * @returns {Object} - Query with school_id filter
 */
export function addSchoolFilter(user, query = {}) {
  return {
    ...query,
    school_id: user.school_id
  };
}