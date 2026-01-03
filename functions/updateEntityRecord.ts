import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityName, id, data } = await req.json();

    const record = await base44.asServiceRole.entities[entityName].update(id, data);

    return Response.json({ record });
  } catch (error) {
    console.error('Error in updateEntityRecord:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});