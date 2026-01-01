import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'preview';
    const maxGroupSize = Number(body.max_group_size) > 0 ? Number(body.max_group_size) : 20;

    const schoolId = user.school_id;
    if (!schoolId) return Response.json({ error: 'No school found for user' }, { status: 400 });

    const [students, subjects] = await Promise.all([
      base44.entities.Student.filter({ school_id: schoolId }),
      base44.entities.Subject.filter({ school_id: schoolId })
    ]);

    // Map subjects for quick lookup and ensure DP-only
    const subjectById = new Map();
    (subjects || []).forEach((s) => {
      if (s?.id) subjectById.set(s.id, s);
    });

    // Group DP students by subject_id + level + year_group
    const groupMap = new Map();
    const warnings = [];

    (students || [])
      .filter((s) => s?.ib_programme === 'DP' && s?.is_active !== false)
      .forEach((student) => {
        const choices = Array.isArray(student.subject_choices) ? student.subject_choices : [];
        if (choices.length === 0) return;

        choices.forEach((choice) => {
          if (!choice?.subject_id) return;
          
          const subject = subjectById.get(choice.subject_id);
          if (!subject) {
            warnings.push({ 
              type: 'subject_not_found', 
              student_id: student.id, 
              subject_id: choice.subject_id 
            });
            return;
          }

          const level = choice.level === 'HL' ? 'HL' : 'SL';
          const yearGroup = student.year_group || 'DP1';
          const key = `${choice.subject_id}__${level}__${yearGroup}`;

          if (!groupMap.has(key)) {
            groupMap.set(key, {
              subject_id: choice.subject_id,
              subject_name: subject.name,
              level,
              year_group: yearGroup,
              student_ids: []
            });
          }
          groupMap.get(key).student_ids.push(student.id);
        });
      });

    // Build proposed groups and split those exceeding maxGroupSize
    const proposed = [];
    for (const group of groupMap.values()) {
      const count = group.student_ids.length;
      if (count === 0) continue;

      if (count <= maxGroupSize) {
        proposed.push({ ...group, status: 'ready' });
      } else {
        const numGroups = Math.ceil(count / maxGroupSize);
        const per = Math.ceil(count / numGroups);
        for (let i = 0; i < numGroups; i++) {
          const start = i * per;
          const end = start + per;
          proposed.push({
            ...group,
            student_ids: group.student_ids.slice(start, end),
            group_suffix: String.fromCharCode(65 + i), // A, B, C...
            status: 'ready'
          });
        }
      }
    }

    // Compute hours from subject
    proposed.forEach((g) => {
      const subject = subjectById.get(g.subject_id);
      if (g.level === 'HL') g.hours_per_week = subject?.hl_hours_per_week ?? 6;
      else if (g.level === 'SL') g.hours_per_week = subject?.sl_hours_per_week ?? 4;
      else g.hours_per_week = subject?.pyp_myp_hours_per_week ?? 4;

      g.name = `${g.subject_name} ${g.level} - ${g.year_group}${g.group_suffix ? ` Group ${g.group_suffix}` : ''}`;
    });

    const result = {
      total: proposed.length,
      ready: proposed.filter((g) => g.status === 'ready').length,
      warnings: warnings.length,
      warnings_list: warnings,
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
      const toCreate = result.groups.filter((g) => g.status === 'ready').map((g) => ({
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

      // Create as the user
      await base44.entities.TeachingGroup.bulkCreate(toCreate);
      return Response.json({ ...result, created: toCreate.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});