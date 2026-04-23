import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

export async function requireAuthenticatedUser(req) {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return { base44, error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { base44, user };
}

export async function getCurrentUserRecord(base44, user) {
  const rows = await base44.asServiceRole.entities.User.filter({ id: user.id });
  return rows[0] || user;
}

export function getSchoolId(userRecord) {
  return userRecord?.school_id || userRecord?.data?.school_id || null;
}

export function getRole(userRecord) {
  return userRecord?.role || userRecord?.data?.role || null;
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
  if (getRole(userRecord) !== 'admin' || !getSchoolId(userRecord)) {
    return { error: Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 }) };
  }
  return { base44, user: userRecord, schoolId: getSchoolId(userRecord) };
}

export async function requireSuperAdmin(req) {
  const { base44, user, error } = await requireAuthenticatedUser(req);
  if (error) return { error };
  if (!isSuperAdminEmail(user?.email)) {
    return { error: Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 }) };
  }
  return { base44, user };
}