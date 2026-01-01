import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { school_id, max_additional_users } = await req.json();

    // Update school with service role
    await base44.asServiceRole.entities.School.update(school_id, {
      max_additional_users
    });

    return Response.json({ 
      success: true,
      message: 'School seats updated successfully' 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});