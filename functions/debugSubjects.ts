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
      user: {
        school_id: user.school_id
      },
      rlsRules: schema?.rls || {},
      allSubjects: {
        count: allSubjects.length,
        schoolIds: [...new Set(allSubjects.map(s => s.school_id))]
      },
      userSubjects: {
        count: userSubjects.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});