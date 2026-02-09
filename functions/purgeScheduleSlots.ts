import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Purge all ScheduleSlots for a given schedule_version
 * Server-side bulk delete with service role to bypass rate limits
 */

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ 
        ok: false, 
        error: 'Unauthorized: user missing school_id' 
      }, { status: 403 });
    }

    const body = await req.json();
    const schedule_version_id = body?.schedule_version_id;

    if (!schedule_version_id) {
      return Response.json({ 
        ok: false, 
        error: 'schedule_version_id required' 
      }, { status: 400 });
    }

    console.log(`[purgeScheduleSlots] Starting purge for schedule_version=${schedule_version_id}, school=${user.school_id}`);

    // Fetch slots to delete using service role (bypasses rate limits)
    const slotsToDelete = await base44.asServiceRole.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });

    const totalCount = slotsToDelete.length;
    console.log(`[purgeScheduleSlots] Found ${totalCount} slots to delete`);

    if (totalCount === 0) {
      return Response.json({
        ok: true,
        deletedCount: 0,
        message: 'No slots to delete'
      });
    }

    // Delete in chunks using service role
    const CHUNK_SIZE = 50;
    let deletedCount = 0;
    const errors = [];

    for (let i = 0; i < slotsToDelete.length; i += CHUNK_SIZE) {
      const chunk = slotsToDelete.slice(i, i + CHUNK_SIZE);
      
      const results = await Promise.allSettled(
        chunk.map(slot => base44.asServiceRole.entities.ScheduleSlot.delete(slot.id))
      );

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected');

      deletedCount += successes;

      failures.forEach((f, idx) => {
        errors.push(`${chunk[idx]?.id}: ${f.reason?.message || 'unknown'}`);
      });

      // Progress log
      if ((i + CHUNK_SIZE) % 100 === 0 || i + CHUNK_SIZE >= totalCount) {
        console.log(`[purgeScheduleSlots] Progress: ${deletedCount}/${totalCount}`);
      }

      // Small delay between chunks to be gentle on DB
      if (i + CHUNK_SIZE < totalCount) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[purgeScheduleSlots] Completed: ${deletedCount}/${totalCount} deleted`);

    return Response.json({
      ok: true,
      deletedCount,
      totalCount,
      errors: errors.slice(0, 10),
      success: deletedCount === totalCount
    });

  } catch (error) {
    console.error('[purgeScheduleSlots] Error:', error);
    return Response.json({
      ok: false,
      error: error.message || 'Unknown error',
      stack: error.stack
    }, { status: 500 });
  }
});