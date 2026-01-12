import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the Subject schema
    const schema = await base44.entities.Subject.schema();

    // Use service role to bypass RLS and see ALL subjects - with sort
    const allSubjects = await base44.asServiceRole.entities.Subject.list('-created_date', 100);
    
    // Try to read with normal user permissions
    const userSubjects = await base44.entities.Subject.list('-created_date', 100);

    return Response.json({
      environment: {
        app_id: Deno.env.get('BASE44_APP_ID'),
        has_schema: !!schema
      },
      user: {
        email: user.email,
        school_id: user.school_id,
        school_id_type: typeof user.school_id
      },
      rls_rules: schema?.rls || 'no RLS',
      allSubjectsCount: allSubjects.length,
      allSubjects: allSubjects.slice(0, 5).map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id,
        created_date: s.created_date,
        matches: s.school_id === user.school_id
      })),
      userSubjectsCount: userSubjects.length,
      userSubjects: userSubjects.slice(0, 5).map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});