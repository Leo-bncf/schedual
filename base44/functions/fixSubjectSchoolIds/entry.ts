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

    // Count subjects already correctly scoped to this school
    const ownedSubjects = await base44.asServiceRole.entities.Subject.filter({ school_id: schoolId });

    // Scan ALL subjects to find ones with missing school_id
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    const missingSchoolId = allSubjects.filter((s: any) => !s.school_id);

    // Heuristic: a subject with no school_id belongs to this school if this school's
    // teaching groups reference it
    const teachingGroups = await base44.asServiceRole.entities.TeachingGroup.filter({ school_id: schoolId });
    const subjectIdsUsedByThisSchool = new Set(
      teachingGroups.map((tg: any) => tg.subject_id).filter(Boolean)
    );

    let fixedCount = 0;
    for (const subject of missingSchoolId) {
      if (subjectIdsUsedByThisSchool.has(subject.id)) {
        await base44.asServiceRole.entities.Subject.update(subject.id, { school_id: schoolId });
        fixedCount++;
      }
    }

    return Response.json({
      ok: true,
      fixed: fixedCount,
      subjectsWithCorrectSchoolId: ownedSubjects.length,
      missingSchoolId: missingSchoolId.length,
      message: `Fixed ${fixedCount} subjects by adding school_id`,
    });

  } catch (error) {
    console.error('[fixSubjectSchoolIds] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
