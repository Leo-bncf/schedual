import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const schoolId = user.school_id;

    // Fetch all subjects for this school
    const subjects = await base44.entities.Subject.filter({ school_id: schoolId });

    console.log(`[fixSubjectSchoolIds] Found ${subjects.length} subjects with correct school_id`);

    // Fetch ALL subjects (service role) to find ones with missing/wrong school_id
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    console.log(`[fixSubjectSchoolIds] Total subjects in system: ${allSubjects.length}`);

    const missingSchoolId = allSubjects.filter(s => !s.school_id);
    const wrongSchoolId = allSubjects.filter(s => s.school_id && s.school_id !== schoolId);

    console.log(`[fixSubjectSchoolIds] Missing school_id: ${missingSchoolId.length}`);
    console.log(`[fixSubjectSchoolIds] Wrong school_id: ${wrongSchoolId.length}`);

    // Fix subjects with missing school_id that belong to this school
    // (heuristic: if they're referenced by this school's teaching groups, fix them)
    const teachingGroups = await base44.entities.TeachingGroup.filter({ school_id: schoolId });
    const subjectIdsUsedByThisSchool = new Set(teachingGroups.map(tg => tg.subject_id).filter(Boolean));

    console.log(`[fixSubjectSchoolIds] Teaching groups reference ${subjectIdsUsedByThisSchool.size} subjects`);

    let fixedCount = 0;
    for (const subject of missingSchoolId) {
      if (subjectIdsUsedByThisSchool.has(subject.id)) {
        console.log(`[fixSubjectSchoolIds] Fixing subject ${subject.id} (${subject.name}) - adding school_id`);
        await base44.asServiceRole.entities.Subject.update(subject.id, { school_id: schoolId });
        fixedCount++;
      }
    }

    return Response.json({
      ok: true,
      fixed: fixedCount,
      subjectsWithCorrectSchoolId: subjects.length,
      missingSchoolId: missingSchoolId.length,
      wrongSchoolId: wrongSchoolId.length,
      message: `Fixed ${fixedCount} subjects by adding school_id`
    });

  } catch (error) {
    console.error('[fixSubjectSchoolIds] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});