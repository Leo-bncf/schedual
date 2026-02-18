import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * OptaPlanner/Codex Scheduling Pipeline
 * 
 * Clean, direct pipeline without error masking:
 * 1. Pre-audit (validate inputs)
 * 2. Build problem (via buildSchedulingProblem)
 * 3. Solve (call Codex solver)
 * 4. Persist (save to DB)
 * 
 * Returns structured result with transparent error propagation (requestId, validationErrors, details)
 */

const PIPELINE_VERSION = '2026-02-18-OPTAPLANNER-CLEAN';

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
    // STAGE 2: Build Problem
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
      // CRITICAL: Extract full error from response.data (Axios throws on 4xx/5xx)
      console.error(`[OptaPlannerPipeline] ❌ buildSchedulingProblem failed (HTTP ${buildError?.response?.status})`);
      console.error('[OptaPlannerPipeline] Full error data:', JSON.stringify(buildError?.response?.data, null, 2));
      
      const errorData = buildError?.response?.data || {};
      
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
      console.error('[OptaPlannerPipeline] Build data:', JSON.stringify(buildData, null, 2));
      
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
    // STAGE 3: Call Solver (Codex)
    // ========================================
    stage = 'callSolver';
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
    
    console.log(`[OptaPlannerPipeline] ${stage}: calling Codex at ${SOLVER_ENDPOINT}`);
    
    const problem = buildData.problem;
    
    // Prepare solver payload
    const solverPayload = {
      ...problem,
      schoolId,
      scheduleVersionId: schedule_version_id,
      debug: true,
      strictDemand: true
    };
    
    console.log('[OptaPlannerPipeline] Solver payload:', {
      timeslots: solverPayload.timeslots?.length,
      lessons: solverPayload.lessons?.length,
      subjects: solverPayload.subjects?.length
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
      return Response.json({
        ok: false,
        stage: 'callSolver',
        errorCode: 'SOLVER_NETWORK_ERROR',
        message: 'Network error calling solver',
        requestId: null,
        validationErrors: [String(fetchError?.message || fetchError)],
        details: [],
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
    
    console.log('[OptaPlannerPipeline] ✅ Solver completed, score:', solution.score);
    
    // ========================================
    // STAGE 4: Persist to Database
    // ========================================
    stage = 'persist';
    console.log(`[OptaPlannerPipeline] ${stage}: saving ${solution.lessons?.length || 0} lessons to DB`);
    
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
      status: lesson.timeslotId ? 'scheduled' : 'unscheduled'
    }));
    
    // Delete old slots
    let deletedCount = 0;
    try {
      const purgeResponse = await base44.functions.invoke('purgeScheduleSlots', {
        schedule_version_id
      });
      deletedCount = purgeResponse?.data?.deletedCount || 0;
      console.log(`[OptaPlannerPipeline] Deleted ${deletedCount} old slots`);
    } catch (purgeError) {
      console.error('[OptaPlannerPipeline] ⚠️ Purge failed:', purgeError);
    }
    
    // Insert new slots
    let insertedCount = 0;
    if (slots.length > 0) {
      const inserted = await base44.entities.ScheduleSlot.bulkCreate(slots);
      insertedCount = Array.isArray(inserted) ? inserted.length : slots.length;
      console.log(`[OptaPlannerPipeline] Inserted ${insertedCount} new slots`);
    }
    
    // Update schedule version
    try {
      await base44.entities.ScheduleVersion.update(schedule_version_id, {
        generated_at: new Date().toISOString(),
        score: solution.score || 0,
        conflicts_count: slots.filter(s => !s.timeslot_id).length,
        warnings_count: 0
      });
    } catch (updateError) {
      console.warn('[OptaPlannerPipeline] ⚠️ Failed to update schedule version:', updateError);
    }
    
    // ========================================
    // STAGE 5: Return Success
    // ========================================
    return Response.json({
      ok: true,
      stage: 'complete',
      result: {
        lessonsCreated: solution.lessons?.length || 0,
        lessonsAssigned: slots.filter(s => s.timeslot_id).length,
        lessonsUnassigned: slots.filter(s => !s.timeslot_id).length,
        slotsDeleted: deletedCount,
        slotsInserted: insertedCount,
        conflicts: slots.filter(s => !s.timeslot_id).length,
        score: solution.score || 0
      },
      meta: { 
        schoolId, 
        schedule_version_id,
        buildVersion: buildData.buildVersion,
        pipelineVersion: PIPELINE_VERSION
      }
    });
    
  } catch (error) {
    console.error(`[OptaPlannerPipeline] ❌ FATAL ERROR at stage=${stage}:`, error);
    console.error('[OptaPlannerPipeline] Stack:', error?.stack);
    
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