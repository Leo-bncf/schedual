import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ARCHIVE SCHEDULE VERSION
 * Archives a draft or published version
 * 
 * Input: {
 *   schedule_version_id: string
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { schedule_version_id } = payload;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get version
    const versions = await base44.entities.ScheduleVersion.filter({
      id: schedule_version_id,
      school_id: user.school_id
    });

    if (versions.length === 0) {
      return Response.json({ error: 'Schedule version not found' }, { status: 404 });
    }

    const version = versions[0];

    if (version.status === 'archived') {
      return Response.json({ error: 'Version is already archived' }, { status: 400 });
    }

    const archived = await base44.entities.ScheduleVersion.update(schedule_version_id, {
      status: 'archived'
    });

    console.log(`[ArchiveVersion] Archived version: ${schedule_version_id}`);

    return Response.json({
      status: 'success',
      message: 'Version archived successfully',
      version: archived
    });

  } catch (error) {
    console.error('[ArchiveVersion] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});