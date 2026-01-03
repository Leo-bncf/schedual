import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityName, data } = await req.json();

    // Auto-add school_id for school-scoped entities if not present
    let finalData = { ...data };
    if (user.school_id && !data.school_id) {
      finalData.school_id = user.school_id;
    }

    const record = await base44.asServiceRole.entities[entityName].create(finalData);

    return Response.json({ record });
  } catch (error) {
    console.error('Error in createEntityRecord:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});