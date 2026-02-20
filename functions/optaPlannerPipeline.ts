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
        code: 'NO_USER',
        severity: 'error',
        title: 'Non authentifié',
        message: 'Vous devez être connecté pour générer un planning.',
        userAction: 'Connectez-vous et réessayez.',
        validationErrors: [],
        details: [],
        meta: { schoolId: null, schedule_version_id: null }
      }, { status: 401 });
    }
    
    if (!user.school_id) {
      return Response.json({ 
        ok: false, 
        stage, 
        code: 'NO_SCHOOL',
        severity: 'error',
        title: 'École manquante',
        message: 'Votre compte n\'est pas lié à une école.',
        userAction: 'Contactez le support pour lier votre compte à une école.',
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
        code: 'MISSING_SCHEDULE_VERSION',
        severity: 'error',
        title: 'Configuration à corriger',
        message: 'Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l\'appel OPTA.',
        userAction: 'Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.',
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
        code: errorData?.code || errorData?.errorCode || 'BUILD_ERROR',
        severity: 'error',
        title: 'Configuration à corriger',
        message: 'Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l\'appel OPTA.',
        userAction: 'Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.',
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
        code: buildData?.code || buildData?.errorCode || 'BUILD_VALIDATION_ERROR',
        severity: 'error',
        title: 'Configuration à corriger',
        message: 'Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l\'appel OPTA.',
        userAction: 'Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.',
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
    
    // ========================================
    // STAGE 3: Validate scheduleSettings completeness (DTO contract enforcement)
    // ========================================
    stage = 'validateScheduleSettings';
    console.log(`[OptaPlannerPipeline] ${stage}: validating scheduleSettings completeness`);
    
    const scheduleSettings = buildData?.problem?.scheduleSettings;
    const settingsValidation = [];
    
    if (!scheduleSettings) {
      settingsValidation.push('scheduleSettings object missing');
    } else {
      if (!scheduleSettings.dayStartTime || scheduleSettings.dayStartTime === null) {
        settingsValidation.push('dayStartTime missing or null');
      }
      if (!scheduleSettings.dayEndTime || scheduleSettings.dayEndTime === null) {
        settingsValidation.push('dayEndTime missing or null');
      }
      if (!scheduleSettings.periodDurationMinutes || scheduleSettings.periodDurationMinutes <= 0) {
        settingsValidation.push(`periodDurationMinutes invalid (${scheduleSettings.periodDurationMinutes})`);
      }
      if (!Array.isArray(scheduleSettings.daysOfWeek) || scheduleSettings.daysOfWeek.length === 0) {
        settingsValidation.push('daysOfWeek missing or empty array');
      }
      if (!Array.isArray(scheduleSettings.breaks)) {
        settingsValidation.push('breaks must be array (can be empty)');
      }
      if (typeof scheduleSettings.minPeriodsPerDay !== 'number' || scheduleSettings.minPeriodsPerDay <= 0) {
        settingsValidation.push(`minPeriodsPerDay invalid (${scheduleSettings.minPeriodsPerDay})`);
      }
      if (typeof scheduleSettings.targetPeriodsPerDay !== 'number' || scheduleSettings.targetPeriodsPerDay <= 0) {
        settingsValidation.push(`targetPeriodsPerDay invalid (${scheduleSettings.targetPeriodsPerDay})`);
      }
    }
    
    if (settingsValidation.length > 0) {
      console.error('[OptaPlannerPipeline] ❌ scheduleSettings validation failed:', settingsValidation);
      
      return Response.json({
        ok: false,
        stage: 'validateScheduleSettings',
        code: 'INCOMPLETE_SCHEDULE_SETTINGS',
        severity: 'error',
        title: 'Configuration à corriger',
        message: 'Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l\'appel OPTA.',
        userAction: 'Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.',
        validationErrors: settingsValidation,
        details: settingsValidation.map(v => ({
          entity: 'scheduleSettings',
          field: v.split(' ')[0],
          reason: 'missing_or_invalid',
          hint: 'Ensure school has valid day_start_time, day_end_time, period_duration_minutes, and days_of_week configured'
        })),
        receivedSettings: scheduleSettings || null,
        meta: { schoolId, schedule_version_id }
      }, { status: 200 });
    }
    
    console.log('[OptaPlannerPipeline] ✅ scheduleSettings validation passed:', {
      dayStartTime: scheduleSettings.dayStartTime,
      dayEndTime: scheduleSettings.dayEndTime,
      periodDurationMinutes: scheduleSettings.periodDurationMinutes,
      daysOfWeek: scheduleSettings.daysOfWeek.length,
      breaks: scheduleSettings.breaks.length,
      minPeriodsPerDay: scheduleSettings.minPeriodsPerDay,
      targetPeriodsPerDay: scheduleSettings.targetPeriodsPerDay
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
        code: 'MISSING_SOLVER_CONFIG',
        severity: 'error',
        title: 'Configuration à corriger',
        message: 'Certaines données sont manquantes ou incohérentes : la génération a été bloquée avant l\'appel OPTA.',
        userAction: 'Corrigez les paramètres (horaires, durée, jours, ressources), puis relancez.',
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
    
    // CRITICAL: Sanitize payload for OptaPlanner (Java type safety)
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
        
        // CRITICAL: studentIds MUST be number[]
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

      // Debug log
      const sample = out.lessons[0] || {};
      console.log("[OPTA sanitize] lesson[0].studentIds sample:", sample.studentIds, "types:", (sample.studentIds || []).map((x) => typeof x));

      return out;
    };
    
    // Sanitize problem before sending to Codex
    const sanitizedProblem = sanitizeForOpta(problem);
    
    const solverPayload = {
      ...sanitizedProblem,
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
      teachers: solverPayload.teachers?.length || 0,
      subjectRequirements: solverPayload.subjectRequirements?.length || 0
    });

    // CRITICAL: Log exact counts for mismatch debugging
    const lessonsCount = solverPayload.lessons?.length || 0;
    const requirementsCount = solverPayload.subjectRequirements?.length || 0;
    const requirementsPeriodSum = (solverPayload.subjectRequirements || []).reduce((sum, r) => sum + (r.requiredPeriods || 0), 0);

    console.log('[OptaPlannerPipeline] 🔍 MISMATCH DEBUG:', {
      lessonsCount,
      requirementsCount,
      requirementsPeriodSum,
      match: lessonsCount === requirementsPeriodSum ? '✅ MATCH' : `❌ MISMATCH (diff: ${lessonsCount - requirementsPeriodSum})`
    });

    // Sample first 3 subjectRequirements for debugging
    if (solverPayload.subjectRequirements?.length > 0) {
      console.log('[OptaPlannerPipeline] 📋 Sample subjectRequirements (first 3):', 
        JSON.stringify(solverPayload.subjectRequirements.slice(0, 3), null, 2)
      );
    }
    
    // CRITICAL: Final validation before sending to OptaPlanner
    if (solverPayload.lessons?.length > 0) {
      const firstLesson = solverPayload.lessons[0];
      const studentIdsTypes = Array.isArray(firstLesson.studentIds) 
        ? firstLesson.studentIds.map(x => typeof x)
        : [];
      const allNumeric = Array.isArray(firstLesson.studentIds) && 
        firstLesson.studentIds.every(x => typeof x === 'number' && Number.isFinite(x));
      
      console.log('[OptaPlannerPipeline] 🔍 FINAL VALIDATION - lesson[0].studentIds:', {
        value: firstLesson.studentIds,
        types: studentIdsTypes,
        allNumeric,
        length: firstLesson.studentIds?.length || 0
      });
      
      if (!allNumeric && Array.isArray(firstLesson.studentIds) && firstLesson.studentIds.length > 0) {
        console.error('[OptaPlannerPipeline] ❌ BLOCKING: studentIds contains non-numeric values - this will fail OptaPlanner deserialization');
        console.error('[OptaPlannerPipeline] Sample lesson:', JSON.stringify(firstLesson, null, 2));
        
        return Response.json({
          ok: false,
          stage: 'validatePayload',
          code: 'INVALID_STUDENT_IDS_TYPE',
          severity: 'error',
          title: 'Type de données invalide',
          message: 'Les studentIds doivent être des nombres (Java Long), pas des chaînes ou objets.',
          userAction: 'Erreur interne du pipeline - contactez le support.',
          requestId: null,
          validationErrors: [`studentIds contains ${studentIdsTypes.filter(t => t !== 'number').length} non-numeric values`],
          details: [{
            entity: 'Lesson',
            field: 'studentIds',
            reason: `Expected number[], got mixed types: ${[...new Set(studentIdsTypes)].join(', ')}`,
            hint: 'All studentIds must be numeric (Java Long) for OptaPlanner deserialization',
            sample: firstLesson.studentIds
          }],
          meta: { 
            schoolId, 
            schedule_version_id,
            sampleLesson: firstLesson
          }
        }, { status: 200 });
      }
    }
    
    let solverResponse;
    try {
      // NOTE: No timeout set - let Deno Deploy handle natural timeout (~55s)
      // If solver takes >55s, Deno will return 502 TIME_LIMIT
      // For >60s solver runs, async job queue architecture would be needed
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
        stage: 'OPTA_CALL',
        code: 'SOLVER_NETWORK_ERROR',
        severity: 'error',
        title: 'Impossible de contacter OPTA',
        message: 'La connexion a échoué (réseau ou délai dépassé).',
        userAction: 'Réessayez dans quelques instants. Si ça continue, vérifiez la configuration réseau et le endpoint OPTA.',
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
        code: parsedError?.code || parsedError?.errorCode || 'SOLVER_ERROR',
        severity: 'error',
        title: parsedError?.title || 'OPTA a renvoyé une erreur',
        message: parsedError?.message || parsedError?.error || `Le solver a retourné HTTP ${solverResponse.status}.`,
        userAction: parsedError?.userAction || 'Vérifiez les diagnostics et réessayez. Contactez le support si le problème persiste.',
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
    
    // CRITICAL: Log raw solver response for debugging
    console.log('[OptaPlannerPipeline] 📤 SOLVER RAW RESPONSE (first 2000 chars):', solverText.slice(0, 2000));
    console.log('[OptaPlannerPipeline] 📏 Full response length:', solverText.length, 'bytes');

    let solution;
    try {
      solution = JSON.parse(solverText);
    } catch (parseError) {
      console.error('[OptaPlannerPipeline] ❌ Failed to parse solver response');
      console.error('[OptaPlannerPipeline] Parse error:', parseError.message);
      console.error('[OptaPlannerPipeline] Response preview:', solverText.slice(0, 500));
      return Response.json({
        ok: false,
        stage: 'parseSolution',
        code: 'INVALID_SOLVER_RESPONSE',
        severity: 'error',
        title: 'Réponse OPTA invalide',
        message: 'La réponse reçue n\'est pas exploitable (JSON malformé).',
        userAction: 'Réessayez. Si le problème persiste, vérifiez les logs OPTA et envoyez le requestId au support.',
        requestId: null,
        validationErrors: ['Solver returned non-JSON response'],
        details: [{ entity: 'solver', field: 'response', reason: 'malformed JSON', hint: 'Check solver logs' }],
        meta: { schoolId, schedule_version_id }
      }, { status: 200 });
    }

    // CRITICAL: Log parsed solution structure
    console.log('[OptaPlannerPipeline] 📋 PARSED SOLUTION STRUCTURE:', {
      hasLessons: !!solution.lessons,
      lessonsType: Array.isArray(solution.lessons) ? 'array' : typeof solution.lessons,
      lessonsCount: Array.isArray(solution.lessons) ? solution.lessons.length : 'N/A',
      score: solution.score || 'N/A',
      hardScore: solution.hardScore || 'N/A',
      softScore: solution.softScore || 'N/A',
      requestId: solution.requestId || solution.meta?.requestId || 'N/A',
      topLevelKeys: Object.keys(solution)
    });

    // Always extract requestId from solver response
    const requestId = solution.requestId || solution.meta?.requestId || null;

    console.log('[OptaPlannerPipeline] ✅ Solver completed');
    console.log('[OptaPlannerPipeline] Result:', {
      score: solution.score,
      lessonsReturned: solution.lessons?.length || 0,
      requestId: requestId || 'N/A'
    });
    
    // DIAGNOSTIC: Log sample lessons to understand assignment status
    if (solution.lessons?.length > 0) {
      const sampleLessons = solution.lessons.slice(0, 10);
      console.log('[OptaPlannerPipeline] 🔍 Sample lessons returned by solver (first 10):');
      sampleLessons.forEach((lesson, idx) => {
        console.log(`  [${idx}]:`, {
          id: lesson.id,
          subject: lesson.subject || lesson.subjectId,
          timeslotId: lesson.timeslotId,
          teacherId: lesson.teacherId,
          roomId: lesson.roomId,
          studentGroup: lesson.studentGroup,
          day: lesson.day,
          period: lesson.period
        });
      });

      const assignedCount = solution.lessons.filter(l => l.timeslotId || l.timeslotId === 0).length;
      const unassignedCount = solution.lessons.filter(l => !l.timeslotId && l.timeslotId !== 0).length;
      console.log('[OptaPlannerPipeline] 📊 Assignment summary:', {
        total: solution.lessons.length,
        assigned: assignedCount,
        unassigned: unassignedCount,
        assignmentRate: `${Math.round((assignedCount / solution.lessons.length) * 100)}%`,
        hardScore: solution.hardScore || hardScore,
        softScore: solution.softScore || scoreStr
      });

      // Log reasons for unassignment if available
      if (unassignedCount > 0) {
        const unassignedSample = solution.lessons.filter(l => !l.timeslotId && l.timeslotId !== 0).slice(0, 5);
        console.log('[OptaPlannerPipeline] 🔍 Sample unassigned lessons:', JSON.stringify(unassignedSample, null, 2));
      }
    }
    
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

      // ========================================
      // ENHANCED CONSTRAINT VIOLATION BREAKDOWN
      // ========================================
      const constraintViolations = solution.constraintMatches || solution.indictmentMap || solution.violations || [];
      console.log('[OptaPlannerPipeline] Raw constraint violations from solver:', constraintViolations?.length || 0);
      
      // Parse and enrich violations with structured data
      const parsedViolations = Array.isArray(constraintViolations) 
        ? constraintViolations
            .filter(v => v.score && String(v.score).includes('hard'))
            .map(v => {
              const scoreImpact = parseInt(String(v.score).match(/-?\d+/)?.[0] || '0');
              const facts = v.justificationList || v.facts || v.entities || [];
              
              // Extract structured data from facts (teacherId, tgId, timeslot, etc.)
              const parsedFacts = facts.slice(0, 5).map(fact => {
                if (typeof fact === 'string') {
                  // Try to extract IDs from string facts
                  const teacherMatch = fact.match(/teacher[_\s]?id[:\s]+([a-f0-9]{24})/i);
                  const tgMatch = fact.match(/teaching[_\s]?group[_\s]?id[:\s]+([a-f0-9]{24})/i);
                  const roomMatch = fact.match(/room[_\s]?id[:\s]+([a-f0-9]{24})/i);
                  const dayMatch = fact.match(/(monday|tuesday|wednesday|thursday|friday)/i);
                  const periodMatch = fact.match(/period[:\s]+(\d+)/i);
                  
                  return {
                    raw: fact,
                    teacherId: teacherMatch?.[1] || null,
                    tgId: tgMatch?.[1] || null,
                    roomId: roomMatch?.[1] || null,
                    day: dayMatch?.[1] || null,
                    period: periodMatch?.[1] ? parseInt(periodMatch[1]) : null
                  };
                } else if (typeof fact === 'object') {
                  // Extract from object facts
                  return {
                    raw: JSON.stringify(fact),
                    teacherId: fact.teacherId || fact.teacher_id || null,
                    tgId: fact.teachingGroupId || fact.teaching_group_id || fact.studentGroup || null,
                    roomId: fact.roomId || fact.room_id || null,
                    day: fact.day || fact.dayOfWeek || null,
                    period: fact.period || fact.timeslot || null,
                    timeslotId: fact.timeslotId || fact.timeslot_id || null
                  };
                }
                return { raw: String(fact) };
              });
              
              return {
                constraintId: v.constraintId || v.constraintName || v.constraint || 'unknown',
                constraintName: v.constraintName || v.name || v.constraint || 'Unknown Constraint',
                violationCount: v.matchCount || v.count || facts.length || 1,
                scoreImpact,
                totalImpact: scoreImpact * (v.matchCount || v.count || 1),
                sampleFacts: parsedFacts
              };
            })
            .sort((a, b) => a.totalImpact - b.totalImpact) // Most negative total impact first
        : [];

      // Group violations by constraint type for summary
      const violationsByConstraint = {};
      parsedViolations.forEach(v => {
        const key = v.constraintName;
        if (!violationsByConstraint[key]) {
          violationsByConstraint[key] = {
            constraintName: v.constraintName,
            totalViolations: 0,
            totalScoreImpact: 0,
            examples: []
          };
        }
        violationsByConstraint[key].totalViolations += v.violationCount;
        violationsByConstraint[key].totalScoreImpact += v.totalImpact;
        violationsByConstraint[key].examples.push(...v.sampleFacts);
      });

      // Sort by total impact and take top 10 constraints
      const topViolationsSummary = Object.values(violationsByConstraint)
        .sort((a, b) => a.totalScoreImpact - b.totalScoreImpact)
        .slice(0, 10)
        .map(v => ({
          constraintName: v.constraintName,
          violationCount: v.totalViolations,
          scoreImpact: v.totalScoreImpact,
          examples: v.examples.slice(0, 3).map(ex => ({
            teacherId: ex.teacherId || null,
            tgId: ex.tgId || null,
            roomId: ex.roomId || null,
            day: ex.day || null,
            period: ex.period || null,
            timeslotId: ex.timeslotId || null,
            description: ex.raw
          }))
        }));

      // Extract capacity summaries (if available)
      const teacherCapacity = solution.teacherCapacitySummary || null;
      const roomCapacity = solution.roomCapacitySummary || null;

      // Always include requestId
      const requestId = solution.requestId || solution.meta?.requestId || null;

      console.error('[OptaPlannerPipeline] Constraint violation breakdown:', {
        totalConstraintsViolated: Object.keys(violationsByConstraint).length,
        totalViolationCount: parsedViolations.reduce((sum, v) => sum + v.violationCount, 0),
        totalScoreImpact: hardScore,
        topConstraints: topViolationsSummary.map(v => `${v.constraintName}: ${v.violationCount} violations (${v.scoreImpact} impact)`)
      });

      return Response.json({
        ok: false,
        stage: 'SOLUTION_INFEASIBLE',
        code: 'HARD_CONSTRAINTS_VIOLATED',
        severity: 'error',
        title: 'Planning impossible',
        message: `OPTA n'a pas pu satisfaire toutes les contraintes obligatoires (score dur : ${hardScore}, doit être ≥ 0).`,
        userAction: topViolationsSummary.length > 0 
          ? `Corrigez les contraintes les plus violées :\n${topViolationsSummary.slice(0, 3).map((v, i) => `${i+1}. ${v.constraintName} (${v.violationCount}×)`).join('\n')}\n\nPuis régénérez le planning.`
          : 'Réduisez les heures requises, augmentez les créneaux disponibles, ou assouplissez les contraintes dures.',
        requestId,
        constraintBreakdown: topViolationsSummary.length > 0 ? {
          summary: topViolationsSummary.map(v => ({
            constraintName: v.constraintName,
            violationCount: v.violationCount,
            scoreImpact: v.scoreImpact,
            sampleViolations: v.examples.map(ex => ({
              teacher: ex.teacherId,
              teachingGroup: ex.tgId,
              room: ex.roomId,
              day: ex.day,
              period: ex.period,
              timeslot: ex.timeslotId,
              description: ex.description
            }))
          })),
          totalConstraintsViolated: Object.keys(violationsByConstraint).length,
          totalViolationCount: parsedViolations.reduce((sum, v) => sum + v.violationCount, 0)
        } : null,
        violatingConstraints: parsedViolations.slice(0, 20), // Legacy field - top 20 detailed violations
        teacherCapacitySummary: teacherCapacity,
        roomCapacitySummary: roomCapacity,
        details: topViolationsSummary.length > 0 
          ? topViolationsSummary.map(v => ({
              entity: 'Constraint',
              field: v.constraintName,
              reason: `${v.violationCount} violation(s), score impact: ${v.scoreImpact}`,
              hint: v.examples.length > 0 
                ? `Affected: ${v.examples.map(ex => {
                    const parts = [];
                    if (ex.teacherId) parts.push(`teacher:${ex.teacherId.slice(0,8)}`);
                    if (ex.tgId) parts.push(`tg:${ex.tgId.slice(0,8)}`);
                    if (ex.roomId) parts.push(`room:${ex.roomId.slice(0,8)}`);
                    if (ex.day && ex.period) parts.push(`${ex.day}P${ex.period}`);
                    return parts.join(' ');
                  }).slice(0, 3).join(' | ')}` 
                : 'Review this constraint configuration'
            }))
          : [{
              entity: 'Solution',
              field: 'hardScore',
              reason: `${hardScore} violations (solver did not return constraint breakdown)`,
              hint: 'Review constraints, reduce required hours, or increase available timeslots'
            }],
        suggestion: topViolationsSummary.length > 0
          ? `🔧 Most violated constraints:\n${topViolationsSummary.slice(0, 3).map((v, i) => `${i+1}. ${v.constraintName} (${v.violationCount}×)`).join('\n')}\n\nFix these constraints first to resolve ${Math.abs(hardScore)} total violations.`
          : '🔧 Try:\n• Reduce teaching hours/week for some subjects\n• Add more periods per day\n• Review hard constraints (may be too restrictive)\n• Check if enough teachers/rooms available',
        requiredAction: 'Fix violated constraints listed above',
        meta: { 
          schoolId, 
          schedule_version_id,
          hardScore,
          softScore: scoreStr,
          lessonsReturned: solution.lessons?.length || 0,
          lessonsAssigned: slotsToInsert.length,
          lessonsUnassigned: unassignedCount,
          requestId
        }
      }, { status: 200 });
    }
    
    // CRITICAL GUARD 2: Block if 0 slots to insert (destructive purge)
    if (slotsToInsert.length === 0) {
      console.error(`[OptaPlannerPipeline] ❌ BLOCKING: slotsToInsert=0 (would leave schedule empty)`);
      console.error('[OptaPlannerPipeline] NOT purging existing slots - keeping current schedule');
      console.error('[OptaPlannerPipeline] 🔍 DIAGNOSTIC:', {
        lessonsReturned: solution.lessons?.length || 0,
        lessonsWithTimeslot: slotsToInsert.length,
        lessonsWithoutTimeslot: unassignedCount,
        hardScore,
        scoreStr,
        constraintMatches: solution.constraintMatches?.length || 0,
        sampleUnassignedLesson: solution.lessons?.find(l => !l.timeslotId)
      });
      
      // Extract detailed unassignment reasons if available
      const unassignedReasons = {};
      solution.lessons?.forEach(l => {
        if (!l.timeslotId) {
          const reason = l.unassignedReason || l.status || 'unknown';
          unassignedReasons[reason] = (unassignedReasons[reason] || 0) + 1;
        }
      });
      
      return Response.json({
        ok: false,
        stage: 'PERSISTENCE_BLOCKED',
        code: 'ZERO_SLOTS_GENERATED',
        severity: 'error',
        title: 'Aucun créneau généré',
        message: hardScore !== null && hardScore < 0
          ? `OPTA a trouvé une solution impossible (score dur : ${hardScore}). Toutes les leçons sont restées non assignées.`
          : `OPTA a terminé (score dur : ${hardScore || 'N/A'}) mais aucun créneau n'a été assigné.`,
        userAction: hardScore !== null && hardScore < 0
          ? 'Contraintes dures violées. Réduisez les heures requises, augmentez les créneaux disponibles, ou assouplissez les contraintes.'
          : 'Vérifiez les paramètres d\'établissement (jours, horaires, durée), les ressources (profs/salles) et relancez.',
        requestId,
        unassignedReasons,
        details: [{
          entity: 'Solution',
          field: 'lessons',
          reason: `${solution.lessons?.length || 0} lessons returned but 0 have timeslot assignments`,
          hint: hardScore !== null && hardScore < 0 
            ? 'Hard constraints violated - solver could not find feasible solution'
            : 'Solver completed but assigned 0 lessons - may be over-constrained or misconfigured'
        }],
        meta: { 
          schoolId, 
          schedule_version_id,
          hardScore,
          softScore: scoreStr,
          lessonsReturned: solution.lessons?.length || 0,
          lessonsUnassigned: unassignedCount,
          slotsToInsert: 0,
          requestId,
          unassignedReasons
        }
      }, { status: 200 });
      }
    
    console.log(`[OptaPlannerPipeline] ✅ Validation passed: hardScore=${hardScore}, slotsToInsert=${slotsToInsert.length}`);
    
    // ========================================
    // STAGE 7: Atomic Persist (Purge + Insert in Single Transaction)
    // ========================================
    stage = 'persist';
    console.log(`[OptaPlannerPipeline] ${stage}: atomic transaction - replacing ${slotsToInsert.length} slots`);

    let deletedCount = 0;
    let insertedCount = 0;

    try {
      // CRITICAL: Call atomic replace function to ensure transaction safety
      const replaceResponse = await base44.functions.invoke('atomicReplaceScheduleSlots', {
        schedule_version_id,
        slots: slotsToInsert
      });

      const replaceData = replaceResponse?.data || {};

      if (!replaceData.success) {
        console.error('[OptaPlannerPipeline] ❌ Atomic replace failed:', replaceData);

        const dataLoss = replaceData.dataLoss || false;
        deletedCount = replaceData.deletedCount || 0;
        insertedCount = replaceData.insertedCount || 0;

        return Response.json({
          ok: false,
          stage: 'PERSISTENCE_FAILED',
          code: dataLoss ? 'DATA_LOSS_DETECTED' : 'TRANSACTION_FAILED',
          severity: dataLoss ? 'critical' : 'error',
          title: dataLoss ? '🚨 PERTE DE DONNÉES CRITIQUE' : 'Échec d\'enregistrement',
          message: dataLoss 
            ? `${deletedCount} créneaux supprimés mais l'insertion a échoué. Le planning est maintenant vide.`
            : `Le planning a été généré mais n'a pas pu être enregistré.`,
          userAction: dataLoss 
            ? '🚨 URGENT : Régénérez immédiatement le planning pour restaurer vos données.'
            : 'Réessayez. Si ça persiste, contactez le support avec le requestId.',
          requestId,
          details: [{
            entity: 'Database',
            field: 'atomicReplace',
            reason: replaceData.errorDetails || replaceData.error || 'Transaction failed',
            hint: dataLoss ? 'Re-generate schedule immediately - data was lost' : 'Retry schedule generation'
          }],
          meta: { 
            schoolId, 
            schedule_version_id,
            deletedCount,
            insertedCount,
            expectedInsertions: slotsToInsert.length,
            dataLoss,
            requestId
          }
        }, { status: 200 });
      }

      // Success - extract counts from atomic operation
      deletedCount = replaceData.deletedCount || 0;
      insertedCount = replaceData.insertedCount || 0;

      console.log(`[OptaPlannerPipeline] ✅ Atomic replace succeeded: deleted ${deletedCount}, inserted ${insertedCount}`);

      // Count core slots inserted (TOK/CAS/EE)
      const coreSlotsInsertedCount = {
        TOK: slotsToInsert.filter(s => s._subject_code === 'TOK').length,
        CAS: slotsToInsert.filter(s => s._subject_code === 'CAS').length,
        EE: slotsToInsert.filter(s => s._subject_code === 'EE').length
      };
      console.log(`[OptaPlannerPipeline] 📊 Core slots inserted:`, coreSlotsInsertedCount);

      // Update schedule version metadata
      await base44.entities.ScheduleVersion.update(schedule_version_id, {
        generated_at: new Date().toISOString(),
        score: solution.score || 0,
        conflicts_count: unassignedCount,
        warnings_count: 0
      });

    } catch (persistError) {
      console.error('[OptaPlannerPipeline] ❌ Persistence error:', persistError);

      return Response.json({
        ok: false,
        stage: 'PERSISTENCE_ERROR',
        code: 'FUNCTION_ERROR',
        severity: 'error',
        title: 'Échec d\'enregistrement',
        message: 'Le planning a été généré mais n\'a pas pu être enregistré.',
        userAction: 'Réessayez. Si ça persiste, contactez le support avec le requestId.',
        requestId,
        details: [{
          entity: 'Function',
          field: 'atomicReplaceScheduleSlots',
          reason: String(persistError?.message || persistError),
          hint: 'Check backend function logs and database connectivity'
        }],
        meta: { 
          schoolId, 
          schedule_version_id,
          requestId
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
      requestId,
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
        requestId
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
      code: 'PIPELINE_ERROR',
      severity: 'error',
      title: 'Erreur interne du pipeline',
      message: 'Une erreur inattendue s\'est produite pendant la génération.',
      userAction: 'Contactez le support avec l\'erreur : ' + String(error?.message || error).slice(0, 100),
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