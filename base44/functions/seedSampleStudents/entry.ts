import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const targetSchoolId = user.school_id;
    if (!targetSchoolId) return Response.json({ error: 'No school assigned to your account' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.Student.filter({ school_id: targetSchoolId }, '-created_date', 1).catch(() => []);
    if (existing.length > 0) {
      return Response.json({ success: true, message: 'Students already exist for this school, skipping seeding.', seeded: 0 });
    }

    const students = [];
    for (let i = 1; i <= 25; i++) {
      students.push({
        school_id: targetSchoolId,
        full_name: `Sample Student ${i}`,
        email: `sample${i}@example.com`,
        ib_programme: 'MYP',
        year_group: 'MYP3',
        is_active: true,
      });
    }

    const created = await base44.asServiceRole.entities.Student.bulkCreate(students);

    return Response.json({ success: true, seeded: created?.length || students.length });
  } catch (error) {
    console.error('seedSampleStudents error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});