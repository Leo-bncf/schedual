import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const dbUser = dbUsers[0] || authUser;
    const schoolId = dbUser?.school_id || dbUser?.data?.school_id;
    const role = dbUser?.role || dbUser?.data?.role;

    if (!schoolId || role !== 'admin') {
      return Response.json({ error: 'Forbidden - admin required' }, { status: 403 });
    }

    const inferProgramme = (yearGroup) => {
      if (!yearGroup) return null;
      const yg = String(yearGroup).toUpperCase().trim();
      if (yg.startsWith('DP')) return 'DP';
      if (yg.startsWith('MYP')) return 'MYP';
      if (yg.startsWith('PYP')) return 'PYP';
      return null;
    };

    // Fetch all students for this school
    const students = await base44.asServiceRole.entities.Student.filter(
      { school_id: schoolId }, '-created_date', 2000
    );

    console.log(`[repairStudentProgrammes] Found ${students.length} students for school ${schoolId}`);

    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    for (const student of students) {
      if (student.ib_programme) {
        skipped++;
        continue;
      }

      const inferred = inferProgramme(student.year_group);
      if (!inferred) {
        console.warn(`[repairStudentProgrammes] Cannot infer programme for student ${student.id} (year_group: ${student.year_group})`);
        failed++;
        continue;
      }

      await base44.asServiceRole.entities.Student.update(student.id, { ib_programme: inferred });
      console.log(`[repairStudentProgrammes] Fixed student ${student.id}: year_group=${student.year_group} → ib_programme=${inferred}`);
      fixed++;
    }

    return Response.json({
      success: true,
      total: students.length,
      fixed,
      skipped,
      failed,
      message: `Fixed ${fixed} students, skipped ${skipped} (already had programme), ${failed} could not be inferred.`
    });

  } catch (error) {
    console.error('[repairStudentProgrammes] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});