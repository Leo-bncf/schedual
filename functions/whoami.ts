import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ authenticated: false }, { status: 200 });
    }

    const school = user.school_id ? await base44.entities.School.filter({ id: user.school_id }).then(r => r[0] || null).catch(() => null) : null;

    return Response.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        school_id: user.school_id || null,
      },
      isAdmin: user.role === 'admin',
      schoolSnapshot: school ? { id: school.id, name: school.name, code: school.code } : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});