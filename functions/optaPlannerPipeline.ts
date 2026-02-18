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
        error: 'Unauthorized',
        code: 'NO_USER'
      }, { status: 401 });
    }
    
    if (!user.school_id) {
      return Response.json({ 
        ok: false, 
        stage, 
        error: 'User missing school_id',
        code: 'NO_SCHOOL'
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
        error: 'schedule_version_id required',
        code: 'MISSING_SCHEDULE_VERSION'
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
        ...errorData, // ✅ Propagate ALL fields from buildSchedulingProblem
        upstream: 'buildSchedulingProblem',
        axiosError: buildError?.message
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
        ...buildData, // ✅ Propagate ALL fields
        upstream: 'buildSchedulingProblem'
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
        stage: 'audit_complete',
        audit: true,
        problem: buildData.problem,
        validationReport: buildData.validationReport,
        stats: buildData.stats,
        buildVersion: buildData.buildVersion,
        pipelineVersion: PIPELINE_VERSION
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
        error: 'Solver endpoint or API key missing',
        code: 'MISSING_SOLVER_CONFIG',
        env: {
          has_endpoint: !!SOLVER_ENDPOINT,
          has_api_key: !!SOLVER_API_KEY
        }
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
        error: 'Network error calling solver',
        code: 'SOLVER_NETWORK_ERROR',
        errorMessage: String(fetchError?.message || fetchError)
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
        stage: 'solverError',
        error: 'Solver returned error',
        code: parsedError?.code || 'SOLVER_ERROR',
        httpStatus: solverResponse.status,
        solverResponse: parsedError,
        requestId: parsedError?.requestId,
        validationErrors: parsedError?.validationErrors,
        details: parsedError?.details
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
        error: 'Invalid JSON from solver',
        code: 'INVALID_SOLVER_RESPONSE',
        preview: solverText.slice(0, 500)
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
      success: true,
      stage: 'complete',
      schedule_version_id,
      school_id: schoolId,
      stats: {
        lessons_total: solution.lessons?.length || 0,
        lessons_assigned: slots.filter(s => s.timeslot_id).length,
        lessons_unassigned: slots.filter(s => !s.timeslot_id).length,
        slots_deleted: deletedCount,
        slots_inserted: insertedCount,
        score: solution.score || 0
      },
      buildVersion: buildData.buildVersion,
      pipelineVersion: PIPELINE_VERSION,
      message: 'Schedule generated successfully'
    });
    
  } catch (error) {
    console.error(`[OptaPlannerPipeline] ❌ FATAL ERROR at stage=${stage}:`, error);
    console.error('[OptaPlannerPipeline] Stack:', error?.stack);
    
    return Response.json({
      ok: false,
      stage,
      error: String(error?.message || error),
      errorStack: String(error?.stack || ''),
      code: 'PIPELINE_ERROR',
      meta: { schedule_version_id, schoolId }
    }, { status: 200 });
  }
});