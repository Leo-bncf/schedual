import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch canonical record via service role (email is unique)
    const canonUsers = await base44.asServiceRole.entities.User.filter({ email: user.email });
    const canon = canonUsers && canonUsers[0] ? canonUsers[0] : null;

    if (!canon) {
      return Response.json({ mismatch: false, reason: 'not_found' });
    }

    const jwtSchoolId = user.school_id || null;
    const dbSchoolId = canon.school_id || null;

    if (jwtSchoolId !== dbSchoolId) {
      return Response.json({ mismatch: true, expected_school_id: dbSchoolId });
    }

    return Response.json({ mismatch: false });
  } catch (error) {
    console.error('checkUserAssignment error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});