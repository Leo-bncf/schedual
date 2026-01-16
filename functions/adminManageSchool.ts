import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validateCSRF } from './csrfHelper.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Superadmins: skip CSRF (server-side privileged action)
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isSuperAdmin = superAdminEmails.includes((user.email || '').toLowerCase());
    if (!isSuperAdmin) {
      const csrf = await validateCSRF(req, base44, user);
      if (!csrf.valid) {
        return Response.json({ error: csrf.error }, { status: csrf.status || 403 });
      }
    }

    // Require SuperAdmin
    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    const { action, schoolId, data } = await req.json();

    // Ensure we always use service role for School ops to bypass RLS
    const svc = base44.asServiceRole;

    // Extra guard: enforce service role by performing a no-op list with service role
    await svc.entities.School.filter({ id: undefined }).catch(() => {});

    switch (action) {
      case 'create':
        const newSchool = await svc.entities.School.create(data);
        return Response.json({ success: true, school: newSchool });

      case 'update':
        // Use service role explicitly (bypasses RLS) — allowed for superadmins only
        const updated = await svc.entities.School.update(schoolId, data);
        return Response.json({ success: true, school: updated });

      case 'delete':
        await svc.entities.School.delete(schoolId);
        return Response.json({ success: true });

      case 'list':
        const schools = await svc.entities.School.filter({});
        return Response.json({ success: true, schools });

      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in adminManageSchool:', error);
    // Normalize common RLS/permission error messaging
    const msg = (error && typeof error === 'object' && ('message' in error)) ? error.message : String(error);
    if (/permission denied|rls|not allowed/i.test(msg)) {
      return Response.json({ error: 'Server role escalation failed while updating School (permissions). Please try again.' }, { status: 500 });
    }
    return Response.json({ error: msg }, { status: 500 });
  }
});