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

    // Superadmin check (with hard-allow override)
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const hardAllowed = ["leo.bancroft34@icloud.com"];
    const isSuperAdmin = hardAllowed.includes((user.email || '').toLowerCase()) || superAdminEmails.includes((user.email || '').toLowerCase());
    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }



    const { action, schoolId, data } = await req.json();

    // Ensure we always use service role for School ops to bypass RLS
    const svc = base44.asServiceRole;

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
    return Response.json({ error: error.message }, { status: 500 });
  }
});