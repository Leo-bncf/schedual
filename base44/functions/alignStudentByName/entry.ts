import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = (body?.name || '').trim();
    const targetSchoolId = body?.school_id || user.school_id;
    const programme = body?.ib_programme || 'DP';
    const yearGroup = body?.year_group || 'DP1';

    if (!name) return Response.json({ error: 'Missing name' }, { status: 400 });
    if (!targetSchoolId) return Response.json({ error: 'Missing school_id' }, { status: 400 });
    if (body?.school_id && user?.role !== 'admin' && body.school_id !== user.school_id) {
      return Response.json({ error: 'Forbidden: cannot modify another school' }, { status: 403 });
    }

    // Pull students using service role to avoid RLS masking
    const allStudents = await base44.asServiceRole.entities.Student.list().catch(() => []);

    // Case-insensitive substring match on full_name
    const candidates = allStudents.filter(s => (s.full_name || '').toLowerCase().includes(name.toLowerCase()));

    if (candidates.length === 0) {
      return Response.json({ success: false, message: 'No students matched by name', matched: 0 });
    }

    let updated = 0;
    const failed = [];

    for (const s of candidates) {
      try {
        await base44.asServiceRole.entities.Student.update(s.id, {
          school_id: targetSchoolId,
          ib_programme: programme,
          year_group: yearGroup,
          is_active: true,
        });
        updated++;
      } catch (e) {
        failed.push({ id: s.id, error: e?.message || String(e) });
      }
    }

    return Response.json({
      success: true,
      name,
      targetSchoolId,
      matched: candidates.length,
      updated,
      failed,
      sample: candidates.slice(0, 5).map(s => ({ id: s.id, full_name: s.full_name, old_school_id: s.school_id, old_programme: s.ib_programme, old_year_group: s.year_group }))
    });
  } catch (error) {
    console.error('alignStudentByName error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});