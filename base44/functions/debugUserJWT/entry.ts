import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get current user from JWT
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user from database using service role
    const dbUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const dbUser = dbUsers.length > 0 ? dbUsers[0] : null;

    return Response.json({ 
      success: true,
      jwt_claims: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        school_id: user.school_id,
        school_id_type: typeof user.school_id
      },
      database_record: dbUser ? {
        id: dbUser.id,
        email: dbUser.email,
        full_name: dbUser.full_name,
        role: dbUser.role,
        school_id: dbUser.school_id,
        school_id_type: typeof dbUser.school_id
      } : null,
      mismatch: dbUser && dbUser.school_id !== user.school_id
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});