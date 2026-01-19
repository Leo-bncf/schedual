import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, data, id, query } = body || {};

    // Superadmin check (with hard-allow override)
    const superAdminEmailsStr = Deno.env.get('SUPER_ADMIN_EMAILS') || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const hardAllowed = ['leo.bancroft34@icloud.com'];
    const isSuperAdmin = hardAllowed.includes((user.email || '').toLowerCase()) || superAdminEmails.includes((user.email || '').toLowerCase());

    if (!isSuperAdmin) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    if (!action) {
      return Response.json({ error: 'Missing action' }, { status: 400 });
    }

    // Use service role to bypass RLS for admin operations
    const svc = base44.asServiceRole.entities.School;

    if (action === 'list') {
      const schools = await svc.filter(query || {});
      return Response.json({ success: true, schools });
    }

    if (action === 'create') {
      if (!data) return Response.json({ error: 'Missing data' }, { status: 400 });
      const created = await svc.create(data);
      return Response.json({ success: true, school: created });
    }

    if (action === 'update') {
      if (!id || !data) return Response.json({ error: 'Missing id or data' }, { status: 400 });
      const updated = await svc.update(id, data);
      return Response.json({ success: true, school: updated });
    }

    if (action === 'delete') {
      if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
      await svc.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('adminManageSchool error:', error);
    const msg = error?.message || 'Internal Server Error';
    return Response.json({ error: msg }, { status: 500 });
  }
});