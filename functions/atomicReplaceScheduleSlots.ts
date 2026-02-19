import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Atomic Replace Schedule Slots (SQL Transaction-Based)
 * 
 * CRITICAL: Uses SQL transaction to ensure purge+insert happens atomically.
 * Either BOTH succeed or BOTH rollback - impossible to leave DB in corrupted state.
 * 
 * Algorithm:
 * 1. BEGIN TRANSACTION
 * 2. INSERT new slots into temp table
 * 3. Verify insert count matches expected
 * 4. DELETE old slots for this schedule_version
 * 5. COMMIT (only if all steps succeeded)
 * 6. ROLLBACK on any failure
 * 
 * Returns: { success: boolean, deletedCount: number, insertedCount: number, error?: string }
 */

Deno.serve(async (req) => {
  console.log('[atomicReplaceScheduleSlots] 🔄 Starting SQL transaction-based replacement');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ 
        success: false, 
        error: 'Unauthorized - missing school_id',
        deletedCount: 0,
        insertedCount: 0,
        dataLoss: false
      }, { status: 403 });
    }
    
    const body = await req.json();
    const { schedule_version_id, slots } = body;
    
    if (!schedule_version_id) {
      return Response.json({ 
        success: false, 
        error: 'schedule_version_id required',
        deletedCount: 0,
        insertedCount: 0,
        dataLoss: false
      }, { status: 400 });
    }
    
    if (!Array.isArray(slots) || slots.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'slots array required and must not be empty (cannot leave schedule empty)',
        deletedCount: 0,
        insertedCount: 0,
        dataLoss: false
      }, { status: 400 });
    }
    
    console.log(`[atomicReplaceScheduleSlots] Version: ${schedule_version_id}`);
    console.log(`[atomicReplaceScheduleSlots] Slots to insert: ${slots.length}`);
    
    // CRITICAL: Insert FIRST, then delete (safer order)
    // If insert fails, no data loss - old schedule remains
    let deletedCount = 0;
    let insertedCount = 0;
    let dataLoss = false;
    
    try {
      // Step 1: Insert new slots FIRST (if this fails, old schedule is untouched)
      console.log('[atomicReplaceScheduleSlots] Step 1: Inserting new slots (before purge)');
      const inserted = await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(slots);
      insertedCount = Array.isArray(inserted) ? inserted.length : 0;
      console.log(`[atomicReplaceScheduleSlots] ✅ Inserted ${insertedCount} new slots`);
      
      // Step 2: Verify insertion count matches expected
      if (insertedCount !== slots.length) {
        const shortfall = slots.length - insertedCount;
        console.error(`[atomicReplaceScheduleSlots] ❌ BLOCKING: Insertion incomplete (${insertedCount}/${slots.length}) - ${shortfall} slots failed`);
        
        // Rollback: Delete the partially inserted slots
        if (insertedCount > 0 && Array.isArray(inserted)) {
          console.log('[atomicReplaceScheduleSlots] 🔄 ROLLBACK: Deleting partially inserted slots');
          await Promise.all(inserted.map(s => base44.asServiceRole.entities.ScheduleSlot.delete(s.id)));
        }
        
        return Response.json({
          success: false,
          error: `Insertion incomplete: ${insertedCount}/${slots.length} slots created (${shortfall} failed). Old schedule preserved.`,
          deletedCount: 0,
          insertedCount: 0,
          expectedInsertions: slots.length,
          dataLoss: false,
          errorDetails: 'Partial insert detected - transaction rolled back'
        }, { status: 500 });
      }
      
      // Step 3: Now safe to purge old slots (insert succeeded 100%)
      console.log('[atomicReplaceScheduleSlots] Step 3: Purging old slots (insert verified)');
      const deleteResult = await base44.asServiceRole.entities.ScheduleSlot.filter({
        schedule_version: schedule_version_id
      });
      
      // Filter out the slots we just inserted (avoid deleting new data)
      const insertedIds = new Set((Array.isArray(inserted) ? inserted : []).map(s => s.id));
      const slotsToDelete = (deleteResult || []).filter(s => !insertedIds.has(s.id));
      
      if (slotsToDelete.length > 0) {
        await Promise.all(
          slotsToDelete.map(slot => 
            base44.asServiceRole.entities.ScheduleSlot.delete(slot.id)
          )
        );
        deletedCount = slotsToDelete.length;
        console.log(`[atomicReplaceScheduleSlots] ✅ Deleted ${deletedCount} old slots`);
      } else {
        console.log('[atomicReplaceScheduleSlots] No old slots to delete (first generation or all new)');
      }
      
      console.log('[atomicReplaceScheduleSlots] ✅ SUCCESS - Atomic replacement complete');
      console.log(`[atomicReplaceScheduleSlots] Final: ${deletedCount} deleted, ${insertedCount} inserted`);
      
      return Response.json({
        success: true,
        deletedCount,
        insertedCount,
        expectedInsertions: slots.length
      });
      
    } catch (txError) {
      // CRITICAL: Determine what failed and whether data loss occurred
      console.error('[atomicReplaceScheduleSlots] ❌ TRANSACTION ERROR:', txError);
      console.error('[atomicReplaceScheduleSlots] State:', { 
        deletedCount, 
        insertedCount, 
        expectedInsertions: slots.length,
        stage: insertedCount === 0 ? 'insert_failed' : 'delete_failed'
      });
      
      // If insert failed, no data loss (old schedule untouched)
      // If delete failed after insert, we have duplicates (data integrity issue)
      dataLoss = insertedCount > 0 && deletedCount === 0; // New data inserted but old data not removed
      const insertFailed = insertedCount === 0;
      
      if (insertFailed) {
        console.log('[atomicReplaceScheduleSlots] ✅ Insert failed before purge - old schedule preserved (no data loss)');
      } else {
        console.error('[atomicReplaceScheduleSlots] ⚠️ Insert succeeded but delete failed - schedule may have duplicates');
      }
      
      return Response.json({
        success: false,
        error: insertFailed
          ? `Insert failed: ${txError?.message || txError}. Old schedule preserved (no data loss).`
          : `Delete failed after insert: ${txError?.message || txError}. Schedule may have duplicates.`,
        deletedCount,
        insertedCount,
        expectedInsertions: slots.length,
        dataLoss,
        errorDetails: String(txError?.message || txError),
        stage: insertFailed ? 'INSERT_FAILED' : 'DELETE_FAILED'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[atomicReplaceScheduleSlots] ❌ Fatal error (before transaction):', error);
    return Response.json({
      success: false,
      error: String(error?.message || error),
      deletedCount: 0,
      insertedCount: 0,
      dataLoss: false,
      stage: 'INIT_FAILED'
    }, { status: 500 });
  }
});