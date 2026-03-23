import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetSchoolId = body?.school_id || user.school_id;

    if (!targetSchoolId) {
      return Response.json({ error: 'Missing target school_id' }, { status: 400 });
    }

    if (body?.school_id && user?.role !== 'admin' && body.school_id !== user.school_id) {
      return Response.json({ error: 'Forbidden: cannot modify another school' }, { status: 403 });
    }

    // Pull all students/subjects using service role to avoid RLS masking
    const [allStudents, allSubjects] = await Promise.all([
      base44.asServiceRole.entities.Student.list().catch(() => []),
      base44.asServiceRole.entities.Subject.list().catch(() => []),
    ]);

    // Candidates: missing school_id OR created_by user and different school
    const studentCandidates = allStudents.filter(s => {
      const missing = !s.school_id || String(s.school_id).trim() === '';
      const mineWrong = s.created_by === user.email && s.school_id && s.school_id !== targetSchoolId;
      return missing || mineWrong;
    });

    const subjectCandidates = allSubjects.filter(sub => {
      const missing = !sub.school_id || String(sub.school_id).trim() === '';
      const mineWrong = sub.created_by === user.email && sub.school_id && sub.school_id !== targetSchoolId;
      return missing || mineWrong;
    });

    let studentsUpdated = 0;
    let subjectsUpdated = 0;

    // Update in small batches
    const batchUpdate = async (items, updater) => {
      const size = 25;
      for (let i = 0; i < items.length; i += size) {
        const slice = items.slice(i, i + size);
        await Promise.all(slice.map(updater));
        await new Promise(r => setTimeout(r, 150));
      }
    };

    await batchUpdate(studentCandidates, async (s) => {
      try {
        await base44.asServiceRole.entities.Student.update(s.id, { school_id: targetSchoolId });
        studentsUpdated++;
      } catch (_e) { /* ignore single failures */ }
    });

    await batchUpdate(subjectCandidates, async (sub) => {
      try {
        await base44.asServiceRole.entities.Subject.update(sub.id, { school_id: targetSchoolId });
        subjectsUpdated++;
      } catch (_e) { /* ignore single failures */ }
    });

    return Response.json({
      success: true,
      targetSchoolId,
      totals: {
        students_total: allStudents.length,
        subjects_total: allSubjects.length,
      },
      candidates: {
        students: studentCandidates.length,
        subjects: subjectCandidates.length,
      },
      updated: {
        students: studentsUpdated,
        subjects: subjectsUpdated,
      },
      samples: {
        students: studentCandidates.slice(0, 5).map(s => ({ id: s.id, old_school_id: s.school_id, created_by: s.created_by })),
        subjects: subjectCandidates.slice(0, 5).map(s => ({ id: s.id, old_school_id: s.school_id, created_by: s.created_by })),
      }
    });
  } catch (error) {
    console.error('fixSchoolData error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});