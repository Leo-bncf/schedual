import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ error: 'Your account is not linked to a school' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.filter(Boolean) : [];

    if (studentIds.length === 0) {
      return Response.json({ error: 'No student IDs provided' }, { status: 400 });
    }

    const targetSchoolId = user.school_id;

    let updated = 0;
    let skipped = 0;
    const errors = [];

    // process in small batches
    const batchSize = 25;
    for (let i = 0; i < studentIds.length; i += batchSize) {
      const batch = studentIds.slice(i, i + batchSize);
      await Promise.all(batch.map(async (id) => {
        try {
          // Update to user's school_id regardless of current value
          await base44.asServiceRole.entities.Student.update(id, { school_id: targetSchoolId });
          updated += 1;
        } catch (e) {
          skipped += 1;
          errors.push({ id, error: e?.message || 'update failed' });
        }
      }));
      // small delay to avoid throttling
      await new Promise((r) => setTimeout(r, 150));
    }

    return Response.json({ success: true, targetSchoolId, total: studentIds.length, updated, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    console.error('retagStudentsToSchool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});