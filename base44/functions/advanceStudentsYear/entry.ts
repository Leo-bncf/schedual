import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();

    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use DB record to avoid stale JWT role/school_id
    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const dbUser = dbUsers[0] || null;
    const schoolId = dbUser?.school_id || dbUser?.data?.school_id || authUser.school_id;
    const role = dbUser?.role || dbUser?.data?.role || authUser.role;

    if (!schoolId) {
      return Response.json({ error: 'Unauthorized - no school assigned' }, { status: 401 });
    }

    if (role !== 'admin') {
      // Auto-heal role if school_id is present (same rule as Layout.jsx)
      await base44.asServiceRole.entities.User.update(authUser.id, { role: 'admin' });
    }

    // Use asServiceRole to bypass RLS role check on student reads
    const students = await base44.asServiceRole.entities.Student.filter({ school_id: schoolId });

    const yearProgressionMap: Record<string, string | null> = {
      'DP1': 'DP2',
      'DP2': null,
      'MYP1': 'MYP2',
      'MYP2': 'MYP3',
      'MYP3': 'MYP4',
      'MYP4': 'MYP5',
      'MYP5': 'DP1',
      'PYP-A': 'PYP-B',
      'PYP-B': 'PYP-C',
      'PYP-C': 'PYP-D',
      'PYP-D': 'PYP-E',
      'PYP-E': 'PYP-F',
      'PYP-F': 'MYP1',
    };

    let advanced = 0;
    let graduated = 0;
    const updates: { id: string; data: Record<string, unknown> }[] = [];

    for (const student of students) {
      const currentYear = student.year_group;
      const nextYear = yearProgressionMap[currentYear];

      if (nextYear === undefined) continue;

      if (nextYear === null) {
        updates.push({ id: student.id, data: { is_active: false, year_group: 'DP2 (Graduated)' } });
        graduated++;
      } else {
        const updateData: Record<string, unknown> = { year_group: nextYear };
        if (currentYear === 'MYP5' && nextYear === 'DP1') {
          updateData.ib_programme = 'DP';
          updateData.subject_choices = [];
        }
        if (currentYear === 'PYP-F' && nextYear === 'MYP1') {
          updateData.ib_programme = 'MYP';
          updateData.subject_choices = [];
        }
        updates.push({ id: student.id, data: updateData });
        advanced++;
      }
    }

    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await Promise.all(
        batch.map(({ id, data }) => base44.asServiceRole.entities.Student.update(id, data))
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      advanced,
      graduated,
      message: `Advanced ${advanced} students, ${graduated} graduated`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
