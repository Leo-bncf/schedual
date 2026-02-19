import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Codex Scheduling Pipeline (OptaPlanner Solver)
 * 
 * Direct pipeline with strict DTO validation:
 * 1. Load school data
 * 2. Normalize TeachingGroups (DTO whitelist: id, student_group, subject_id, level, required_minutes_per_week, section_id)
 * 3. Pre-validate (HL/SL hours, minutes > 0)
 * 4. Build problem
 * 5. Solve (call Codex)
 * 6. Persist (save to DB)
 * 
 * Returns: { ok, stage, result/errorCode, requestId, validationErrors[], details[], meta }
 */

const PIPELINE_VERSION = '2026-02-18-CODEX-DTO-STRICT';

Deno.serve(async (req) => {
  console.log(`[OptaPlannerPipeline] 🚀 VERSION: ${PIPELINE_VERSION}`);
  
  let stage = 'init';
  let schedule_version_id = null;
  let schoolId = null;
  
  try {
    // ========================================
    // STAGE 1: Authentication & Input Parsing
    // ========================================
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ 
        ok: false, 
        stage, 
        errorCode: 'NO_USER',
        message: 'Unauthorized - no user authenticated',
        validationErrors: [],
        details: [],
        meta: { schoolId: null, schedule_version_id: null }
      }, { status: 401 });
    }
    
    if (!user.school_id) {
      return Response.json({ 
        ok: false, 
        stage, 
        errorCode: 'NO_SCHOOL',
        message: 'User missing school_id',
        validationErrors: [],
        details: [],
        meta: { schoolId: null, schedule_version_id: null }
      }, { status: 403 });
    }
    
    stage = 'parseRequest';
    const body = await req.json();
    schedule_version_id = body?.schedule_version_id;
    schoolId = user.school_id;
    
    const auditOnly = body?.audit === true;
    
    console.log(`[OptaPlannerPipeline] Request:`, {
      schedule_version_id,
      school_id: schoolId,
      audit_only: auditOnly
    });
    
    if (!schedule_version_id) {
      return Response.json({ 
        ok: false, 
        stage, 
        errorCode: 'MISSING_SCHEDULE_VERSION',
        message: 'schedule_version_id is required',
        validationErrors: ['schedule_version_id missing in request body'],
        details: [],
        meta: { schoolId, schedule_version_id: null }
      }, { status: 400 });
    }
    
    // ========================================
    // STAGE 2: Build Problem (handles all validation & DTO mapping)
    // ========================================
    stage = 'buildProblem';
    console.log(`[OptaPlannerPipeline] ${stage}: calling buildSchedulingProblem`);
    
    let buildResponse;
    try {
      buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
        schedule_version_id,
        school_id: schoolId
      });
    } catch (buildError) {
      console.error(`[OptaPlannerPipeline] ❌ buildSchedulingProblem failed (HTTP ${buildError?.response?.status})`);
      
      const errorData = buildError?.response?.data || {};
      console.error('[OptaPlannerPipeline] requestId:', errorData?.requestId || 'N/A');
      console.error('[OptaPlannerPipeline] validationErrors:', errorData?.validationErrors || []);
      console.error('[OptaPlannerPipeline] details:', errorData?.details || []);
      
      // CRITICAL: Propagate Codex error directly (don't wrap)
      if (errorData.ok === false || errorData.requestId || errorData.validationErrors || errorData.details) {
        return Response.json(errorData, { status: 200 });
      }
      
      return Response.json({
        ok: false,
        stage: 'buildProblem',
        errorCode: errorData?.code || errorData?.errorCode || 'BUILD_ERROR',
        message: errorData?.message || errorData?.error || 'Failed to build scheduling problem',
        requestId: errorData?.requestId || null,
        validationErrors: errorData?.validationErrors || [],
        details: errorData?.details || [],
        meta: { schoolId, schedule_version_id }
      }, { status: 200 });
    }
    
    const buildData = buildResponse?.data;
    
    // Check build success
    if (!buildData?.success || buildData?.ok === false) {
      console.error('[OptaPlannerPipeline] ❌ buildProblem returned failure');
      console.error('[OptaPlannerPipeline] requestId:', buildData?.requestId || 'N/A');
      console.error('[OptaPlannerPipeline] validationErrors:', buildData?.validationErrors || []);
      console.error('[OptaPlannerPipeline] details:', buildData?.details || []);
      
      return Response.json({
        ok: false,
        stage: 'buildProblem',
        errorCode: buildData?.code || buildData?.errorCode || 'BUILD_VALIDATION_ERROR',
        message: buildData?.message || buildData?.error || 'Build validation failed',
        requestId: buildData?.requestId || null,
        validationErrors: buildData?.validationErrors || [],
        details: buildData?.details || [],
        meta: { schoolId, schedule_version_id }
      }, { status: 200 });
    }
    
    console.log('[OptaPlannerPipeline] ✅ Problem built successfully');
    console.log('[OptaPlannerPipeline] Stats:', {
      timeslots: buildData?.problem?.timeslots?.length || 0,
      lessons: buildData?.problem?.lessons?.length || 0,
      teachingGroups: buildData?.problem?.teachingGroups?.length || 0,
      subjects: buildData?.problem?.subjects?.length || 0
    });
    
    // Early return for audit-only mode
    if (auditOnly) {
      console.log('[OptaPlannerPipeline] Audit mode - returning problem without solving');
      return Response.json({
        ok: true,
        stage: 'audit',
        result: {
          timeslots: buildData.problem?.timeslots?.length || 0,
          lessons: buildData.problem?.lessons?.length || 0,
          validationReport: buildData.validationReport,
          stats: buildData.stats
        },
        meta: { 
          schoolId, 
          schedule_version_id,
          buildVersion: buildData.buildVersion,
          pipelineVersion: PIPELINE_VERSION
        }
      });
    }
    
    // ========================================
    // STAGE 5: Call Solver (Codex)
    // ========================================
    stage = 'solve';
    const SOLVER_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT') || Deno.env.get('SOLVER_ENDPOINT');
    const SOLVER_API_KEY = Deno.env.get('OR_TOOL_API_KEY') || Deno.env.get('SOLVER_API_KEY');
    
    if (!SOLVER_ENDPOINT || !SOLVER_API_KEY) {
      return Response.json({
        ok: false,
        stage,
        errorCode: 'MISSING_SOLVER_CONFIG',
        message: 'Solver endpoint or API key not configured',
        requestId: null,
        validationErrors: [
          !SOLVER_ENDPOINT ? 'OR_TOOL_ENDPOINT env var missing' : null,
          !SOLVER_API_KEY ? 'OR_TOOL_API_KEY env var missing' : null
        ].filter(Boolean),
        details: [],
        meta: { schoolId, schedule_version_id }
      }, { status: 503 });
    }
    
    console.log(`[OptaPlannerPipeline] ${stage}: calling Codex solver at ${SOLVER_ENDPOINT}`);
    
    const problem = buildData.problem;
    
    // Verify teachingGroups DTO format (buildSchedulingProblem already applies whitelist)
    const tgSample = problem.teachingGroups?.[0];
    if (tgSample) {
      console.log('[OptaPlannerPipeline] DTO sample:', {
        id: tgSample.id,
        student_group: tgSample.student_group,
        subject_id: tgSample.subject_id,
        level: tgSample.level,
        required_minutes_per_week: tgSample.required_minutes_per_week,
        section_id: tgSample.section_id
      });
    }
    
    // Send problem as-is to Codex (buildSchedulingProblem handles DTO whitelist)
    const solverPayload = {
      ...problem, // Already contains: timeslots, lessons, subjects, rooms, teachers, teachingGroups (DTO strict)
      schoolId,
      scheduleVersionId: schedule_version_id,
      debug: true,
      strictDemand: true
    };
    
    console.log('[OptaPlannerPipeline] Codex payload prepared:', {
      timeslots: solverPayload.timeslots?.length || 0,
      lessons: solverPayload.lessons?.length || 0,
      teachingGroups: solverPayload.teachingGroups?.length || 0,
      subjects: solverPayload.subjects?.length || 0,
      rooms: solverPayload.rooms?.length || 0,
      teachers: solverPayload.teachers?.length || 0
    });
    
    let solverResponse;
    try {
      solverResponse = await fetch(SOLVER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SOLVER_API_KEY
        },
        body: JSON.stringify(solverPayload)
      });
    } catch (fetchError) {
      console.error('[OptaPlannerPipeline] ❌ Solver network error:', fetchError);
      console.error('[OptaPlannerPipeline] requestId: N/A (network error)');
      console.error('[OptaPlannerPipeline] validationErrors:', [String(fetchError?.message || fetchError)]);
      
      return Response.json({
        ok: false,
        stage: 'solve',
        errorCode: 'SOLVER_NETWORK_ERROR',
        message: 'Network error calling solver',
        requestId: null,
        validationErrors: [String(fetchError?.message || fetchError)],
        details: [{ entity: 'solver', field: 'network', reason: String(fetchError?.message || fetchError), hint: 'Check solver endpoint availability' }],
        meta: { schoolId, schedule_version_id }
      }, { status: 200 });
    }
    
    const solverText = await solverResponse.text();
    
    if (!solverResponse.ok) {
      console.error(`[OptaPlannerPipeline] ❌ Solver returned error (HTTP ${solverResponse.status})`);
      console.error('[OptaPlannerPipeline] Solver response:', solverText.slice(0, 500));
      
      let parsedError;
      try {
        parsedError = JSON.parse(solverText);
      } catch {
        parsedError = { rawText: solverText };
      }
      
      // CRITICAL: Propagate solver error directly (don't wrap)
      console.error('[OptaPlannerPipeline] requestId:', parsedError?.requestId || 'N/A');
      console.error('[OptaPlannerPipeline] validationErrors:', parsedError?.validationErrors || []);
      console.error('[OptaPlannerPipeline] details:', parsedError?.details || []);
      
      // If Codex returned structured error, propagate it directly
      if (parsedError.ok === false || parsedError.requestId) {
        return Response.json(parsedError, { status: 200 });
      }
      
      return Response.json({
        ok: false,
        stage: 'solve',
        errorCode: parsedError?.code || parsedError?.errorCode || 'SOLVER_ERROR',
        message: parsedError?.message || parsedError?.error || `Solver returned HTTP ${solverResponse.status}`,
        requestId: parsedError?.requestId || null,
        validationErrors: parsedError?.validationErrors || [],
        details: parsedError?.details || [],
        meta: { 
          schoolId, 
          schedule_version_id,
          solverHttpStatus: solverResponse.status
        }
      }, { status: 200 });
    }
    
    let solution;
    try {
      solution = JSON.parse(solverText);
    } catch (parseError) {
      console.error('[OptaPlannerPipeline] ❌ Failed to parse solver response');
      return Response.json({
        ok: false,
        stage: 'parseSolution',
        errorCode: 'INVALID_SOLVER_RESPONSE',
        message: 'Invalid JSON from solver',
        requestId: null,
        validationErrors: ['Solver returned non-JSON response'],
        details: [{ entity: 'solver', field: 'response', reason: 'malformed JSON', hint: 'Check solver logs' }],
        meta: { schoolId, schedule_version_id }
      }, { status: 200 });
    }
    
    console.log('[OptaPlannerPipeline] ✅ Solver completed');
    console.log('[OptaPlannerPipeline] Result:', {
      score: solution.score,
      lessonsReturned: solution.lessons?.length || 0,
      requestId: solution.requestId || 'N/A'
    });
    
    // ========================================
    // STAGE 6: Validate Solution Before Persist
    // ========================================
    stage = 'validateSolution';
    
    // Parse hardScore from score string (e.g., "-10hard/-814soft" or "0hard/100soft")
    const scoreStr = String(solution.score || '');
    const hardScoreMatch = scoreStr.match(/(-?\d+)hard/);
    const hardScore = hardScoreMatch ? parseInt(hardScoreMatch[1]) : null;
    
    console.log(`[OptaPlannerPipeline] ${stage}: hardScore=${hardScore}, lessonsReturned=${solution.lessons?.length || 0}`);
    
    // Map solver output to ScheduleSlot entities
    const slots = (solution.lessons || []).map(lesson => ({
      school_id: schoolId,
      schedule_version: schedule_version_id,
      teaching_group_id: lesson.studentGroup?.startsWith('TG_') ? lesson.studentGroup.slice(3) : null,
      subject_id: lesson.subjectId || null,
      teacher_id: lesson.teacherId || null,
      room_id: lesson.roomId || null,
      timeslot_id: lesson.timeslotId || null,
      day: lesson.day || null,
      period: lesson.period || null,
      is_double_period: false,
      status: lesson.timeslotId ? 'scheduled' : 'unscheduled',
      _subject_code: lesson.subject || null // Preserve subject code for diagnostics
    }));
    
    const slotsToInsert = slots.filter(s => s.timeslot_id); // Only insert assigned slots
    const unassignedCount = slots.filter(s => !s.timeslot_id).length;
    
    // CRITICAL GUARD 1: Block if hardScore < 0 (infeasible solution)
    if (hardScore !== null && hardScore < 0) {
      console.error(`[OptaPlannerPipeline] ❌ BLOCKING: hardScore=${hardScore} < 0 (infeasible solution)`);
      console.error('[OptaPlannerPipeline] NOT purging existing slots - keeping current schedule');
      
      return Response.json({
        ok: false,
        stage: 'SOLUTION_INFEASIBLE',
        code: 'HARD_CONSTRAINTS_VIOLATED',
        error: 'Schedule infeasible',
        errorMessage: `❌ OptaPlanner could not satisfy hard constraints.\n\nHard Score: ${hardScore} (must be 0 or positive)\n\nThe solver could not find a feasible schedule that satisfies all mandatory constraints.\n\n👉 Existing schedule preserved - no changes made.`,
        details: [{
          entity: 'Solution',
          field: 'hardScore',
          reason: `${hardScore} violations`,
          hint: 'Review constraints, reduce required hours, or increase available timeslots'
        }],
        suggestion: '🔧 Try:\n• Reduce teaching hours/week for some subjects\n• Add more periods per day\n• Review hard constraints (may be too restrictive)\n• Check if enough teachers/rooms available',
        requiredAction: 'Fix constraints or increase schedule capacity',
        meta: { 
          schoolId, 
          schedule_version_id,
          hardScore,
          softScore: scoreStr,
          lessonsReturned: solution.lessons?.length || 0,
          lessonsAssigned: slotsToInsert.length,
          lessonsUnassigned: unassignedCount
        }
      }, { status: 200 });
    }
    
    // CRITICAL GUARD 2: Block if 0 slots to insert (destructive purge)
    if (slotsToInsert.length === 0) {
      console.error(`[OptaPlannerPipeline] ❌ BLOCKING: slotsToInsert=0 (would leave schedule empty)`);
      console.error('[OptaPlannerPipeline] NOT purging existing slots - keeping current schedule');
      
      return Response.json({
        ok: false,
        stage: 'PERSISTENCE_BLOCKED',
        code: 'ZERO_SLOTS_GENERATED',
        error: 'No assignable slots',
        errorMessage: `❌ OptaPlanner returned 0 assigned slots.\n\nSolver returned ${solution.lessons?.length || 0} lessons total, but ALL are unassigned (no timeslot_id).\n\nPurging existing slots would leave schedule empty.\n\n👉 Existing schedule preserved - no changes made.`,
        details: [{
          entity: 'Solution',
          field: 'lessons',
          reason: '0 lessons with timeslot assignments',
          hint: 'Solver may be over-constrained or missing capacity'
        }],
        suggestion: '🔧 Try:\n• Increase periods per day in Settings\n• Reduce teaching hours for some subjects\n• Check if enough timeslots available\n• Review hard constraints',
        requiredAction: 'Fix configuration to enable slot assignment',
        meta: { 
          schoolId, 
          schedule_version_id,
          hardScore,
          softScore: scoreStr,
          lessonsReturned: solution.lessons?.length || 0,
          lessonsUnassigned: unassignedCount,
          slotsToInsert: 0
        }
      }, { status: 200 });
    }
    
    console.log(`[OptaPlannerPipeline] ✅ Validation passed: hardScore=${hardScore}, slotsToInsert=${slotsToInsert.length}`);
    
    // ========================================
    // STAGE 7: Atomic Persist (Purge + Insert)
    // ========================================
    stage = 'persist';
    console.log(`[OptaPlannerPipeline] ${stage}: atomic transaction - deleting old slots then inserting ${slotsToInsert.length} new slots`);
    
    let deletedCount = 0;
    let insertedCount = 0;
    
    try {
      // Step 1: Purge old slots (safe - we have validated slots ready to insert)
      try {
        const purgeResponse = await base44.functions.invoke('purgeScheduleSlots', {
          schedule_version_id
        });
        deletedCount = purgeResponse?.data?.deletedCount || 0;
        console.log(`[OptaPlannerPipeline] ✅ Deleted ${deletedCount} old slots`);
      } catch (purgeError) {
        console.error('[OptaPlannerPipeline] ❌ Purge failed:', purgeError);
        throw new Error(`Purge failed: ${purgeError?.message || purgeError}`);
      }
      
      // Step 2: Insert new slots
      const inserted = await base44.entities.ScheduleSlot.bulkCreate(slotsToInsert);
      insertedCount = Array.isArray(inserted) ? inserted.length : slotsToInsert.length;
      console.log(`[OptaPlannerPipeline] ✅ Inserted ${insertedCount} new slots`);
      
      // Step 3: Count core slots inserted (TOK/CAS/EE)
      const coreSlotsInsertedCount = {
        TOK: slotsToInsert.filter(s => s._subject_code === 'TOK').length,
        CAS: slotsToInsert.filter(s => s._subject_code === 'CAS').length,
        EE: slotsToInsert.filter(s => s._subject_code === 'EE').length
      };
      console.log(`[OptaPlannerPipeline] 📊 Core slots inserted:`, coreSlotsInsertedCount);
      
      // Step 4: Update schedule version
      await base44.entities.ScheduleVersion.update(schedule_version_id, {
        generated_at: new Date().toISOString(),
        score: solution.score || 0,
        conflicts_count: unassignedCount,
        warnings_count: 0
      });
      
    } catch (persistError) {
      console.error('[OptaPlannerPipeline] ❌❌❌ ATOMIC TRANSACTION FAILED');
      console.error('[OptaPlannerPipeline] Error:', persistError);
      console.error('[OptaPlannerPipeline] State:', { deletedCount, insertedCount, slotsToInsert: slotsToInsert.length });
      
      // CRITICAL: If insert failed after purge, schedule is now empty (data loss)
      const dataLoss = deletedCount > 0 && insertedCount === 0;
      
      return Response.json({
        ok: false,
        stage: 'PERSISTENCE_FAILED',
        code: dataLoss ? 'DATA_LOSS_DETECTED' : 'INSERT_FAILED',
        error: 'Database persistence failed',
        errorMessage: dataLoss 
          ? `❌ CRITICAL: ${deletedCount} slots deleted but insert failed.\n\nSchedule is now empty (data loss occurred).\n\nError: ${persistError?.message || persistError}\n\n👉 Re-run schedule generation immediately to restore.`
          : `❌ Failed to persist new schedule.\n\nError: ${persistError?.message || persistError}\n\n👉 Existing schedule may be partially affected.`,
        details: [{
          entity: 'Database',
          field: 'bulkCreate',
          reason: String(persistError?.message || persistError),
          hint: dataLoss ? 'Re-generate schedule immediately - data was lost' : 'Retry persistence operation'
        }],
        suggestion: dataLoss 
          ? '🚨 Data loss occurred. Click "Generate" immediately to restore schedule.'
          : '🔧 Retry schedule generation to persist new slots.',
        requiredAction: dataLoss ? 'URGENT: Re-generate schedule to restore data' : 'Retry generation',
        meta: { 
          schoolId, 
          schedule_version_id,
          deletedCount,
          insertedCount,
          slotsToInsert: slotsToInsert.length,
          dataLoss
        }
      }, { status: 200 });
    }
    
    // ========================================
    // STAGE 8: Return Success
    // ========================================
    console.log('[OptaPlannerPipeline] ✅ SUCCESS - Pipeline complete');
    console.log('[OptaPlannerPipeline] Final counts:', {
      deletedCount,
      insertedCount,
      requestId: solution.requestId || 'N/A'
    });
    
    return Response.json({
      ok: true,
      stage: 'complete',
      result: {
        lessonsCreated: solution.lessons?.length || 0,
        lessonsAssigned: slotsToInsert.length,
        lessonsUnassigned: unassignedCount,
        slotsDeleted: deletedCount,
        slotsInserted: insertedCount,
        conflicts: unassignedCount,
        score: solution.score || 0,
        coreSlotsInserted: coreSlotsInsertedCount // NEW: Core slots breakdown
      },
      // Propagate build diagnostics for UI display
      coreTeachingGroupsDetected: buildData?.coreTeachingGroupsDetected || [],
      coreSubjectRequirementsSample: buildData?.coreSubjectRequirementsSample || [],
      expectedLessonsBySubject: buildData?.expectedLessonsBySubject || {},
      expectedMinutesBySubject: buildData?.expectedMinutesBySubject || {},
      timeslots: buildData?.problem?.timeslots || [],
      meta: { 
        schoolId, 
        schedule_version_id,
        buildVersion: buildData?.buildVersion || 'unknown',
        pipelineVersion: PIPELINE_VERSION,
        requestId: solution.requestId || null
      }
    });
    
  } catch (error) {
    console.error(`[OptaPlannerPipeline] ❌ FATAL ERROR at stage=${stage}:`, error);
    console.error('[OptaPlannerPipeline] Stack:', error?.stack);
    console.error('[OptaPlannerPipeline] requestId: N/A (pipeline crash)');
    console.error('[OptaPlannerPipeline] validationErrors: []');
    console.error('[OptaPlannerPipeline] details:', [{ entity: 'pipeline', field: 'execution', reason: String(error?.message || error) }]);
    
    return Response.json({
      ok: false,
      stage,
      errorCode: 'PIPELINE_ERROR',
      message: String(error?.message || error),
      requestId: null,
      validationErrors: [],
      details: [{ 
        entity: 'pipeline', 
        field: 'execution', 
        reason: String(error?.message || error), 
        hint: 'Check function logs for stack trace' 
      }],
      meta: { schoolId, schedule_version_id }
    }, { status: 200 });
  }
});