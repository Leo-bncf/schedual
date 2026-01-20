import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * PUBLISH SCHEDULE VERSION
 * Publishes a schedule version (sets status to published)
 * Archives all other versions in same term to avoid confusion
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

    // Verify it's admin
    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log(`[PublishVersion] Publishing version: ${schedule_version_id}`);

    // Get version to publish
    const versions = await base44.entities.ScheduleVersion.filter({
      id: schedule_version_id,
      school_id: user.school_id
    });

    if (versions.length === 0) {
      return Response.json({ error: 'Schedule version not found' }, { status: 404 });
    }

    const versionToPublish = versions[0];

    // Check for conflicts before publishing
    const unresolved = await base44.entities.ConflictReport.filter({
      schedule_version_id,
      status: 'unresolved'
    });

    if (unresolved.length > 0) {
      return Response.json({
        error: `Cannot publish version with ${unresolved.length} unresolved conflicts`,
        unresolved_conflict_count: unresolved.length,
        conflicts: unresolved.slice(0, 5) // Return first 5
      }, { status: 400 });
    }

    // Archive other published versions in same term
    const otherVersions = await base44.entities.ScheduleVersion.filter({
      school_id: user.school_id,
      academic_year: versionToPublish.academic_year,
      term: versionToPublish.term,
      status: 'published'
    });

    for (const other of otherVersions) {
      await base44.entities.ScheduleVersion.update(other.id, {
        status: 'archived'
      });
      console.log(`[PublishVersion] Archived previous version: ${other.id}`);
    }

    // Publish this version
    const published = await base44.entities.ScheduleVersion.update(schedule_version_id, {
      status: 'published',
      published_at: new Date().toISOString()
    });

    console.log(`[PublishVersion] Published version: ${schedule_version_id}`);

    return Response.json({
      status: 'success',
      message: `Version published successfully`,
      version: published,
      archived_count: otherVersions.length
    });

  } catch (error) {
    console.error('[PublishVersion] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});