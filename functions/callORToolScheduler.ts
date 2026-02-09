import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calls OR-Tool scheduling service and processes results
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

Deno.serve(async (req) => {
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
    const dpStudyWeekly = body?.dp_study_weekly ?? 6;
    const dpMinEndTime = body?.dp_min_end_time ?? '14:30';
    requestedSchoolId = body?.school_id || null;
    schoolId = requestedSchoolId || user.school_id;
    console.log(`[callORToolScheduler] ${stage}: schedule_version_id=${schedule_version_id}, school_id=${schoolId}`);
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

    stage = 'buildProblem';
    console.log(`[callORToolScheduler] ${stage}: calling buildSchedulingProblem`);
    
    // Step 1: Build scheduling problem
    let buildResponse;
    try {
      buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
        schedule_version_id,
        school_id: schoolId,
        dp_study_weekly: dpStudyWeekly,
        dp_min_end_time: dpMinEndTime
      });
    } catch (buildError) {
      console.error(`[callORToolScheduler] buildSchedulingProblem invocation error:`, buildError);
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
      console.error(`[callORToolScheduler] buildProblem failed:`, buildResponse?.data);
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
    const expectedLessonsBySubject = (buildResponse.data?.stats?.expectedLessonsBySubject) || {};
    const expectedMinutesBySubject = (buildResponse.data?.stats?.expectedMinutesBySubject) || null;
    const problemLessonsCreated = (buildResponse.data?.stats?.lessonsCreatedBySubject) || {};
    
    // DIAGNOSTIC: Filter subjectRequirements for TOK/CAS/EE
    const coreCodesSet = new Set(['TOK', 'CAS', 'EE']);
    const coreSubjectRequirements = (problem?.subjectRequirements || [])
      .filter(r => {
        const subj = String(r.subject || '')
          .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        return coreCodesSet.has(subj);
      })
      .slice(0, 20); // First 20 for logging
    
    console.log('[callORToolScheduler] Core subject requirements (TOK/CAS/EE):', {
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
    console.log(`[callORToolScheduler] ${stage}: validating solver inputs`);
    
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

    console.log('[callORToolScheduler] subjects validation:', {
      isArray: Array.isArray(subjectsForSolver),
      type: typeof subjectsForSolver,
      length: subjectsForSolver.length,
      first5: subjectsForSolver.slice(0, 5),
      invalidIds: subjectsInvalidIds
    });
    console.log('[callORToolScheduler] subjectRequirements validation:', {
      isArray: Array.isArray(subjectRequirementsForSolver),
      length: subjectRequirementsForSolver.length,
      first10: subjectRequirementsForSolver.slice(0, 10),
      unknownSubjects: requirementsUnknownSubjects,
      invalidMinutes: requirementsInvalidMinutes
    });
    console.log('[callORToolScheduler] normalization:', {
      normalizedSubjectsIndex,
      normalizedRequirementsSubjects
    });

    if (subjectsForSolver.length === 0 || subjectRequirementsForSolver.length === 0) {
      const reason = subjectsForSolver.length === 0 ? 'subjects[] is empty' : 'subjectRequirements[] is empty';
      console.error('[callORToolScheduler] INVALID_INPUT:', reason);
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

    stage = 'callORTool';
    console.log(`[callORToolScheduler] ${stage}: preparing OR-Tool request`);
    
    // Step 3: Call OR-Tool service
    const OR_TOOL_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT');
    const OR_TOOL_API_KEY = Deno.env.get('OR_TOOL_API_KEY');

    if (!OR_TOOL_ENDPOINT) {
      console.error('[callORToolScheduler] Missing OR_TOOL_ENDPOINT');
      return Response.json({ 
        error: 'OR-Tool endpoint missing: set OR_TOOL_ENDPOINT to http://87.106.27.27:8080/solve-and-push'
      }, { status: 503 });
    }
    if (!OR_TOOL_API_KEY) {
      console.error('[callORToolScheduler] Missing OR_TOOL_API_KEY');
      return Response.json({ 
        error: 'OR-Tool API key missing: set OR_TOOL_API_KEY'
      }, { status: 503 });
    }

    const REQUIRED_OR_TOOL_ENDPOINT = 'http://87.106.27.27:8080/solve-and-push';
    if (OR_TOOL_ENDPOINT !== REQUIRED_OR_TOOL_ENDPOINT) {
      console.error('[callORToolScheduler] OR_TOOL_ENDPOINT mismatch', { configured: OR_TOOL_ENDPOINT, required: REQUIRED_OR_TOOL_ENDPOINT });
      return Response.json({ 
        error: 'OR-Tool endpoint misconfigured',
        orToolEndpointConfigured: OR_TOOL_ENDPOINT,
        required: REQUIRED_OR_TOOL_ENDPOINT
      }, { status: 503 });
    }

    const orToolEndpointUsed = OR_TOOL_ENDPOINT;
    console.log('[callORToolScheduler] Calling OR-Tool at', orToolEndpointUsed, 'schedule_version_id =', schedule_version_id);

    // Diagnostics defaults + /health check
    let orToolHttpStatus = null;
    let orToolRequestHeadersSent = { 'Content-Type': 'application/json', 'X-API-Key': '***' };
    let orToolHealthStatus = null;
    let orToolHealthOk = null;
    try {
      const healthUrl = orToolEndpointUsed.replace('/solve-and-push', '/health');
      const healthRes = await fetch(healthUrl, { method: 'GET' });
      orToolHealthStatus = healthRes.status;
      orToolHealthOk = healthRes.ok;
      console.log('[callORToolScheduler] OR-Tool /health status =', orToolHealthStatus);
    } catch (e) {
      console.warn('[callORToolScheduler] OR-Tool /health check failed:', String(e?.message || e));
      orToolHealthStatus = null;
      orToolHealthOk = false;
    }

    let solverResponse;
    let solverResponseText = null;
    try {
      const maskApiKey = (k) => (k && k.length >= 6) ? `${k.slice(0,3)}***${k.slice(-3)}` : '***';
      const requestHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': OR_TOOL_API_KEY
      };
      orToolRequestHeadersSent = { 'Content-Type': 'application/json', 'X-API-Key': maskApiKey(OR_TOOL_API_KEY) };
      // OR-Tool expects top-level schoolId + scheduleVersionId + problem data
      // Spread problem first, then overwrite to prevent null/undefined from problem overwriting our values
      const orToolPayload = {
        ...problem,
        schoolId: schoolId,
        scheduleVersionId: schedule_version_id
      };
      // Double assurance: force overwrite even if problem contained null/undefined
      orToolPayload.schoolId = schoolId;
      orToolPayload.scheduleVersionId = schedule_version_id;
      const payloadJson = JSON.stringify(orToolPayload);

      console.log('[callORToolScheduler] PRE-SEND VALIDATION:', {
        schoolId_var: schoolId,
        schoolId_type: typeof schoolId,
        schoolId_exists: !!schoolId,
        payload_schoolId: orToolPayload.schoolId,
        payload_schoolId_type: typeof orToolPayload.schoolId,
        payload_schoolId_exists: !!orToolPayload.schoolId,
        scheduleVersionId: schedule_version_id
      });

      console.log('[callORToolScheduler] Sending to OR-Tool:', {
        endpoint: orToolEndpointUsed,
        schoolId: schoolId,
        scheduleVersionId: schedule_version_id,
        payloadSchoolId: orToolPayload.schoolId,
        payloadScheduleVersionId: orToolPayload.scheduleVersionId,
        subjectsCount: problem?.subjects?.length || 0,
        requirementsCount: problem?.subjectRequirements?.length || 0,
        lessonsCount: problem?.lessons?.length || 0,
        timeslotsCount: problem?.timeslots?.length || 0
      });

      console.log('[OR-Tool payload] schoolId=', orToolPayload.schoolId, 'scheduleVersionId=', orToolPayload.scheduleVersionId, 'keys=', Object.keys(orToolPayload).slice(0, 20));
      console.log('[OR-Tool payload JSON preview]:', payloadJson.slice(0, 300));

      solverResponse = await fetch(orToolEndpointUsed, {
        method: 'POST',
        headers: requestHeaders,
        body: payloadJson
      });
      orToolHttpStatus = solverResponse.status;
      console.log('[callORToolScheduler] OR-Tool HTTP status =', orToolHttpStatus);

      // Read response body once
      solverResponseText = await solverResponse.text();
      console.log('[callORToolScheduler] OR-Tool response preview:', solverResponseText?.slice(0, 500));
    } catch (e) {
      console.error('[callORToolScheduler] OR-Tool network/fetch error:', e);
      console.error('[callORToolScheduler] Error stack:', e?.stack);
      return Response.json({
        ok: false,
        stage: 'callORTool',
        error: 'Network error calling OR-Tool',
        errorMessage: String(e?.message || e),
        errorStack: String(e?.stack || ''),
        orToolEndpointUsed,
        orToolHttpStatus: null,
        orToolErrorBody: String(e?.message || e),
        orToolRequestHeadersSent,
        orToolHealthStatus,
        orToolHealthOk,
        scheduleVersionIdInput: schedule_version_id,
        scheduleVersionIdUsed: schedule_version_id,
        schoolIdSent: schoolId,
        performedDeletion: false,
        performedInsertion: false,
        slotsDeleted: 0,
        slotsInserted: 0,
        orToolRequestPayload: {
          schoolId: schoolId,
          scheduleVersionId: schedule_version_id,
          subjects: (problem?.subjects || []).slice(0, 5),
          subjectRequirements: (problem?.subjectRequirements || []).slice(0, 10),
          lessonsCount: problem?.lessons?.length || 0,
          timeslotsCount: problem?.timeslots?.length || 0
        }
      }, { status: 200 }); // Return 200 so UI can parse
    }

    if (!solverResponse.ok) {
      console.error('[callORToolScheduler] OR-Tool returned error status:', orToolHttpStatus);
      console.error('[callORToolScheduler] OR-Tool error body:', solverResponseText);

      // Try to parse as JSON, fallback to text
      let parsedError = null;
      try {
        parsedError = JSON.parse(solverResponseText);
      } catch {
        parsedError = { rawText: solverResponseText };
      }

      // Return 200 with ok:false so UI can parse JSON and show real OR-Tool status
      return Response.json({ 
        ok: false,
        stage: 'callORTool',
        error: 'OR-Tool rejected the request',
        errorMessage: `OR-Tool returned HTTP ${orToolHttpStatus}`,
        orToolEndpointUsed,
        orToolHttpStatus,
        orToolErrorBody: solverResponseText,
        orToolErrorParsed: parsedError,
        orToolRequestHeadersSent,
        orToolHealthStatus,
        orToolHealthOk,
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
        orToolRequestPayload: {
          schoolId: schoolId,
          scheduleVersionId: schedule_version_id,
          scheduleSettings: scheduleSettingsSent,
          subjects: (problem?.subjects || []).slice(0, 5),
          subjectRequirements: coreSubjectRequirements.length > 0 
            ? coreSubjectRequirements 
            : (problem?.subjectRequirements || []).slice(0, 10),
          lessonsCount: problem?.lessons?.length || 0,
          timeslotsCount: problem?.timeslots?.length || 0
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
      console.error('[callORToolScheduler] Failed to parse OR-Tool response as JSON:', parseError);
      return Response.json({
        ok: false,
        stage: 'parseORToolResponse',
        error: 'Invalid JSON from OR-Tool',
        errorMessage: String(parseError?.message || parseError),
        errorStack: String(parseError?.stack || ''),
        orToolHttpStatus,
        orToolErrorBody: solverResponseText?.slice(0, 1000),
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    console.log('[callORToolScheduler] solver score =', solution.score);

    // Step 3: Validate solution format (support lessons or legacy assignments)
    const solvedLessons = Array.isArray(solution.lessons)
      ? solution.lessons
      : (Array.isArray(solution.assignments) ? solution.assignments : null);
    if (!solvedLessons) {
      return Response.json({ 
        ok: false,
        error: 'Invalid solution format from OR-Tool (expected lessons[] or assignments[])',
        solution,
        orToolHttpStatus,
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }
    const assignmentsReturnedBySubject = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      assignmentsReturnedBySubject[subj] = (assignmentsReturnedBySubject[subj] || 0) + 1;
    }
    console.log('[callORToolScheduler] assignmentsReturnedBySubject =', assignmentsReturnedBySubject);
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
    console.log('[callORToolScheduler] assignedBySubjectCode =', assignedBySubjectCode);
    console.log('[callORToolScheduler] unassignedBySubjectCode =', unassignedBySubjectCode);
    const coreKeys = ['TOK','CAS','EE'];
    const coreAssignmentSummary = {};
    for (const k of coreKeys) {
      coreAssignmentSummary[k] = {
        assigned: assignedBySubjectCode[k] || 0,
        unassigned: unassignedBySubjectCode[k] || 0,
        total: (assignedBySubjectCode[k] || 0) + (unassignedBySubjectCode[k] || 0)
      };
    }
    console.log('[callORToolScheduler] coreAssignmentSummary =', coreAssignmentSummary);

    // Step 4: Get Base44 entities to reverse-map IDs
    const [subjects, teachingGroups, rooms, teachers] = await Promise.all([
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.TeachingGroup.filter({ school_id: schoolId }),
      base44.entities.Room.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId })
    ]);

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

    // Core assignments (TOK/CAS/EE) with timeslotId + mapped day/period
    const periodsPerDay = periodsPerDayComputed;
    const coreAssignments = { TOK: [], CAS: [], EE: [] };
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (!['TOK','CAS','EE'].includes(subj)) continue;
      let day = null, period = null;
      if (l.timeslotId) {
        const ts = problem.timeslots.find(t => t.id === l.timeslotId) || null;
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
      const ts = problem.timeslots.find(t => t.id === l.timeslotId);
      if (!ts) continue;
      const day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
      const period = timeslotIndexInDay[ts.id] || 1;
      if (maxPeriodUsedByDay[day] === undefined || period > maxPeriodUsedByDay[day]) {
        maxPeriodUsedByDay[day] = period;
        endTimeUsedByDay[day] = ts.endTime || null;
      }
    }
    console.log('[callORToolScheduler] maxPeriodUsedByDay =', maxPeriodUsedByDay);
    console.log('[callORToolScheduler] endTimeUsedByDay =', endTimeUsedByDay);

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
    const latestUsedTimeslot = maxUsedTimeslotId ? (problem.timeslots.find(t => t.id === maxUsedTimeslotId) || null) : null;
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
    
    console.log(`[callORToolScheduler] Unassigned lessons: ${unassignedLessons.length} / ${solvedLessons.length}`);
    console.log(`[callORToolScheduler] Unassigned by subject:`, Object.keys(unassignedBySubject).map(k => `${k}: ${unassignedBySubject[k].length}`).join(', '));
    
    // Step 5b: GUARD - if too many unassigned, abort without overwriting
    const unassignedThreshold = 0.3; // 30% unassigned = fail
    const unassignedRatio = unassignedLessons.length / Math.max(1, solvedLessons.length);
    
    if (unassignedRatio > unassignedThreshold) {
      console.error(`[callORToolScheduler] ABORT: ${(unassignedRatio*100).toFixed(1)}% lessons unassigned (threshold: ${(unassignedThreshold*100).toFixed(0)}%)`);
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
    
    // Step 5c: Map OptaPlanner solution back to Base44 ScheduleSlot entities (assigned + unscheduled)
    const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
    const periods_per_day = periodsPerDayComputed; // derived from schedule settings
    let lessonsWithoutTimeslot = 0;
    let missingRoomCount = 0;
    let missingTeacherCount = 0;
    const slots = [];
    
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

      const timeslot = problem.timeslots.find(ts => ts.id === lesson.timeslotId);
      if (!timeslot) continue;

      const normalizedSubject = String(lesson.subject || lesson.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const subjectId = subjectIdByCode[normalizedSubject] || null;
      const teacherId = lesson.teacherId ? numericToTeacherId[lesson.teacherId] : null;
      const roomId = numericToRoomId[lesson.roomId] || null;
      
      // CRITICAL: Extract teaching_group_id from studentGroup (must be "TG_<id>" format)
      const tgIdFromGroup = (lesson.studentGroup && lesson.studentGroup.startsWith('TG_')) ? lesson.studentGroup.slice(3) : null;
      
      // WARN if solver returned non-standard format
      if (lesson.studentGroup && !lesson.studentGroup.startsWith('TG_')) {
        console.warn(`[callORToolScheduler] Non-standard studentGroup format: "${lesson.studentGroup}" - teaching_group_id will be null!`);
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
    console.log('[callORToolScheduler] slotsPreparedBySubject =', slotsPreparedBySubject);

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
    console.log('[callORToolScheduler] slotsToInsertBySubjectId =', slotsToInsertBySubjectId);

    // Full JSON samples for TOK/CAS/EE
    const sampleTok = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TOK') || null;
    const sampleCas = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'CAS') || null;
    const sampleEe  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'EE')  || null;
    const sampleTest  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TEST')  || null;
    console.log('[callORToolScheduler] sampleSlot.TOK =', sampleTok);
    console.log('[callORToolScheduler] sampleSlot.CAS =', sampleCas);
    console.log('[callORToolScheduler] sampleSlot.EE  =', sampleEe);
    // Prepare core verification helpers
    let coreSlotsInsertedCount = { TOK: 0, CAS: 0, EE: 0 };
    let sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
    console.log('[callORToolScheduler] coreSlotsInsertedCount (init) =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);

    // Step 6.5: Inject STUDY slots into empty timeslots (post-solver, ONLY if solver succeeded)
    // CRITICAL: STUDY/TEST only injected when orToolHttpStatus === 200
    const allTimeslots = problem.timeslots || [];
    const occupiedSlots = new Set();
    slots.forEach(s => {
      const key = `${s.day}_${s.period}`;
      occupiedSlots.add(key);
    });

    const studySlots = [];
    const studySubject = subjects.find(s => s.code === 'STUDY' || s.name === 'STUDY');
    if (studySubject && orToolHttpStatus === 200) {
      // Only inject STUDY if solver succeeded
      for (const ts of allTimeslots) {
        const day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
        const period = timeslotIndexInDay[ts.id] || 1;
        const key = `${day}_${period}`;

        if (!occupiedSlots.has(key)) {
          studySlots.push({
            school_id: schoolId,
            schedule_version: schedule_version_id,
            teaching_group_id: null,
            subject_id: studySubject.id,
            teacher_id: null,
            room_id: null,
            day,
            period,
            is_double_period: false,
            status: 'scheduled',
            notes: 'Study / Free Period'
          });
        }
      }
      console.log('[callORToolScheduler] Injected STUDY slots:', studySlots.length);
    }

    // Combine solver slots + STUDY slots
    const allSlots = [...slots, ...studySlots];

    stage = 'deleteOldSlots';
    console.log(`[callORToolScheduler] ${stage}: deleting old slots`);

    // Step 6: Delete existing slots - THROTTLED SEQUENTIAL DELETE to avoid rate limits
    const existingSlots = await base44.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });
    const totalToDelete = existingSlots.length;
    console.log(`[callORToolScheduler] Deleting ${totalToDelete} existing slots with throttling`);

    let deletedCount = 0;
    const deleteErrors = [];
    const BATCH_SIZE = 5; // Small batches to avoid rate limit
    const BATCH_DELAY_MS = 500; // 500ms between batches
    const MAX_RETRIES = 3;

    const deleteBatches = chunk(existingSlots, BATCH_SIZE);

    for (let i = 0; i < deleteBatches.length; i++) {
      const batch = deleteBatches[i];
      let batchSuccess = false;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const results = await Promise.allSettled(batch.map(s => base44.entities.ScheduleSlot.delete(s.id)));
        const failures = results.filter(r => r.status === 'rejected');
        const successes = results.filter(r => r.status === 'fulfilled');

        deletedCount += successes.length;

        if (failures.length === 0) {
          batchSuccess = true;
          break;
        }

        // Check if rate limit error
        const hasRateLimit = failures.some(f => 
          String(f.reason?.message || '').toLowerCase().includes('rate limit')
        );

        if (hasRateLimit && attempt < MAX_RETRIES) {
          const backoff = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.warn(`[callORToolScheduler] Rate limit (batch ${i+1}/${deleteBatches.length}), retry in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        // Log persistent errors
        failures.forEach((r, idx) => {
          const errorMsg = `delete:${batch[idx]?.id}:${r.reason?.message || 'error'}`;
          deleteErrors.push(errorMsg);
        });
        break;
      }

      if (!batchSuccess) {
        console.error(`[callORToolScheduler] Batch ${i+1}/${deleteBatches.length} failed after ${MAX_RETRIES} retries`);
      }

      // Delay between batches (except last one)
      if (i < deleteBatches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }

      // Progress log every 20 slots
      if ((i + 1) % 4 === 0 || i === deleteBatches.length - 1) {
        console.log(`[callORToolScheduler] Delete progress: ${deletedCount}/${totalToDelete}`);
      }
    }

    // CRITICAL: Block insertion if significant deletion failure
    const deleteFailureRate = (totalToDelete - deletedCount) / Math.max(1, totalToDelete);
    if (deleteFailureRate > 0.1) { // Allow up to 10% failure
      console.error(`[callORToolScheduler] DELETE FAILED - only ${deletedCount}/${totalToDelete} deleted (${(deleteFailureRate*100).toFixed(1)}% failure)`);
      return Response.json({
        ok: false,
        stage: 'deleteOldSlots',
        error: `Failed to delete existing slots: ${deletedCount}/${totalToDelete} succeeded (${(deleteFailureRate*100).toFixed(1)}% failure rate)`,
        deletedCount,
        existingSlotsCount: totalToDelete,
        deleteErrors: deleteErrors.slice(0, 20),
        suggestion: 'Rate limit exceeded. Recommendations: 1) Wait 2 minutes and retry, 2) Contact support to increase rate limits, 3) Manually delete slots via Base44 dashboard',
        meta: { schedule_version_id, schoolId }
      }, { status: 200 });
    }

    console.log(`[callORToolScheduler] Successfully deleted ${deletedCount}/${totalToDelete} slots (${deleteErrors.length} errors tolerated)`);

    stage = 'insertNewSlots';
    console.log(`[callORToolScheduler] ${stage}: inserting ${allSlots.length} new slots`);
    
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
      
      console.log('[callORToolScheduler] insertedCount =', insertedCount);
      console.log('[callORToolScheduler] slotsInsertedBySubjectCode =', slotsInsertedBySubjectCode);
      console.log('[callORToolScheduler] insertedCountBySubject =', slotsPreparedBySubject);
      if (createdIds) {
        console.log('[callORToolScheduler] createdIds (first 20) =', createdIds.slice(0, 20));
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
        console.log('[callORToolScheduler] coreSlotsInsertedCount =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);
      } else {
        coreSlotsInsertedCount = {
          TOK: slotsPreparedBySubject['TOK'] || 0,
          CAS: slotsPreparedBySubject['CAS'] || 0,
          EE: slotsPreparedBySubject['EE'] || 0,
        };
        sampleCoreSlot = sampleTok || sampleCas || sampleEe || null;
        console.log('[callORToolScheduler] coreSlotsInsertedCount (from prepared) =', coreSlotsInsertedCount, 'sampleCoreSlot =', sampleCoreSlot);
      }
    }

    // Step 8: Create conflict reports for unassigned lessons - BATCH CREATE
    console.log(`[callORToolScheduler] Creating ${unassignedLessons.length} conflict reports in batches`);
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
            console.log('[callORToolScheduler] offByOneIssues =', offByOneIssues);
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
              console.error('[callORToolScheduler] ScheduleVersion.update failed:', e?.message || e);
              errors.push(`scheduleVersionUpdate:${e?.message || e}`);
            }

    console.log('[callORToolScheduler] persistence diagnostics', { lessonsWithoutTimeslot, missingRoomCount, missingTeacherCount });
    const buildMeta = {
      schoolIdInput: requestedSchoolId,
      schoolIdUsed: schoolId,
      timeslotsCount: problem.timeslots.length,
      periodsPerDay: periodsPerDayComputed,
      lastTimeslot: problem.timeslots[problem.timeslots.length - 1] || null,
      dpTargetPeriodsPerDay: (buildResponse?.data?.stats?.dp_target_periods_per_day) || null,
      periodDurationMinutes: (problem?.scheduleSettings?.periodDurationMinutes) || null,
    };
    console.log('[callORToolScheduler] buildMeta =', buildMeta);

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
      school_id: user.school_id,
      schedule_version_id,
      scheduleVersionIdInput: schedule_version_id,
      scheduleVersionIdUsed: schedule_version_id,
      orToolEndpointUsed,
      orToolHttpStatus,
      orToolErrorBody: null,
      orToolRequestHeadersSent,
      orToolHealthStatus,
      orToolHealthOk,
      orToolRequestPayload: {
        scheduleSettings: scheduleSettingsSent,
        subjects: (problem?.subjects || []).slice(0, 5),
        subjectRequirements: coreSubjectRequirements.length > 0 
          ? coreSubjectRequirements 
          : (problem?.subjectRequirements || []).slice(0, 10),
        lessonsCount: solvedLessons ? solvedLessons.length : null,
        timeslotsCount: problem.timeslots ? problem.timeslots.length : null,
        coreRequirementsFound: coreSubjectRequirements.length
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
      buildMeta,
      problemLessonsCreated,
      solutionAssignmentsReturned: assignmentsReturnedBySubject,
      slotsPreparedForInsert: slotsPreparedBySubject,
      testSlotsInsertedCount,
      slotsInsertedBySubjectCode,
      orToolRequestPayloadSubjects: (problem?.subjects || []).slice(0, 5),
      orToolRequestPayloadSubjectRequirements: (problem?.subjectRequirements || []).slice(0, 10),
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
      coreTeachingGroupsDetected
    });

  } catch (error) {
    console.error(`[callORToolScheduler] ERROR at stage="${stage}":`, error);
    console.error(`[callORToolScheduler] Error message:`, error?.message);
    console.error(`[callORToolScheduler] Error stack:`, error?.stack);
    
    return Response.json({ 
      ok: false,
      stage,
      errorMessage: String(error?.message || error),
      errorStack: String(error?.stack || ''),
      meta: { schedule_version_id, schoolId }
    }, { status: 200 }); // Return 200 so UI can always parse JSON
  }
});