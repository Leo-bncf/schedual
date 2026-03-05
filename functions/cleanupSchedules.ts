import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete all schedule slots for this school
    const slots = await base44.entities.ScheduleSlot.filter({ school_id: user.school_id });
    if (slots.length > 0) {
      for (const slot of slots) {
        await base44.entities.ScheduleSlot.delete(slot.id);
      }
    }

    // Delete all schedule versions for this school
    const versions = await base44.entities.ScheduleVersion.filter({ school_id: user.school_id });
    if (versions.length > 0) {
      for (const version of versions) {
        await base44.entities.ScheduleVersion.delete(version.id);
      }
    }

    console.log(`[Cleanup] Deleted ${slots.length} slots and ${versions.length} versions for school ${user.school_id}`);

    return Response.json({
      ok: true,
      deleted: {
        slots: slots.length,
        versions: versions.length
      }
    });
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});