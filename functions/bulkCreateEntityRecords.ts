import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityName, records } = await req.json();

    // Auto-add school_id for each record if not present
    const finalRecords = records.map(record => {
      if (user.school_id && !record.school_id) {
        return { ...record, school_id: user.school_id };
      }
      return record;
    });

    const createdRecords = await base44.asServiceRole.entities[entityName].bulkCreate(finalRecords);

    return Response.json({ records: createdRecords });
  } catch (error) {
    console.error('Error in bulkCreateEntityRecords:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});