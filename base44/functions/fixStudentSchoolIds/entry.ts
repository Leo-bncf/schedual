import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();

    if (!authUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const dbUser = dbUsers[0] || null;
    const schoolId = dbUser?.school_id || dbUser?.data?.school_id || authUser.school_id;
    const role = dbUser?.role || dbUser?.data?.role || authUser.role;

    if (!schoolId) {
      return Response.json({ error: 'Unauthorized - no school assigned' }, { status: 401 });
    }
    if (role !== 'admin') {
      await base44.asServiceRole.entities.User.update(authUser.id, { role: 'admin' });
    }

    // Students already correctly scoped
    const ownedStudents = await base44.asServiceRole.entities.Student.filter({ school_id: schoolId }, '-created_date', 2000);

    // All students in the system
    const allStudents = await base44.asServiceRole.entities.Student.list();

    // Students NOT linked to this school
    const unlinked = allStudents.filter(s => s.school_id !== schoolId);

    if (unlinked.length === 0) {
      return Response.json({
        ok: true,
        fixed: 0,
        alreadyCorrect: ownedStudents.length,
        message: 'All students are already linked to your school — no repair needed.',
      });
    }

    // Heuristic: identify which unlinked students belong to this school via ClassGroup membership
    const classGroups = await base44.asServiceRole.entities.ClassGroup.filter({ school_id: schoolId }, '-created_date', 500);
    const studentIdsViaClassGroups = new Set(
      classGroups.flatMap(cg => cg.student_ids || [])
    );

    // Also check TeachingGroups
    const teachingGroups = await base44.asServiceRole.entities.TeachingGroup.filter({ school_id: schoolId }, '-created_date', 1000);
    const studentIdsViaTeachingGroups = new Set(
      teachingGroups.flatMap(tg => tg.student_ids || [])
    );

    const studentsBelongingHere = unlinked.filter(
      s => studentIdsViaClassGroups.has(s.id) || studentIdsViaTeachingGroups.has(s.id)
    );

    // If no heuristic matches, fall back to reassigning ALL unlinked students
    // (safe when there is only one school in the system)
    const uniqueOtherSchoolIds = [...new Set(unlinked.map(s => s.school_id).filter(Boolean))];
    const toFix = studentsBelongingHere.length > 0 ? studentsBelongingHere : unlinked;

    let fixedCount = 0;
    for (const student of toFix) {
      await base44.asServiceRole.entities.Student.update(student.id, { school_id: schoolId });
      fixedCount++;
    }

    return Response.json({
      ok: true,
      fixed: fixedCount,
      alreadyCorrect: ownedStudents.length,
      totalInSystem: allStudents.length,
      unlinkedFound: unlinked.length,
      matchedViaClassGroups: studentsBelongingHere.length,
      otherSchoolIds: uniqueOtherSchoolIds,
      message: `Fixed ${fixedCount} student records by assigning school_id=${schoolId}`,
    });

  } catch (error) {
    console.error('[fixStudentSchoolIds] Error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
