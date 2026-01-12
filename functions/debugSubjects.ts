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

    return Response.json({
      user: {
        email: user.email,
        school_id: user.school_id,
        school_id_type: typeof user.school_id
      },
      allSubjects: allSubjects.map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id,
        school_id_type: typeof s.school_id
      })),
      userSubjects: userSubjects.map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id
      })),
      rlsWorking: allSubjects.length > 0 && userSubjects.length === 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});