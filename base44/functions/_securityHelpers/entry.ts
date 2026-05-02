import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function requireAuthenticatedUser(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return { base44, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { base44, user };
}

export async function getCurrentUserRecord(base44, authUser) {
  const rows = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
  return rows[0] || authUser;
}

export function getSchoolId(userRecord, jwtUser?) {
  return userRecord?.school_id || userRecord?.data?.school_id ||
         jwtUser?.school_id || jwtUser?.data?.school_id || null;
}

export function getRole(userRecord, jwtUser?) {
  return userRecord?.role || userRecord?.data?.role ||
         jwtUser?.role || jwtUser?.data?.role || null;
}

export function getSuperAdminEmails() {
  return String(Deno.env.get('SUPER_ADMIN_EMAILS') || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email) {
  const normalized = String(email || '').toLowerCase();
  return getSuperAdminEmails().includes(normalized);
}

export async function requireAdmin(req) {
  const { base44, user, error } = await requireAuthenticatedUser(req);
  if (error) return { error };
  const userRecord = await getCurrentUserRecord(base44, user);
  const role = getRole(userRecord, user);
  const schoolId = getSchoolId(userRecord, user);
  if (role !== 'admin' || !schoolId) {
    return { error: Response.json({ error: `Forbidden: Admin access required (role: ${role ?? 'none'})` }, { status: 403 }) };
  }
  return { base44, user: userRecord, schoolId };
}

export async function requireSuperAdmin(req) {
  const { base44, user, error } = await requireAuthenticatedUser(req);
  if (error) return { error };
  if (!isSuperAdminEmail(user?.email)) {
    return { error: Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 }) };
  }
  return { base44, user };
}