import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const explicitSchoolId = body?.school_id || null;
    const schoolId = explicitSchoolId || user.school_id;

    if (!schoolId) {
      return Response.json({ error: 'No school_id on user/session' }, { status: 400 });
    }

    if (explicitSchoolId && user?.role !== 'admin' && explicitSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: cannot diagnose another school' }, { status: 403 });
    }

    // Fetch data with service role to avoid RLS masking
    const [students, subjects, classGroups] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ school_id: schoolId }, '-created_date', 10000).catch(() => []),
      base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }, '-created_date', 5000).catch(() => []),
      base44.asServiceRole.entities.ClassGroup.filter({ school_id: schoolId }, '-created_date', 5000).catch(() => [])
    ]);

    // Cross-school scan to detect mismatched school_ids
    const allStudents = await base44.asServiceRole.entities.Student.list().catch(() => []);
    const allSubjects = await base44.asServiceRole.entities.Subject.list().catch(() => []);

    const studentsBySchool = {};
    const subjectsBySchool = {};
    for (const s of allStudents) {
      const sid = s.school_id || 'null';
      studentsBySchool[sid] = (studentsBySchool[sid] || 0) + 1;
    }
    for (const sub of allSubjects) {
      const sid = sub.school_id || 'null';
      subjectsBySchool[sid] = (subjectsBySchool[sid] || 0) + 1;
    }

    const totals = {
      schoolId,
      students_total: students.length,
      students_active: students.filter(s => s.is_active !== false).length,
      students_inactive: students.filter(s => s.is_active === false).length,
      students_missing_programme: students.filter(s => !s.ib_programme).length,
      students_missing_year_group: students.filter(s => !s.year_group).length,
      students_with_classgroup: students.filter(s => !!s.classgroup_id).length,
      classgroups_total: classGroups.length,
      subjects_total: subjects.length,
      subjects_by_level: subjects.reduce((acc, sub) => {
        const lvl = sub.ib_level || 'unknown';
        acc[lvl] = (acc[lvl] || 0) + 1;
        return acc;
      }, {})
    };

    // Programme/Year breakdown
    const programmeYear = {};
    for (const s of students) {
      const prog = s.ib_programme || 'unknown';
      const yr = s.year_group || 'unknown';
      const key = `${prog}:${yr}`;
      if (!programmeYear[key]) programmeYear[key] = { count: 0, sample_ids: [] };
      programmeYear[key].count += 1;
      if (programmeYear[key].sample_ids.length < 5) programmeYear[key].sample_ids.push(s.id);
    }

    // DP subject health
    const dpStudents = students.filter(s => s.ib_programme === 'DP');
    const dpSubjectStats = {
      dp_students: dpStudents.length,
      with_exactly_6: 0,
      with_invalid_hl_sl_mix: 0,
      with_duplicates: 0,
      samples_invalid: []
    };

    for (const s of dpStudents) {
      const choices = Array.isArray(s.subject_choices) ? s.subject_choices : [];
      const names = choices.map(c => (c.subject_id || '') + ':' + (c.level || ''));
      const uniqueNames = new Set(names);
      if (choices.length === 6) dpSubjectStats.with_exactly_6 += 1;
      const hl = choices.filter(c => c.level === 'HL').length;
      const sl = choices.filter(c => c.level === 'SL').length;
      if (hl < 2 || hl > 4 || sl < 2 || sl > 4) dpSubjectStats.with_invalid_hl_sl_mix += 1;
      if (uniqueNames.size !== names.length) {
        dpSubjectStats.with_duplicates += 1;
        if (dpSubjectStats.samples_invalid.length < 5) dpSubjectStats.samples_invalid.push({ id: s.id, full_name: s.full_name, count: choices.length });
      }
    }

    // Return concise diagnostics
    return Response.json({
      success: true,
      totals,
      programmeYear,
      dpSubjectStats,
      crossSchool: {
        studentsBySchool,
        subjectsBySchool
      },
      sampleStudents: students.slice(0, 5).map(s => ({ id: s.id, full_name: s.full_name, ib_programme: s.ib_programme, year_group: s.year_group })),
      sampleSubjects: subjects.slice(0, 5).map(sub => ({ id: sub.id, name: sub.name, ib_level: sub.ib_level }))
    });
  } catch (error) {
    console.error('diagnoseStudents error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});