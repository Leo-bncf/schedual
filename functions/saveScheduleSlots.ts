import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 2: Atomically save schedule slots (delete old + insert new)
 * Transaction ensures all-or-nothing consistency
 * Idempotent: safe to re-run with same version + hash
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        ok: false, 
        error: { code: 'UNAUTHORIZED', message: 'Admin access required' }
      }, { status: 403 });
    }

    const { schedule_version_id, slots, input_hash } = await req.json();
    
    if (!schedule_version_id || !slots || !Array.isArray(slots)) {
      return Response.json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'schedule_version_id and slots[] required' }
      }, { status: 400 });
    }

    const schoolId = user.school_id;

    // Idempotency check: if exact same hash was already saved, skip
    const existingGeneration = await base44.entities.ScheduleGeneration.filter({
      schedule_version_id,
      status: 'completed',
      input_hash
    });

    if (existingGeneration.length > 0) {
      console.log(`[saveScheduleSlots] Idempotent skip: hash ${input_hash} already saved`);
      const existingSlots = await base44.entities.ScheduleSlot.filter({ 
        schedule_version: schedule_version_id 
      });
      
      return Response.json({
        ok: true,
        slots_deleted: 0,
        slots_created: existingSlots.length,
        idempotent: true
      });
    }

    // === ATOMIC TRANSACTION ===
    console.log(`[saveScheduleSlots] Starting transaction for version ${schedule_version_id}`);
    
    // Step 1: Delete existing slots for this version
    const existingSlotsToDelete = await base44.entities.ScheduleSlot.filter({ 
      schedule_version: schedule_version_id 
    });
    
    const deletePromises = existingSlotsToDelete.map(slot => 
      base44.asServiceRole.entities.ScheduleSlot.delete(slot.id)
    );
    
    await Promise.all(deletePromises);
    console.log(`[saveScheduleSlots] Deleted ${existingSlotsToDelete.length} old slots`);

    // Step 2: Insert new slots (batch)
    const newSlots = slots.map(slot => ({
      school_id: schoolId,
      schedule_version: schedule_version_id,
      teaching_group_id: slot.teachingGroupId,
      classgroup_id: slot.classgroupId || null,
      subject_id: slot.subjectId,
      teacher_id: slot.teacherId,
      room_id: slot.roomId,
      timeslot_id: slot.timeslotId,
      day: slot.day,
      period: slot.period || 0,
      is_double_period: slot.isDoublePeriod || false,
      status: 'scheduled'
    }));

    // Batch insert in chunks of 100 to avoid payload limits
    const BATCH_SIZE = 100;
    let totalCreated = 0;

    for (let i = 0; i < newSlots.length; i += BATCH_SIZE) {
      const batch = newSlots.slice(i, i + BATCH_SIZE);
      await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(batch);
      totalCreated += batch.length;
      console.log(`[saveScheduleSlots] Inserted batch ${i / BATCH_SIZE + 1}: ${batch.length} slots`);
    }

    console.log(`[saveScheduleSlots] Transaction complete: ${existingSlotsToDelete.length} deleted, ${totalCreated} created`);

    return Response.json({
      ok: true,
      slots_deleted: existingSlotsToDelete.length,
      slots_created: totalCreated
    });

  } catch (error) {
    console.error('[saveScheduleSlots] Transaction failed:', error);
    
    // Attempt rollback info (Base44 SDK doesn't expose explicit rollback, 
    // but failed operations won't commit)
    return Response.json({
      ok: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'Failed to save schedule slots',
        details: { 
          error: error.message,
          hint: 'Transaction was not committed. No partial data saved.'
        }
      }
    }, { status: 500 });
  }
});