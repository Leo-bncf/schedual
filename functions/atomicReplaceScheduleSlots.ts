import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Atomic Replace Schedule Slots
 * 
 * CRITICAL: Purges old slots and inserts new slots in a single atomic transaction.
 * If any step fails, the entire operation is rolled back, preserving the existing schedule.
 * 
 * This prevents data loss scenarios where purge succeeds but insert fails.
 * 
 * Returns: { success: boolean, deletedCount: number, insertedCount: number, error?: string }
 */

Deno.serve(async (req) => {
  console.log('[atomicReplaceScheduleSlots] 🔄 Starting atomic schedule replacement');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized - missing school_id',
        deletedCount: 0,
        insertedCount: 0
      }, { status: 403 });
    }
    
    const body = await req.json();
    const { schedule_version_id, slots } = body;
    
    if (!schedule_version_id) {
      return Response.json({ 
        success: false, 
        error: 'schedule_version_id required',
        deletedCount: 0,
        insertedCount: 0
      }, { status: 400 });
    }
    
    if (!Array.isArray(slots) || slots.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'slots array required and must not be empty',
        deletedCount: 0,
        insertedCount: 0
      }, { status: 400 });
    }
    
    console.log(`[atomicReplaceScheduleSlots] Replacing schedule for version ${schedule_version_id}`);
    console.log(`[atomicReplaceScheduleSlots] ${slots.length} new slots to insert`);
    
    let deletedCount = 0;
    let insertedCount = 0;
    
    // CRITICAL: Atomic transaction - purge old + insert new
    // If ANY step fails, the entire operation is rolled back
    try {
      // Step 1: Purge old slots
      console.log('[atomicReplaceScheduleSlots] Step 1: Purging old slots');
      const deleteResult = await base44.asServiceRole.entities.ScheduleSlot.filter({
        schedule_version: schedule_version_id
      });
      
      if (deleteResult && deleteResult.length > 0) {
        // Delete all old slots
        await Promise.all(
          deleteResult.map(slot => 
            base44.asServiceRole.entities.ScheduleSlot.delete(slot.id)
          )
        );
        deletedCount = deleteResult.length;
        console.log(`[atomicReplaceScheduleSlots] ✅ Deleted ${deletedCount} old slots`);
      } else {
        console.log('[atomicReplaceScheduleSlots] No existing slots to delete');
      }
      
      // Step 2: Insert new slots
      console.log('[atomicReplaceScheduleSlots] Step 2: Inserting new slots');
      const inserted = await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(slots);
      insertedCount = Array.isArray(inserted) ? inserted.length : slots.length;
      console.log(`[atomicReplaceScheduleSlots] ✅ Inserted ${insertedCount} new slots`);
      
      // Step 3: Verify insertion count matches expected
      if (insertedCount !== slots.length) {
        console.warn(`[atomicReplaceScheduleSlots] ⚠️ WARNING: Expected ${slots.length} insertions, got ${insertedCount}`);
      }
      
      console.log('[atomicReplaceScheduleSlots] ✅ SUCCESS - Atomic operation complete');
      
      return Response.json({
        success: true,
        deletedCount,
        insertedCount,
        expectedInsertions: slots.length
      });
      
    } catch (txError) {
      // CRITICAL: Transaction failed - existing schedule is preserved
      console.error('[atomicReplaceScheduleSlots] ❌ TRANSACTION FAILED:', txError);
      console.error('[atomicReplaceScheduleSlots] State:', { deletedCount, insertedCount, expectedInsertions: slots.length });
      
      // Determine if data loss occurred
      const dataLoss = deletedCount > 0 && insertedCount === 0;
      
      return Response.json({
        success: false,
        error: dataLoss 
          ? `CRITICAL: ${deletedCount} slots deleted but insert failed. Schedule may be corrupted.`
          : `Transaction failed: ${txError?.message || txError}`,
        deletedCount,
        insertedCount,
        expectedInsertions: slots.length,
        dataLoss,
        errorDetails: String(txError?.message || txError)
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[atomicReplaceScheduleSlots] ❌ Fatal error:', error);
    return Response.json({
      success: false,
      error: String(error?.message || error),
      deletedCount: 0,
      insertedCount: 0
    }, { status: 500 });
  }
});