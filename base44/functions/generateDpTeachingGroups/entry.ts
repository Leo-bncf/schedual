import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUFFIXES = ['A', 'B', 'C', 'D', 'E', 'F'];

// Default DP subject hours per week by level
const DEFAULT_MINUTES: Record<string, number> = { HL: 270, SL: 180 };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    if (!authUser) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
    const user = dbUsers[0] || authUser;
    const schoolId = user?.school_id || user?.data?.school_id;
    if (!schoolId) return Response.json({ error: 'No school_id on user' }, { status: 400 });

    const { action, max_group_size = 20 } = await req.json().catch(() => ({}));

    // Fetch data
    const [students, subjects] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }),
    ]);

    const dpStudents = (students || []).filter((s: any) => s?.ib_programme === 'DP' && s?.is_active !== false);
    const dpSubjectMap = new Map(
      (subjects || []).filter((s: any) => s?.ib_level === 'DP').map((s: any) => [s.id, s])
    );

    // Bucket students: (subject_id, level, year_group) → student IDs
    const buckets = new Map<string, string[]>();
    const warnings_list: { message: string }[] = [];

    for (const student of dpStudents) {
      const yearGroup = student.year_group || 'DP1';
      const choices: any[] = student.subject_choices || [];
      for (const choice of choices) {
        const subId = choice?.subject_id;
        const level = choice?.level;
        if (!subId || !level) continue;
        if (!dpSubjectMap.has(subId)) {
          warnings_list.push({ message: `Student ${student.full_name}: subject ${subId?.slice(-8)} not found or not DP` });
          continue;
        }
        const key = `${subId}|${level}|${yearGroup}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key)!.push(student.id);
      }
    }

    // Build proposed groups (split oversized buckets)
    const proposedGroups: any[] = [];
    for (const [key, studentIds] of buckets.entries()) {
      const [subjectId, level, yearGroup] = key.split('|');
      const subject = dpSubjectMap.get(subjectId);
      const subjectName = subject?.name || subjectId;
      const minutesPerWeek = DEFAULT_MINUTES[level] ?? 180;

      if (studentIds.length <= max_group_size) {
        proposedGroups.push({
          subject_id: subjectId,
          level,
          year_group: yearGroup,
          student_ids: studentIds,
          name: `${subjectName} ${level} - ${yearGroup}`,
          minutes_per_week: minutesPerWeek,
        });
      } else {
        // Split into chunks
        const chunks = Math.ceil(studentIds.length / max_group_size);
        const chunkSize = Math.ceil(studentIds.length / chunks);
        for (let i = 0; i < chunks; i++) {
          const suffix = SUFFIXES[i] || String(i + 1);
          proposedGroups.push({
            subject_id: subjectId,
            level,
            year_group: yearGroup,
            student_ids: studentIds.slice(i * chunkSize, (i + 1) * chunkSize),
            name: `${subjectName} ${level} - ${yearGroup} ${suffix}`,
            minutes_per_week: minutesPerWeek,
          });
        }
      }
    }

    if (action !== 'create') {
      // Preview mode
      return Response.json({
        total: dpStudents.length,
        ready: proposedGroups.reduce((sum, g) => sum + g.student_ids.length, 0),
        warnings: warnings_list.length,
        warnings_list,
        groups: proposedGroups,
      });
    }

    // Create mode — delete existing DP teaching groups and recreate
    const existingGroups = await base44.asServiceRole.entities.TeachingGroup.filter({ school_id: schoolId });
    const existingDp = existingGroups.filter((g: any) => {
      const sub = dpSubjectMap.get(g.subject_id);
      return sub != null;
    });

    for (const g of existingDp) {
      await base44.asServiceRole.entities.TeachingGroup.delete(g.id);
    }

    let groups_created = 0;
    for (const g of proposedGroups) {
      await base44.asServiceRole.entities.TeachingGroup.create({
        school_id: schoolId,
        name: g.name,
        subject_id: g.subject_id,
        level: g.level,
        year_group: g.year_group,
        student_ids: g.student_ids,
        minutes_per_week: g.minutes_per_week,
        max_students: max_group_size,
        is_active: true,
      });
      groups_created++;
    }

    return Response.json({
      success: true,
      groups_created,
      warnings: warnings_list.length,
      warnings_list,
    });
  } catch (error) {
    console.error('[generateDpTeachingGroups] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
