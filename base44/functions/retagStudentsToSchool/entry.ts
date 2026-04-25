import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    const dbUsers = authUser ? await base44.asServiceRole.entities.User.filter({ id: authUser.id }) : [];
    const user = dbUsers[0] || authUser;
    const schoolId = user?.school_id || user?.data?.school_id;
    const role = user?.role || user?.data?.role;

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!schoolId) {
      return Response.json({ error: 'Your account is not linked to a school' }, { status: 400 });
    }
    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const studentIds = Array.isArray(body?.studentIds) ? body.studentIds.filter(Boolean) : [];

    if (studentIds.length === 0) {
      return Response.json({ error: 'No student IDs provided' }, { status: 400 });
    }

    const targetSchoolId = schoolId;

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

    // Post-update verification: fetch each student's school_id
    const verifyResults = [];
    const countsBySchool = {};
    const verifyBatch = 20;
    for (let i = 0; i < studentIds.length; i += verifyBatch) {
      const batch = studentIds.slice(i, i + verifyBatch);
      const fetched = await Promise.all(batch.map(async (id) => {
        try {
          const rows = await base44.asServiceRole.entities.Student.filter({ id });
          const rec = rows?.[0] || null;
          if (rec) {
            countsBySchool[rec.school_id || 'null'] = (countsBySchool[rec.school_id || 'null'] || 0) + 1;
            return { id: rec.id, school_id: rec.school_id };
          }
          countsBySchool['missing'] = (countsBySchool['missing'] || 0) + 1;
          return { id, school_id: null };
        } catch (e) {
          countsBySchool['error'] = (countsBySchool['error'] || 0) + 1;
          return { id, error: e?.message || 'fetch failed' };
        }
      }));
      verifyResults.push(...fetched);
      await new Promise((r) => setTimeout(r, 100));
    }

    const confirmedToTarget = countsBySchool[targetSchoolId] || 0;

    return Response.json({ 
      success: true, 
      targetSchoolId, 
      total: studentIds.length, 
      updated, 
      skipped, 
      confirmedToTarget,
      countsBySchool,
      sample: verifyResults.slice(0, 10),
      errors: errors.slice(0, 10) 
    });
  } catch (error) {
    console.error('retagStudentsToSchool error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});