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

    console.log('User school_id:', user.school_id);

    // Use service role to bypass ALL RLS
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    
    console.log('Total subjects in database:', allSubjects.length);
    console.log('All subjects:', JSON.stringify(allSubjects, null, 2));

    // Group by school_id
    const bySchool = {};
    allSubjects.forEach(s => {
      const sid = s.school_id || 'NULL';
      if (!bySchool[sid]) bySchool[sid] = [];
      bySchool[sid].push(s);
    });

    // Check if any match user's school
    const userSchoolSubjects = allSubjects.filter(s => s.school_id === user.school_id);

    return Response.json({
      user_school_id: user.school_id,
      total_subjects: allSubjects.length,
      subjects_for_your_school: userSchoolSubjects.length,
      grouped_by_school: Object.keys(bySchool).map(sid => ({
        school_id: sid,
        count: bySchool[sid].length
      })),
      all_subjects: allSubjects
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});