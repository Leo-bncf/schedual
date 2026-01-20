import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserSchoolId } from './securityHelper.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'preview';
    const maxGroupSize = Number(body.max_group_size) > 0 ? Number(body.max_group_size) : 20;

    const schoolId = await getUserSchoolId(base44);

    const [students, subjects] = await Promise.all([
      base44.entities.Student.filter({ school_id: schoolId }),
      base44.entities.Subject.filter({ school_id: schoolId })
    ]);

    // Map subjects for quick lookup
    const subjectById = new Map();
    (subjects || []).forEach((s) => {
      if (s?.id) subjectById.set(s.id, s);
    });

    // Group DP students by subject_id + year_group (both HL and SL together for shared sessions)
    const slStudentsBySubjectYear = new Map(); // subject_id__year -> [student_ids]
    const hlStudentsBySubjectYear = new Map(); // subject_id__year -> [student_ids]
    const warnings = [];
    const duplicateSubjects = [];

    (students || [])
      .filter((s) => s?.ib_programme === 'DP' && s?.is_active !== false)
      .forEach((student) => {
        const choices = Array.isArray(student.subject_choices) ? student.subject_choices : [];
        if (choices.length === 0) return;

        // Check for duplicate subjects
        const subjectIds = choices.map(c => c.subject_id);
        const uniqueSubjectIds = new Set(subjectIds);
        if (subjectIds.length !== uniqueSubjectIds.size) {
          duplicateSubjects.push({
            student: student.full_name,
            student_id: student.id,
            duplicate_count: subjectIds.length - uniqueSubjectIds.size
          });
        }

        choices.forEach((choice) => {
          if (!choice?.subject_id) return;
          
          const subject = subjectById.get(choice.subject_id);
          if (!subject) return;

          const isHL = choice.level === 'HL';
          const yearGroup = student.year_group || 'DP1';
          const key = `${choice.subject_id}__${yearGroup}`;

          if (isHL) {
            if (!hlStudentsBySubjectYear.has(key)) hlStudentsBySubjectYear.set(key, []);
            hlStudentsBySubjectYear.get(key).push(student.id);
          } else {
            if (!slStudentsBySubjectYear.has(key)) slStudentsBySubjectYear.set(key, []);
            slStudentsBySubjectYear.get(key).push(student.id);
          }
        });
      });

    // Build proposed groups: 2 groups per subject/year_group (shared + HL-only)
    const proposed = [];

    // Iterate through all subject+year combinations
    const allSubjectYears = new Set([
      ...slStudentsBySubjectYear.keys(),
      ...hlStudentsBySubjectYear.keys()
    ]);

    for (const key of allSubjectYears) {
      const [subjectId, yearGroup] = key.split('__');
      const subject = subjectById.get(subjectId);
      if (!subject) continue;

      const slStudents = slStudentsBySubjectYear.get(key) || [];
      const hlStudents = hlStudentsBySubjectYear.get(key) || [];

      // Only create groups if there are students
      if (slStudents.length === 0 && hlStudents.length === 0) continue;

      const slHours = subject?.sl_hours_per_week ?? 4;
      const hlHours = subject?.hl_hours_per_week ?? 6;
      const hlOnlyHours = Math.max(0, hlHours - slHours);

      // Group 1: Shared session (SL students + HL students) - duration = SL hours
      if ((slStudents.length > 0 || hlStudents.length > 0) && slHours > 0) {
        const sharedStudents = [...new Set([...slStudents, ...hlStudents])];
        
        if (sharedStudents.length <= maxGroupSize) {
          proposed.push({
            subject_id: subjectId,
            subject_name: subject.name,
            level: 'SL', // Shared group uses SL hours
            year_group: yearGroup,
            student_ids: sharedStudents,
            hours_per_week: slHours,
            group_type: 'shared',
            name: `${subject.name} Shared (SL+HL) - ${yearGroup}`,
            status: 'ready'
          });
        } else {
          const numGroups = Math.ceil(sharedStudents.length / maxGroupSize);
          const per = Math.ceil(sharedStudents.length / numGroups);
          for (let i = 0; i < numGroups; i++) {
            const start = i * per;
            const end = start + per;
            proposed.push({
              subject_id: subjectId,
              subject_name: subject.name,
              level: 'SL',
              year_group: yearGroup,
              student_ids: sharedStudents.slice(start, end),
              hours_per_week: slHours,
              group_type: 'shared',
              group_suffix: String.fromCharCode(65 + i),
              name: `${subject.name} Shared (SL+HL) - ${yearGroup} Group ${String.fromCharCode(65 + i)}`,
              status: 'ready'
            });
          }
        }
      }

      // Group 2: HL-only session (only HL students) - duration = HL hours - SL hours
      if (hlStudents.length > 0 && hlOnlyHours > 0) {
        if (hlStudents.length <= maxGroupSize) {
          proposed.push({
            subject_id: subjectId,
            subject_name: subject.name,
            level: 'HL',
            year_group: yearGroup,
            student_ids: hlStudents,
            hours_per_week: hlOnlyHours,
            group_type: 'hl_only',
            name: `${subject.name} HL-Only - ${yearGroup}`,
            status: 'ready'
          });
        } else {
          const numGroups = Math.ceil(hlStudents.length / maxGroupSize);
          const per = Math.ceil(hlStudents.length / numGroups);
          for (let i = 0; i < numGroups; i++) {
            const start = i * per;
            const end = start + per;
            proposed.push({
              subject_id: subjectId,
              subject_name: subject.name,
              level: 'HL',
              year_group: yearGroup,
              student_ids: hlStudents.slice(start, end),
              hours_per_week: hlOnlyHours,
              group_type: 'hl_only',
              group_suffix: String.fromCharCode(65 + i),
              name: `${subject.name} HL-Only - ${yearGroup} Group ${String.fromCharCode(65 + i)}`,
              status: 'ready'
            });
          }
        }
      }
    }

    const result = {
      total: proposed.length,
      ready: proposed.filter((g) => g.status === 'ready').length,
      warnings: warnings.length,
      warnings_list: warnings,
      duplicate_subjects: duplicateSubjects,
      groups: proposed.map((g) => ({
        subject_id: g.subject_id,
        subject_name: g.subject_name,
        level: g.level,
        year_group: g.year_group,
        student_ids: g.student_ids,
        hours_per_week: g.hours_per_week,
        name: g.name,
        group_suffix: g.group_suffix,
        status: g.status
      }))
    };

    if (action === 'preview') {
      return Response.json(result);
    }

    if (action === 'create') {
      const toCreate = result.groups
        .filter((g) => g.status === 'ready')
        .map((g) => ({
          school_id: schoolId,
          name: g.name,
          subject_id: g.subject_id,
          level: g.level,
          year_group: g.year_group,
          student_ids: g.student_ids,
          hours_per_week: g.hours_per_week,
          is_active: true,
          max_students: maxGroupSize,
          min_students: 1
        }));

      if (toCreate.length === 0) {
        return Response.json({ ...result, created: 0 });
      }

      await base44.entities.TeachingGroup.bulkCreate(toCreate);
      return Response.json({ ...result, created: toCreate.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});