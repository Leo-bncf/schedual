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
    // STAGE 2: Fetch School Data & Pre-Validate
    // ========================================
    stage = 'loadData';
    
    const teachingGroups = await base44.entities.TeachingGroup.filter({ school_id: schoolId });
    const subjects = await base44.entities.Subject.filter({ school_id: schoolId });
    
    console.log(`[OptaPlannerPipeline] Loaded: ${teachingGroups.length} teaching groups, ${subjects.length} subjects`);
    
    // ========================================
    // STAGE 3: DTO Mapping & Pre-Validation
    // ========================================
    stage = 'validateAndNormalize';
    
    const validationErrors = [];
    const details = [];
    const subjectIndex = {};
    subjects.forEach(s => { subjectIndex[s.id] = s; });
    
    const normalizedGroups = [];
    
    for (const tg of teachingGroups) {
      if (!tg.is_active) continue;
      
      const subject = subjectIndex[tg.subject_id];
      if (!subject) {
        details.push({
          entity: 'TeachingGroup',
          field: 'subject_id',
          reason: `TeachingGroup "${tg.name}" references unknown subject ID: ${tg.subject_id}`,
          hint: 'Remove or fix this teaching group'
        });
        continue;
      }
      
      // Normalize minutes (float → int)
      let minutesPerWeek = null;
      if (typeof tg.minutes_per_week === 'number' && tg.minutes_per_week > 0) {
        minutesPerWeek = Math.round(tg.minutes_per_week);
      } else if (typeof tg.hours_per_week === 'number' && tg.hours_per_week > 0) {
        minutesPerWeek = Math.round(tg.hours_per_week * 60);
      } else {
        // Fallback to subject defaults
        const level = String(tg.level || '').toUpperCase();
        if (subject.ib_level === 'DP') {
          if (level === 'HL') {
            if (!subject.hoursPerWeekHL || subject.hoursPerWeekHL <= 0) {
              details.push({
                entity: 'Subject',
                field: 'hoursPerWeekHL',
                reason: `Subject "${subject.name}" missing hoursPerWeekHL (required for HL teaching groups)`,
                hint: 'Configure on Subjects page'
              });
              continue;
            }
            minutesPerWeek = Math.round(subject.hoursPerWeekHL * 60);
          } else if (level === 'SL') {
            if (!subject.hoursPerWeekSL || subject.hoursPerWeekSL <= 0) {
              details.push({
                entity: 'Subject',
                field: 'hoursPerWeekSL',
                reason: `Subject "${subject.name}" missing hoursPerWeekSL (required for SL teaching groups)`,
                hint: 'Configure on Subjects page'
              });
              continue;
            }
            minutesPerWeek = Math.round(subject.hoursPerWeekSL * 60);
          }
        } else {
          minutesPerWeek = subject.pyp_myp_minutes_per_week_default || 180;
        }
      }
      
      // Validate required_minutes_per_week > 0
      if (!minutesPerWeek || minutesPerWeek <= 0) {
        details.push({
          entity: 'TeachingGroup',
          field: 'required_minutes_per_week',
          reason: `TeachingGroup "${tg.name}" has invalid minutes_per_week: ${minutesPerWeek}`,
          hint: 'Configure minutes_per_week or hours_per_week on teaching group, or HL/SL hours on subject'
        });
        continue;
      }
      
      // DTO Whitelist Mapping
      const normalized = {
        id: String(tg.id),
        student_group: String(tg.name || tg.id), // Non-empty stable identifier
        subject_id: String(tg.subject_id),
        level: tg.level || null,
        required_minutes_per_week: minutesPerWeek,
        section_id: tg.section_id || null
      };
      
      normalizedGroups.push(normalized);
    }
    
    // Block if validation errors
    if (details.length > 0) {
      console.error(`[OptaPlannerPipeline] ❌ Pre-validation failed: ${details.length} issues`);
      console.error('[OptaPlannerPipeline] Details:', JSON.stringify(details, null, 2));
      
      return Response.json({
        ok: false,
        stage: 'validateAndNormalize',
        errorCode: 'PRE_VALIDATION_FAILED',
        message: `${details.length} validation issues detected (HL/SL hours, invalid minutes, etc.)`,
        requestId: null,
        validationErrors: details.map(d => `${d.entity}.${d.field}: ${d.reason}`),
        details,
        meta: { schoolId, schedule_version_id, teachingGroupsTotal: teachingGroups.length, validCount: normalizedGroups.length }
      }, { status: 200 });
    }
    
    console.log(`[OptaPlannerPipeline] ✅ Normalized ${normalizedGroups.length} teaching groups`);
    
    // ========================================
    // STAGE 4: Build Problem
    // ========================================
    stage = 'buildProblem';
    console.log(`[OptaPlannerPipeline] ${stage}: calling buildSchedulingProblem`);
    
    let buildResponse;
    try {
      buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
        schedule_version_id,
        school_id: schoolId,
        teaching_groups_override: normalizedGroups // Pass normalized groups
      });
    } catch (buildError) {
      console.error(`[OptaPlannerPipeline] ❌ buildSchedulingProblem failed (HTTP ${buildError?.response?.status})`);
      
      const errorData = buildError?.response?.data || {};
      console.error('[OptaPlannerPipeline] requestId:', errorData?.requestId || 'N/A');
      console.error('[OptaPlannerPipeline] validationErrors:', errorData?.validationErrors || []);
      console.error('[OptaPlannerPipeline] details:', errorData?.details || []);
      
      // Propagate error response directly (don't wrap)
      if (errorData.ok === false || errorData.requestId) {
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
    // STAGE 6: Persist to Database
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
    // STAGE 7: Return Success
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