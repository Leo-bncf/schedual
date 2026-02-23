import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 2: Main orchestrator for schedule generation
 * Flow: validate -> prepare -> call OptaPlanner VPS -> save -> complete
 * Synchronous with timeout (150s total, 140s for HTTP call)
 */

const OPTAPLANNER_VPS_URL = Deno.env.get('OPTAPLANNER_VPS_URL') || 'https://schedual-optaplanner-vps.deno.dev/solve';
const SOLVER_TIMEOUT_MS = 140000; // 140 seconds for HTTP call
const TOTAL_TIMEOUT_MS = 150000; // 150 seconds total function timeout

Deno.serve(async (req) => {
  const startTime = Date.now();
  let generationId = null;

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        ok: false, 
        error: { code: 'UNAUTHORIZED', message: 'Admin access required', stage: 'auth' }
      }, { status: 403 });
    }

    const { schedule_version_id } = await req.json();
    
    if (!schedule_version_id) {
      return Response.json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'schedule_version_id required', stage: 'validation' }
      }, { status: 400 });
    }

    const schoolId = user.school_id;

    // === STEP 1: ANTI-CONCURRENT LOCK ===
    const existingGeneration = await base44.entities.ScheduleGeneration.filter({
      schedule_version_id,
      status: 'generating'
    });

    if (existingGeneration.length > 0) {
      console.log(`[generateSchedule] Rejected: generation already in progress for version ${schedule_version_id}`);
      return Response.json({
        ok: false,
        error: {
          code: 'GENERATION_IN_PROGRESS',
          message: 'Schedule generation already in progress for this version',
          stage: 'lock',
          details: { generation_id: existingGeneration[0].id }
        }
      }, { status: 409 });
    }

    // === STEP 2: CREATE GENERATION RECORD ===
    const generation = await base44.asServiceRole.entities.ScheduleGeneration.create({
      school_id: schoolId,
      schedule_version_id,
      status: 'generating',
      started_at: new Date().toISOString()
    });
    
    generationId = generation.id;
    console.log(`[generateSchedule] Created generation ${generationId}`);

    // === STEP 3: PREPARE & VALIDATE DATA ===
    console.log(`[generateSchedule] Calling prepareScheduleData...`);
    const prepareResponse = await base44.functions.invoke('prepareScheduleData', {
      schedule_version_id
    });

    if (!prepareResponse.data.ok) {
      const errors = prepareResponse.data.errors || [];
      console.error(`[generateSchedule] Validation failed:`, errors);
      
      await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: {
          code: 'VALIDATION_FAILED',
          message: `${errors.length} validation error(s)`,
          details: errors,
          stage: 'prepare'
        }
      });

      return Response.json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Pre-generation validation failed',
          stage: 'prepare',
          details: errors
        }
      }, { status: 400 });
    }

    const { payload, meta, input_hash } = prepareResponse.data;
    console.log(`[generateSchedule] Prepared payload with ${meta.total_lessons} lessons, hash: ${input_hash}`);

    // Update generation with input_hash
    await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
      input_hash
    });

    // === STEP 4: CALL OPTAPLANNER VPS (SYNC WITH TIMEOUT) ===
    console.log(`[generateSchedule] Calling OptaPlanner VPS at ${OPTAPLANNER_VPS_URL}...`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SOLVER_TIMEOUT_MS);

    let solverResponse;
    let solverStartTime = Date.now();
    
    try {
      const response = await fetch(OPTAPLANNER_VPS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('WEBHOOK_BEARER_TOKEN') || ''}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`VPS returned ${response.status}: ${await response.text()}`);
      }

      solverResponse = await response.json();
      const solverDuration = Date.now() - solverStartTime;
      console.log(`[generateSchedule] Solver completed in ${solverDuration}ms`);

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.error(`[generateSchedule] Solver timeout after ${SOLVER_TIMEOUT_MS}ms`);
        
        await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error: {
            code: 'SOLVER_TIMEOUT',
            message: `Solver did not complete within ${SOLVER_TIMEOUT_MS / 1000}s`,
            stage: 'solver',
            details: { timeout_ms: SOLVER_TIMEOUT_MS }
          }
        });

        return Response.json({
          ok: false,
          error: {
            code: 'SOLVER_TIMEOUT',
            message: 'Schedule generation timed out',
            stage: 'solver',
            details: { timeout_ms: SOLVER_TIMEOUT_MS }
          }
        }, { status: 504 });
      }

      throw error; // Re-throw other errors
    }

    // === STEP 5: VALIDATE SOLVER RESPONSE ===
    if (!solverResponse || !solverResponse.solution || !Array.isArray(solverResponse.solution.assignments)) {
      console.error(`[generateSchedule] Invalid solver response:`, solverResponse);
      
      await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: {
          code: 'INVALID_SOLVER_RESPONSE',
          message: 'Solver returned invalid response format',
          stage: 'solver',
          details: { response: solverResponse }
        }
      });

      return Response.json({
        ok: false,
        error: {
          code: 'INVALID_SOLVER_RESPONSE',
          message: 'Solver response validation failed',
          stage: 'solver'
        }
      }, { status: 500 });
    }

    // Map solver assignments to ScheduleSlot format
    const assignments = solverResponse.solution.assignments;
    const slots = assignments.map(assignment => ({
      teachingGroupId: assignment.lessonId?.replace('lesson-', ''), // Extract original ID
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      roomId: assignment.roomId,
      timeslotId: assignment.timeslotId,
      day: assignment.dayOfWeek,
      period: assignment.periodIndex || 0,
      isDoublePeriod: assignment.isDoublePeriod || false
    }));

    console.log(`[generateSchedule] Mapped ${slots.length} assignments to slots`);

    // === STEP 6: SAVE SLOTS (ATOMIC TRANSACTION) ===
    console.log(`[generateSchedule] Calling saveScheduleSlots...`);
    const saveResponse = await base44.functions.invoke('saveScheduleSlots', {
      schedule_version_id,
      slots,
      input_hash
    });

    if (!saveResponse.data.ok) {
      console.error(`[generateSchedule] Save failed:`, saveResponse.data.error);
      
      await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error: {
          code: 'SAVE_FAILED',
          message: 'Failed to persist schedule slots',
          stage: 'save',
          details: saveResponse.data.error
        }
      });

      return Response.json({
        ok: false,
        error: {
          code: 'SAVE_FAILED',
          message: 'Failed to save schedule',
          stage: 'save',
          details: saveResponse.data.error
        }
      }, { status: 500 });
    }

    // === STEP 7: MARK COMPLETED ===
    const totalDuration = Date.now() - startTime;
    const solverDuration = Date.now() - solverStartTime;

    await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      duration_ms: totalDuration,
      result: {
        slots_created: saveResponse.data.slots_created,
        slots_deleted: saveResponse.data.slots_deleted,
        warnings_count: solverResponse.warnings?.length || 0,
        conflicts_count: solverResponse.conflicts?.length || 0,
        optimization_score: solverResponse.score || 0,
        solver_duration_ms: solverDuration
      },
      solver_metadata: {
        score: solverResponse.score,
        solver_version: solverResponse.solverVersion,
        timeslots_used: meta.total_timeslots
      }
    });

    console.log(`[generateSchedule] ✅ Completed in ${totalDuration}ms (solver: ${solverDuration}ms)`);

    return Response.json({
      ok: true,
      generation_id: generationId,
      result: {
        slots_created: saveResponse.data.slots_created,
        slots_deleted: saveResponse.data.slots_deleted,
        optimization_score: solverResponse.score || 0,
        warnings: solverResponse.warnings || [],
        conflicts: solverResponse.conflicts || []
      },
      duration_ms: totalDuration,
      solver_duration_ms: solverDuration
    });

  } catch (error) {
    console.error('[generateSchedule] Unexpected error:', error);
    
    // Attempt to mark generation as failed if we have the ID
    if (generationId) {
      try {
        const base44 = createClientFromRequest(req);
        await base44.asServiceRole.entities.ScheduleGeneration.update(generationId, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          error: {
            code: 'INTERNAL_ERROR',
            message: error.message,
            stage: 'unknown',
            details: { stack: error.stack }
          }
        });
      } catch (updateError) {
        console.error('[generateSchedule] Failed to update generation status:', updateError);
      }
    }

    return Response.json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        stage: 'unknown',
        details: { stack: error.stack }
      }
    }, { status: 500 });
  }
});