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

    // Delete with AGGRESSIVE rate limit handling
    const CHUNK_SIZE = 10; // Smaller chunks to avoid rate limit
    const DELAY_MS = 1000; // 1 second between chunks
    const MAX_RETRIES = 5;
    let deletedCount = 0;
    const errors = [];

    for (let i = 0; i < slotsToDelete.length; i += CHUNK_SIZE) {
      const chunk = slotsToDelete.slice(i, i + CHUNK_SIZE);
      let chunkSuccess = false;
      
      // Retry logic for each chunk
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const results = await Promise.allSettled(
          chunk.map(slot => base44.asServiceRole.entities.ScheduleSlot.delete(slot.id))
        );

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected');

        deletedCount += successes;

        if (failures.length === 0) {
          chunkSuccess = true;
          break;
        }

        // Check for rate limit errors
        const hasRateLimit = failures.some(f => 
          String(f.reason?.message || '').toLowerCase().includes('rate limit')
        );

        if (hasRateLimit && attempt < MAX_RETRIES) {
          const backoff = Math.pow(2, attempt) * 2000; // 2s, 4s, 8s, 16s, 32s
          console.warn(`[purgeScheduleSlots] Rate limit hit (chunk ${i+1}/${Math.ceil(totalCount/CHUNK_SIZE)}), retry in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        // Log persistent errors
        failures.forEach((f, idx) => {
          errors.push(`${chunk[idx]?.id}: ${f.reason?.message || 'unknown'}`);
        });
        break;
      }

      if (!chunkSuccess) {
        console.error(`[purgeScheduleSlots] Chunk ${i+1}/${Math.ceil(totalCount/CHUNK_SIZE)} failed after ${MAX_RETRIES} retries`);
      }

      // Progress log
      if ((i + CHUNK_SIZE) % 50 === 0 || i + CHUNK_SIZE >= totalCount) {
        console.log(`[purgeScheduleSlots] Progress: ${deletedCount}/${totalCount}`);
      }

      // Delay between chunks (except last)
      if (i + CHUNK_SIZE < totalCount) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
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