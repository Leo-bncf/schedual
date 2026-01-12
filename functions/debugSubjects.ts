import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to bypass RLS and see ALL subjects
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    
    // Try to read with normal user permissions
    const userSubjects = await base44.entities.Subject.list();
    
    // Try filtering by school_id explicitly
    const filteredSubjects = await base44.entities.Subject.filter({
      school_id: user.school_id
    });

    return Response.json({
      user: {
        email: user.email,
        school_id: user.school_id,
        school_id_type: typeof user.school_id
      },
      allSubjectsCount: allSubjects.length,
      allSubjects: allSubjects.map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id,
        matches: s.school_id === user.school_id
      })),
      userSubjectsCount: userSubjects.length,
      filteredSubjectsCount: filteredSubjects.length,
      filteredSubjects: filteredSubjects.map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});