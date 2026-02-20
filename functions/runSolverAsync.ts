import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Run Solver Async (Background Executor)
 * 
 * Executes the full OptaPlanner pipeline asynchronously.
 * Updates SolverJob record with progress and results.
 * 
 * Can take 5+ minutes - no HTTP timeout issues since invoked async.
 */

Deno.serve(async (req) => {
  console.log('[runSolverAsync] 🚀 Background execution started');
  
  const startTime = Date.now();
  let job_id = null;
  let schedule_version_id = null;
  let schoolId = null;
  
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    job_id = body?.job_id;
    schedule_version_id = body?.schedule_version_id;
    schoolId = body?.school_id;
    const audit = body?.audit || false;
    
    if (!job_id || !schedule_version_id || !schoolId) {
      console.error('[runSolverAsync] ❌ Missing required params');
      return Response.json({ ok: false, error: 'Missing params' }, { status: 400 });
    }
    
    console.log(`[runSolverAsync] Job ${job_id}: Building problem...`);
    
    // Update: building
    await base44.asServiceRole.entities.SolverJob.update(job_id, {
      status: 'running',
      stage: 'buildProblem',
      progress_percent: 10
    });
    
    // Build problem
    let buildResponse;
    try {
      buildResponse = await base44.asServiceRole.functions.invoke('buildSchedulingProblem', {
        schedule_version_id,
        school_id: schoolId
      });
    } catch (buildError) {
      console.error(`[runSolverAsync] ❌ Build failed:`, buildError);
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'buildProblem',
        error: {
          stage: 'buildProblem',
          message: String(buildError?.message || buildError),
          details: buildError?.response?.data || {}
        },
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Build failed' });
    }
    
    const buildData = buildResponse?.data;
    
    if (!buildData?.success || buildData?.ok === false) {
      console.error('[runSolverAsync] ❌ Build validation failed');
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'buildProblem',
        error: buildData,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Build validation failed' });
    }
    
    console.log(`[runSolverAsync] Job ${job_id}: Build complete, calling solver...`);
    
    // Update: solving
    await base44.asServiceRole.entities.SolverJob.update(job_id, {
      stage: 'solve',
      progress_percent: 30
    });
    
    // Call solver
    const SOLVER_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT');
    const SOLVER_API_KEY = Deno.env.get('OR_TOOL_API_KEY');
    
    const problem = buildData.problem;
    
    // Sanitize (reuse from optaPlannerPipeline)
    const sanitizeForOpta = (payload) => {
      const out = structuredClone(payload || {});
      const toNum = (v) => {
        if (v === null || v === undefined || v === "") return null;
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (typeof v === "string") {
          const n = Number(v.trim());
          return Number.isFinite(n) ? n : null;
        }
        if (typeof v === "object") {
          if (v.id !== undefined) return toNum(v.id);
          if (v._id !== undefined) return toNum(v._id);
        }
        return null;
      };
      const toSubjectId = (v) => {
        if (v === null || v === undefined) return null;
        if (typeof v === "string") return v.trim();
        if (typeof v === "object") return String(v.id ?? v._id ?? "").trim() || null;
        return String(v);
      };
      out.lessons = Array.isArray(out.lessons) ? out.lessons.map((l) => {
        const lesson = { ...l };
        lesson.id = toNum(lesson.id);
        lesson.teacherId = toNum(lesson.teacherId);
        lesson.roomId = toNum(lesson.roomId);
        lesson.timeslotId = toNum(lesson.timeslotId);
        lesson.blockId = toNum(lesson.blockId);
        lesson.requiredCapacity = toNum(lesson.requiredCapacity);
        lesson.subject = toSubjectId(lesson.subject);
        if (lesson.subjectId !== undefined) lesson.subjectId = toSubjectId(lesson.subjectId);
        const rawStudentIds = Array.isArray(lesson.studentIds) ? lesson.studentIds : [];
        lesson.studentIds = rawStudentIds.map(toNum).filter((x) => x !== null);
        return lesson;
      }) : [];
      out.subjectRequirements = Array.isArray(out.subjectRequirements)
        ? out.subjectRequirements.map((r) => ({ ...r, subject: toSubjectId(r.subject) }))
        : [];
      out.teachers = Array.isArray(out.teachers)
        ? out.teachers.map((t) => ({ 
            ...t, 
            id: toNum(t.id), 
            unavailableSlotIds: (t.unavailableSlotIds || []).map(toNum).filter((x) => x !== null) 
          }))
        : [];
      out.rooms = Array.isArray(out.rooms)
        ? out.rooms.map((r) => ({ ...r, id: toNum(r.id), capacity: toNum(r.capacity) }))
        : [];
      return out;
    };
    
    const sanitizedProblem = sanitizeForOpta(problem);
    const solverPayload = {
      ...sanitizedProblem,
      schoolId,
      scheduleVersionId: schedule_version_id,
      debug: true,
      strictDemand: true
    };
    
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
      console.error('[runSolverAsync] ❌ Solver network error:', fetchError);
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'solve',
        error: {
          stage: 'solve',
          code: 'SOLVER_NETWORK_ERROR',
          message: String(fetchError?.message || fetchError)
        },
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Solver network error' });
    }
    
    const solverText = await solverResponse.text();
    
    if (!solverResponse.ok) {
      console.error(`[runSolverAsync] ❌ Solver error (HTTP ${solverResponse.status})`);
      
      let parsedError;
      try {
        parsedError = JSON.parse(solverText);
      } catch {
        parsedError = { rawText: solverText };
      }
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'solve',
        error: parsedError,
        request_id: parsedError?.requestId || null,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Solver error' });
    }
    
    let solution;
    try {
      solution = JSON.parse(solverText);
    } catch (parseError) {
      console.error('[runSolverAsync] ❌ Failed to parse solver response');
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'parseSolution',
        error: {
          stage: 'parseSolution',
          code: 'INVALID_SOLVER_RESPONSE',
          message: 'Solver returned non-JSON response'
        },
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Parse error' });
    }
    
    const requestId = solution.requestId || solution.meta?.requestId || null;
    
    console.log(`[runSolverAsync] Job ${job_id}: Solver complete, persisting...`);
    
    // Update: persisting
    await base44.asServiceRole.entities.SolverJob.update(job_id, {
      stage: 'persist',
      progress_percent: 80,
      request_id: requestId
    });
    
    // Parse score
    const scoreStr = String(solution.score || '');
    const hardScoreMatch = scoreStr.match(/(-?\d+)hard/);
    const hardScore = hardScoreMatch ? parseInt(hardScoreMatch[1]) : null;
    
    // Map to slots
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
      _subject_code: lesson.subject || null
    }));
    
    const slotsToInsert = slots.filter(s => s.timeslot_id);
    const unassignedCount = slots.filter(s => !s.timeslot_id).length;
    
    // Check infeasibility
    if (hardScore !== null && hardScore < 0) {
      console.error(`[runSolverAsync] ❌ Infeasible solution (hardScore=${hardScore})`);
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'validateSolution',
        error: {
          stage: 'SOLUTION_INFEASIBLE',
          code: 'HARD_CONSTRAINTS_VIOLATED',
          hardScore,
          scoreStr,
          message: `Solution infeasible: hardScore=${hardScore} < 0`
        },
        request_id: requestId,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Infeasible solution' });
    }
    
    // Check zero slots
    if (slotsToInsert.length === 0) {
      console.error(`[runSolverAsync] ❌ Zero slots generated`);
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'validateSolution',
        error: {
          stage: 'PERSISTENCE_BLOCKED',
          code: 'ZERO_SLOTS_GENERATED',
          hardScore,
          scoreStr,
          lessonsReturned: solution.lessons?.length || 0,
          message: 'Solver returned 0 assigned slots'
        },
        request_id: requestId,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Zero slots generated' });
    }
    
    // Persist
    let deletedCount = 0;
    let insertedCount = 0;
    
    try {
      const replaceResponse = await base44.asServiceRole.functions.invoke('atomicReplaceScheduleSlots', {
        schedule_version_id,
        slots: slotsToInsert
      });
      
      const replaceData = replaceResponse?.data || {};
      
      if (!replaceData.success) {
        console.error('[runSolverAsync] ❌ Atomic replace failed');
        
        await base44.asServiceRole.entities.SolverJob.update(job_id, {
          status: 'failed',
          stage: 'persist',
          error: {
            stage: 'PERSISTENCE_FAILED',
            code: replaceData.dataLoss ? 'DATA_LOSS_DETECTED' : 'TRANSACTION_FAILED',
            message: replaceData.error || 'Atomic replace failed',
            deletedCount: replaceData.deletedCount || 0,
            insertedCount: replaceData.insertedCount || 0
          },
          request_id: requestId,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
        
        return Response.json({ ok: false, error: 'Persistence failed' });
      }
      
      deletedCount = replaceData.deletedCount || 0;
      insertedCount = replaceData.insertedCount || 0;
      
      console.log(`[runSolverAsync] ✅ Persisted: deleted ${deletedCount}, inserted ${insertedCount}`);
      
      // Update schedule version
      await base44.asServiceRole.entities.ScheduleVersion.update(schedule_version_id, {
        generated_at: new Date().toISOString(),
        score: solution.score || 0,
        conflicts_count: unassignedCount,
        warnings_count: 0
      });
      
    } catch (persistError) {
      console.error('[runSolverAsync] ❌ Persistence error:', persistError);
      
      await base44.asServiceRole.entities.SolverJob.update(job_id, {
        status: 'failed',
        stage: 'persist',
        error: {
          stage: 'PERSISTENCE_ERROR',
          code: 'FUNCTION_ERROR',
          message: String(persistError?.message || persistError)
        },
        request_id: requestId,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      
      return Response.json({ ok: false, error: 'Persistence error' });
    }
    
    // Success!
    console.log(`[runSolverAsync] ✅ Job ${job_id} completed successfully`);
    
    await base44.asServiceRole.entities.SolverJob.update(job_id, {
      status: 'completed',
      stage: 'complete',
      progress_percent: 100,
      result: {
        lessonsCreated: solution.lessons?.length || 0,
        lessonsAssigned: slotsToInsert.length,
        lessonsUnassigned: unassignedCount,
        slotsDeleted: deletedCount,
        slotsInserted: insertedCount,
        score: solution.score || 0
      },
      request_id: requestId,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });
    
    return Response.json({ ok: true, job_id });
    
  } catch (error) {
    console.error('[runSolverAsync] ❌ FATAL ERROR:', error);
    
    if (job_id) {
      try {
        await base44.asServiceRole.entities.SolverJob.update(job_id, {
          status: 'failed',
          stage: 'error',
          error: {
            stage: 'PIPELINE_ERROR',
            code: 'FATAL_ERROR',
            message: String(error?.message || error),
            stack: String(error?.stack || '')
          },
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
      } catch (updateError) {
        console.error('[runSolverAsync] ❌ Failed to update job on error:', updateError);
      }
    }
    
    return Response.json({ 
      ok: false, 
      error: String(error?.message || error) 
    }, { status: 500 });
  }
});