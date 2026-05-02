import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const superAdminEmails = String(Deno.env.get('SUPER_ADMIN_EMAILS') || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!superAdminEmails.includes((user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden: SuperAdmin access required' }, { status: 403 });
    }

    const allSubjects = await base44.asServiceRole.entities.Subject.list();

    const bySchool: Record<string, number> = {};
    allSubjects.forEach((s: any) => {
      const sid = s.school_id || 'NULL';
      bySchool[sid] = (bySchool[sid] || 0) + 1;
    });

    return Response.json({
      total_subjects: allSubjects.length,
      grouped_by_school: Object.entries(bySchool).map(([school_id, count]) => ({ school_id, count })),
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
