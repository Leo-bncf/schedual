import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    const dbUsers = authUser ? await base44.asServiceRole.entities.User.filter({ id: authUser.id }) : [];
    const user = dbUsers[0] || authUser;
    const userSchoolId = user?.school_id || user?.data?.school_id;
    const role = user?.role || user?.data?.role;

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    if (!userSchoolId) {
      return Response.json({ error: 'No school assigned to your account' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    // SuperAdmin can target another school; regular admins are always scoped to their own school
    const superAdminEmails = String(Deno.env.get('SUPER_ADMIN_EMAILS') || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const isSuperAdmin = superAdminEmails.includes((user.email || '').toLowerCase());
    const targetSchoolId = isSuperAdmin ? (body?.school_id || userSchoolId) : userSchoolId;

    // Pull candidates using service role
    const [allStudents, allSubjects] = await Promise.all([
      base44.asServiceRole.entities.Student.list().catch(() => []),
      base44.asServiceRole.entities.Subject.list().catch(() => []),
    ]);

    // Only touch records that are missing a school_id or were created by this user with wrong school
    const studentCandidates = (allStudents as any[]).filter(s => {
      const missing = !s.school_id || String(s.school_id).trim() === '';
      const mineWrong = s.created_by === user.email && s.school_id && s.school_id !== targetSchoolId;
      return missing || mineWrong;
    });

    const subjectCandidates = (allSubjects as any[]).filter(sub => {
      const missing = !sub.school_id || String(sub.school_id).trim() === '';
      const mineWrong = sub.created_by === user.email && sub.school_id && sub.school_id !== targetSchoolId;
      return missing || mineWrong;
    });

    let studentsUpdated = 0;
    let subjectsUpdated = 0;

    const batchUpdate = async (items: any[], updater: (item: any) => Promise<void>) => {
      const size = 25;
      for (let i = 0; i < items.length; i += size) {
        await Promise.all(items.slice(i, i + size).map(updater));
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
      candidates: { students: studentCandidates.length, subjects: subjectCandidates.length },
      updated: { students: studentsUpdated, subjects: subjectsUpdated },
    });
  } catch (error) {
    console.error('fixSchoolData error:', error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
