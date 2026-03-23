import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load school-scoped data
    const schoolId = user.school_id;
    if (!schoolId) {
      return Response.json({ error: 'No school_id on user' }, { status: 400 });
    }

    const [students, subjects, teachers] = await Promise.all([
      base44.entities.Student.filter({ school_id: schoolId }),
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId })
    ]);

    // Prepare compact context for the LLM (DP only)
    const dpStudents = (students || []).filter(s => s?.ib_programme === 'DP' && s?.is_active !== false).map(s => ({
      id: s.id,
      full_name: s.full_name,
      year_group: s.year_group,
      subject_choices: (s.subject_choices || []).map(c => ({ subject_id: c.subject_id, level: c.level }))
    }));

    const subjectInfo = (subjects || []).filter(sub => sub?.ib_level === 'DP').map(sub => ({
      id: sub.id,
      name: sub.name,
      ib_group: sub.ib_group,
      available_levels: sub.available_levels || ['HL', 'SL']
    }));

    const teacherInfo = (teachers || []).filter(t => t?.is_active).map(t => ({
      id: t.id,
      full_name: t.full_name,
      qualifications: (t.qualifications || []).map(q => ({ subject_id: q.subject_id, ib_levels: q.ib_levels || [] }))
    }));

    const prompt = `You are helping an IB Diploma school organize teaching groups.\n` +
      `Given DP students with their subject choices and levels, propose groups per subject and level, ` +
      `keeping groups balanced with a maximum of 20 students per group. If a group exceeds 20 students, split into A, B, C, etc. ` +
      `Use the provided subject ids and levels. Only include subjects that exist.\n` +
      `Output JSON strictly matching the provided schema.`;

    const schema = {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              subject_id: { type: 'string' },
              level: { type: 'string', enum: ['HL', 'SL'] },
              year_group: { type: 'string' },
              student_ids: { type: 'array', items: { type: 'string' } },
              group_suffix: { type: 'string' }
            },
            required: ['subject_id', 'level', 'year_group', 'student_ids']
          }
        }
      },
      required: ['groups']
    };

    const { groups } = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${prompt}\n\nSubjects: ${JSON.stringify(subjectInfo)}\n\nStudents: ${JSON.stringify(dpStudents)}\n\nTeachers (for context only): ${JSON.stringify(teacherInfo)}`,
      response_json_schema: schema
    });

    return Response.json({ groups: groups || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});