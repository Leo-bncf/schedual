import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const SUFFIXES = ['A', 'B', 'C', 'D', 'E', 'F'];
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

    const [students, subjects] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }),
    ]);

    const dpStudents = (students || []).filter((s: any) => s?.ib_programme === 'DP' && s?.is_active !== false);
    const dpSubjectMap = new Map(
      (subjects || []).filter((s: any) => s?.ib_level === 'DP').map((s: any) => [s.id, s])
    );

    // Bucket: (subject_id|level|year_group) → student IDs
    const buckets = new Map<string, string[]>();
    const warnings_list: { message: string }[] = [];

    for (const student of dpStudents) {
      const yearGroup = student.year_group || 'DP1';
      for (const choice of (student.subject_choices || [])) {
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
          _key: key,
          subject_id: subjectId,
          level,
          year_group: yearGroup,
          student_ids: studentIds,
          name: `${subjectName} ${level} - ${yearGroup}`,
          minutes_per_week: minutesPerWeek,
        });
      } else {
        const chunks = Math.ceil(studentIds.length / max_group_size);
        const chunkSize = Math.ceil(studentIds.length / chunks);
        for (let i = 0; i < chunks; i++) {
          const suffix = SUFFIXES[i] || String(i + 1);
          proposedGroups.push({
            _key: `${key}|${suffix}`,
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
      return Response.json({
        total: dpStudents.length,
        ready: proposedGroups.reduce((sum, g) => sum + g.student_ids.length, 0),
        warnings: warnings_list.length,
        warnings_list,
        groups: proposedGroups,
      });
    }

    // Create mode — diff against existing DP groups (preserve teacher/room/block assignments)
    const allExisting = await base44.asServiceRole.entities.TeachingGroup.filter({ school_id: schoolId });
    const existingDp = (allExisting || []).filter((g: any) => dpSubjectMap.has(g.subject_id));

    // Index existing groups by (subject_id|level|year_group) for matching
    const existingByKey = new Map<string, any[]>();
    for (const g of existingDp) {
      const k = `${g.subject_id}|${g.level}|${g.year_group}`;
      if (!existingByKey.has(k)) existingByKey.set(k, []);
      existingByKey.get(k)!.push(g);
    }

    // Track which existing group IDs get matched so we can deactivate unmatched ones
    const matchedExistingIds = new Set<string>();
    let groups_created = 0;
    let groups_updated = 0;

    // Group proposals by (subject_id|level|year_group) to match with existing
    const proposalsByBaseKey = new Map<string, any[]>();
    for (const g of proposedGroups) {
      const baseKey = `${g.subject_id}|${g.level}|${g.year_group}`;
      if (!proposalsByBaseKey.has(baseKey)) proposalsByBaseKey.set(baseKey, []);
      proposalsByBaseKey.get(baseKey)!.push(g);
    }

    for (const [baseKey, proposals] of proposalsByBaseKey.entries()) {
      const existingSlots = existingByKey.get(baseKey) || [];

      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];
        const match = existingSlots[i]; // pair by position within the same bucket

        if (match) {
          // Update existing — preserves teacher_id, preferred_room_id, block_id
          await base44.asServiceRole.entities.TeachingGroup.update(match.id, {
            name: proposal.name,
            student_ids: proposal.student_ids,
            minutes_per_week: proposal.minutes_per_week,
            max_students: max_group_size,
            is_active: true,
          });
          matchedExistingIds.add(match.id);
          groups_updated++;
        } else {
          // No existing group at this position — create new
          await base44.asServiceRole.entities.TeachingGroup.create({
            school_id: schoolId,
            name: proposal.name,
            subject_id: proposal.subject_id,
            level: proposal.level,
            year_group: proposal.year_group,
            student_ids: proposal.student_ids,
            minutes_per_week: proposal.minutes_per_week,
            max_students: max_group_size,
            is_active: true,
          });
          groups_created++;
        }
      }

      // Deactivate surplus existing groups (e.g. previously 2 groups, now only 1)
      for (let i = proposals.length; i < existingSlots.length; i++) {
        const surplus = existingSlots[i];
        if (!matchedExistingIds.has(surplus.id)) {
          await base44.asServiceRole.entities.TeachingGroup.update(surplus.id, { is_active: false, student_ids: [] });
          matchedExistingIds.add(surplus.id);
        }
      }
    }

    // Deactivate any remaining DP groups not touched above (subject no longer selected by any student)
    for (const g of existingDp) {
      if (!matchedExistingIds.has(g.id)) {
        await base44.asServiceRole.entities.TeachingGroup.update(g.id, { is_active: false, student_ids: [] });
      }
    }

    return Response.json({
      success: true,
      groups_created,
      groups_updated,
      warnings: warnings_list.length,
      warnings_list,
    });
  } catch (error) {
    console.error('[generateDpTeachingGroups] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
