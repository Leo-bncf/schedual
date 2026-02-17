import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calls OptaPlanner scheduling service and processes results
 * 
 * Sends clean schedule_problem_v1 payload
 * Receives schedule_solution_v1 response
 * Maps assignments back to Base44 entities (ScheduleSlot)
 */

// Helper: chunk array into batches
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// DEPLOYMENT TIMESTAMP: 2026-02-17T17:00:00Z
// WRAPPER for OptaPlanner scheduler with audit gating and enhanced error logging

Deno.serve(async (req) => {
  const RUNTIME_FINGERPRINT = "2026-02-17T17:00:00Z-OPTAPLANNER-RENAME"; // HARD RUNTIME IDENTIFIER
  const WRAPPER_BUILD_VERSION = '2026-02-17T17:00:00Z-OPTAPLANNER-RENAME';
  console.log("🔍 RUNTIME_FINGERPRINT", RUNTIME_FINGERPRINT);
  console.log(`[callOptaPlannerScheduler] 🚀 WRAPPER BUILD VERSION: ${WRAPPER_BUILD_VERSION}`);
  
  let stage = 'init';
  let schedule_version_id = null;
  let schoolId = null;
  
  try {
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    let requestedSchoolId = null;
    let scheduleVersionSchoolId = null;
    const whoami = user ? { userId: user.id, role: user.role, school_id: user.school_id || null } : null;

    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'NO_USER', guardFailureCode: 'NOT_AUTHENTICATED', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ error: 'Forbidden: user missing school_id', code: 'NO_SCHOOL_ON_USER', guardFailureCode: 'NO_SCHOOL_ON_USER', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }

    stage = 'parseRequest';
    const body = await req.json();
    schedule_version_id = body?.schedule_version_id;
    const auditOnly = body?.audit === true;
    const smokeTest = body?.smoke_test === true;
    const dpStudyWeekly = body?.dp_study_weekly ?? 6;
    const dpMinEndTime = body?.dp_min_end_time ?? '14:30';
    requestedSchoolId = body?.school_id || null;
    schoolId = requestedSchoolId || user.school_id;
    console.log(`[callOptaPlannerScheduler] ${stage}: schedule_version_id=${schedule_version_id}, school_id=${schoolId}, smoke_test=${smokeTest}`);
    try {
      if (schedule_version_id) {
        const sv = await base44.entities.ScheduleVersion.filter({ id: schedule_version_id });
        scheduleVersionSchoolId = sv?.[0]?.school_id || null;
      }
    } catch (_) {}
    if (requestedSchoolId && requestedSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: Cross-school access', guardFailureCode: 'CROSS_SCHOOL', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }

    if (!schedule_version_id) {
      return Response.json({ ok: false, stage, error: 'schedule_version_id required', meta: { schedule_version_id, schoolId } }, { status: 400 });
    }
    const errors = [];

    // CRITICAL: Fetch teaching groups FIRST (post-generation/sync) for stable IDs
    stage = 'fetchFreshTeachingGroups';
    console.log(`[callOptaPlannerScheduler] ${stage}: fetching fresh teaching groups for stable solver input`);
    
    const teachingGroupsFresh = await base44.entities.TeachingGroup.filter({ school_id: schoolId });
    console.log(`[callOptaPlannerScheduler] Fetched ${teachingGroupsFresh.length} teaching groups (post-generation/sync)`);
    
    // CRITICAL: BUILD demandByTG FIRST (before buildProblem call) - TDZ FIX
    stage = 'buildDemandByTG';
    const demandByTG = {};
    for (const tg of teachingGroupsFresh) {
      // Only schedule groups that should appear in timetable
      if (!tg.periods_per_week || tg.periods_per_week <= 0) {
        console.log(`[callOptaPlannerScheduler] Skipping TG ${tg.id} (${tg.name}): periods_per_week=${tg.periods_per_week}`);
        continue;
      }

      demandByTG[tg.id] = tg.periods_per_week;
    }

    console.log(`[callOptaPlannerScheduler] ✅ demandByTG constructed BEFORE buildProblem: ${Object.keys(demandByTG).length} teaching groups with explicit demand`);
    console.log(`[callOptaPlannerScheduler] demandByTG sample (first 10):`, Object.entries(demandByTG).slice(0, 10));
    
    // Diagnostic: Show groups without periods_per_week
    const groupsWithoutDemand = teachingGroupsFresh.filter(tg => !tg.periods_per_week || tg.periods_per_week <= 0);
    if (groupsWithoutDemand.length > 0) {
      console.warn(`[callOptaPlannerScheduler] ⚠️ Teaching groups WITHOUT periods_per_week: ${groupsWithoutDemand.length}/${teachingGroupsFresh.length}`);
      console.warn('[callOptaPlannerScheduler] Groups without demand (first 10):', groupsWithoutDemand.slice(0, 10).map(tg => ({
        id: tg.id,
        name: tg.name,
        periods_per_week: tg.periods_per_week,
        minutes_per_week: tg.minutes_per_week
      })));
    }
    
    stage = 'buildProblem';
    console.log(`[callOptaPlannerScheduler] ${stage}: calling buildSchedulingProblem with fresh TGs`);

    // Step 1: Build scheduling problem with FRESH teaching groups
    let buildResponse;
    try {
      buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
        schedule_version_id,
        school_id: schoolId,
        dp_study_weekly: dpStudyWeekly,
        dp_min_end_time: dpMinEndTime,
        teachingGroups: teachingGroupsFresh // CRITICAL: Pass fresh TGs to prevent stale data
      });
    } catch (buildError) {
      console.error(`[callOptaPlannerScheduler] ❌ buildSchedulingProblem invocation error:`, buildError);
      console.error('[callOptaPlannerScheduler] Error stack:', buildError?.stack);
      return Response.json({ 
        ok: false,
        stage: 'buildProblem',
        error: 'Failed to invoke buildSchedulingProblem',
        errorMessage: String(buildError?.message || buildError),
        errorStack: String(buildError?.stack || ''),
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }

    if (!buildResponse?.data?.success || buildResponse?.data?.ok === false) {
      console.error(`[callOptaPlannerScheduler] ❌ buildProblem failed:`, buildResponse?.data);
      return Response.json({ 
        ok: false,
        stage: buildResponse?.data?.stage || 'buildProblem',
        error: 'buildSchedulingProblem failed',
        errorMessage: buildResponse?.data?.errorMessage || buildResponse?.data?.error || 'Unknown error',
        errorStack: buildResponse?.data?.errorStack || '',
        buildError: buildResponse?.data || null,
        meta: { schedule_version_id, schoolId },
        counts: buildResponse?.data?.counts || null,
        samples: buildResponse?.data?.samples || null
      }, { status: 200 }); // Return 200 so UI can parse
    }

    const problem = buildResponse.data.problem;

    // CRITICAL VALIDATION 1: Block if timeslots empty
    if (!Array.isArray(problem?.timeslots) || problem.timeslots.length === 0) {
      console.error('[callOptaPlannerScheduler] ❌ CRITICAL: buildSchedulingProblem returned ZERO timeslots');
      return Response.json({
        ok: false,
        stage: 'VALIDATION_TIMESLOTS_EMPTY',
        error: 'Cannot run OptaPlanner with zero timeslots',
        errorMessage: 'buildSchedulingProblem generated 0 timeslots. This indicates invalid school configuration (day_start_time/day_end_time/period_duration_minutes). Fix school settings before generating schedule.',
        suggestion: 'Check Settings tab: ensure day_start_time < day_end_time and period_duration_minutes < (day_end_time - day_start_time)',
        meta: { schedule_version_id, schoolId },
        scheduleSettings: problem?.scheduleSettings || null
      }, { status: 200 });
    }

    console.log(`[callOptaPlannerScheduler] ✅ Timeslots validation passed: ${problem.timeslots.length} timeslots generated`);

    // CRITICAL VALIDATION 2: Check for duplicate timeslot IDs
    const timeslotIds = problem.timeslots.map(ts => ts.id);
    const uniqueTimeslotIds = new Set(timeslotIds);

    if (uniqueTimeslotIds.size !== timeslotIds.length) {
      console.error('[callOptaPlannerScheduler] ❌ CRITICAL: Duplicate timeslot IDs detected in problem payload');

      const duplicates = [];
      const seen = {};
      timeslotIds.forEach((id, idx) => {
        if (seen[id] === undefined) {
          seen[id] = idx;
        } else {
          duplicates.push({ id, firstIndex: seen[id], duplicateIndex: idx });
        }
      });

      return Response.json({
        ok: false,
        stage: 'VALIDATION_DUPLICATE_TIMESLOTS',
        error: 'Duplicate timeslot IDs in problem payload',
        errorMessage: `Found ${duplicates.length} duplicate timeslot ID(s). Each timeslot must have a unique ID.`,
        duplicates: duplicates.slice(0, 10),
        suggestion: 'This is a bug in buildSchedulingProblem. Timeslot IDs must be sequential and unique.',
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }

    console.log(`[callOptaPlannerScheduler] ✅ Timeslot uniqueness validated: ${uniqueTimeslotIds.size} unique IDs`);
    const expectedLessonsBySubject = (buildResponse.data?.stats?.expectedLessonsBySubject) || {};
    const expectedMinutesBySubject = (buildResponse.data?.stats?.expectedMinutesBySubject) || null;
    const problemLessonsCreated = (buildResponse.data?.stats?.lessonsCreatedBySubject) || {};
    const teachingGroupsDiagnostics = buildResponse.data?.teachingGroupsDiagnostics || [];
    const debugMinutesSourceByTG = buildResponse.data?.debugMinutesSourceByTG || {};
    const problemSummary = buildResponse.data?.problemSummary || null;
    
    // DIAGNOSTIC: Filter subjectRequirements for TOK/CAS/EE
    const coreCodesSet = new Set(['TOK', 'CAS', 'EE']);
    const coreSubjectRequirements = (problem?.subjectRequirements || [])
      .filter(r => {
        const subj = String(r.subject || '')
          .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        return coreCodesSet.has(subj);
      })
      .slice(0, 20); // First 20 for logging
    
    console.log('[callOptaPlannerScheduler] Core subject requirements (TOK/CAS/EE):', {
      count: coreSubjectRequirements.length,
      sample: coreSubjectRequirements.slice(0, 10)
    });
    const scheduleSettingsSent = {
      day_start_time: problem?.scheduleSettings?.dayStartTime || problem?.scheduleSettings?.schoolStartTime || null,
      day_end_time: problem?.scheduleSettings?.dayEndTime || null,
      period_duration_minutes: problem?.scheduleSettings?.periodDurationMinutes || null,
      days_of_week: problem?.scheduleSettings?.daysOfWeek || null,
      breaks: problem?.scheduleSettings?.breaks || [],
      min_periods_per_day: problem?.scheduleSettings?.minPeriodsPerDay || null,
      target_periods_per_day: problem?.scheduleSettings?.targetPeriodsPerDay || (buildResponse?.data?.stats?.dp_target_periods_per_day || null),
    };

    stage = 'validateProblem';
    console.log(`[callOptaPlannerScheduler] ${stage}: validating solver inputs`);
    
    // Step 2: Validate problem before calling OR-Tool
    const subjectsForSolver = Array.isArray(problem?.subjects) ? problem.subjects : [];
    const subjectRequirementsForSolver = Array.isArray(problem?.subjectRequirements) ? problem.subjectRequirements : [];

    // Validation 1: Check subject ID format (24-char hex for MongoDB ObjectId)
    const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ''));
    const subjectsInvalidIds = subjectsForSolver
      .filter(s => !isValidMongoId(s?.id))
      .map(s => ({ id: s?.id, code: s?.code, name: s?.name }));

    // Normalization helper (trim, collapse whitespace, _ ↔ space)
    const normalizeKey = (s) => {
      if (!s) return '';
      return String(s).trim().replace(/\s+/g, ' ').replace(/_/g, ' ').toUpperCase();
    };

    // Build normalized index: normalized string → original subject
    const normalizedSubjectsIndex = {};
    subjectsForSolver.forEach(s => {
      const normCode = normalizeKey(s?.code);
      const normName = normalizeKey(s?.name);
      if (normCode) normalizedSubjectsIndex[normCode] = s?.code || s?.name;
      if (normName) normalizedSubjectsIndex[normName] = s?.name || s?.code;
    });

    // Validation 2: Check subjectRequirements reference valid subject codes
    const validSubjectCodes = new Set(subjectsForSolver.map(s => s?.code).filter(Boolean));
    const validSubjectNames = new Set(subjectsForSolver.map(s => s?.name).filter(Boolean));
    const requirementsUnknownSubjects = subjectRequirementsForSolver
      .filter(r => {
        const subj = r?.subject;
        if (!subj) return true;
        // Check exact match first
        if (validSubjectCodes.has(subj) || validSubjectNames.has(subj)) return false;
        // Check normalized match
        const normSubj = normalizeKey(subj);
        return !normalizedSubjectsIndex[normSubj];
      })
      .map(r => ({ studentGroup: r?.studentGroup, subject: r?.subject, minutesPerWeek: r?.minutesPerWeek }));

    // Validation 3: Check minutesPerWeek > 0
    const requirementsInvalidMinutes = subjectRequirementsForSolver
      .filter(r => !(typeof r?.minutesPerWeek === 'number' && r.minutesPerWeek > 0))
      .map(r => ({ studentGroup: r?.studentGroup, subject: r?.subject, minutesPerWeek: r?.minutesPerWeek }));

    // Normalized requirements subjects (first 20)
    const normalizedRequirementsSubjects = subjectRequirementsForSolver
      .slice(0, 20)
      .map(r => ({ original: r?.subject, normalized: normalizeKey(r?.subject) }));

    console.log('[callOptaPlannerScheduler] subjects validation:', {
      isArray: Array.isArray(subjectsForSolver),
      type: typeof subjectsForSolver,
      length: subjectsForSolver.length,
      first5: subjectsForSolver.slice(0, 5),
      invalidIds: subjectsInvalidIds
    });
    console.log('[callOptaPlannerScheduler] subjectRequirements validation:', {
      isArray: Array.isArray(subjectRequirementsForSolver),
      length: subjectRequirementsForSolver.length,
      first10: subjectRequirementsForSolver.slice(0, 10),
      unknownSubjects: requirementsUnknownSubjects,
      invalidMinutes: requirementsInvalidMinutes
    });
    console.log('[callOptaPlannerScheduler] normalization:', {
      normalizedSubjectsIndex,
      normalizedRequirementsSubjects
    });

    if (subjectsForSolver.length === 0 || subjectRequirementsForSolver.length === 0) {
      const reason = subjectsForSolver.length === 0 ? 'subjects[] is empty' : 'subjectRequirements[] is empty';
      console.error('[callOptaPlannerScheduler] INVALID_INPUT:', reason);
      return Response.json({
        ok: false,
        error: 'INVALID_INPUT',
        message: `Invalid problem for solver: ${reason}. Fix data and retry.`,
        scheduleVersionIdInput: schedule_version_id,
        scheduleVersionIdUsed: schedule_version_id,
        orToolEndpointUsed: Deno.env.get('OR_TOOL_ENDPOINT') || null,
        orToolHttpStatus: null,
        orToolHealthStatus: null,
        orToolHealthOk: null,
        orToolRequestHeadersSent: { 'Content-Type': 'application/json', 'X-API-Key': '***' },
        orToolErrorBody: null,
        performedDeletion: false,
        performedInsertion: false,
        slotsDeleted: 0,
        slotsInserted: 0,
        orToolRequestPayloadSubjects: subjectsForSolver.slice(0, 5),
        orToolRequestPayloadSubjectRequirements: subjectRequirementsForSolver.slice(0, 10),
        subjectsInvalidIds: subjectsInvalidIds || [],
        requirementsUnknownSubjects: requirementsUnknownSubjects || [],
        requirementsInvalidMinutes: requirementsInvalidMinutes || [],
        normalizedSubjectsIndex: normalizedSubjectsIndex || {},
        normalizedRequirementsSubjects: normalizedRequirementsSubjects || []
      }, { status: 200 });
    }

    // Step 2.5: Fetch solver identity FIRST (log engine type before solving)
    stage = 'fetchSolverInfo';
    console.log(`[callOptaPlannerScheduler] ${stage}: identifying solver engine`);

    let solverIdentity = { engine: 'OptaPlanner', implementation: 'unknown', version: 'unknown' };
    try {
      const solverInfoRes = await base44.functions.invoke('getSolverInfo');
      if (solverInfoRes?.data?.success) {
        solverIdentity = {
          engine: solverInfoRes.data.engine || 'OptaPlanner',
          implementation: solverInfoRes.data.implementation || 'unknown',
          version: solverInfoRes.data.version || 'unknown',
          build_sha: solverInfoRes.data.build_sha || null
        };
        console.log('[callOptaPlannerScheduler] ✅ SOLVER IDENTITY:', JSON.stringify(solverIdentity));
        console.log(`[callOptaPlannerScheduler] 🔧 Engine: ${solverIdentity.engine}, Implementation: ${solverIdentity.implementation}`);
      }
    } catch (e) {
      console.warn('[callOptaPlannerScheduler] Failed to fetch solver info:', e.message);
    }
    
    // SMOKE TEST MODE: Minimal payload to validate VPS connectivity (EARLY EXIT)
    if (smokeTest) {
      console.log('[callOptaPlannerScheduler] 🧪 SMOKE TEST MODE: Sending minimal payload to validate solver');
      
      // Skip to solver call stage
      stage = 'callSolver';
      const SOLVER_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT') || Deno.env.get('SOLVER_ENDPOINT');
      const SOLVER_API_KEY = Deno.env.get('OR_TOOL_API_KEY') || Deno.env.get('SOLVER_API_KEY');
      
      if (!SOLVER_ENDPOINT || !SOLVER_API_KEY) {
        return Response.json({
          ok: false,
          smokeTest: true,
          error: 'Missing solver endpoint or API key',
          envCheck: {
            OR_TOOL_ENDPOINT: Deno.env.get('OR_TOOL_ENDPOINT') || null,
            SOLVER_ENDPOINT: Deno.env.get('SOLVER_ENDPOINT') || null,
            hasApiKey: !!(Deno.env.get('OR_TOOL_API_KEY') || Deno.env.get('SOLVER_API_KEY'))
          }
        }, { status: 200 });
      }
      
      const smokePayload = {
        schoolId: school_id,
        scheduleVersionId: schedule_version_id,
        rooms: [{ id: 1, name: "Room A", capacity: 30 }],
        teachers: [{ id: 1, name: "Teacher X" }],
        subjects: [{ id: "000000000000000000000001", code: "MATH", name: "Mathematics" }],
        lessons: [
          { id: 1, subject: "MATH", studentGroup: "TG_smoke1", requiredCapacity: 20, timeslotId: null, roomId: 1, teacherId: 1 },
          { id: 2, subject: "MATH", studentGroup: "TG_smoke1", requiredCapacity: 20, timeslotId: null, roomId: 1, teacherId: 1 },
          { id: 3, subject: "MATH", studentGroup: "TG_smoke1", requiredCapacity: 20, timeslotId: null, roomId: 1, teacherId: 1 },
          { id: 4, subject: "MATH", studentGroup: "TG_smoke1", requiredCapacity: 20, timeslotId: null, roomId: 1, teacherId: 1 },
          { id: 5, subject: "MATH", studentGroup: "TG_smoke1", requiredCapacity: 20, timeslotId: null, roomId: 1, teacherId: 1 }
        ],
        timeslots: [
          { id: 1, dayOfWeek: "MONDAY", startTime: "08:00", endTime: "09:00" },
          { id: 2, dayOfWeek: "MONDAY", startTime: "09:00", endTime: "10:00" },
          { id: 3, dayOfWeek: "MONDAY", startTime: "10:00", endTime: "11:00" },
          { id: 4, dayOfWeek: "MONDAY", startTime: "11:00", endTime: "12:00" },
          { id: 5, dayOfWeek: "MONDAY", startTime: "14:00", endTime: "15:00" }
        ],
        subjectRequirements: [
          { studentGroup: "TG_smoke1", subject: "MATH", minutesPerWeek: 300, requiredPeriods: 5 }
        ],
        demandByTG: { "smoke1": 5 },
        scheduleSettings: {
          periodDurationMinutes: 60,
          dayStartTime: "08:00",
          dayEndTime: "17:00",
          daysOfWeek: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
          breaks: [],
          minPeriodsPerDay: 5,
          targetPeriodsPerDay: 8
        },
        debug: true,
        strictDemand: true
      };
      
      console.log('[callOptaPlannerScheduler] 🧪 Smoke payload preview:', JSON.stringify(smokePayload).slice(0, 500));
      
      try {
        const smokeResponse = await fetch(SOLVER_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': SOLVER_API_KEY
          },
          body: JSON.stringify(smokePayload)
        });
        
        const smokeText = await smokeResponse.text();
        console.log('[callOptaPlannerScheduler] 🧪 Smoke response:', { status: smokeResponse.status, ok: smokeResponse.ok, preview: smokeText.slice(0, 500) });
        
        let smokeResult;
        try {
          smokeResult = JSON.parse(smokeText);
        } catch {
          smokeResult = { rawText: smokeText };
        }
        
        return Response.json({
          ok: smokeResponse.ok,
          smokeTest: true,
          solverHttpStatus: smokeResponse.status,
          solverResponse: smokeResult,
          endpointUsed: SOLVER_ENDPOINT,
          message: smokeResponse.ok ? '✅ Smoke test passed - solver is reachable' : '❌ Smoke test failed - check solver logs'
        });
      } catch (smokeError) {
        console.error('[callOptaPlannerScheduler] 🧪 Smoke test error:', smokeError);
        return Response.json({
          ok: false,
          smokeTest: true,
          error: String(smokeError.message || smokeError),
          errorStack: String(smokeError.stack || ''),
          endpointUsed: SOLVER_ENDPOINT,
          message: '❌ Smoke test failed - network/connection error'
        }, { status: 200 });
      }
    }
    
    // EARLY RETURN: If audit-only mode, return problem without calling solver
    if (auditOnly) {
      console.log('[callOptaPlannerScheduler] AUDIT MODE: Returning problem without solving');
      
      // Check if buildSchedulingProblem succeeded
      if (buildResponse?.data?.ok !== true) {
        console.error('[callOptaPlannerScheduler] ❌ buildSchedulingProblem failed during audit');
        return Response.json({
          ok: false,
          audit: true,
          stage: buildResponse?.data?.stage || 'buildProblem',
          error: buildResponse?.data?.error || 'buildSchedulingProblem failed',
          errorMessage: buildResponse?.data?.errorMessage || 'Unknown error',
          errorStack: buildResponse?.data?.errorStack || '',
          buildVersion: buildResponse?.data?.buildVersion || null,
          wrapperBuildVersion: WRAPPER_BUILD_VERSION,
          buildError: buildResponse?.data || null,
          meta: { schedule_version_id, schoolId }
        });
      }
      
      return Response.json({
        ok: true,
        audit: true,
        stage: 'audit_complete',
        buildVersion: buildResponse?.data?.buildVersion || null,
        wrapperBuildVersion: WRAPPER_BUILD_VERSION,
        problem,
        validationReport: buildResponse?.data?.validationReport || null,
        stats: buildResponse?.data?.stats || {},
        message: 'Audit passed - ready to solve'
      });
    }
    
    stage = 'callSolver';
    console.log(`[callOptaPlannerScheduler] ${stage}: preparing solver request (${solverIdentity.engine})`);

    // Step 3: Call solver service - CRITICAL DIAGNOSTICS
    const SOLVER_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT') || Deno.env.get('SOLVER_ENDPOINT');
    const SOLVER_API_KEY = Deno.env.get('OR_TOOL_API_KEY') || Deno.env.get('SOLVER_API_KEY');

    console.log('🔍 CRITICAL ENV CHECK:');
    console.log('  OR_TOOL_ENDPOINT =', Deno.env.get('OR_TOOL_ENDPOINT') || 'NOT_SET');
    console.log('  SOLVER_ENDPOINT =', Deno.env.get('SOLVER_ENDPOINT') || 'NOT_SET');
    console.log('  OR_TOOL_API_KEY =', Deno.env.get('OR_TOOL_API_KEY') ? '***SET***' : 'NOT_SET');
    console.log('  SOLVER_API_KEY =', Deno.env.get('SOLVER_API_KEY') ? '***SET***' : 'NOT_SET');
    console.log('  FINAL ENDPOINT USED:', SOLVER_ENDPOINT);
    console.log('[OR] endpointUsed =', SOLVER_ENDPOINT);
    const healthUrlForLog = SOLVER_ENDPOINT?.replace('/solve-and-push', '/health');
    console.log('[OR] healthUrl =', healthUrlForLog);

    // DIAGNOSTIC: Log timeslots distribution by day
    const timeslotsByDayCount = {};
    (problem?.timeslots || []).forEach(ts => {
      const day = ts.dayOfWeek || 'UNKNOWN';
      timeslotsByDayCount[day] = (timeslotsByDayCount[day] || 0) + 1;
    });

    const firstTimeslot = problem?.timeslots?.[0];
    const lastTimeslot = problem?.timeslots?.[problem?.timeslots?.length - 1];

    console.log('[OR] timeslots distribution:', {
      total: problem?.timeslots?.length || 0,
      byDay: timeslotsByDayCount,
      minStart: firstTimeslot?.startTime,
      maxEnd: lastTimeslot?.endTime,
      breaks: problem?.scheduleSettings?.breaks?.length || 0
    });

    if (!SOLVER_ENDPOINT) {
      console.error('[callOptaPlannerScheduler] ❌ Missing SOLVER_ENDPOINT');
      return Response.json({ 
        error: 'Solver endpoint missing: set OR_TOOL_ENDPOINT or SOLVER_ENDPOINT',
        envCheck: {
          OR_TOOL_ENDPOINT: Deno.env.get('OR_TOOL_ENDPOINT') || null,
          SOLVER_ENDPOINT: Deno.env.get('SOLVER_ENDPOINT') || null
        },
        solverIdentity
      }, { status: 503 });
    }
    if (!SOLVER_API_KEY) {
      console.error('[callOptaPlannerScheduler] ❌ Missing SOLVER_API_KEY');
      return Response.json({ 
        error: 'Solver API key missing: set OR_TOOL_API_KEY or SOLVER_API_KEY',
        solverIdentity
      }, { status: 503 });
    }

    const solverEndpointUsed = SOLVER_ENDPOINT;
    console.log(`[callOptaPlannerScheduler] ✅ Calling solver (${solverIdentity.engine}) at`, solverEndpointUsed, 'schedule_version_id =', schedule_version_id);

    // Diagnostics defaults + /health check (VPS returns text/plain "OK")
    let solverHttpStatus = null;
    let solverRequestHeadersSent = { 'Content-Type': 'application/json', 'X-API-Key': '***' };
    let solverHealthStatus = null;
    let solverHealthOk = null;
    try {
      const healthUrl = solverEndpointUsed.replace('/solve-and-push', '/health');
      console.log('[callOptaPlannerScheduler] Testing solver /health at:', healthUrl);
      const healthRes = await fetch(healthUrl, { method: 'GET' });
      solverHealthStatus = healthRes.status;
      solverHealthOk = healthRes.ok;
      // VPS returns text/plain "OK", not JSON
      const healthBody = await healthRes.text();
      console.log('[OR] health', { status: solverHealthStatus, ok: solverHealthOk, body: healthBody.slice(0, 50) });
    } catch (e) {
      console.warn('[callOptaPlannerScheduler] Solver /health check failed:', String(e?.message || e));
      console.error('[OR] health', { status: null, ok: false, error: String(e?.message || e) });
      solverHealthStatus = null;
      solverHealthOk = false;
    }

    let solverResponse;
    let solverResponseText = null;
    try {
      const maskApiKey = (k) => (k && k.length >= 6) ? `${k.slice(0,3)}***${k.slice(-3)}` : '***';
      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': SOLVER_API_KEY
      };
      solverRequestHeadersSent = { 'Content-Type': 'application/json', 'X-API-Key': maskApiKey(SOLVER_API_KEY) };

      // CRITICAL: Use demandByTG already constructed earlier (TDZ FIX - NO REDECLARATION)
      console.log('[callOptaPlannerScheduler] 🔒 HARD CONSTRAINT: using demandByTG from earlier:', {
        total_groups: Object.keys(demandByTG).length,
        total_periods_demanded: Object.values(demandByTG).reduce((sum, v) => sum + v, 0),
        sample: Object.entries(demandByTG).slice(0, 5)
      });

      // SOFT CONSTRAINTS: Enable default pack if no constraints configured
      stage = 'fetchConstraints';
      console.log(`[callOptaPlannerScheduler] ${stage}: checking for configured constraints`);
      
      let constraints = [];
      let useDefaultSoftConstraints = false;
      
      try {
        constraints = await base44.entities.Constraint.filter({ school_id: schoolId, is_active: true });
        console.log(`[callOptaPlannerScheduler] Found ${constraints.length} active constraints`);
        
        if (constraints.length === 0) {
          useDefaultSoftConstraints = true;
          console.log('[callOptaPlannerScheduler] 🎯 No constraints configured → enabling default soft constraints pack');
        }
      } catch (constraintError) {
        console.warn('[callOptaPlannerScheduler] Failed to fetch constraints:', constraintError);
        useDefaultSoftConstraints = true; // Fallback to defaults if fetch fails
      }
      
      const orToolPayload = {
        ...problem,
        schoolId: schoolId,
        scheduleVersionId: schedule_version_id,
        demandByTG: demandByTG, // CRITICAL: Explicit period demand per teaching group (SOURCE OF TRUTH)
        teachingGroupsMetadata: teachingGroupsFresh.map(tg => ({
          id: tg.id,
          name: tg.name,
          subject_id: tg.subject_id,
          level: tg.level || null,
          hours_per_week: tg.hours_per_week || null,
          minutes_per_week: tg.minutes_per_week || null,
          periods_per_week: tg.periods_per_week || 0,
          teacher_id: tg.teacher_id || null,
          preferred_room_id: tg.preferred_room_id || null
        })),
        constraints: constraints.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type, // hard/soft
          category: c.category,
          weight: c.weight || 1,
          rule: c.rule
        })),
        useDefaultSoftConstraints, // FLAG: Solver should apply default soft constraints if true
        debug: true, // Enable solver debug mode for detailed coverage metrics
        strictDemand: true // FLAG: Solver MUST respect demandByTG exactly
      };
      // Double assurance: force overwrite even if problem contained null/undefined
      orToolPayload.schoolId = schoolId;
      orToolPayload.scheduleVersionId = schedule_version_id;
      orToolPayload.demandByTG = demandByTG;
      orToolPayload.useDefaultSoftConstraints = useDefaultSoftConstraints;

      // CRITICAL: Log payload summary for debugging (verify HL/SL hours included)
      const hlSlHoursPresent = orToolPayload.subjects?.some(s => 
        s.hoursPerWeekByLevel && (s.hoursPerWeekByLevel.HL || s.hoursPerWeekByLevel.SL)
      );
      const hlSlOnTeachingGroups = orToolPayload.teachingGroups?.some(tg =>
        tg.hoursPerWeekHL || tg.hoursPerWeekSL
      );

      console.log('[callOptaPlannerScheduler] 📤 PAYLOAD SUMMARY (pre-solver):', {
        schoolId: schoolId,
        scheduleVersionId: schedule_version_id,
        subjects_count: orToolPayload.subjects?.length || 0,
        teachingGroups_count: orToolPayload.teachingGroups?.length || 0,
        lessons_count: orToolPayload.lessons?.length || 0,
        timeslots_count: orToolPayload.timeslots?.length || 0,
        rooms_count: orToolPayload.rooms?.length || 0,
        teachers_count: orToolPayload.teachers?.length || 0,
        subjectRequirements_count: orToolPayload.subjectRequirements?.length || 0,
        demandByTG_groups: Object.keys(demandByTG || {}).length,
        demandByTG_total_periods: Object.values(demandByTG || {}).reduce((sum, v) => sum + v, 0),
        constraints_count: orToolPayload.constraints?.length || 0,
        hlSlHoursPresent_on_subjects: hlSlHoursPresent,
        hlSlHoursPresent_on_teachingGroups: hlSlOnTeachingGroups,
        useDefaultSoftConstraints,
        strictDemand: true,
        debug: true
      });

      // Log sample subject with HL/SL hours to verify
      const sampleSubjectWithHours = orToolPayload.subjects?.find(s => s.hoursPerWeekByLevel);
      if (sampleSubjectWithHours) {
        console.log('[callOptaPlannerScheduler] 📋 Sample subject with HL/SL hours:', {
          code: sampleSubjectWithHours.code,
          name: sampleSubjectWithHours.name,
          hoursPerWeekByLevel: sampleSubjectWithHours.hoursPerWeekByLevel
        });
      } else {
        console.warn('[callOptaPlannerScheduler] ⚠️ No subjects with hoursPerWeekByLevel found in payload');
      }

      // Log sample teaching group with HL/SL hours
      const sampleTGWithHours = orToolPayload.teachingGroups?.find(tg => tg.hoursPerWeekHL || tg.hoursPerWeekSL);
      if (sampleTGWithHours) {
        console.log('[callOptaPlannerScheduler] 📋 Sample TG with HL/SL hours:', {
          id: sampleTGWithHours.id,
          subjectCode: sampleTGWithHours.subjectCode,
          level: sampleTGWithHours.level,
          hoursPerWeekHL: sampleTGWithHours.hoursPerWeekHL,
          hoursPerWeekSL: sampleTGWithHours.hoursPerWeekSL,
          minutesPerWeek: sampleTGWithHours.minutesPerWeek
        });
      } else {
        console.warn('[callOptaPlannerScheduler] ⚠️ No teaching groups with hoursPerWeekHL/SL found in payload');
      }
      
      console.log('[callOptaPlannerScheduler] Constraint configuration:', {
        active_constraints: constraints.length,
        useDefaultSoftConstraints,
        message: useDefaultSoftConstraints 
          ? '🎯 Using default soft constraints pack (variety, no repetitive patterns)' 
          : `✅ Using ${constraints.length} custom constraints`
      });

      // CRITICAL DIAGNOSTIC: Verify HL/SL hours are included in payload
      console.log('[callOptaPlannerScheduler] 🔍 HL/SL Hours Configuration Check:');
      const subjectsWithHours = (orToolPayload.subjects || []).filter(s => s.hoursPerWeekByLevel);
      const tgsWithHours = (orToolPayload.teachingGroups || []).filter(tg => tg.hoursPerWeekHL || tg.hoursPerWeekSL);

      console.log('[callOptaPlannerScheduler]   - Subjects with hoursPerWeekByLevel:', subjectsWithHours.length, '/', orToolPayload.subjects?.length || 0);
      console.log('[callOptaPlannerScheduler]   - TeachingGroups with HL/SL hours:', tgsWithHours.length, '/', orToolPayload.teachingGroups?.length || 0);

      if (subjectsWithHours.length > 0) {
        console.log('[callOptaPlannerScheduler]   ✅ Sample subject hours:', {
          code: subjectsWithHours[0].code,
          hoursPerWeekByLevel: subjectsWithHours[0].hoursPerWeekByLevel
        });
      } else {
        console.warn('[callOptaPlannerScheduler]   ⚠️ NO subjects have hoursPerWeekByLevel configured - solver will use defaults');
      }

      if (tgsWithHours.length > 0) {
        console.log('[callOptaPlannerScheduler]   ✅ Sample TG hours:', {
          id: tgsWithHours[0].id,
          subjectCode: tgsWithHours[0].subjectCode,
          level: tgsWithHours[0].level,
          hoursPerWeekHL: tgsWithHours[0].hoursPerWeekHL,
          hoursPerWeekSL: tgsWithHours[0].hoursPerWeekSL
        });
      }

      // CRITICAL: Validate payload completeness BEFORE sending to solver
      console.log("[OR] payload counts", {
        rooms: orToolPayload.rooms?.length,
        teachers: orToolPayload.teachers?.length,
        lessons: orToolPayload.lessons?.length,
        subjects: orToolPayload.subjects?.length,
        subjectRequirements: Array.isArray(orToolPayload.subjectRequirements) ? orToolPayload.subjectRequirements.length : null,
        scheduleSettings: !!orToolPayload.scheduleSettings,
        demandByTG_count: Object.keys(orToolPayload.demandByTG || {}).length
      });

      if (!orToolPayload.scheduleSettings) {
        throw new Error("payload missing scheduleSettings");
      }
      if (!Array.isArray(orToolPayload.rooms) || orToolPayload.rooms.length === 0) {
        throw new Error("payload missing rooms[]");
      }
      if (!Array.isArray(orToolPayload.teachers) || orToolPayload.teachers.length === 0) {
        throw new Error("payload missing teachers[]");
      }
      if (!Array.isArray(orToolPayload.lessons) || orToolPayload.lessons.length === 0) {
        throw new Error("payload missing lessons[]");
      }
      if (!Array.isArray(orToolPayload.subjects) || orToolPayload.subjects.length === 0) {
        throw new Error("payload missing subjects[]");
      }
      if (!Array.isArray(orToolPayload.subjectRequirements)) {
        throw new Error("payload subjectRequirements must be [] not null");
      }

      console.log("[OR] ✅ Payload validation passed - ready to send to solver");

      const payloadJson = JSON.stringify(orToolPayload);

      console.log('[callOptaPlannerScheduler] PRE-SEND VALIDATION:', {
        schoolId_var: schoolId,
        schoolId_type: typeof schoolId,
        schoolId_exists: !!schoolId,
        payload_schoolId: orToolPayload.schoolId,
        payload_schoolId_type: typeof orToolPayload.schoolId,
        payload_schoolId_exists: !!orToolPayload.schoolId,
        scheduleVersionId: schedule_version_id
      });

      console.log(`[callOptaPlannerScheduler] Sending to solver (${solverIdentity.engine}/${solverIdentity.implementation}):`, {
        endpoint: solverEndpointUsed,
        schoolId: schoolId,
        scheduleVersionId: schedule_version_id,
        payloadSchoolId: orToolPayload.schoolId,
        payloadScheduleVersionId: orToolPayload.scheduleVersionId,
        subjectsCount: problem?.subjects?.length || 0,
        requirementsCount: problem?.subjectRequirements?.length || 0,
        lessonsCount: problem?.lessons?.length || 0,
        timeslotsCount: problem?.timeslots?.length || 0
      });

      console.log('[Solver payload] schoolId=', orToolPayload.schoolId, 'scheduleVersionId=', orToolPayload.scheduleVersionId, 'keys=', Object.keys(orToolPayload).slice(0, 20));
      console.log('[Solver payload JSON preview]:', payloadJson.slice(0, 300));

      solverResponse = await fetch(solverEndpointUsed, {
        method: 'POST',
        headers: requestHeaders,
        body: payloadJson
      });
      solverHttpStatus = solverResponse.status;
      console.log('[callOptaPlannerScheduler] Solver HTTP status =', solverHttpStatus);

      // Read response body once
      solverResponseText = await solverResponse.text();
      console.log('[callOptaPlannerScheduler] Solver response preview:', solverResponseText?.slice(0, 500));
    } catch (e) {
      console.error('[callOptaPlannerScheduler] Solver network/fetch error:', e);
      console.error('[callOptaPlannerScheduler] Error stack:', e?.stack);
      return Response.json({
        ok: false,
        stage: 'callSolver',
        error: 'Network error calling solver',
        errorMessage: String(e?.message || e),
        errorStack: String(e?.stack || ''),
        solverIdentity,
        solverEndpointUsed,
        solverHttpStatus: null,
        solverErrorBody: String(e?.message || e),
        solverRequestHeadersSent,
        solverHealthStatus,
        solverHealthOk,
        scheduleVersionIdInput: schedule_version_id,
        scheduleVersionIdUsed: schedule_version_id,
        schoolIdSent: schoolId,
        performedDeletion: false,
        performedInsertion: false,
        slotsDeleted: 0,
        slotsInserted: 0,
        solverRequestPayload: {
          schoolId: schoolId,
          scheduleVersionId: schedule_version_id,
          scheduleSettings: scheduleSettingsSent,
          timeslots: {
            total: problem.timeslots?.length || 0,
            sample: (problem.timeslots || []).slice(0, 3)
          },
          rooms: {
            total: problem.rooms?.length || 0,
            sample: (problem.rooms || []).slice(0, 3)
          },
          teachers: {
            total: problem.teachers?.length || 0,
            sample: (problem.teachers || []).slice(0, 3)
          },
          subjects: {
            total: (problem?.subjects || []).length,
            all_codes: (problem?.subjects || []).map(s => s.code),
            sample: (problem?.subjects || []).slice(0, 10)
          },
          lessons: {
            total: problem.lessons?.length || 0,
            sample: (problem.lessons || []).slice(0, 10)
          },
          subjectRequirements: {
            total: (problem?.subjectRequirements || []).length,
            all: problem?.subjectRequirements || [],
            core_only: coreSubjectRequirements
          },
          demandByTG: {
            total_groups: Object.keys(demandByTG || {}).length,
            total_periods: Object.values(demandByTG || {}).reduce((sum, v) => sum + v, 0),
            sample: Object.entries(demandByTG || {}).slice(0, 10)
          },
          flags: {
            debug: true,
            strictDemand: true
          }
        }
      }, { status: 200 }); // Return 200 so UI can parse
    }

    if (!solverResponse.ok) {
      console.error(`[callOptaPlannerScheduler] Solver (${solverIdentity.engine}) returned error status:`, solverHttpStatus);
      console.error('[callOptaPlannerScheduler] Solver error body:', solverResponseText);

      // Try to parse as JSON, fallback to text
      let parsedError = null;
      try {
        parsedError = JSON.parse(solverResponseText);
      } catch {
        parsedError = { rawText: solverResponseText };
      }

      // Return 200 with ok:false so UI can parse JSON and show real solver status
      return Response.json({ 
        ok: false,
        stage: 'callSolver',
        error: 'Solver rejected the request',
        errorMessage: `Solver returned HTTP ${solverHttpStatus}`,
        solverIdentity,
        solverEndpointUsed,
        solverHttpStatus,
        solverErrorBody: solverResponseText,
        solverErrorParsed: parsedError,
        solverRequestHeadersSent,
        solverHealthStatus,
        solverHealthOk,
        scheduleVersionIdInput: schedule_version_id,
        scheduleVersionIdUsed: schedule_version_id,
        schoolIdSent: schoolId,
        payloadPreview: {
          schoolId: schoolId,
          scheduleVersionId: schedule_version_id,
          hasSubjects: !!(problem?.subjects?.length),
          hasRequirements: !!(problem?.subjectRequirements?.length)
        },
        performedDeletion: false,
        performedInsertion: false,
        slotsDeleted: 0,
        slotsInserted: 0,
        solverRequestPayload: {
          schoolId: schoolId,
          scheduleVersionId: schedule_version_id,
          scheduleSettings: scheduleSettingsSent,
          timeslots: {
            total: problem.timeslots?.length || 0,
            sample: (problem.timeslots || []).slice(0, 3)
          },
          rooms: {
            total: problem.rooms?.length || 0,
            sample: (problem.rooms || []).slice(0, 3)
          },
          teachers: {
            total: problem.teachers?.length || 0,
            sample: (problem.teachers || []).slice(0, 3)
          },
          subjects: {
            total: (problem?.subjects || []).length,
            all_codes: (problem?.subjects || []).map(s => s.code),
            sample: (problem?.subjects || []).slice(0, 10)
          },
          lessons: {
            total: problem.lessons?.length || 0,
            sample: (problem.lessons || []).slice(0, 10)
          },
          subjectRequirements: {
            total: (problem?.subjectRequirements || []).length,
            all: problem?.subjectRequirements || [],
            core_only: coreSubjectRequirements
          },
          demandByTG: {
            total_groups: Object.keys(demandByTG || {}).length,
            total_periods: Object.values(demandByTG || {}).reduce((sum, v) => sum + v, 0),
            sample: Object.entries(demandByTG || {}).slice(0, 10)
          },
          flags: {
            debug: true,
            strictDemand: true
          }
        },
        subjectsInvalidIds: subjectsInvalidIds || [],
        requirementsUnknownSubjects: requirementsUnknownSubjects || [],
        requirementsInvalidMinutes: requirementsInvalidMinutes || []
      }, { status: 200 }); // Always 200 so UI can parse, check ok:false + orToolHttpStatus
    }

    // Parse solution from response text
    let solution;
    try {
      solution = JSON.parse(solverResponseText);
    } catch (parseError) {
      console.error('[callOptaPlannerScheduler] Failed to parse solver response as JSON:', parseError);
      return Response.json({
        ok: false,
        stage: 'parseSolverResponse',
        error: 'Invalid JSON from solver',
        errorMessage: String(parseError?.message || parseError),
        errorStack: String(parseError?.stack || ''),
        solverIdentity,
        solverHttpStatus,
        solverErrorBody: solverResponseText?.slice(0, 1000),
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    console.log('[callOptaPlannerScheduler] solver score =', solution.score);
    
    // Log debug metrics if present
    if (solution.unknownTeachingGroupIdsInOutput) {
      console.log('[callOptaPlannerScheduler] 🔍 unknownTeachingGroupIdsInOutput:', solution.unknownTeachingGroupIdsInOutput);
    }
    if (solution.uniqueTeachingGroupIdsInOutput) {
      console.log('[callOptaPlannerScheduler] 🔍 uniqueTeachingGroupIdsInOutput:', solution.uniqueTeachingGroupIdsInOutput);
    }
    if (solution.periodCoverageByStudentGroupOrSection) {
      const coverage = solution.periodCoverageByStudentGroupOrSection;
      const coverageArray = Array.isArray(coverage) ? coverage : Object.values(coverage);
      console.log('[callOptaPlannerScheduler] 🔍 periodCoverage sample (first 10):', coverageArray.slice(0, 10));
      
      // Count sections with missing periods
      const sectionsMissingPeriods = coverageArray.filter(c => (c.missingPeriods || 0) > 0);
      console.log('[callOptaPlannerScheduler] ⚠️ Sections with missing periods:', sectionsMissingPeriods.length, '/', coverageArray.length);
      if (sectionsMissingPeriods.length > 0) {
        console.log('[callOptaPlannerScheduler] Missing periods sample:', sectionsMissingPeriods.slice(0, 5));
      }
    }
    
    // CRITICAL: Validate unknown teaching group IDs
    const unknownTGIds = solution.unknownTeachingGroupIdsInOutput || [];
    if (unknownTGIds.length > 0) {
      console.error(`[callOptaPlannerScheduler] ❌ CRITICAL: Solver returned ${unknownTGIds.length} unknown teaching_group_ids`);
      console.error('[callOptaPlannerScheduler] These IDs are in solver output but not in Base44:', unknownTGIds);
      
      return Response.json({
        ok: false,
        stage: 'UNKNOWN_TEACHING_GROUP_IDS',
        error: `Solver created ${unknownTGIds.length} teaching groups not in Base44`,
        errorMessage: 'Solver output contains teaching_group_ids that do not exist in Base44 database. This will cause student schedules to appear incomplete.',
        unknownTeachingGroupIds: unknownTGIds,
        suggestion: 'This indicates solver is creating new "shared" groups. Configure solver to use original teaching_group_ids for shared sessions, or ensure students are assigned to solver-created groups.',
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }

    // Step 3: Validate solution format (support lessons or legacy assignments)
    const solvedLessons = Array.isArray(solution.lessons)
      ? solution.lessons
      : (Array.isArray(solution.assignments) ? solution.assignments : null);
    if (!solvedLessons) {
      return Response.json({ 
        ok: false,
        error: 'Invalid solution format from solver (expected lessons[] or assignments[])',
        solution,
        solverIdentity,
        solverHttpStatus,
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    const assignmentsReturnedBySubject = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      assignmentsReturnedBySubject[subj] = (assignmentsReturnedBySubject[subj] || 0) + 1;
    }
    console.log('[callOptaPlannerScheduler] assignmentsReturnedBySubject =', assignmentsReturnedBySubject);
    const assignedBySubjectCode = {};
    const unassignedBySubjectCode = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (l.timeslotId) {
        assignedBySubjectCode[subj] = (assignedBySubjectCode[subj] || 0) + 1;
      } else {
        unassignedBySubjectCode[subj] = (unassignedBySubjectCode[subj] || 0) + 1;
      }
    }
    console.log('[callOptaPlannerScheduler] assignedBySubjectCode =', assignedBySubjectCode);
    console.log('[callOptaPlannerScheduler] unassignedBySubjectCode =', unassignedBySubjectCode);
    const coreKeys = ['TOK','CAS','EE'];
    const coreAssignmentSummary = {};
    for (const k of coreKeys) {
      coreAssignmentSummary[k] = {
        assigned: assignedBySubjectCode[k] || 0,
        unassigned: unassignedBySubjectCode[k] || 0,
        total: (assignedBySubjectCode[k] || 0) + (unassignedBySubjectCode[k] || 0)
      };
    }
    console.log('[callOptaPlannerScheduler] coreAssignmentSummary =', coreAssignmentSummary);

    // Step 4: Get Base44 entities to reverse-map IDs
    // CRITICAL: Reuse teachingGroupsFresh and demandByTG from earlier (consistency)
    const [subjects, rooms, teachers] = await Promise.all([
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.Room.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId })
    ]);

    const teachingGroups = teachingGroupsFresh; // Reuse fresh TGs for consistency
    // NOTE: demandByTG was already constructed before solver call and sent in payload

    // Use mappings provided by the problem payload (no DB index ordering)
    const subjectIdByCode = problem.subjectIdByCode || {};
    const numericToRoomId = problem.roomNumericIdToBase44Id || {};
    const numericToTeacherId = problem.teacherNumericIdToBase44Id || {};



    // Map timeslot ID → day/period
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const dayMapping = {
      'MONDAY': 'Monday',
      'TUESDAY': 'Tuesday',
      'WEDNESDAY': 'Wednesday',
      'THURSDAY': 'Thursday',
      'FRIDAY': 'Friday'
    };

    // Build per-day timeslot index for flexible days/periods
    const cfgDays = (problem.scheduleSettings && Array.isArray(problem.scheduleSettings.daysOfWeek) && problem.scheduleSettings.daysOfWeek.length)
      ? problem.scheduleSettings.daysOfWeek
      : days;
    const timeslotsByDay = {};
    cfgDays.forEach(d => {
      timeslotsByDay[d] = (problem.timeslots || [])
        .filter(t => t.dayOfWeek === d)
        .sort((a,b) => String(a.startTime||'').localeCompare(String(b.startTime||'')));
    });
    const timeslotIndexInDay = {};
    Object.values(timeslotsByDay).forEach(arr => {
      arr.forEach((t, i) => { timeslotIndexInDay[t.id] = i + 1; });
    });
    const periodsPerDayComputed = Math.max(0, ...Object.values(timeslotsByDay).map(arr => arr.length));
    
    // Performance optimization: Build timeslot lookup index (O(1) access vs O(n) find)
    const timeslotById = {};
    (problem.timeslots || []).forEach(ts => {
      timeslotById[ts.id] = ts;
    });

    // Core assignments (TOK/CAS/EE) with timeslotId + mapped day/period
    const periodsPerDay = periodsPerDayComputed;
    const coreAssignments = { TOK: [], CAS: [], EE: [] };
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (!['TOK','CAS','EE'].includes(subj)) continue;
      let day = null, period = null;
      if (l.timeslotId) {
        const ts = timeslotById[l.timeslotId] || null;
        if (ts) {
          day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
          period = timeslotIndexInDay[ts.id] || 1;
        }
      }
      coreAssignments[subj].push({
        subject: subj,
        studentGroup: l.studentGroup || null,
        timeslotId: l.timeslotId || null,
        day, period,
        teacherId: l.teacherId || null,
        roomId: l.roomId || null
      });
    }

    // After solve: compute max period used by day + last endTime actually used per day
    const maxPeriodUsedByDay = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    const endTimeUsedByDay = { Monday: null, Tuesday: null, Wednesday: null, Thursday: null, Friday: null };
    const periodsPerDayLocal = periodsPerDayComputed;
    for (const l of solvedLessons) {
      if (!l.timeslotId) continue;
      const ts = timeslotById[l.timeslotId];
      if (!ts) continue;
      const day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
      const period = timeslotIndexInDay[ts.id] || 1;
      if (maxPeriodUsedByDay[day] === undefined || period > maxPeriodUsedByDay[day]) {
        maxPeriodUsedByDay[day] = period;
        endTimeUsedByDay[day] = ts.endTime || null;
      }
    }
    console.log('[callOptaPlannerScheduler] maxPeriodUsedByDay =', maxPeriodUsedByDay);
    console.log('[callOptaPlannerScheduler] endTimeUsedByDay =', endTimeUsedByDay);

    // Build Problem Build/Input Summary
    const subjectKeySet = new Set(Object.keys(expectedLessonsBySubject || {}).concat(Object.keys(expectedMinutesBySubject || {})));
    const normalize = (s) => String(s||'').toUpperCase().replace(/\s+/g,'_').replace(/[^A-Z0-9_]/g,'');
    // Ensure common subjects
    ['TOK','CAS','EE','TEST','ENGLISH','FILM'].forEach(k => subjectKeySet.add(k));
    const minutesPerPeriod = scheduleSettingsSent.period_duration_minutes || 60;
    const inputSummaryBySubject = {};
    for (const code of subjectKeySet) {
      // Handle English and Film fuzzy matching
      const matchKey = (target) => {
        const candidates = Object.keys(expectedMinutesBySubject || {});
        const found = candidates.find(k => normalize(k).includes(target));
        return found ? normalize(found) : target;
      };
      const key = (code === 'ENGLISH') ? matchKey('ENGLISH') : (code === 'FILM' ? matchKey('FILM') : code);
      const minutes = (expectedMinutesBySubject && expectedMinutesBySubject[key]) || 0;
      const requiredPeriods = minutes ? Math.ceil(minutes / minutesPerPeriod) : 0;
      inputSummaryBySubject[code] = {
        minutes_per_week: minutes,
        requiredPeriods,
        expectedLessons: (expectedLessonsBySubject && expectedLessonsBySubject[key]) || 0,
        problemLessonsCreated: (problemLessonsCreated && problemLessonsCreated[key]) || 0
      };
    }

    // Detect core teaching groups (TOK/CAS/EE/TEST)
    const codeBySubjectId = {};
    Object.entries(subjectIdByCode || {}).forEach(([code, id]) => { codeBySubjectId[id] = code; });
    const coreSubjectsSet = new Set(['TOK','CAS','EE','TEST']);
    const coreTeachingGroupsDetected = (teachingGroups || []).filter(g => coreSubjectsSet.has(codeBySubjectId[g.subject_id] || ''))
      .map(g => ({
        id: g.id,
        subject_code: codeBySubjectId[g.subject_id] || null,
        minutes_per_week: typeof g.minutes_per_week === 'number' ? g.minutes_per_week : null,
        is_active: g.is_active !== false
      }));
    // Compute latest timeslot actually used and dominant cause for early stop
    const usedTimeslotIds = solvedLessons.filter(l => l.timeslotId).map(l => l.timeslotId);
    const maxUsedTimeslotId = usedTimeslotIds.length ? Math.max(...usedTimeslotIds) : null;
    const latestUsedTimeslot = maxUsedTimeslotId ? (timeslotById[maxUsedTimeslotId] || null) : null;
    const latestTimeslotAvailable = problem.timeslots[problem.timeslots.length - 1] || null;
    const periodsPerDayLocal2 = periodsPerDayComputed;
    const underfilled = !!(buildResponse?.data?.stats?.underfilled);
    const maxUsedPeriod = Math.max(...Object.values(maxPeriodUsedByDay || { Monday:0, Tuesday:0, Wednesday:0, Thursday:0, Friday:0 }));
    const dpTarget = (buildResponse?.data?.stats?.dp_target_periods_per_day) || null;
    let earlyStopCause = 'CONSTRAINT_PUSHING_EARLY';
    if (underfilled) {
      earlyStopCause = 'NOT_ENOUGH_LESSONS';
    } else if (dpTarget && dpTarget < (periodsPerDayLocal2 - 2)) {
      earlyStopCause = 'DP_TARGET_PERIODS_PER_DAY_TOO_LOW';
    } else if (maxUsedPeriod <= Math.ceil(periodsPerDayLocal2 / 2)) {
      earlyStopCause = 'FILTER_DROPPED_PM_SLOTS';
    }

    // Step 5a: Collect unassigned lessons for diagnostics
    const unassignedLessons = solvedLessons.filter(l => !l.timeslotId);
    const unassignedBySubject = {};
    for (const ul of unassignedLessons) {
      const code = ul.subject || 'UNKNOWN';
      if (!unassignedBySubject[code]) unassignedBySubject[code] = [];
      unassignedBySubject[code].push({ studentGroup: ul.studentGroup, requiredCapacity: ul.requiredCapacity });
    }
    
    console.log(`[callOptaPlannerScheduler] Unassigned lessons: ${unassignedLessons.length} / ${solvedLessons.length}`);
    console.log(`[callOptaPlannerScheduler] Unassigned by subject:`, Object.keys(unassignedBySubject).map(k => `${k}: ${unassignedBySubject[k].length}`).join(', '));
    
    // Step 5b: GUARD - if too many unassigned, abort without overwriting
    const unassignedThreshold = 0.3; // 30% unassigned = fail
    const unassignedRatio = unassignedLessons.length / Math.max(1, solvedLessons.length);
    
    if (unassignedRatio > unassignedThreshold) {
      console.error(`[callOptaPlannerScheduler] ABORT: ${(unassignedRatio*100).toFixed(1)}% lessons unassigned (threshold: ${(unassignedThreshold*100).toFixed(0)}%)`);
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      return Response.json({
        ok: false,
        status: 'generation_failed',
        error: 'Too many unassigned lessons - schedule generation aborted to prevent data loss',
        unassignedCount: unassignedLessons.length,
        totalLessons: solvedLessons.length,
        unassignedRatio: parseFloat((unassignedRatio * 100).toFixed(1)),
        unassignedBySubject,
        unassignedPreview: unassignedLessons.slice(0, 50).map(l => ({
          subject: l.subject,
          studentGroup: l.studentGroup,
          reason: !l.roomId && !allowNullRoomSubjects.has(l.subject) ? 'no_room' : 'no_timeslot'
        })),
        suggestion: 'Check: 1) enough rooms/timeslots, 2) teacher availability, 3) teaching group config (minutes_per_week vs period_duration_minutes)',
        problemSummary: problem ? {
          timeslots: problem.timeslots?.length || 0,
          rooms: problem.rooms?.length || 0,
          teachers: problem.teachers?.length || 0,
          totalLessons: problem.lessons?.length || 0,
          periodDurationMinutes: problem.scheduleSettings?.periodDurationMinutes || 60
        } : null
      }, { status: 200 });
    }
    
    // CRITICAL VALIDATION: Cohort Integrity Check
    // Ensures all lessons for the same studentGroup (section) are assigned to the SAME students
    // Detects split sections: same course appearing at different times for different students
    stage = 'validateCohortIntegrity';
    console.log(`[callOptaPlannerScheduler] ${stage}: validating cohort/section integrity`);
    
    const sectionCoverageMap = {}; // { studentGroup: { subject, timeslots: [ids], lessons_total, lessons_assigned } }
    
    for (const lesson of solvedLessons) {
      const sg = lesson.studentGroup;
      if (!sg) continue;
      
      if (!sectionCoverageMap[sg]) {
        sectionCoverageMap[sg] = {
          studentGroup: sg,
          subject: lesson.subject,
          timeslots: [],
          lessons_total: 0,
          lessons_assigned: 0
        };
      }
      
      sectionCoverageMap[sg].lessons_total++;
      
      if (lesson.timeslotId) {
        sectionCoverageMap[sg].lessons_assigned++;
        sectionCoverageMap[sg].timeslots.push(lesson.timeslotId);
      }
    }
    
    // Check for duplicate timeslot assignments within same section (impossible - would mean split section)
    const splitSections = [];
    const sectionCoverage = [];
    
    for (const [sg, data] of Object.entries(sectionCoverageMap)) {
      const uniqueTimeslots = new Set(data.timeslots);
      const hasDuplicates = uniqueTimeslots.size !== data.timeslots.length;
      
      if (hasDuplicates) {
        // CRITICAL: Same section scheduled multiple times at same timeslot = impossible
        console.error(`[callOptaPlannerScheduler] ❌ SPLIT SECTION DETECTED: ${sg} has duplicate timeslot assignments`);
        splitSections.push({
          studentGroup: sg,
          subject: data.subject,
          timeslots_total: data.timeslots.length,
          timeslots_unique: uniqueTimeslots.size,
          timeslots_list: data.timeslots,
          reason: 'Same timeslot assigned multiple times (physically impossible)'
        });
      }
      
      sectionCoverage.push({
        studentGroup: sg,
        subject: data.subject,
        expected_periods: data.lessons_total,
        assigned_periods: data.lessons_assigned,
        unassigned_periods: data.lessons_total - data.lessons_assigned,
        coverage_percent: data.lessons_total > 0 ? Math.round((data.lessons_assigned / data.lessons_total) * 100) : 0,
        timeslots_assigned: Array.from(uniqueTimeslots)
      });
    }
    
    console.log('[callOptaPlannerScheduler] Section Coverage Report:', {
      total_sections: sectionCoverage.length,
      fully_scheduled: sectionCoverage.filter(s => s.coverage_percent === 100).length,
      partially_scheduled: sectionCoverage.filter(s => s.coverage_percent > 0 && s.coverage_percent < 100).length,
      not_scheduled: sectionCoverage.filter(s => s.coverage_percent === 0).length,
      split_sections: splitSections.length
    });
    
    if (splitSections.length > 0) {
      console.error('[callOptaPlannerScheduler] ❌ COHORT INTEGRITY VIOLATION: Split sections detected');
      console.error('[callOptaPlannerScheduler] Split sections:', splitSections);
      
      return Response.json({
        ok: false,
        stage: 'COHORT_INTEGRITY_VIOLATION',
        error: `${splitSections.length} sections have duplicate timeslot assignments (same class scheduled multiple times at same time)`,
        splitSections,
        suggestion: 'This indicates a solver bug. Each section should have unique timeslots for each period.',
        meta: { schedule_version_id, schoolId }
      }, { status: 500 });
    }
    
    // FIX C: POST-SOLVE DEMAND VALIDATION (prevent under/over-scheduling)
    stage = 'validateDemandFulfillment';
    console.log(`[callOptaPlannerScheduler] ${stage}: HARD GATE - auditing solver output against demand`);
    console.log(`[callOptaPlannerScheduler] demandByTG keys:`, Object.keys(demandByTG).length);
    console.log(`[callOptaPlannerScheduler] demandByTG sample:`, Object.entries(demandByTG).slice(0, 5));

    const actualByTG = {};
    const debugActual = []; // Track first 10 lessons for debug

    for (const lesson of solvedLessons) {
      if (!lesson.timeslotId) continue; // Only count assigned lessons

      // Extract teaching_group_id from studentGroup (format: "TG_<id>")
      const tgId = (lesson.studentGroup && lesson.studentGroup.startsWith('TG_')) 
        ? lesson.studentGroup.slice(3) 
        : null;

      if (!tgId) {
        console.warn(`[callOptaPlannerScheduler] ⚠️ Lesson without valid teaching_group_id: ${lesson.studentGroup}`);
        continue;
      }

      // CRITICAL: Support both snake_case and camelCase for double period detection
      const isDouble = lesson.is_double_period === true || lesson.isDoublePeriod === true;
      const periodsToAdd = isDouble ? 2 : 1;
      actualByTG[tgId] = (actualByTG[tgId] || 0) + periodsToAdd;

      // Debug tracking
      if (debugActual.length < 10) {
        debugActual.push({
          tgId,
          studentGroup: lesson.studentGroup,
          subject: lesson.subject,
          timeslotId: lesson.timeslotId,
          isDouble,
          periodsAdded: periodsToAdd
        });
      }
    }

    console.log('[callOptaPlannerScheduler] actualByTG constructed:', Object.keys(actualByTG).length, 'teaching groups');
    console.log('[callOptaPlannerScheduler] actualByTG debug sample:', debugActual);
    
    console.log('[callOptaPlannerScheduler] actualByTG:', actualByTG);
    console.log('[callOptaPlannerScheduler] demandByTG:', demandByTG);
    
    const demandProblems = [];
    for (const tgId of Object.keys(demandByTG)) {
      const want = demandByTG[tgId];
      const got = actualByTG[tgId] || 0;
      
      if (got !== want) {
        const tg = teachingGroups.find(g => g.id === tgId);
        demandProblems.push({
          tgId,
          name: tg?.name || tgId,
          subject_id: tg?.subject_id || null,
          want,
          got,
          diff: got - want,
          status: got < want ? 'under-scheduled' : 'over-scheduled'
        });
      }
    }
    
    if (demandProblems.length > 0) {
      console.error('[callOptaPlannerScheduler] ❌❌❌ CRITICAL: DEMAND VALIDATION FAILURE - BLOCKING DB WRITE');
      console.error('[callOptaPlannerScheduler] Demand problems (showing all):', demandProblems);
      console.error('[callOptaPlannerScheduler] This schedule will NOT be written to database (protection against Film HL=2 bug)');

      // Enhanced diagnostics: show Film specifically if it's in the problems
      const filmProblems = demandProblems.filter(p => 
        p.name?.toLowerCase().includes('film') || 
        (teachingGroups.find(g => g.id === p.tgId)?.name?.toLowerCase().includes('film'))
      );
      if (filmProblems.length > 0) {
        console.error('[callOptaPlannerScheduler] 🎬 FILM SUBJECT DETECTED IN PROBLEMS:', filmProblems);
      }

      return Response.json({
        ok: false,
        stage: 'DEMAND_VALIDATION_FAILURE',
        error: `❌ HARD GATE: Solver output does not match required periods for ${demandProblems.length}/${Object.keys(demandByTG).length} teaching groups`,
        errorMessage: '🚫 The solver scheduled incorrect period counts. Database write BLOCKED to prevent corrupt schedules (e.g., Film HL with only 2 periods instead of 6).',
        demandProblems: demandProblems.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)), // Worst first
        demandSummary: {
          total_teaching_groups: Object.keys(demandByTG).length,
          mismatched: demandProblems.length,
          under_scheduled: demandProblems.filter(p => p.status === 'under-scheduled').length,
          over_scheduled: demandProblems.filter(p => p.status === 'over-scheduled').length,
          worst_deficit: demandProblems.reduce((min, p) => Math.min(min, p.diff), 0),
          worst_excess: demandProblems.reduce((max, p) => Math.max(max, p.diff), 0)
        },
        filmSpecificIssues: filmProblems.length > 0 ? filmProblems : null,
        debugInfo: {
          demandByTG_sample: Object.entries(demandByTG).slice(0, 10),
          actualByTG_sample: Object.entries(actualByTG).slice(0, 10),
          demandByTG_total: Object.values(demandByTG).reduce((sum, v) => sum + v, 0),
          actualByTG_total: Object.values(actualByTG).reduce((sum, v) => sum + v, 0)
        },
        suggestion: '🔧 Solver constraint bug detected. Required: model.Add(sum(x[tg, ts] for ts in timeslots) == demandByTG[tg]) for ALL teaching groups. Check solver logs for constraint violations.',
        performedDeletion: false,
        performedInsertion: false,
        slotsDeleted: 0,
        slotsInserted: 0,
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    
    console.log('[callOptaPlannerScheduler] ✅ Demand validation passed - all teaching groups scheduled correctly');
    
    // Step 5c: POST-SOLVE DOUBLE BOOKING VALIDATION (guardrail against solver regressions)
    stage = 'validateDoubleBooking';
    console.log(`[callOptaPlannerScheduler] ${stage}: checking for student double-booking conflicts`);
    
    const doubleBookings = [];
    const slotsByStudent = {}; // { studentId: { "day_period": [slots] } }
    
    for (const lesson of solvedLessons) {
      if (!lesson.timeslotId) continue; // Skip unassigned
      
      const timeslot = timeslotById[lesson.timeslotId];
      if (!timeslot) continue;
      
      const day = dayMapping[timeslot.dayOfWeek] || timeslot.dayOfWeek;
      const period = timeslotIndexInDay[timeslot.id] || 1;
      const cellKey = `${day}_${period}`;
      
      // Get students from this lesson
      const studentIds = Array.isArray(lesson.studentIds) ? lesson.studentIds : [];
      
      for (const studentId of studentIds) {
        if (!slotsByStudent[studentId]) slotsByStudent[studentId] = {};
        if (!slotsByStudent[studentId][cellKey]) slotsByStudent[studentId][cellKey] = [];
        
        slotsByStudent[studentId][cellKey].push({
          subject: lesson.subject,
          studentGroup: lesson.studentGroup,
          timeslotId: lesson.timeslotId,
          teacherId: lesson.teacherId,
          roomId: lesson.roomId
        });
      }
    }
    
    // Find conflicts (students with multiple lessons at same time)
    for (const [studentId, schedule] of Object.entries(slotsByStudent)) {
      for (const [cellKey, lessons] of Object.entries(schedule)) {
        if (lessons.length > 1) {
          doubleBookings.push({
            studentId,
            cellKey,
            count: lessons.length,
            lessons: lessons.map(l => ({
              subject: l.subject,
              studentGroup: l.studentGroup
            }))
          });
        }
      }
    }
    
    if (doubleBookings.length > 0) {
      console.error(`[callOptaPlannerScheduler] ❌ DOUBLE BOOKING DETECTED: ${doubleBookings.length} conflicts`);
      console.error('[callOptaPlannerScheduler] Double bookings:', doubleBookings.slice(0, 10));
      
      return Response.json({
        ok: false,
        stage: 'DOUBLE_BOOKING_VIOLATION',
        error: `${doubleBookings.length} students have multiple courses scheduled at the same time`,
        errorMessage: 'Solver created double bookings. This schedule cannot be saved.',
        doubleBookings: doubleBookings.slice(0, 50),
        summary: {
          total_conflicts: doubleBookings.length,
          affected_students: Object.keys(slotsByStudent).filter(sid => 
            Object.values(slotsByStudent[sid]).some(lessons => lessons.length > 1)
          ).length
        },
        suggestion: 'Solver bug: hard constraint violated. Check solver logs for constraint enforcement issues.',
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    
    console.log('[callOptaPlannerScheduler] ✅ Double booking validation passed - no conflicts detected');
    
    // Step 5d: Map OptaPlanner solution back to Base44 ScheduleSlot entities (assigned + unscheduled)
    // CRITICAL VALIDATION: Verify all lessons have valid TG_ format BEFORE mapping
    stage = 'validateStudentGroupFormat';
    console.log(`[callOptaPlannerScheduler] ${stage}: validating studentGroup format in solver output`);
    
    const invalidFormatLessons = solvedLessons.filter(l => {
      if (!l.timeslotId) return false; // Skip unassigned
      return l.studentGroup && !l.studentGroup.startsWith('TG_');
    });
    
    if (invalidFormatLessons.length > 0) {
      console.error(`[callOptaPlannerScheduler] ❌ INVALID STUDENTGROUP FORMAT: ${invalidFormatLessons.length} lessons have non-TG_ format`);
      console.error('[callOptaPlannerScheduler] Invalid format samples:', invalidFormatLessons.slice(0, 10).map(l => ({
        subject: l.subject,
        studentGroup: l.studentGroup,
        timeslotId: l.timeslotId
      })));
      
      return Response.json({
        ok: false,
        stage: 'INVALID_STUDENTGROUP_FORMAT',
        error: `${invalidFormatLessons.length} lessons have invalid studentGroup format (not TG_*)`,
        errorMessage: 'Solver returned lessons with studentGroup that do not match "TG_<teaching_group_id>" format. This will cause teaching_group_id to be NULL and students will lose their classes.',
        invalidSamples: invalidFormatLessons.slice(0, 20).map(l => ({
          subject: l.subject,
          studentGroup: l.studentGroup,
          timeslotId: l.timeslotId,
          expected_format: 'TG_<teaching_group_id>'
        })),
        suggestion: 'Configure solver to preserve original studentGroup format from input lessons. DO NOT create new studentGroup identifiers.',
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    
    console.log('[callOptaPlannerScheduler] ✅ All assigned lessons have valid TG_ format');
    
    const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
    const periods_per_day = periodsPerDayComputed; // derived from schedule settings
    let lessonsWithoutTimeslot = 0;
    let missingRoomCount = 0;
    let missingTeacherCount = 0;
    const slots = [];
    
    // DIAGNOSTIC: Track TG ID extraction for French/English
    const tgIdExtractionLog = [];
    
    for (const lesson of solvedLessons) {
      const isAssigned = !!lesson.timeslotId;
      
      if (!isAssigned) {
        lessonsWithoutTimeslot++;
        // Create unscheduled slot for visibility in UI
        const normalizedSubject = String(lesson.subject || lesson.subjectCode || '')
          .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        const subjectId = subjectIdByCode[normalizedSubject] || null;
        const teacherId = lesson.teacherId ? numericToTeacherId[lesson.teacherId] : null;
        const roomId = numericToRoomId[lesson.roomId] || null;
        const tgIdFromGroup = (lesson.studentGroup && lesson.studentGroup.startsWith('TG_')) ? lesson.studentGroup.slice(3) : null;
        
        slots.push({
          school_id: schoolId,
          schedule_version: schedule_version_id,
          teaching_group_id: tgIdFromGroup || null,
          subject_id: subjectId || null,
          teacher_id: teacherId,
          room_id: roomId,
          day: null,
          period: null,
          is_double_period: false,
          status: 'unscheduled',
          notes: `Unassigned: ${lesson.subject} - ${lesson.studentGroup}`
        });
        continue;
      }

      const timeslot = timeslotById[lesson.timeslotId];
      if (!timeslot) continue;

      const normalizedSubject = String(lesson.subject || lesson.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const subjectId = subjectIdByCode[normalizedSubject] || null;
      const teacherId = lesson.teacherId ? numericToTeacherId[lesson.teacherId] : null;
      const roomId = numericToRoomId[lesson.roomId] || null;
      
      // CRITICAL: Extract teaching_group_id from studentGroup (must be "TG_<id>" format)
      const tgIdFromGroup = (lesson.studentGroup && lesson.studentGroup.startsWith('TG_')) ? lesson.studentGroup.slice(3) : null;
      
      // DIAGNOSTIC: Track French/English TG extraction
      if (normalizedSubject.includes('FRENCH') || normalizedSubject.includes('ENGLISH') || normalizedSubject.includes('ANGLAIS')) {
        tgIdExtractionLog.push({
          subject: normalizedSubject,
          studentGroup: lesson.studentGroup,
          extracted_tg_id: tgIdFromGroup,
          timeslotId: lesson.timeslotId,
          day: dayMapping[timeslot.dayOfWeek],
          period: timeslotIndexInDay[timeslot.id]
        });
      }
      
      // Allow null room for STUDY and any DP core subject (based on is_core or well-known codes)
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      const isCore = (() => {
        const subjId = subjectId;
        const byFlag = subjId && subjects.some(s => s.id === subjId && s.is_core === true);
        return byFlag || allowNullRoomSubjects.has(normalizedSubject);
      })();
      if (!roomId) { missingRoomCount++; }
      if (!teacherId) { missingTeacherCount++; }
      
      // Calculate period from timeslot ID: ((id - 1) % periods_per_day) + 1
      const period = timeslotIndexInDay[timeslot.id] || 1;

      slots.push({
        school_id: schoolId,
        schedule_version: schedule_version_id,
        teaching_group_id: tgIdFromGroup || null,
        subject_id: subjectId || null,
        teacher_id: teacherId,
        room_id: roomId,
        timeslot_id: Number(lesson.timeslotId),
        day: dayMapping[timeslot.dayOfWeek] || timeslot.dayOfWeek,
        period: period,
        is_double_period: false,
        status: isAssigned ? 'scheduled' : 'unscheduled',
        notes: normalizedSubject === 'STUDY' ? 'Study / Free Period' : undefined
      });
    }

    // Log slots prepared by subject and sample core slots
    // codeBySubjectId already defined above
    const slotsPreparedBySubject = {};
    for (const s of slots) {
      const code = s.subject_id ? (codeBySubjectId[s.subject_id] || 'UNKNOWN') : (s.notes?.includes('Study') ? 'STUDY' : 'UNKNOWN');
      slotsPreparedBySubject[code] = (slotsPreparedBySubject[code] || 0) + 1;
    }
    console.log('[callOptaPlannerScheduler] slotsPreparedBySubject =', slotsPreparedBySubject);
    
    // DIAGNOSTIC: Log French/English TG extraction
    if (tgIdExtractionLog.length > 0) {
      console.log('[callOptaPlannerScheduler] 🔍 French/English TG extraction log:', tgIdExtractionLog);
    } else {
      console.warn('[callOptaPlannerScheduler] ⚠️ No French/English lessons found in solver output');
    }
    
    // DIAGNOSTIC: Analyze TG ID distribution in prepared slots
    const slotsByTGId = {};
    const slotsWithNullTG = slots.filter(s => !s.teaching_group_id);
    
    for (const slot of slots) {
      if (slot.teaching_group_id) {
        slotsByTGId[slot.teaching_group_id] = (slotsByTGId[slot.teaching_group_id] || 0) + 1;
      }
    }
    
    console.log('[callOptaPlannerScheduler] 🔍 TG ID distribution:', {
      unique_tg_ids: Object.keys(slotsByTGId).length,
      slots_with_null_tg: slotsWithNullTG.length,
      tg_id_counts_sample: Object.entries(slotsByTGId).slice(0, 10)
    });
    
    // DIAGNOSTIC: Check for unknown TG IDs (not in teachingGroupsFresh)
    const knownTGIds = new Set(teachingGroupsFresh.map(tg => tg.id));
    const slotsWithUnknownTG = slots.filter(s => s.teaching_group_id && !knownTGIds.has(s.teaching_group_id));
    
    if (slotsWithUnknownTG.length > 0) {
      console.error('[callOptaPlannerScheduler] ❌ Slots with unknown TG IDs:', slotsWithUnknownTG.length);
      console.error('[callOptaPlannerScheduler] Unknown TG ID samples:', slotsWithUnknownTG.slice(0, 5).map(s => ({
        teaching_group_id: s.teaching_group_id,
        subject_id: s.subject_id,
        day: s.day,
        period: s.period
      })));
    }

    // Test slots counters (solver-based). DP breakdown unavailable in solver payload; provide totals.
    const testSlotsInsertedCount = {
      DP1: 0,
      DP2: 0,
      total_from_solver: assignmentsReturnedBySubject['TEST'] || 0,
      prepared_for_insert: slotsPreparedBySubject['TEST'] || 0
    };

    // Counts by subject_id
    const slotsToInsertBySubjectId = {};
    for (const s of slots) {
      const key = s.subject_id || 'null';
      slotsToInsertBySubjectId[key] = (slotsToInsertBySubjectId[key] || 0) + 1;
    }
    console.log('[callOptaPlannerScheduler] slotsToInsertBySubjectId =', slotsToInsertBySubjectId);

    // Full JSON samples for TOK/CAS/EE
    const sampleTok = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TOK') || null;
    const sampleCas = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'CAS') || null;
    const sampleEe  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'EE')  || null;
    const sampleTest  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TEST')  || null;
    console.log('[callOptaPlannerScheduler] sampleSlot.TOK =', sampleTok);
    console.log('[callOptaPlannerScheduler] sampleSlot.CAS =', sampleCas);
    console.log('[callOptaPlannerScheduler] sampleSlot.EE  =', sampleEe);
    // Prepare core verification helpers
    let coreSlotsInsertedCount = { TOK: 0, CAS: 0, EE: 0 };
    let sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
    console.log('[callOptaPlannerScheduler] coreSlotsInsertedCount (init) =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);

    // Step 6.5: Inject STUDY slots into empty timeslots (post-solver, ONLY if solver succeeded)
    // CRITICAL: STUDY/TEST only injected when orToolHttpStatus === 200
    // Use timeslot_id as occupation key for break-awareness
    const allTimeslots = problem.timeslots || [];
    const occupiedSlots = new Set();
    slots.forEach(s => {
      if (s.timeslot_id) {
        occupiedSlots.add(Number(s.timeslot_id));
      }
    });

    const studySlots = [];
    const studySubject = subjects.find(s => s.code === 'STUDY' || s.name === 'STUDY');
    if (studySubject && orToolHttpStatus === 200) {
      // Only inject STUDY if solver succeeded
      for (const ts of allTimeslots) {
        const tsId = Number(ts.id);
        
        if (!occupiedSlots.has(tsId)) {
          const day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
          const period = timeslotIndexInDay[ts.id] || 1;
          
          studySlots.push({
            school_id: schoolId,
            schedule_version: schedule_version_id,
            teaching_group_id: null,
            subject_id: studySubject.id,
            teacher_id: null,
            room_id: null,
            timeslot_id: tsId,
            day,
            period,
            is_double_period: false,
            status: 'scheduled',
            notes: 'Study / Free Period'
          });
        }
      }
      console.log('[callOptaPlannerScheduler] Injected STUDY slots:', studySlots.length);
    }

    // Combine solver slots + STUDY slots
    const allSlots = [...slots, ...studySlots];

    stage = 'deleteOldSlots';
    console.log(`[callOptaPlannerScheduler] ${stage}: calling purgeScheduleSlots`);

    // Step 6: Delete existing slots using dedicated purge function (server-side, bypasses rate limits)
    let deletedCount = 0;
    try {
      const purgeResponse = await base44.functions.invoke('purgeScheduleSlots', {
        schedule_version_id
      });

      if (!purgeResponse?.data?.ok) {
        console.error('[callOptaPlannerScheduler] Purge failed:', purgeResponse?.data);
        return Response.json({
          ok: false,
          stage: 'deleteOldSlots',
          error: 'Failed to purge existing slots',
          purgeError: purgeResponse?.data?.error || 'Unknown error',
          suggestion: 'Server-side purge failed. Check purgeScheduleSlots function logs.',
          meta: { schedule_version_id, schoolId }
        }, { status: 200 });
      }

      deletedCount = purgeResponse.data.deletedCount || 0;
      const totalCount = purgeResponse.data.totalCount || 0;

      console.log(`[callOptaPlannerScheduler] Purge completed: ${deletedCount}/${totalCount} slots deleted`);

      if (!purgeResponse.data.success) {
        console.warn('[callOptaPlannerScheduler] Partial purge success:', purgeResponse.data);
        // Continue anyway if most slots deleted (90%+)
        const successRate = deletedCount / Math.max(1, totalCount);
        if (successRate < 0.9) {
          return Response.json({
            ok: false,
            stage: 'deleteOldSlots',
            error: `Partial purge: only ${deletedCount}/${totalCount} deleted (${(successRate*100).toFixed(1)}%)`,
            purgeErrors: purgeResponse.data.errors,
            suggestion: 'Most slots failed to delete. Wait 1 minute and retry.',
            meta: { schedule_version_id, schoolId }
          }, { status: 200 });
        }
      }
    } catch (purgeError) {
      console.error('[callOptaPlannerScheduler] Purge invocation error:', purgeError);
      return Response.json({
        ok: false,
        stage: 'deleteOldSlots',
        error: 'Failed to invoke purge function',
        errorMessage: purgeError.message || 'Unknown error',
        suggestion: 'Check that purgeScheduleSlots function exists and is deployed.',
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }

    stage = 'insertNewSlots';
    console.log(`[callOptaPlannerScheduler] ${stage}: inserting ${allSlots.length} new slots`);
    
    // Step 7: Create new slots
    let insertedCount = 0;
    let sampleSlotsInserted = null;
    let slotsInsertedBySubjectCode = {};
    
    if (allSlots.length > 0) {
      const inserted = await base44.entities.ScheduleSlot.bulkCreate(allSlots);
      const createdIds = Array.isArray(inserted) ? inserted.map(r => r.id) : null;
      insertedCount = Array.isArray(inserted) ? inserted.length : allSlots.length;
      
      // Count inserted slots by subject code
      if (Array.isArray(inserted)) {
        for (const slot of inserted) {
          const code = slot.subject_id ? (codeBySubjectId[slot.subject_id] || 'UNKNOWN') : 'UNKNOWN';
          slotsInsertedBySubjectCode[code] = (slotsInsertedBySubjectCode[code] || 0) + 1;
        }
      }
      
      console.log('[callOptaPlannerScheduler] insertedCount =', insertedCount);
      console.log('[callOptaPlannerScheduler] slotsInsertedBySubjectCode =', slotsInsertedBySubjectCode);
      console.log('[callOptaPlannerScheduler] insertedCountBySubject =', slotsPreparedBySubject);
      if (createdIds) {
        console.log('[callOptaPlannerScheduler] createdIds (first 20) =', createdIds.slice(0, 20));
      }
      // Build sampleSlotsInserted (5 max, ensure one core if exists)
      if (Array.isArray(inserted)) {
        const getCoreKey = (sid) => {
          const subj = subjects.find(s => s.id === sid);
          const label = String((subj?.code || subj?.name || '')).toUpperCase();
          if (label.includes('TOK') || label.includes('THEORY OF KNOWLEDGE')) return 'TOK';
          if (label.includes('CAS')) return 'CAS';
          if (label.includes('EXTENDED ESSAY') || label === 'EE' || label.includes(' EE')) return 'EE';
          return null;
        };
        const coreList = inserted.filter(s => s.subject_id && getCoreKey(s.subject_id));
        const nonCore = inserted.filter(s => !(s.subject_id && getCoreKey(s.subject_id)));
        sampleSlotsInserted = [...coreList.slice(0,1), ...nonCore.slice(0,4)];
        coreSlotsInsertedCount = { TOK: 0, CAS: 0, EE: 0 };
        inserted.forEach(s => {
          const k = s.subject_id ? getCoreKey(s.subject_id) : null;
          if (k) coreSlotsInsertedCount[k]++;
        });
        sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
        console.log('[callOptaPlannerScheduler] coreSlotsInsertedCount =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);
      } else {
        coreSlotsInsertedCount = {
          TOK: slotsPreparedBySubject['TOK'] || 0,
          CAS: slotsPreparedBySubject['CAS'] || 0,
          EE: slotsPreparedBySubject['EE'] || 0,
        };
        sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
        console.log('[callOptaPlannerScheduler] coreSlotsInsertedCount (from prepared) =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);
      }
    }

    // Step 8: Create conflict reports for unassigned lessons - BATCH CREATE
    console.log(`[callOptaPlannerScheduler] Creating ${unassignedLessons.length} conflict reports in batches`);
    if (unassignedLessons.length > 0) {
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      const conflictReports = unassignedLessons.map(lesson => ({
        school_id: user.school_id,
        schedule_version_id,
        conflict_type: 'insufficient_hours',
        severity: 'critical',
        description: `Lesson "${lesson.subject} - ${lesson.studentGroup}" could not be scheduled. No valid time slots found.`,
        affected_entities: {
          subject_code: lesson.subject,
          student_group: lesson.studentGroup
        },
        suggested_resolution: 'Try adding more rooms, adjusting teacher availability, or reducing required sessions.',
        status: 'unresolved'
      }));
      
      const conflictBatches = chunk(conflictReports, 25);
      for (const batch of conflictBatches) {
        try {
          await base44.entities.ConflictReport.bulkCreate(batch);
        } catch (e) {
          errors.push(`conflictBatch:${e?.message || 'error'}`);
        }
      }
    }

    // Step 9: Off-by-one mismatch check and warnings
            const offByOneIssues = {};
            for (const [code, exp] of Object.entries(expectedLessonsBySubject || {})) {
              const got = assignedBySubjectCode[code] || 0;
              if (got !== exp) {
                offByOneIssues[code] = { expected: exp, assigned: got, diff: got - exp };
              }
            }
            console.log('[callOptaPlannerScheduler] offByOneIssues =', offByOneIssues);
            let warningsCount = Object.keys(offByOneIssues).length;
            
            // Create warning conflict reports in batch
            if (warningsCount > 0) {
              const warningReports = Object.entries(offByOneIssues).map(([code, info]) => ({
                school_id: user.school_id,
                schedule_version_id,
                conflict_type: info.assigned < info.expected ? 'insufficient_hours' : 'ib_requirement_violation',
                severity: 'medium',
                description: `Subject ${code}: assigned ${info.assigned} vs expected ${info.expected} (diff ${info.diff >= 0 ? '+' : ''}${info.diff})`,
                affected_entities: { subject_code: code },
                status: 'unresolved'
              }));
              
              const warningBatches = chunk(warningReports, 25);
              for (const batch of warningBatches) {
                try {
                  await base44.entities.ConflictReport.bulkCreate(batch);
                } catch (e) {
                  errors.push(`warningBatch:${e?.message || 'error'}`);
                }
              }
            }
            // Step 9: Update schedule version metadata
            const scoreRaw = solution?.score;
            const scoreNum =
              typeof scoreRaw === 'number'
                ? scoreRaw
                : Number.parseFloat(String(scoreRaw ?? '').replace(',', '.'));

            try {
              await base44.entities.ScheduleVersion.update(schedule_version_id, {
                generated_at: new Date().toISOString(),
                score: Number.isFinite(scoreNum) ? scoreNum : 0,
                conflicts_count: Number(unassignedLessons?.length || 0),
                warnings_count: Number(warningsCount || 0),
              });
            } catch (e) {
              console.error('[callOptaPlannerScheduler] ScheduleVersion.update failed:', e?.message || e);
              errors.push(`scheduleVersionUpdate:${e?.message || e}`);
            }

    console.log('[callOptaPlannerScheduler] persistence diagnostics', { lessonsWithoutTimeslot, missingRoomCount, missingTeacherCount });
    const buildMeta = {
      schoolIdInput: requestedSchoolId,
      schoolIdUsed: schoolId,
      timeslotsCount: problem.timeslots.length,
      periodsPerDay: periodsPerDayComputed,
      lastTimeslot: problem.timeslots[problem.timeslots.length - 1] || null,
      dpTargetPeriodsPerDay: (buildResponse?.data?.stats?.dp_target_periods_per_day) || null,
      periodDurationMinutes: (problem?.scheduleSettings?.periodDurationMinutes) || null,
    };
    console.log('[callOptaPlannerScheduler] buildMeta =', buildMeta);

    const totalExpectedLessons = Object.values(expectedLessonsBySubject || {}).reduce((a,b)=>a+(b||0),0);
    const totalAssignedLessons = Object.values(assignedBySubjectCode || {}).reduce((a,b)=>a+(b||0),0);
    const totalUnassignedLessons = Object.values(unassignedBySubjectCode || {}).reduce((a,b)=>a+(b||0),0);
    const totalTimeslots = problem.timeslots.length;
    const periodsPerDayOut = periodsPerDayComputed;
    let underfillReason = earlyStopCause;
    if (totalExpectedLessons < totalTimeslots) {
      underfillReason = 'BUILDER_NOT_ENOUGH_LESSONS';
    } else if (totalUnassignedLessons > 0) {
      underfillReason = 'SOLVER_UNASSIGNED_LESSONS';
    }
    const isUnderfilled = totalAssignedLessons < totalTimeslots;

    return Response.json({
      success: true,
      ok: true,
      buildVersion: buildResponse?.data?.buildVersion || null,
      wrapperBuildVersion: WRAPPER_BUILD_VERSION,
      school_id: user.school_id,
      schedule_version_id,
      scheduleVersionIdInput: schedule_version_id,
      scheduleVersionIdUsed: schedule_version_id,
      solverIdentity,
      solverEndpointUsed,
      solverHttpStatus,
      solverErrorBody: null,
      solverRequestHeadersSent,
      solverHealthStatus,
      solverHealthOk,
      solverDebugMetrics: {
        unknownTeachingGroupIdsInOutput: solution.unknownTeachingGroupIdsInOutput || [],
        uniqueTeachingGroupIdsInOutput: solution.uniqueTeachingGroupIdsInOutput || [],
        periodCoverageBySection: solution.periodCoverageByStudentGroupOrSection || [],
        sectionsMissingPeriods: Array.isArray(solution.periodCoverageByStudentGroupOrSection) 
          ? solution.periodCoverageByStudentGroupOrSection.filter(c => (c.missingPeriods || 0) > 0).length
          : 0,
        missingPeriodsByReason: solution.missingPeriodsByReason || {},
        unmetRequirements: solution.unmetRequirements || []
      },
      subjectRequirements: problem.subjectRequirements || [],
      solverRequestPayload: {
        schoolId: schoolId,
        scheduleVersionId: schedule_version_id,
        scheduleSettings: scheduleSettingsSent,
        timeslots: {
          total: problem.timeslots?.length || 0,
          sample: (problem.timeslots || []).slice(0, 3)
        },
        rooms: {
          total: problem.rooms?.length || 0,
          sample: (problem.rooms || []).slice(0, 3)
        },
        teachers: {
          total: problem.teachers?.length || 0,
          sample: (problem.teachers || []).slice(0, 3)
        },
        subjects: {
          total: (problem?.subjects || []).length,
          all_codes: (problem?.subjects || []).map(s => s.code),
          sample: (problem?.subjects || []).slice(0, 10)
        },
        lessons: {
          total: problem.lessons?.length || 0,
          sample: (problem.lessons || []).slice(0, 10)
        },
        subjectRequirements: {
          total: (problem?.subjectRequirements || []).length,
          all: problem?.subjectRequirements || [],
          core_only: coreSubjectRequirements
        },
        demandByTG: {
          total_groups: Object.keys(demandByTG || {}).length,
          total_periods: Object.values(demandByTG || {}).reduce((sum, v) => sum + v, 0),
          sample: Object.entries(demandByTG || {}).slice(0, 10)
        },
        teachingGroupsMetadata: {
          total: teachingGroupsFresh?.length || 0,
          sample: (teachingGroupsFresh || []).slice(0, 5).map(tg => ({
            id: tg.id,
            name: tg.name,
            periods_per_week: tg.periods_per_week
          }))
        },
        flags: {
          debug: true,
          strictDemand: true
        }
      },
      expectedLessonsBySubject,
      assignedBySubjectCode,
      assignmentsBySubjectCode: assignedBySubjectCode,
      unassignedBySubjectCode,
      coreAssignments,
      maxPeriodUsedByDay,
      endTimeUsedByDay,
      timeslotsCount: problem.timeslots.length,
      lastTimeslotUsed: latestUsedTimeslot ? { dayOfWeek: latestUsedTimeslot.dayOfWeek, startTime: latestUsedTimeslot.startTime, endTime: latestUsedTimeslot.endTime, id: latestUsedTimeslot.id } : null,
      scheduleSettingsSent,
      expectedMinutesBySubject,
      assignedLessonsBySubject: assignedBySubjectCode,
      unassignedLessonsBySubject: unassignedBySubjectCode,
      sampleCoreSlots: { TOK: sampleTok, CAS: sampleCas, EE: sampleEe, TEST: sampleTest },
      underfill: {
        underfilled: isUnderfilled,
        totalExpectedLessons,
        totalAssignedLessons,
        totalTimeslots,
        periodsPerDay: periodsPerDayOut,
        reason: underfillReason,
        study: {
          assigned_in_solver: assignedBySubjectCode['STUDY'] || 0,
          total_from_solver: assignmentsReturnedBySubject['STUDY'] || 0,
          prepared_for_insert: slotsPreparedBySubject['STUDY'] || 0
        }
      },
      slotsToInsertBySubjectId,
      insertedCount,
      deletedCount: typeof deletedCount === 'number' ? deletedCount : 0,
      slotsInserted: insertedCount,
      slotsDeleted: typeof deletedCount === 'number' ? deletedCount : 0,
      performedInsertion: insertedCount > 0,
      performedDeletion: (typeof deletedCount === 'number' ? deletedCount : 0) > 0,
      errors,
      offByOneIssues,
      sampleSlotsInserted,
      coreSlotsInsertedCount,
      sampleCoreSlot,
      diagnostics: {
        lessonsWithoutTimeslot,
        missingRoomCount,
        missingTeacherCount,
      },
      cohortIntegrity: {
        total_sections: sectionCoverage.length,
        fully_scheduled: sectionCoverage.filter(s => s.coverage_percent === 100).length,
        partially_scheduled: sectionCoverage.filter(s => s.coverage_percent > 0 && s.coverage_percent < 100).length,
        not_scheduled: sectionCoverage.filter(s => s.coverage_percent === 0).length,
        split_sections: splitSections.length,
        sectionCoverageReport: sectionCoverage.slice(0, 100)
      },
      tgMappingDiagnostics: {
        unique_tg_ids_in_slots: Object.keys(slotsByTGId || {}).length,
        slots_with_null_tg: slotsWithNullTG?.length || 0,
        slots_with_unknown_tg: slotsWithUnknownTG?.length || 0,
        french_english_extraction: tgIdExtractionLog || [],
        tg_id_distribution_sample: Object.entries(slotsByTGId || {}).slice(0, 20)
      },
      buildMeta,
      problemLessonsCreated,
      solutionAssignmentsReturned: assignmentsReturnedBySubject,
      slotsPreparedForInsert: slotsPreparedBySubject,
      testSlotsInsertedCount,
      slotsInsertedBySubjectCode,
      solverRequestPayloadSubjects: (problem?.subjects || []).slice(0, 5),
      solverRequestPayloadSubjectRequirements: (problem?.subjectRequirements || []).slice(0, 10),
      subjectsInvalidIds: subjectsInvalidIds || [],
      requirementsUnknownSubjects: requirementsUnknownSubjects || [],
      requirementsInvalidMinutes: requirementsInvalidMinutes || [],
      normalizedSubjectsIndex: normalizedSubjectsIndex || {},
      normalizedRequirementsSubjects: normalizedRequirementsSubjects || [],
      coreSubjectRequirementsSample: coreSubjectRequirements,
      whyStopsEarly: {
        latestTimeslotAvailable: latestTimeslotAvailable ? { dayOfWeek: latestTimeslotAvailable.dayOfWeek, endTime: latestTimeslotAvailable.endTime } : null,
        latestTimeslotActuallyUsed: latestUsedTimeslot ? { dayOfWeek: latestUsedTimeslot.dayOfWeek, endTime: latestUsedTimeslot.endTime } : null,
        cause: earlyStopCause
      },
      message: 'Schedule generated successfully',
      stats: {
        slots_created: slots.length,
        unassigned_lessons: unassignedLessons.length,
        score: solution.score || 0
      },
      unassignedSummary: {
        count: unassignedLessons.length,
        total: solvedLessons.length,
        ratio: parseFloat((unassignedLessons.length / Math.max(1, solvedLessons.length) * 100).toFixed(1)),
        bySubject: unassignedBySubject,
        preview: unassignedLessons.slice(0, 20).map(l => ({
          subject: l.subject,
          studentGroup: l.studentGroup,
          reason: !l.roomId && !allowNullRoomSubjects.has(l.subject) ? 'no_room' : 'no_timeslot'
        }))
      },
      inputSummaryBySubject,
      coreTeachingGroupsDetected,
      buildDiagnostics: {
        teachingGroupsDiagnostics,
        debugMinutesSourceByTG,
        problemSummary
      },
      timeslots: problem.timeslots || [],
      dayMapping,
      timeslotIndexInDay
      });

  } catch (error) {
    console.error(`[callOptaPlannerScheduler] ❌❌❌ FATAL ERROR at stage="${stage}":`, error);
    console.error(`[callOptaPlannerScheduler] Error message:`, error?.message);
    console.error(`[callOptaPlannerScheduler] Error name:`, error?.name);
    console.error(`[callOptaPlannerScheduler] Error stack (FULL):`, error?.stack);
    console.error(`[callOptaPlannerScheduler] Context:`, {
      schedule_version_id,
      schoolId,
      stage,
      timestamp: new Date().toISOString()
    });
    
    // Map internal stages to user-friendly stages
    const publicStage = (() => {
      if (stage.includes('audit') || stage.includes('validate')) return 'pre_solve_audit';
      if (stage.includes('build') || stage.includes('Problem')) return 'build_problem';
      if (stage.includes('Solver') || stage.includes('call')) return 'solver_call';
      if (stage.includes('insert') || stage.includes('delete') || stage.includes('Slots')) return 'insert_slots';
      return stage; // Keep original if not mapped
    })();
    
    return Response.json({ 
      success: false,
      ok: false,
      stage: publicStage,
      internalStage: stage,
      error: String(error?.message || error),
      errorName: error?.name || 'Error',
      errorMessage: String(error?.message || error),
      errorStack: String(error?.stack || ''),
      errorCause: error?.cause ? String(error.cause) : null,
      details: {
        errorStack: String(error?.stack || ''),
        schedule_version_id,
        schoolId,
        wrapperBuildVersion: WRAPPER_BUILD_VERSION,
        timestamp: new Date().toISOString()
      }
    }, { status: 200 }); // Return 200 with success:false for UI parsing
  }
});