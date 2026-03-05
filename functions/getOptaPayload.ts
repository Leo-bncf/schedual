import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { schedule_version_id: explicitVersionId, constraints = {} } = body || {};

    // Require auth (this returns the caller's school context)
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ ok: false, error: 'User not linked to a school' }, { status: 400 });
    }

    // Resolve target schedule version: explicit or latest Draft for this school
    let targetVersionId = explicitVersionId;
    if (!targetVersionId) {
      const versions = await base44.entities.ScheduleVersion.filter(
        { school_id: user.school_id, status: 'draft' },
        '-updated_date',
        1
      );
      if (!versions || versions.length === 0) {
        return Response.json({ ok: false, error: 'No Draft schedule version found for this school' }, { status: 404 });
      }
      targetVersionId = versions[0].id;
    }

    // Call the existing pipeline in DRY mode (mock_school_id short-circuits to return payload)
    const { data } = await base44.functions.invoke('optaPlannerPipeline', {
      schedule_version_id: targetVersionId,
      constraints,
      mock_school_id: user.school_id,
    });

    if (!data || data.ok !== true || !data.payload) {
      return Response.json({ ok: false, error: 'Pipeline did not return payload', details: data }, { status: 400 });
    }

    // Return the exact payload that would be POSTed to OptaPlanner
    return Response.json({ ok: true, schedule_version_id: targetVersionId, payload: data.payload });
  } catch (error) {
    console.error('[getOptaPayload] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});