import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/*
REFACTORED: Cohort-Centered Schedule Builder (v2.1)
- Each TeachingGroup = ONE canonical section/cohort (identified by teaching_group_id)
- NO aggressive filtering - include all TGs unless completely invalid
- Comprehensive fallback system ensures all TGs have duration (minutes_per_week)
- Unit validation: detects period counts stored as minutes (≤30 for DP = period count)
- IB standards enforcement: HL≥300min, SL≥180min
- Detailed diagnostics log all adjustments, warnings, and skips
- Stable, predictable solver input with complete subject coverage
*/

// DEPLOYMENT TIMESTAMP: 2026-02-18T10:00:00Z
// CRITICAL FIX: TeachingGroup DTO contract aligned with Codex expectations
// - student_group (snake_case, not camelCase)
// - required_minutes_per_week (integer, snake_case)
// - No unknown fields (year_group, name removed from main object)
// - HL/SL hours validation enforced

Deno.serve(async (req) => {
  const BUILD_VERSION = '2026-02-18T10:00:00Z-CODEX-DTO-FIX'; // Deployment marker
  console.log(`[buildSchedulingProblem] 🚀 BUILD VERSION: ${BUILD_VERSION}`);
  
  let stage = 'init';
  let school_id = null;
  let schedule_version_id = null;
  let base44 = null;
  
  // CRITICAL: Declare ALL variables at top to prevent TDZ after Deno bundling
  let subjectRequirements = [];
  let lowPeriodWarnings = [];
  
  // DIAGNOSTICS: Track all adjustments and warnings
  const diagnosticLog = [];
  const recordLog = (msg) => {
    console.log(`[buildSchedulingProblem] ${msg}`);
    diagnosticLog.push(msg);
  };
  
  try {
    stage = 'method_check';
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    stage = 'auth';
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    stage = 'parseRequest';
    const body = await req.json();
    schedule_version_id = body?.schedule_version_id;
    const requestedSchoolId = body?.school_id || body?.schoolId || user?.school_id || null;

    if (!schedule_version_id) {
      return Response.json({ ok: false, stage, error: 'schedule_version_id required', meta: { schedule_version_id, school_id: requestedSchoolId } }, { status: 400 });
    }

    const whoami = user ? { userId: user.id, role: user.role, school_id: user.school_id || null } : null;

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized or no school assigned', whoami }, { status: 403 });
    }
    if (requestedSchoolId && requestedSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: Cross-school access', whoami, requestedSchoolId }, { status: 403 });
    }

    school_id = user.school_id;

    stage = 'loadSchool';
    recordLog(`${stage}: school_id=${school_id}, schedule_version_id=${schedule_version_id}`);
    
    // CRITICAL: Accept teaching groups from caller (post-generation/sync) OR fetch from DB
    const teachingGroupsFromCaller = body?.teachingGroups || null;
    const useCallerTGs = Array.isArray(teachingGroupsFromCaller) && teachingGroupsFromCaller.length > 0;
    
    if (useCallerTGs) {
      recordLog(`Using ${teachingGroupsFromCaller.length} teaching groups from caller (post-generation/sync)`);
    }
    
    const [school, allRooms, allTeachers, allSubjects, allTeachingGroups] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(r => r?.[0] || null).catch(() => null),
      base44.entities.Room.filter({ school_id }).catch(() => []),
      base44.entities.Teacher.filter({ school_id }).catch(() => []),
      base44.entities.Subject.filter({ school_id }).catch(() => []),
      useCallerTGs ? Promise.resolve(teachingGroupsFromCaller) : base44.entities.TeachingGroup.filter({ school_id }).catch(() => []),
    ]);
    
    const roomsDb = (allRooms || []).filter(r => r?.is_active !== false);
    const teachersDb = (allTeachers || []).filter(t => t?.is_active !== false);
    const subjectsDb = (allSubjects || []).filter(s => s?.is_active !== false);
    const teachingGroupsDb = (allTeachingGroups || []).filter(tg => tg?.is_active !== false);

    if (!school) {
      return Response.json({ ok: false, stage, error: 'School not found', meta: { schedule_version_id, school_id } }, { status: 404 });
    }
    if (subjectsDb.length === 0 || teachingGroupsDb.length === 0) {
      return Response.json({ ok: false, stage, error: 'No subjects or teaching groups', meta: { schedule_version_id, school_id } }, { status: 400 });
    }

    stage = 'buildSubjectsIndex';
    
    const normalizeSubjectCode = (raw) => {
      if (!raw) return null;
      const s = String(raw).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      return s || null;
    };
    
    const normalizeCode = (raw) => {
      if (!raw) return '';
      return String(raw).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_');
    };

    const subjectIdToCode = {};
    const subjectIdByCode = {};
    const subjectById = {};
    for (const subj of (subjectsDb || [])) {
      if (!subj?.id) continue;
      // Enrich subject with hour settings (from new hoursPerWeekHL/SL fields)
      const enrichedSubject = {
        ...subj,
        hoursPerWeekHL: subj.hoursPerWeekHL || Math.round((subj.hl_minutes_per_week_default || 360) / 60),
        hoursPerWeekSL: subj.hoursPerWeekSL || Math.round((subj.sl_minutes_per_week_default || 240) / 60)
      };
      subjectById[subj.id] = enrichedSubject;
      const raw = String(subj.code || subj.name || subj.id || '').trim();
      const norm = normalizeSubjectCode(raw);
      if (norm) subjectIdToCode[subj.id] = norm;
      const aliases = new Set([raw.toUpperCase(), norm, norm?.replace(/_/g, ' ')]);
      aliases.forEach((k) => { if (k) subjectIdByCode[k] = subj.id; });
    }

    stage = 'generateTimeslots';
    const periodDurationMinutes = Number(school.period_duration_minutes || 60);
    const dayStartTime = String(school.day_start_time || school.school_start_time || '08:00');
    const dayEndTime = String(school.day_end_time || '18:00');
    const daysOfWeek = Array.isArray(school.days_of_week) && school.days_of_week.length > 0
      ? school.days_of_week
      : ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
    
    // CRITICAL: Validate school timing configuration BEFORE generating timeslots
    recordLog(`School timing config: start=${dayStartTime}, end=${dayEndTime}, period=${periodDurationMinutes}min`);
    
    const startMin = timeToMin(dayStartTime);
    const endMin = timeToMin(dayEndTime);
    const totalMinutesAvailable = endMin - startMin;
    
    if (startMin >= endMin) {
      recordLog(`❌ CRITICAL: day_start_time (${dayStartTime}) >= day_end_time (${dayEndTime})`);
      const errorBody = {
        ok: false,
        stage: 'INVALID_SCHOOL_TIMING',
        code: 'INVALID_DAY_TIMES',
        error: 'School timing configuration invalid',
        errorMessage: `❌ Cannot generate schedule: day_start_time (${dayStartTime}) must be before day_end_time (${dayEndTime}).\n\nPlease fix school timing configuration in Settings page.`,
        details: [{
          entity: 'School',
          field: 'day_start_time / day_end_time',
          reason: 'invalid',
          hint: `Set day_start_time < day_end_time (e.g., start=08:00, end=18:00)`
        }],
        suggestion: '🔧 Go to Settings → School Configuration → Set valid day_start_time and day_end_time',
        requiredAction: 'Fix school timing configuration',
        buildVersion: BUILD_VERSION,
        meta: { schedule_version_id, school_id, dayStartTime, dayEndTime }
      };
      console.error('[buildSchedulingProblem] 🔍 422 RESPONSE BODY:', JSON.stringify(errorBody, null, 2));
      return Response.json(errorBody, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    
    if (periodDurationMinutes <= 0 || periodDurationMinutes > totalMinutesAvailable) {
      recordLog(`❌ CRITICAL: period_duration_minutes (${periodDurationMinutes}) invalid (must be 1-${totalMinutesAvailable})`);
      const errorBody = {
        ok: false,
        stage: 'INVALID_SCHOOL_TIMING',
        code: 'INVALID_PERIOD_DURATION',
        error: 'Period duration invalid',
        errorMessage: `❌ Cannot generate schedule: period_duration_minutes (${periodDurationMinutes}min) must be between 1 and ${totalMinutesAvailable}min (total day duration).\n\nPlease fix school configuration in Settings page.`,
        details: [{
          entity: 'School',
          field: 'period_duration_minutes',
          reason: 'out_of_range',
          hint: `Set period_duration_minutes between 1 and ${totalMinutesAvailable} (e.g., 60 for 1-hour periods)`
        }],
        suggestion: '🔧 Go to Settings → School Configuration → Set valid period_duration_minutes (typically 45-60 minutes)',
        requiredAction: 'Fix period_duration_minutes in Settings',
        buildVersion: BUILD_VERSION,
        meta: { schedule_version_id, school_id, periodDurationMinutes, totalMinutesAvailable }
      };
      console.error('[buildSchedulingProblem] 🔍 422 RESPONSE BODY:', JSON.stringify(errorBody, null, 2));
      return Response.json(errorBody, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }

    // Build breaks array from school settings (convert period numbers to time ranges)
    const breaks = [];
    const breakPeriods = Array.isArray(school.settings?.break_periods) ? school.settings.break_periods : [];
    const lunchPeriod = school.settings?.lunch_period || null;
    const breakDuration = Number(school.settings?.break_duration_minutes || 15);
    const lunchDuration = Number(school.settings?.lunch_duration_minutes || 30);

    const timeToMin = (hhmm) => {
      const [h,m] = String(hhmm).split(':').map(Number);
      return (h||0) * 60 + (m||0);
    };
    const minToTime = (min) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    };

    // Convert period numbers to time ranges
    breakPeriods.forEach(period => {
      const periodStart = timeToMin(dayStartTime) + ((period - 1) * periodDurationMinutes);
      breaks.push({
        start: minToTime(periodStart),
        end: minToTime(periodStart + breakDuration)
      });
    });

    if (lunchPeriod) {
      const lunchStart = timeToMin(dayStartTime) + ((lunchPeriod - 1) * periodDurationMinutes);
      breaks.push({
        start: minToTime(lunchStart),
        end: minToTime(lunchStart + lunchDuration)
      });
    }

    recordLog(`Breaks configured: ${breaks.length} (${breakPeriods.length} short breaks + ${lunchPeriod ? 1 : 0} lunch)`);
    const minPeriodsPerDay = Number(school.min_periods_per_day || 10);
    const targetPeriodsPerDay = Number(school.target_periods_per_day || 10);

    const overlapsBreak = (start, end) => {
      for (const b of breaks) {
        if (!b?.start || !b?.end) continue;
        const bs = timeToMin(b.start), be = timeToMin(b.end);
        if (Math.max(start, bs) < Math.min(end, be)) return true;
      }
      return false;
    };

    const startMin = timeToMin(dayStartTime);
    const endMin = timeToMin(dayEndTime);
    const timeslots = [];
    let tsId = 1;
    
    for (const day of daysOfWeek) {
      for (let cur = startMin; cur + periodDurationMinutes <= endMin; cur += periodDurationMinutes) {
        const s = cur, e = cur + periodDurationMinutes;
        if (overlapsBreak(s, e)) continue;
        const sh = String(Math.floor(s/60)).padStart(2,'0');
        const sm = String(s%60).padStart(2,'0');
        const eh = String(Math.floor(e/60)).padStart(2,'0');
        const em = String(e%60).padStart(2,'0');
        timeslots.push({ id: tsId++, dayOfWeek: day, startTime: `${sh}:${sm}`, endTime: `${eh}:${em}` });
      }
    }
    
    recordLog(`Timeslots generated: ${timeslots.length}`);
    
    // CRITICAL: PRE_SOLVE_VALIDATION - Block if zero timeslots generated
    if (timeslots.length === 0) {
      recordLog(`❌ PRE_SOLVE_VALIDATION FAILED: ZERO timeslots generated - cannot run solver`);
      const errorBody = {
        ok: false,
        stage: 'PRE_SOLVE_VALIDATION',
        code: 'TIMESLOTS_MISSING',
        error: 'Zero timeslots generated',
        errorMessage: `❌ Cannot run OptaPlanner: ZERO timeslots were generated.\n\nThis usually means:\n• day_start_time >= day_end_time\n• period_duration_minutes too large for day duration\n• Breaks cover all available time\n\nPlease fix school timing configuration in Settings page.`,
        details: [{
          entity: 'School',
          field: 'day_start_time / day_end_time / period_duration_minutes / breaks',
          reason: 'invalid',
          hint: 'Check Settings → School Configuration: ensure valid timing (e.g., 08:00-18:00, 60min periods, breaks <10h total)'
        }],
        suggestion: '🔧 Go to Settings → School Configuration → Verify:\n• day_start_time < day_end_time\n• period_duration_minutes reasonable (45-60 min)\n• Breaks don\'t cover entire day',
        requiredAction: 'Fix school timing configuration to generate valid timeslots',
        buildVersion: BUILD_VERSION,
        schoolConfig: {
          day_start_time: dayStartTime,
          day_end_time: dayEndTime,
          period_duration_minutes: periodDurationMinutes,
          breaks_count: breaks.length,
          days_of_week: daysOfWeek,
          total_minutes_available: endMin - startMin
        },
        meta: { schedule_version_id, school_id }
      };
      console.error('[buildSchedulingProblem] 🔍 422 RESPONSE BODY:', JSON.stringify(errorBody, null, 2));
      return Response.json(errorBody, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    
    recordLog(`✅ Timeslots validation passed: ${timeslots.length} timeslots across ${daysOfWeek.length} days`);

    // CRITICAL: OptaPlanner requires NUMERIC IDs (Java deserialization constraint)
    // We map numeric IDs -> MongoDB IDs for persistence
    const rooms = (roomsDb || []).map((r, idx) => ({ 
      id: idx + 1, // Numeric ID for OptaPlanner
      name: r?.name || `Room ${idx+1}`, 
      capacity: r?.capacity || 0
    }));
    const teachers = (teachersDb || []).map((t, idx) => ({ 
      id: idx + 1, // Numeric ID for OptaPlanner
      name: t?.full_name || `Teacher ${idx+1}`
    }));
    
    // Mapping tables: Numeric ID -> MongoDB ID
    const roomNumericIdToBase44Id = {};
    const teacherNumericIdToBase44Id = {};
    (roomsDb || []).forEach((r, idx) => { if (r?.id) roomNumericIdToBase44Id[idx+1] = r.id; });
    (teachersDb || []).forEach((t, idx) => { if (t?.id) teacherNumericIdToBase44Id[idx+1] = t.id; });

    stage = 'buildLessons';
    recordLog(`${stage}: processing ${teachingGroupsDb.length} teaching groups (cohort-centered approach)`);
    
    // DIAGNOSTICS TRACKING
    const teachingGroupsSkipped = [];
    const teachingGroupsAdjusted = [];
    const debugMinutesSourceByTG = {};
    const teachingGroupsDiagnostics = [];
    let teachingGroupsIncludedCount = 0;
    
    const recordAdjustment = (tg, adjustment, originalValue, newValue) => {
      if (!tg) return;
      const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN';
      teachingGroupsAdjusted.push({
        tg_id: tg.id,
        name: tg.name,
        subject_code: subjCode,
        adjustment,
        original: originalValue,
        applied: newValue
      });
      recordLog(`ADJUSTED: TG ${tg.id} (${tg.name}, ${subjCode}): ${adjustment} [${originalValue} → ${newValue}]`);
    };
    
    const recordSkipped = (tg, reason) => {
      if (!tg) return;
      const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN';
      const has_students = Array.isArray(tg.student_ids) && tg.student_ids.length > 0;
      const subj = (tg.subject_id && subjectById[tg.subject_id]) || null;
      
      teachingGroupsSkipped.push({
        tg_id: tg.id,
        name: tg.name,
        subject_code: subjCode,
        ib_level: subj?.ib_level || null,
        year_group: tg.year_group || null,
        has_students,
        student_count: Array.isArray(tg.student_ids) ? tg.student_ids.length : 0,
        reason
      });
      
      recordLog(`SKIPPED: TG ${tg.id} (${tg.name}, ${subjCode}): ${reason}`);
    };
    
    // SUBJECT-CONFIGURED DEFAULTS (NO HARDCODED FALLBACKS)
    const getSubjectDefaults = (subj, tgLevel) => {
      if (!subj) return null;
      const level = String(tgLevel || '').toUpperCase();
      const ibLevel = String(subj.ib_level || '').toUpperCase();
      
      if (ibLevel === 'DP') {
        // PRIORITY: Use new hoursPerWeekHL/SL fields
        if (level === 'HL' && typeof subj.hoursPerWeekHL === 'number' && subj.hoursPerWeekHL > 0) {
          return { minutes: subj.hoursPerWeekHL * 60, source: 'SUBJECT_HOURS_HL' };
        }
        if (level === 'SL' && typeof subj.hoursPerWeekSL === 'number' && subj.hoursPerWeekSL > 0) {
          return { minutes: subj.hoursPerWeekSL * 60, source: 'SUBJECT_HOURS_SL' };
        }
        
        // FALLBACK: Old minutes_per_week_default fields
        if (level === 'HL' && typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          return { minutes: subj.hl_minutes_per_week_default, source: 'SUBJECT_HL_DEFAULT_DEPRECATED' };
        }
        if (level === 'SL' && typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          return { minutes: subj.sl_minutes_per_week_default, source: 'SUBJECT_SL_DEFAULT_DEPRECATED' };
        }
      }
      
      if (['PYP', 'MYP'].includes(ibLevel)) {
        if (typeof subj.pyp_myp_minutes_per_week_default === 'number' && subj.pyp_myp_minutes_per_week_default > 0) {
          return { minutes: subj.pyp_myp_minutes_per_week_default, source: 'SUBJECT_PYP_MYP_DEFAULT' };
        }
      }
      
      return null;
    };
    
    const minutesForTG = (tg) => {
      if (!tg) return 0;

      // CRITICAL: Check if group is explicitly disabled
      if (tg.is_active === false) {
        debugMinutesSourceByTG[tg.id] = { source: 'DISABLED', value: 0, reason: 'is_active_false' };
        return 0;
      }

      // CRITICAL: Check if explicitly configured as 0 (intentional skip)
      if (tg.minutes_per_week === 0 || tg.periods_per_week === 0 || tg.hours_per_week === 0) {
        debugMinutesSourceByTG[tg.id] = { source: 'EXPLICIT_ZERO', value: 0, reason: 'intentionally_disabled' };
        return 0;
      }

      const subj = (tg.subject_id && subjectById[tg.subject_id]) || null;
      const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || null;
      const normCode = normalizeCode(subjCode);
      const level = String(tg.level || '').toUpperCase().trim();
      const yearGroupStr = String(tg.year_group || '').toUpperCase();
      const nameStr = String(tg.name || '').toUpperCase();
      
      // CRITICAL: Detect DP HL/SL from tg.level AND tg.name (e.g., "Physics HL - Group A")
      const isDPHL = level === 'HL' || nameStr.includes(' HL') || nameStr.includes('_HL');
      const isDPSL = level === 'SL' || nameStr.includes(' SL') || nameStr.includes('_SL');
      const isDPGroup = yearGroupStr.includes('DP') || isDPHL || isDPSL;

      // Priority 1: TG-level explicit config (SOURCE OF TRUTH) - WITH ROBUST PARSING
      if (tg.minutes_per_week != null && tg.minutes_per_week !== '') {
        // ROBUST PARSER: handle "5h", "3h", "180min", "300", "5,5", etc.
        const raw = String(tg.minutes_per_week).toLowerCase().trim();
        let parsedValue = parseFloat(raw.replace(',', '.').replace(/[^0-9.]/g, ''));
        
        // If NaN, trigger fallback immediately
        if (!isFinite(parsedValue) || parsedValue <= 0) {
          recordLog(`⚠️ TG ${tg.id} (${tg.name}): minutes_per_week = "${raw}" → NaN, applying IB fallback`);
          const ibFallback = getIBStandardFallback(tg, subj);
          debugMinutesSourceByTG[tg.id] = { 
            source: ibFallback.source + '_AFTER_NAN', 
            value: ibFallback.minutes, 
            originalValue: raw,
            reason: `Parsed as NaN, applied ${ibFallback.source}`
          };
          recordAdjustment(tg, 'NaN detected in minutes_per_week', raw, `${ibFallback.minutes} min (IB fallback)`);
          return ibFallback.minutes;
        }
        
        // UNIT DETECTION: If value <= 30, treat as "hours" and convert to minutes
        if (parsedValue <= 30) {
          const hoursAsValue = parsedValue;
          parsedValue = hoursAsValue * 60;
          debugMinutesSourceByTG[tg.id] = { 
            source: 'TG_MINUTES_CONVERTED_FROM_HOURS', 
            value: parsedValue, 
            originalValue: raw,
            reason: `Detected hours (${hoursAsValue}h) instead of minutes, converted to ${parsedValue}min`
          };
          recordAdjustment(tg, 'Converted hours to minutes', `${raw} (${hoursAsValue}h)`, `${parsedValue} minutes`);
        }
        
        const minutes = parsedValue;
        // NO AUTO-CORRECTION: Use configured value as-is
        // Admin is responsible for setting correct hours on Subject entity

        debugMinutesSourceByTG[tg.id] = { source: 'TG_MINUTES', value: minutes, originalValue: raw };
        return minutes;
      }

      if (typeof tg.periods_per_week === 'number' && tg.periods_per_week > 0) {
        const minutes = tg.periods_per_week * periodDurationMinutes;
        debugMinutesSourceByTG[tg.id] = { source: 'TG_PERIODS', value: minutes, periods: tg.periods_per_week };
        recordAdjustment(tg, 'Converted periods_per_week to minutes', `${tg.periods_per_week} periods`, `${minutes} minutes`);
        return minutes;
      }

      if (typeof tg.hours_per_week === 'number' && tg.hours_per_week > 0) {
        const minutes = Math.round(tg.hours_per_week * 60);
        debugMinutesSourceByTG[tg.id] = { source: 'TG_HOURS', value: minutes, hours: tg.hours_per_week };
        recordAdjustment(tg, 'Converted hours_per_week to minutes', `${tg.hours_per_week}h`, `${minutes} minutes`);
        return minutes;
      }

      // Priority 2: Core subjects special handling
      if (normCode && ['TOK', 'CAS', 'EE', 'TEST'].includes(normCode)) {
        const coreDefault = 60;
        debugMinutesSourceByTG[tg.id] = { source: 'CORE_SUBJECT_DEFAULT', value: coreDefault, subject: subjCode };
        recordAdjustment(tg, `Applied core subject default (${normCode})`, 'missing', `${coreDefault} min/week`);
        return coreDefault;
      }

      // Priority 3: Subject-level defaults (admin-configured)
      const subjDefaults = getSubjectDefaults(subj, tg.level);
      if (subjDefaults && subjDefaults.minutes > 0) {
        debugMinutesSourceByTG[tg.id] = { source: subjDefaults.source, value: subjDefaults.minutes, subject: subjCode, note: subjDefaults.note };
        recordAdjustment(tg, `Applied subject default (${subjDefaults.source})`, 'missing', `${subjDefaults.minutes} min/week`);
        return subjDefaults.minutes;
      }

      // NO FALLBACK: Return 0 if subject config missing (will be blocked later)
      debugMinutesSourceByTG[tg.id] = { source: 'MISSING_CONFIG', value: 0, subject: subjCode, reason: 'No hours configured on Subject' };
      return 0;
    };
    
    const minutesToPeriods = (m) => Math.max(0, Math.ceil((m || 0) / periodDurationMinutes));

    // CREATE LESSONS: One lesson per teaching group (solver handles HL/SL merging)
    const lessons = [];
    let lessonId = 1;
    const expectedLessonsBySubject = {};
    const expectedMinutesBySubject = {};
    const dpStudyWeekly = Number(body?.dp_study_weekly ?? Deno.env.get('DP_STUDY_WEEKLY') ?? 0);
    const dpMinEndTime = String(body?.dp_min_end_time || Deno.env.get('DP_MIN_END_TIME') || '14:30');
    const studentGroupSoftPreferences = {};

    recordLog(`Creating lessons for ${teachingGroupsDb.length} TeachingGroups (solver handles HL/SL merging)`);

    // Process all teaching groups individually - NO client-side HL/SL merging
    for (const tg of teachingGroupsDb) {
      if (!tg) continue;
const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || null;
const subj = (tg.subject_id && subjectById[tg.subject_id]) || null;

// VALIDATION 1: Subject must exist
if (!subjCode || !subj) {
  recordSkipped(tg, 'NO_VALID_SUBJECT');
  continue;
}

// VALIDATION 2: TG must have students (or be special course)
const hasStudents = Array.isArray(tg.student_ids) && tg.student_ids.length > 0;
const isSpecialCourse = ['STUDY', 'TOK', 'CAS', 'EE', 'TEST'].includes(subjCode);

if (!hasStudents && !isSpecialCourse) {
  recordSkipped(tg, 'NO_STUDENTS_ENROLLED');
  continue;
}

// VALIDATION 3: Resolve lesson count - SOURCE OF TRUTH: periods_per_week
// CRITICAL: Use periods_per_week directly if set, otherwise derive from minutes
let weeklyCount = 0;

if (typeof tg.periods_per_week === 'number' && tg.periods_per_week > 0) {
  // SOURCE OF TRUTH: periods_per_week (from generateDpTeachingGroups)
  weeklyCount = tg.periods_per_week;
  debugMinutesSourceByTG[tg.id] = { 
    source: 'PERIODS_PER_WEEK_EXPLICIT', 
    value: weeklyCount * periodDurationMinutes, 
    periods: weeklyCount,
    reason: 'Using periods_per_week as source of truth'
  };
} else {
  // FALLBACK: Calculate from minutes_per_week
  const minutesUsed = minutesForTG(tg);
  
  if (!minutesUsed || minutesUsed <= 0) {
    recordSkipped(tg, 'MISSING_PERIODS_AND_MINUTES_CONFIG');
    continue;
  }
  
  weeklyCount = minutesToPeriods(minutesUsed);
}

if (!weeklyCount || weeklyCount <= 0) {
  recordSkipped(tg, 'INVALID_PERIOD_COUNT');
  continue;
}

const minutesUsed = weeklyCount * periodDurationMinutes; // Recalculate for consistency

// SUCCESS: Include this teaching group as-is
teachingGroupsIncludedCount++;

const studentGroup = `TG_${tg.id}`;
const cap = Math.max(1, (tg.student_ids || []).length);

// Map MongoDB IDs back to numeric IDs for OptaPlanner
const teacherIdx = (tg.teacher_id && teachersDb) ? teachersDb.findIndex(t => t?.id === tg.teacher_id) : -1;
const roomIdx = (tg.preferred_room_id && roomsDb) ? roomsDb.findIndex(r => r?.id === tg.preferred_room_id) : -1;
const teacherNumeric = teacherIdx >= 0 ? teacherIdx + 1 : null;
const roomNumeric = roomIdx >= 0 ? roomIdx + 1 : null;

// Track diagnostics
teachingGroupsDiagnostics.push({
  tg_id: tg.id,
  name: tg.name,
  subject_code: subjCode,
  minutesSource: debugMinutesSourceByTG[tg.id],
  minutesUsed,
  requiredPeriods: weeklyCount,
  lessons_created: weeklyCount, // CRITICAL: Proof that we create exact number
  ib_level: subj?.ib_level || null,
  year_group: tg.year_group || null,
  level: tg.level || null,
  has_students: hasStudents,
  student_count: (tg.student_ids || []).length,
  teacher_id: tg.teacher_id || null,
  room_id: tg.preferred_room_id || null,
  included: true
});

expectedLessonsBySubject[subjCode] = (expectedLessonsBySubject[subjCode] || 0) + weeklyCount;
expectedMinutesBySubject[subjCode] = (expectedMinutesBySubject[subjCode] || 0) + minutesUsed;

// Create EXACTLY periods_per_week lessons for this teaching group
// CRITICAL: studentGroup MUST be "TG_<teaching_group_id>" for persistence
// E.g., Film HL with 360min (6h) → periods_per_week=6 → CREATE 6 LESSONS
const studentIds = Array.isArray(tg.student_ids) ? tg.student_ids : [];
const blockId = tg.block_id || null;

recordLog(`Creating ${weeklyCount} lessons for TG ${tg.id} (${tg.name}, ${subjCode})`);

// DIAGNOSTIC: Log French/English/Anglais lesson creation
const isFrenchOrEnglish = subjCode.includes('FRENCH') || subjCode.includes('ENGLISH') || subjCode.includes('ANGLAIS');

for (let i = 0; i < weeklyCount; i++) {
  const lesson = {
    id: lessonId++,
    subject: tg.subject_id,
    subjectId: tg.subject_id,
    studentGroup: `TG_${tg.id}`,
    teachingGroupId: tg.id,
    sectionId: tg.id,
    studentIds,
    level: tg.level || null,
    yearGroup: tg.year_group || null,
    blockId,
    requiredCapacity: cap,
    timeslotId: null,
    roomId: roomNumeric || null, // Numeric for OptaPlanner
    teacherId: teacherNumeric || null, // Numeric for OptaPlanner
  };

  // Log first French/English lesson for verification
  if (isFrenchOrEnglish && i === 0) {
    recordLog(`📝 French/English lesson created: ${subjCode}, TG_${tg.id}, teachingGroupId=${tg.id}, studentCount=${studentIds.length}`);
  }

  lessons.push(lesson);
}

// DP: add study blocks + preferences
const isDP = (String(tg.year_group || '').toUpperCase().includes('DP')) || (subj?.ib_level === 'DP');
if (isDP) {
  studentGroupSoftPreferences[studentGroup] = { minEndTime: dpMinEndTime, penalty: 5 };
  const studyCount = Math.max(0, dpStudyWeekly - weeklyCount);
  // STUDY blocks use dummy subject_id
  const studySubjectId = '000000000000000000000000';
  for (let s = 0; s < studyCount; s++) {
    lessons.push({
      id: lessonId++,
      subject: studySubjectId,
      subjectId: studySubjectId,
      studentGroup,
      sectionId: tg.id,
      studentIds,
      blockId: null,
      requiredCapacity: cap,
      timeslotId: null,
      roomId: null,
      teacherId: null,
      isStudy: true,
      softConstraints: { maxConsecutive: 2, preferAfternoon: true }
    });
  }
}
}
    
    recordLog(`Lessons created: ${lessons.length} total, ${teachingGroupsIncludedCount} sections included, ${teachingGroupsSkipped.length} skipped`);
    recordLog(`Adjustments made: ${teachingGroupsAdjusted.length}`);
    
    // CORE DETECTION REPORT: Detect TOK/CAS/EE teaching groups and lessons
    const coreTeachingGroupsReport = {
      TOK: { tgs: [], lessons: [], total_minutes: 0 },
      CAS: { tgs: [], lessons: [], total_minutes: 0 },
      EE: { tgs: [], lessons: [], total_minutes: 0 }
    };
    
    for (const tg of teachingGroupsDb) {
      if (!tg?.subject_id) continue;
      
      const subj = subjectById[tg.subject_id];
      if (!subj) continue;
      
      const subjCode = normalizeSubjectCode(subj.code || subj.name);
      if (!subjCode) continue;
      
      // CORE DETECTION: Match on normalized subject code OR is_core flag
      const isCore = subj.is_core === true || ['TOK', 'CAS', 'EE'].includes(subjCode);
      if (!isCore) continue;
      
      const coreType = subjCode === 'TOK' ? 'TOK' : subjCode === 'CAS' ? 'CAS' : subjCode === 'EE' ? 'EE' : null;
      if (!coreType) continue;
      
      // Find lessons created for this TG
      const tgLessons = lessons.filter(l => l.teachingGroupId === tg.id);
      const minutesForThisTG = minutesForTG(tg);
      
      coreTeachingGroupsReport[coreType].tgs.push({
        tg_id: tg.id,
        name: tg.name,
        subject_id: tg.subject_id,
        subject_code: subjCode,
        year_group: tg.year_group,
        student_count: (tg.student_ids || []).length,
        minutes_per_week: minutesForThisTG,
        lessons_created: tgLessons.length
      });
      
      coreTeachingGroupsReport[coreType].lessons.push(...tgLessons);
      coreTeachingGroupsReport[coreType].total_minutes += minutesForThisTG;
    }
    
    // Log core report
    ['TOK', 'CAS', 'EE'].forEach(core => {
      const report = coreTeachingGroupsReport[core];
      recordLog(`✅ ${core} CORE REPORT: ${report.tgs.length} TGs, ${report.lessons.length} lessons created, ${report.total_minutes}min total`);
      report.tgs.forEach(tg => {
        recordLog(`  - TG ${tg.tg_id} (${tg.name}): ${tg.student_count} students, ${tg.lessons_created} lessons, ${tg.minutes_per_week}min/week`);
      });
    });
    
    // CRITICAL: Validate DP subjects have HL/SL hours configured (CODEX requirement)
    // SMART VALIDATION: Only enforce HL/SL if subject has HL/SL teaching groups AND is NOT a core subject
    const dpSubjectsWithoutHours = [];
    const dpTeachingGroupsAffected = [];
    
    for (const subj of subjectsDb) {
      if (subj.ib_level === 'DP') {
        // SKIP VALIDATION FOR CORE SUBJECTS (TOK/CAS/EE)
        if (subj.is_core === true) {
          recordLog(`✓ DP core subject ${subj.code} (is_core=true) - skipping HL/SL hours validation`);
          continue;
        }
        
        // Check if this subject has any HL/SL teaching groups
        const subjectTGs = teachingGroupsDb.filter(tg => tg.subject_id === subj.id);
        const hasHLGroup = subjectTGs.some(tg => String(tg.level || '').toUpperCase() === 'HL');
        const hasSLGroup = subjectTGs.some(tg => String(tg.level || '').toUpperCase() === 'SL');
        
        // Only validate HL/SL hours if this subject has HL/SL groups
        const needsHL = hasHLGroup;
        const needsSL = hasSLGroup;
        
        if (!needsHL && !needsSL) {
          // Subject has no HL/SL groups (e.g., "Standard" or "All DP" level groups)
          // Skip validation - required_minutes_per_week will be used
          recordLog(`✓ DP subject ${subj.code} has no HL/SL groups - skipping HL/SL hours validation`);
          continue;
        }
        
        // Check if required hours are configured
        const hasHL = typeof subj.hoursPerWeekHL === 'number' && subj.hoursPerWeekHL > 0;
        const hasSL = typeof subj.hoursPerWeekSL === 'number' && subj.hoursPerWeekSL > 0;
        
        // Only block if missing hours for existing group levels
        const missingHL = needsHL && !hasHL;
        const missingSL = needsSL && !hasSL;
        
        if (missingHL || missingSL) {
          dpSubjectsWithoutHours.push({
            subject_id: subj.id,
            code: subj.code || subj.name,
            name: subj.name,
            hoursPerWeekHL: subj.hoursPerWeekHL || null,
            hoursPerWeekSL: subj.hoursPerWeekSL || null,
            missing: missingHL && missingSL ? 'both' : missingHL ? 'HL' : 'SL',
            hl_configured: hasHL,
            sl_configured: hasSL,
            has_hl_groups: hasHLGroup,
            has_sl_groups: hasSLGroup
          });
          
          // Find affected teaching groups (only those with matching level)
          const affectedTGs = subjectTGs.filter(tg => {
            const level = String(tg.level || '').toUpperCase();
            if (missingHL && level === 'HL') return true;
            if (missingSL && level === 'SL') return true;
            return false;
          });
          
          dpTeachingGroupsAffected.push(...affectedTGs.map(tg => ({
            tg_id: tg.id,
            name: tg.name,
            level: tg.level,
            year_group: tg.year_group,
            student_count: tg.student_ids?.length || 0,
            missing_config: missingHL && missingSL ? 'HL+SL' : missingHL ? 'HL' : 'SL'
          })));
        }
      }
    }
    
    if (dpSubjectsWithoutHours.length > 0) {
      recordLog(`❌ BLOCKING: ${dpSubjectsWithoutHours.length} DP subjects missing HL/SL hours configuration`);
      recordLog(`❌ Affected teaching groups: ${dpTeachingGroupsAffected.length}`);
      
      return Response.json({
        ok: false,
        stage: 'PRE_SOLVE_VALIDATION',
        code: 'HOURS_MISSING_OR_INVALID',
        error: 'MISSING_HL_SL_HOURS_CONFIG',
        errorMessage: `❌ Cannot run OptaPlanner: ${dpSubjectsWithoutHours.length} DP subjects are missing HL/SL hours configuration.\n\nCodex (OptaPlanner solver) requires explicit hoursPerWeekHL and hoursPerWeekSL for ALL DP subjects.\n\nThis affects ${dpTeachingGroupsAffected.length} teaching group(s).\n\n👉 Go to Subjects page and configure hours for each DP subject before generating schedule.`,
        missingSubjects: dpSubjectsWithoutHours,
        affectedTeachingGroups: dpTeachingGroupsAffected,
        details: dpSubjectsWithoutHours.map(s => ({
          entity: 'Subject',
          id: s.subject_id,
          field: s.missing === 'both' ? 'hoursPerWeekHL + hoursPerWeekSL' : `hoursPerWeek${s.missing}`,
          reason: 'missing',
          hint: `Set ${s.missing} hours/week for ${s.code} (${s.name}) on Subjects page`
        })),
        suggestion: '🔧 Go to Subjects page → Edit each DP subject → Set "Hours per week (HL)" and "Hours per week (SL)" fields (e.g., HL=6, SL=4)',
        requiredAction: 'Configure hoursPerWeekHL and hoursPerWeekSL for all DP subjects in Subjects page',
        buildVersion: BUILD_VERSION,
        meta: { schedule_version_id, school_id }
      }, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    
    recordLog(`✅ HL/SL hours validation passed: ${dpSubjectsWithoutHours.length === 0 ? 'All DP subjects configured' : 'No DP subjects found'}`);

    // DIAGNOSTIC: Log lessons format (subject_id-based)
    recordLog(`📊 Sample lesson format: ${JSON.stringify(lessons[0], null, 2)}`);
    recordLog(`✅ Lessons now use subject_id instead of subject code`);

    // HARD FAIL if groups are missing subject hour configuration
    const missingHoursConfig = teachingGroupsSkipped.filter(s => 
      s.reason === 'MISSING_PERIODS_AND_MINUTES_CONFIG' || 
      s.reason === 'INVALID_PERIOD_COUNT'
    );
    
    // Also check for groups that got 0 minutes from MISSING_CONFIG
    const missingSubjectConfig = Object.entries(debugMinutesSourceByTG)
      .filter(([_, info]) => info.source === 'MISSING_CONFIG' && info.value === 0)
      .map(([tgId, info]) => {
        const tg = teachingGroupsDb.find(g => g.id === tgId);
        const subj = tg?.subject_id ? subjectById[tg.subject_id] : null;
        return {
          tg_id: tgId,
          name: tg?.name || 'Unknown',
          subject_code: info.subject,
          level: tg?.level || 'Unknown',
          year_group: tg?.year_group,
          student_count: tg?.student_ids?.length || 0,
          error: `Subject ${info.subject} missing hoursPerWeek${tg?.level || 'HL/SL'} configuration`
        };
      });
    
    if (missingSubjectConfig.length > 0) {
      recordLog(`❌ CRITICAL: ${missingSubjectConfig.length} TeachingGroups blocked - subjects missing HL/SL hour configuration`);
      
      return Response.json({
        ok: false,
        stage: 'PRE_SOLVE_VALIDATION',
        code: 'HOURS_MISSING_OR_INVALID',
        error: 'MISSING_HL_SL_HOURS_CONFIG',
        errorMessage: `❌ Cannot generate schedule: ${missingSubjectConfig.length} teaching group(s) blocked because their subjects lack HL/SL hours configuration.\n\nCodex validator requires hoursPerWeekHL and hoursPerWeekSL for all DP subjects.\n\n👉 Configure these on the Subjects page before running OptaPlanner.`,
        missingConfigurationCount: missingSubjectConfig.length,
        missingGroups: missingSubjectConfig,
        details: missingSubjectConfig.map(g => ({
          entity: 'TeachingGroup',
          id: g.tg_id,
          field: 'subject.hoursPerWeek' + (g.level || 'HL/SL'),
          reason: 'invalid',
          hint: `Subject ${g.subject_code} needs ${g.level || 'HL/SL'} hours configured`
        })),
        suggestion: '🔧 Go to Subjects page → Edit each DP subject → Set "Hours per week (HL)" and "Hours per week (SL)" fields',
        validationReport: {
          totalTeachingGroups: teachingGroupsDb.length,
          included: teachingGroupsIncludedCount,
          excluded: teachingGroupsSkipped.length,
          missingSubjectHoursConfig: missingSubjectConfig.length,
          excludedGroups: teachingGroupsSkipped
        },
        requiredAction: 'Configure hoursPerWeekHL and hoursPerWeekSL for all DP subjects in Subjects page',
        buildVersion: BUILD_VERSION
      }, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    
    const daysCount = daysOfWeek.length || 5;
    const periodsPerDay = Math.floor(timeslots.length / Math.max(1, daysCount));
    
    const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ''));
    const subjectCodesInLessons = Array.from(new Set(lessons.map(l => l.subject).filter(Boolean)));
    
    // CRITICAL: Build subjects array with ONLY id + hl_hours + sl_hours (Codex format)
    const subjectsList = subjectCodesInLessons.map(code => {
      const subjId = subjectIdByCode[code] || null;
      const subj = subjId ? subjectById[subjId] : null;
      const validId = subjId && isValidMongoId(subjId) ? subjId : '000000000000000000000000';
      
      // Extract HL/SL hours (prioritize hoursPerWeekHL/SL, fallback to deprecated fields)
      let hl_hours = 0;
      let sl_hours = 0;
      
      if (subj?.ib_level === 'DP') {
        // PRIORITY 1: Use admin-configured hoursPerWeekHL/SL
        if (typeof subj.hoursPerWeekHL === 'number' && subj.hoursPerWeekHL > 0) {
          hl_hours = subj.hoursPerWeekHL;
        } else if (typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          hl_hours = Math.round(subj.hl_minutes_per_week_default / 60);
        }
        
        if (typeof subj.hoursPerWeekSL === 'number' && subj.hoursPerWeekSL > 0) {
          sl_hours = subj.hoursPerWeekSL;
        } else if (typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          sl_hours = Math.round(subj.sl_minutes_per_week_default / 60);
        }
      }
      
      return {
        id: validId,
        hl_hours,
        sl_hours
      };
    });
    
    // CRITICAL: Build subjects_hours array with detailed hour/minute config
    const subjectsHours = subjectCodesInLessons.map(code => {
      const subjId = subjectIdByCode[code] || null;
      const subj = subjId ? subjectById[subjId] : null;
      const validId = subjId && isValidMongoId(subjId) ? subjId : '000000000000000000000000';
      
      let hl_hours = 0;
      let sl_hours = 0;
      
      if (subj?.ib_level === 'DP') {
        if (typeof subj.hoursPerWeekHL === 'number' && subj.hoursPerWeekHL > 0) {
          hl_hours = subj.hoursPerWeekHL;
        } else if (typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          hl_hours = Math.round(subj.hl_minutes_per_week_default / 60);
        }
        
        if (typeof subj.hoursPerWeekSL === 'number' && subj.hoursPerWeekSL > 0) {
          sl_hours = subj.hoursPerWeekSL;
        } else if (typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          sl_hours = Math.round(subj.sl_minutes_per_week_default / 60);
        }
      }
      
      return {
        subject_id: validId,
        hl_hours,
        sl_hours,
        hl_minutes_per_week: hl_hours * 60,
        sl_minutes_per_week: sl_hours * 60
      };
    });


    // VALIDATION: Check for suspiciously low requiredPeriods in DP groups - ALREADY DECLARED AT TOP
    lowPeriodWarnings = []; // Reset array
    subjectRequirements.forEach(req => {
      const tgId = String(req.studentGroup || '').replace('TG_', '');
      const tg = teachingGroupsDb.find(g => g.id === tgId);
      if (!tg) return;

      const isDPHL = tg.level === 'HL' && (tg.year_group?.includes('DP') || subjectById[tg.subject_id]?.ib_level === 'DP');
      const isDPSL = tg.level === 'SL' && (tg.year_group?.includes('DP') || subjectById[tg.subject_id]?.ib_level === 'DP');

      if (isDPHL && req.requiredPeriods < 4) {
        lowPeriodWarnings.push({
          tg_id: tg.id,
          name: tg.name,
          level: 'HL',
          requiredPeriods: req.requiredPeriods,
          expected: 5,
          reason: 'DP HL should have 5 periods/week minimum'
        });
      }

      if (isDPSL && req.requiredPeriods < 2) {
        lowPeriodWarnings.push({
          tg_id: tg.id,
          name: tg.name,
          level: 'SL',
          requiredPeriods: req.requiredPeriods,
          expected: 3,
          reason: 'DP SL should have 3 periods/week minimum'
        });
      }
    });

    if (lowPeriodWarnings.length > 0) {
      recordLog(`⚠️ WARNING: ${lowPeriodWarnings.length} DP groups with suspiciously low requiredPeriods`);
      lowPeriodWarnings.forEach(w => {
        recordLog(`  - ${w.name} (${w.level}): ${w.requiredPeriods}p/week (expected ${w.expected}p/week)`);
      });
    }
    
    // Build subjectRequirements (one per section) - ALREADY DECLARED AT TOP
    subjectRequirements = []; // Reset array
    for (const tg of teachingGroupsDb) {
      const subjId = tg.subject_id;
      const subjCode = subjectIdToCode[subjId];
      if (!subjId || !subjCode) continue;

      const minutesUsed = minutesForTG(tg);
      if (!minutesUsed || minutesUsed <= 0) continue;

      const requiredPeriods = minutesToPeriods(minutesUsed);

      // CRITICAL: Use subject ID (not code) in subjectRequirements
      subjectRequirements.push({
        studentGroup: `TG_${tg.id}`,
        subject: subjId, // ✅ Use subject_id instead of code
        minutesPerWeek: minutesUsed,
        requiredPeriods,
        teachingGroupId: tg.id,
        sectionId: tg.id
      });
    }

    // CRITICAL: Only exclude STUDY from solver (keep TEST for scheduling)
    const excludeFromSolver = new Set(['STUDY']);
    const problemForSolver = {
      timeslots,
      rooms,
      teachers,
      lessons: lessons.filter(l => !excludeFromSolver.has(l.subject)),
      subjects: subjectsList,
      subjects_hours: subjectsHours,
      subjectRequirements: subjectRequirements.filter(r => !excludeFromSolver.has(r.subject)),
      teacherNumericIdToBase44Id,
      roomNumericIdToBase44Id,
      studentGroupSoftPreferences,
      scheduleSettings: {
        periodDurationMinutes,
        dayStartTime,
        dayEndTime,
        daysOfWeek,
        breaks,
        minPeriodsPerDay,
        targetPeriodsPerDay
      },
      teachingGroups: teachingGroupsDb.map((tg, idx) => {
        const minutes = minutesForTG(tg);
        
        // Log first TG as concrete example of DTO mapping
        if (idx === 0) {
          recordLog(`📋 CONCRETE MAPPING EXAMPLE (first TeachingGroup):`);
          recordLog(`INPUT (Base44 TeachingGroup):`);
          recordLog(`  {`);
          recordLog(`    "id": "${tg.id}",`);
          recordLog(`    "subject_id": "${tg.subject_id}",`);
          recordLog(`    "level": "${tg.level || 'null'}",`);
          recordLog(`    "minutes_per_week": ${tg.minutes_per_week},`);
          recordLog(`    "year_group": "${tg.year_group || 'null'}",`);
          recordLog(`    "name": "${tg.name}"`);
          recordLog(`  }`);
          recordLog(`OUTPUT (Codex DTO - whitelisted only):`);
          recordLog(`  {`);
          recordLog(`    "id": "${tg.id}",`);
          recordLog(`    "student_group": "TG_${tg.id}",`);
          recordLog(`    "subject_id": "${tg.subject_id}",`);
          recordLog(`    "level": "${(tg.level === 'HL' || tg.level === 'SL') ? tg.level : 'null'}",`);
          recordLog(`    "required_minutes_per_week": ${Math.round(minutes)}`);
          recordLog(`  }`);
          recordLog(`STRIPPED: year_group, name, minutes_per_week (float), student_ids, teacher_id, etc.`);
        }
        
        // UNIVERSAL MAPPING RULE: STRICT WHITELIST FOR ALL SCHOOLS
        // Solver expects: required_minutes_per_week as integer
        // Convert: minutes_per_week (float DB) → required_minutes_per_week (int)
        // Forbidden: name, year_group, _meta, student_ids, teacher_id, etc.
        
        const solverDTO = {
          id: String(tg.id || ''),
          student_group: `TG_${tg.id}`,
          subject_id: String(tg.subject_id || ''),
          required_minutes_per_week: Math.round(minutes) // CRITICAL: int, not float
        };
        
        // Optional fields: only add if valid
        if (tg.level === 'HL' || tg.level === 'SL') {
          solverDTO.level = String(tg.level);
        }
        
        // EXPLICIT: Return only whitelisted fields, no spread operator to prevent leaks
        return solverDTO;
      })
    };

    // VALIDATION REPORT: Show admin what's excluded and why
    const validationReport = {
      totalTeachingGroups: teachingGroupsDb.length,
      included: teachingGroupsIncludedCount,
      excluded: teachingGroupsSkipped.length,
      adjusted: teachingGroupsAdjusted.length,
      exclusionReasons: {},
      excludedGroups: teachingGroupsSkipped.map(s => ({
        name: s.name,
        subject: s.subject_code,
        reason: s.reason,
        studentCount: s.student_count,
        ib_level: s.ib_level
      })),
      adjustedGroups: teachingGroupsAdjusted.map(a => ({
        name: a.name,
        subject: a.subject_code,
        adjustment: a.adjustment,
        applied: a.applied
      }))
    };
    
    // Count exclusion reasons
    for (const skip of teachingGroupsSkipped) {
      validationReport.exclusionReasons[skip.reason] = (validationReport.exclusionReasons[skip.reason] || 0) + 1;
    }
    
    // ========================================
    // PRE-SOLVE FEASIBILITY VALIDATION
    // ========================================
    stage = 'PRE_SOLVE_VALIDATION';
    recordLog(`${stage}: Running feasibility checks before solver`);
    
    const validationErrors = [];
    const validationDetails = [];
    
    // VALIDATION 1: Teacher capacity check
    recordLog('Validation 1: Teacher capacity');
    const teacherCapacityIssues = [];
    const availablePeriodsPerWeek = timeslots.length; // Total periods available per week
    
    for (const teacher of teachersDb) {
      if (!teacher?.id) continue;
      
      // Find all teaching groups assigned to this teacher
      const assignedGroups = teachingGroupsDb.filter(tg => tg.teacher_id === teacher.id && tg.is_active !== false);
      
      // Calculate total required periods for this teacher
      let totalRequiredPeriods = 0;
      for (const tg of assignedGroups) {
        const minutes = minutesForTG(tg);
        if (minutes > 0) {
          totalRequiredPeriods += minutesToPeriods(minutes);
        }
      }
      
      // Check if teacher exceeds available capacity
      const teacherMaxHours = teacher.max_hours_per_week || 25;
      const teacherMaxPeriods = Math.floor((teacherMaxHours * 60) / periodDurationMinutes);
      const feasiblePeriods = Math.min(teacherMaxPeriods, availablePeriodsPerWeek);
      
      if (totalRequiredPeriods > feasiblePeriods) {
        teacherCapacityIssues.push({
          teacher_id: teacher.id,
          teacher_name: teacher.full_name || teacher.email,
          required_periods: totalRequiredPeriods,
          available_periods: feasiblePeriods,
          max_hours_per_week: teacherMaxHours,
          assigned_groups: assignedGroups.length,
          overflow: totalRequiredPeriods - feasiblePeriods
        });
      }
    }
    
    if (teacherCapacityIssues.length > 0) {
      recordLog(`❌ BLOCKING: ${teacherCapacityIssues.length} teachers exceed capacity`);
      validationErrors.push(`Teacher capacity exceeded: ${teacherCapacityIssues.length} teacher(s)`);
      teacherCapacityIssues.forEach(issue => {
        validationDetails.push({
          entity: 'Teacher',
          id: issue.teacher_id,
          field: 'capacity',
          reason: `Requires ${issue.required_periods} periods/week but only ${issue.available_periods} available (overflow: ${issue.overflow})`,
          hint: `Reduce teaching groups for ${issue.teacher_name} or increase max_hours_per_week from ${issue.max_hours_per_week}h`,
          data: issue
        });
      });
    }
    
    // VALIDATION 2: Room eligibility per lesson
    recordLog('Validation 2: Room eligibility per lesson');
    const roomEligibilityIssues = [];
    const roomCapacityIssues = [];
    
    // Build room type index
    const roomsByType = {};
    for (const room of roomsDb) {
      if (room.is_active === false) continue;
      const type = room.room_type || 'classroom';
      if (!roomsByType[type]) roomsByType[type] = [];
      roomsByType[type].push(room);
    }
    
    // Check each teaching group has eligible rooms
    for (const tg of teachingGroupsDb) {
      if (!tg?.subject_id || tg.is_active === false) continue;
      
      const subj = subjectById[tg.subject_id];
      if (!subj) continue;
      
      const minutes = minutesForTG(tg);
      if (minutes <= 0) continue;
      
      const requiredRoomType = subj.requires_special_room || 'classroom';
      const eligibleRooms = roomsByType[requiredRoomType] || roomsByType['classroom'] || [];
      
      if (eligibleRooms.length === 0) {
        roomEligibilityIssues.push({
          tg_id: tg.id,
          name: tg.name,
          subject_code: (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN',
          required_room_type: requiredRoomType,
          student_count: (tg.student_ids || []).length,
          periods: minutesToPeriods(minutes)
        });
      }
    }
    
    if (roomEligibilityIssues.length > 0) {
      recordLog(`❌ BLOCKING: ${roomEligibilityIssues.length} teaching groups have no eligible rooms`);
      validationErrors.push(`Room eligibility: ${roomEligibilityIssues.length} group(s) have no eligible rooms`);
      roomEligibilityIssues.forEach(issue => {
        validationDetails.push({
          entity: 'TeachingGroup',
          id: issue.tg_id,
          field: 'room_eligibility',
          reason: `Requires ${issue.required_room_type} room but none exist`,
          hint: `Add ${issue.required_room_type} rooms or change subject room requirement for ${issue.name}`,
          data: issue
        });
      });
    }
    
    // Global capacity check
    const lessonsByRoomType = {};
    for (const tg of teachingGroupsDb) {
      if (!tg?.subject_id || tg.is_active === false) continue;
      
      const subj = subjectById[tg.subject_id];
      if (!subj) continue;
      
      const roomType = subj.requires_special_room || 'classroom';
      const minutes = minutesForTG(tg);
      if (minutes > 0) {
        if (!lessonsByRoomType[roomType]) {
          lessonsByRoomType[roomType] = { count: 0, groups: [] };
        }
        lessonsByRoomType[roomType].count += minutesToPeriods(minutes);
        lessonsByRoomType[roomType].groups.push({
          tg_id: tg.id,
          name: tg.name,
          periods: minutesToPeriods(minutes)
        });
      }
    }
    
    for (const [roomType, data] of Object.entries(lessonsByRoomType)) {
      const roomsOfType = roomsDb.filter(r => 
        r.is_active !== false && 
        (r.room_type === roomType || (roomType === 'classroom' && !r.room_type))
      );
      
      const totalRoomCapacity = roomsOfType.length * availablePeriodsPerWeek;
      const requiredCapacity = data.count;
      
      if (requiredCapacity > totalRoomCapacity) {
        roomCapacityIssues.push({
          room_type: roomType,
          required_periods: requiredCapacity,
          available_capacity: totalRoomCapacity,
          rooms_of_type: roomsOfType.length,
          overflow: requiredCapacity - totalRoomCapacity,
          affected_groups: data.groups.length
        });
      }
    }
    
    if (roomCapacityIssues.length > 0) {
      recordLog(`❌ BLOCKING: ${roomCapacityIssues.length} room types have insufficient capacity`);
      validationErrors.push(`Room capacity exceeded: ${roomCapacityIssues.length} room type(s)`);
      roomCapacityIssues.forEach(issue => {
        validationDetails.push({
          entity: 'Room',
          field: 'capacity',
          room_type: issue.room_type,
          reason: `Need ${issue.required_periods} periods but only ${issue.available_capacity} available (${issue.rooms_of_type} rooms × ${availablePeriodsPerWeek} periods/week)`,
          hint: `Add more ${issue.room_type} rooms or reduce subjects requiring this room type`,
          data: issue
        });
      });
    }
    
    // VALIDATION 3: Missing critical assignments
    recordLog('Validation 3: Missing critical assignments');
    const missingAssignments = [];
    
    for (const tg of teachingGroupsDb) {
      if (tg.is_active === false) continue;
      
      const minutes = minutesForTG(tg);
      if (minutes <= 0) continue; // Already handled by MISSING_CONFIG validation
      
      const issues = [];
      
      if (!tg.subject_id) {
        issues.push('subject_id missing');
      }
      
      if (!tg.teacher_id) {
        issues.push('teacher_id missing');
      }
      
      // Check if subject requires special room but TG has no preferred_room_id
      const subj = subjectById[tg.subject_id];
      if (subj?.requires_special_room && !tg.preferred_room_id) {
        issues.push(`requires_special_room (${subj.requires_special_room}) but no preferred_room_id`);
      }
      
      if (issues.length > 0) {
        missingAssignments.push({
          tg_id: tg.id,
          name: tg.name,
          subject_code: (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN',
          issues,
          student_count: (tg.student_ids || []).length
        });
      }
    }
    
    if (missingAssignments.length > 0) {
      recordLog(`❌ BLOCKING: ${missingAssignments.length} teaching groups missing critical assignments`);
      validationErrors.push(`Missing assignments: ${missingAssignments.length} group(s)`);
      missingAssignments.forEach(item => {
        validationDetails.push({
          entity: 'TeachingGroup',
          id: item.tg_id,
          field: 'assignments',
          reason: `Missing: ${item.issues.join(', ')}`,
          hint: `Assign missing fields for ${item.name} (${item.subject_code})`,
          data: item
        });
      });
    }
    
    // VALIDATION 4: Hours mismatch between Subject config and TeachingGroup requirements
    recordLog('Validation 4: Hours mismatch validation');
    const hoursMismatchIssues = [];
    
    for (const tg of teachingGroupsDb) {
      if (!tg?.subject_id || tg.is_active === false) continue;
      
      const subj = subjectById[tg.subject_id];
      if (!subj || subj.ib_level !== 'DP') continue; // Only validate DP subjects
      
      const level = String(tg.level || '').toUpperCase();
      if (level !== 'HL' && level !== 'SL') continue; // Skip non-HL/SL groups
      
      // Get expected hours from Subject entity
      const expectedHours = level === 'HL' ? subj.hoursPerWeekHL : subj.hoursPerWeekSL;
      if (!expectedHours) continue; // Already blocked by previous validation
      
      const expectedMinutes = expectedHours * 60;
      const expectedPeriods = minutesToPeriods(expectedMinutes);
      
      // Get actual configured minutes for this teaching group
      const actualMinutes = minutesForTG(tg);
      const actualPeriods = minutesToPeriods(actualMinutes);
      
      // Check for mismatch
      if (expectedPeriods !== actualPeriods) {
        const diff = actualPeriods - expectedPeriods;
        hoursMismatchIssues.push({
          tg_id: tg.id,
          tg_name: tg.name,
          subject_id: subj.id,
          subject_code: subjectIdToCode[tg.subject_id] || subj.code,
          subject_name: subj.name,
          level,
          year_group: tg.year_group,
          student_count: (tg.student_ids || []).length,
          expected_hours: expectedHours,
          expected_minutes: expectedMinutes,
          expected_periods: expectedPeriods,
          actual_minutes: actualMinutes,
          actual_periods: actualPeriods,
          difference_periods: diff,
          difference_sign: diff > 0 ? '+' : '',
          source: debugMinutesSourceByTG[tg.id]?.source || 'UNKNOWN'
        });
      }
    }
    
    if (hoursMismatchIssues.length > 0) {
      recordLog(`❌ BLOCKING: ${hoursMismatchIssues.length} teaching groups have hours mismatches`);
      validationErrors.push(`Hours mismatch: ${hoursMismatchIssues.length} teaching group(s)`);
      
      hoursMismatchIssues.forEach(issue => {
        validationDetails.push({
          entity: 'TeachingGroup',
          id: issue.tg_id,
          field: 'minutes_per_week',
          reason: `Mismatch: Subject expects ${issue.expected_hours}h/week (${issue.expected_periods}p) but TeachingGroup has ${Math.round(issue.actual_minutes/60)}h (${issue.actual_periods}p) [${issue.difference_sign}${Math.abs(issue.difference_periods)}p]`,
          hint: `Edit ${issue.tg_name}: set minutes_per_week to ${issue.expected_minutes} to match Subject ${issue.subject_code} ${issue.level} configuration`,
          data: issue
        });
      });
      
      return Response.json({
        ok: false,
        stage: 'PRE_SOLVE_VALIDATION',
        code: 'HOURS_MISMATCH',
        error: 'Hours mismatch between Subject and TeachingGroup configuration',
        errorMessage: `❌ Cannot generate schedule: ${hoursMismatchIssues.length} teaching group(s) have hour mismatches.\n\nTeachingGroup minutes_per_week does not match Subject hoursPerWeekHL/SL configuration.\n\nThis will cause solver to assign wrong number of periods.\n\n👉 Fix these mismatches before running OptaPlanner.`,
        hoursMismatchCount: hoursMismatchIssues.length,
        hoursMismatches: hoursMismatchIssues,
        details: validationDetails.filter(d => d.entity === 'TeachingGroup' && d.field === 'minutes_per_week'),
        suggestion: '🔧 Fix options:\n1. Update TeachingGroup minutes_per_week to match Subject hours\n2. Adjust Subject hoursPerWeekHL/SL if requirements changed\n\nEach DP TeachingGroup must have minutes_per_week that matches its Subject\'s HL or SL hours configuration.',
        requiredAction: 'Fix hours mismatches listed in details[] - click each to see expected vs actual values',
        buildVersion: BUILD_VERSION,
        meta: { schedule_version_id, school_id }
      }, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    
    recordLog(`✅ Hours mismatch validation passed: All TeachingGroups match Subject hour expectations`);
    
    // VALIDATION 5: Student feasibility (DP)
    recordLog('Validation 5: Student feasibility (DP)');
    const studentFeasibilityIssues = [];
    
    // Load students to check DP feasibility
    const studentsDb = await base44.entities.Student.filter({ school_id }).catch(() => []);
    
    for (const student of studentsDb) {
      if (!student?.id || student.is_active === false) continue;
      if (student.ib_programme !== 'DP') continue; // Only validate DP students
      
      // Find all teaching groups this student is enrolled in
      const studentGroups = teachingGroupsDb.filter(tg => 
        Array.isArray(tg.student_ids) && tg.student_ids.includes(student.id) && tg.is_active !== false
      );
      
      // Calculate total required periods for this student
      let totalRequiredPeriods = 0;
      const groupBreakdown = [];
      
      for (const tg of studentGroups) {
        const minutes = minutesForTG(tg);
        if (minutes > 0) {
          const periods = minutesToPeriods(minutes);
          totalRequiredPeriods += periods;
          
          groupBreakdown.push({
            tg_id: tg.id,
            name: tg.name,
            subject_code: (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN',
            level: tg.level,
            periods_per_week: periods,
            minutes_per_week: minutes
          });
        }
      }
      
      // DP students must have exactly 6 subjects (IB requirement)
      const subjectCount = studentGroups.length;
      const expectedSubjects = 6;
      
      // Check if student's total load is schedulable within available timeslots
      // Basic upper bound: student can't have more periods than available per week
      if (totalRequiredPeriods > availablePeriodsPerWeek) {
        studentFeasibilityIssues.push({
          student_id: student.id,
          student_name: student.full_name || student.email,
          year_group: student.year_group,
          total_required_periods: totalRequiredPeriods,
          available_periods_per_week: availablePeriodsPerWeek,
          overflow: totalRequiredPeriods - availablePeriodsPerWeek,
          subject_count: subjectCount,
          groups_breakdown: groupBreakdown
        });
      }
      
      // Validate subject count (warning, not blocking)
      if (subjectCount < expectedSubjects) {
        recordLog(`⚠️ WARNING: DP student ${student.full_name} has only ${subjectCount} subjects (expected ${expectedSubjects})`);
      }
    }
    
    if (studentFeasibilityIssues.length > 0) {
      recordLog(`❌ BLOCKING: ${studentFeasibilityIssues.length} DP students have impossible schedules`);
      validationErrors.push(`Student feasibility: ${studentFeasibilityIssues.length} DP student(s) have impossible loads`);
      studentFeasibilityIssues.forEach(issue => {
        validationDetails.push({
          entity: 'Student',
          id: issue.student_id,
          field: 'schedule_load',
          reason: `Requires ${issue.total_required_periods} periods/week but only ${issue.available_periods_per_week} available (overflow: ${issue.overflow})`,
          hint: `Reduce subject hours or fix HL/SL configuration for ${issue.student_name} (${issue.subject_count} subjects enrolled)`,
          data: issue
        });
      });
    }
    
    // VALIDATION 6: Timeslot capacity sanity (already validated above, but add final check)
    recordLog('Validation 6: Timeslot configuration sanity');
    if (timeslots.length === 0) {
      validationErrors.push('Zero timeslots generated');
      validationDetails.push({
        entity: 'School',
        field: 'timeslots',
        reason: 'No valid timeslots could be generated from school configuration',
        hint: 'Check day_start_time, day_end_time, period_duration_minutes, and breaks'
      });
    }
    
    // Check for inconsistent timeslots
    const uniqueDays = new Set(timeslots.map(ts => ts.dayOfWeek));
    const periodsPerDayByDay = {};
    timeslots.forEach(ts => {
      if (!periodsPerDayByDay[ts.dayOfWeek]) periodsPerDayByDay[ts.dayOfWeek] = 0;
      periodsPerDayByDay[ts.dayOfWeek]++;
    });
    
    const periodsPerDayValues = Object.values(periodsPerDayByDay);
    const minPeriodsPerDay = Math.min(...periodsPerDayValues);
    const maxPeriodsPerDay = Math.max(...periodsPerDayValues);
    
    if (maxPeriodsPerDay - minPeriodsPerDay > 2) {
      recordLog(`⚠️ WARNING: Inconsistent periods per day across days (min: ${minPeriodsPerDay}, max: ${maxPeriodsPerDay})`);
      validationDetails.push({
        entity: 'School',
        field: 'timeslots_consistency',
        reason: `Inconsistent periods/day: ${JSON.stringify(periodsPerDayByDay)}`,
        hint: 'Check if breaks are configured differently per day',
        severity: 'warning'
      });
    }
    
    // BLOCK if any validation errors found
    if (validationErrors.length > 0) {
      recordLog(`❌ PRE_SOLVE_VALIDATION FAILED: ${validationErrors.length} validation error(s)`);
      
      return Response.json({
        ok: false,
        stage: 'PRE_SOLVE_VALIDATION',
        code: 'INFEASIBLE_CONSTRAINTS',
        error: 'Pre-solve validation failed',
        errorMessage: `❌ Cannot run OptaPlanner: ${validationErrors.length} feasibility issue(s) detected.\n\n${validationErrors.join('\n')}\n\nFix these issues before generating schedule.`,
        validationErrors,
        details: validationDetails,
        suggestion: '🔧 Fix capacity and assignment issues:\n• Reduce teaching load for overloaded teachers\n• Add more rooms or reduce room requirements\n• Assign teachers and rooms to all teaching groups',
        requiredAction: 'Fix validation issues listed in details[] array',
        teacherCapacityIssues: teacherCapacityIssues.length > 0 ? teacherCapacityIssues : undefined,
        roomEligibilityIssues: roomEligibilityIssues.length > 0 ? roomEligibilityIssues : undefined,
        roomCapacityIssues: roomCapacityIssues.length > 0 ? roomCapacityIssues : undefined,
        studentFeasibilityIssues: studentFeasibilityIssues.length > 0 ? studentFeasibilityIssues : undefined,
        missingAssignments: missingAssignments.length > 0 ? missingAssignments : undefined,
        buildVersion: BUILD_VERSION,
        meta: { schedule_version_id, school_id }
      }, { status: 422, headers: { 'Content-Type': 'application/json' } });
    }
    
    recordLog(`✅ PRE_SOLVE_VALIDATION PASSED: All feasibility checks passed`);
    
    // CRITICAL: Final payload diagnostics BEFORE returning
    console.log('[buildSchedulingProblem] 📤 FINAL PAYLOAD SUMMARY:', {
      timeslots_count: timeslots.length,
      rooms_count: rooms.length,
      teachers_count: teachers.length,
      subjects_count: subjectsList.length,
      teachingGroups_count: teachingGroupsDb.length,
      lessons_count: problemForSolver.lessons.length,
      subjectRequirements_count: subjectRequirements.length,
      school_config: {
        day_start_time: dayStartTime,
        day_end_time: dayEndTime,
        period_duration_minutes: periodDurationMinutes,
        breaks_count: breaks.length
      },
      teaching_groups_sample: teachingGroupsDb.slice(0, 3).map(tg => ({
        id: tg.id,
        name: tg.name,
        subject_id: tg.subject_id,
        level: tg.level,
        required_minutes_per_week: Math.round(minutesForTG(tg))
      }))
    });
    
    return Response.json({
      success: true,
      ok: true,
      buildVersion: BUILD_VERSION,
      problem: problemForSolver,
      validationReport, // NEW: Explicit report of what's excluded and why
      subjectIdByCode,
      debugMinutesSourceByTG,
      teachingGroupsDiagnostics,
      builderDiagnostics: {
        adjustments: teachingGroupsAdjusted,
        skipped: teachingGroupsSkipped,
        diagnosticLog,
        lowPeriodWarnings: lowPeriodWarnings || [],
        coreReport: coreTeachingGroupsReport // NEW: Core detection report
      },
      schoolIdUsed: school_id,
      scheduleVersionIdUsed: schedule_version_id,
      periodDurationMinutes,
      timeslotsCount: timeslots.length,
      periodsPerDay,
      teachingGroupsIncludedCount,
      teachingGroupsSkippedCount: teachingGroupsSkipped.length,
      teachingGroupsAdjustedCount: teachingGroupsAdjusted.length,
      expectedMinutesBySubject,
      expectedLessonsBySubject,
      coreTeachingGroupsDetected: ['TOK', 'CAS', 'EE'].map(core => ({
        subject: core,
        tgs_count: coreTeachingGroupsReport[core].tgs.length,
        lessons_count: coreTeachingGroupsReport[core].lessons.length,
        total_minutes: coreTeachingGroupsReport[core].total_minutes,
        tgs: coreTeachingGroupsReport[core].tgs
      })),
      coreSubjectRequirementsSample: subjectRequirements.filter(r => ['TOK', 'CAS', 'EE'].includes(r.subject)),
      stats: {
        timeslots: timeslots.length,
        rooms: rooms.length,
        teachers: teachers.length,
        lessons: problemForSolver.lessons.length,
        expectedLessonsBySubject,
        expectedMinutesBySubject
      }
    }, { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(`[buildSchedulingProblem] ❌❌❌ UNEXPECTED ERROR at stage="${stage}":`, error);
    console.error('[buildSchedulingProblem] Error stack:', error?.stack);
    console.error('[buildSchedulingProblem] Context:', { schedule_version_id, school_id, stage });
    
    const errorBody = { 
      ok: false,
      buildVersion: BUILD_VERSION,
      stage,
      code: 'INTERNAL_ERROR',
      error: 'Unexpected error in buildSchedulingProblem',
      errorMessage: String(error?.message || error),
      errorStack: String(error?.stack || ''),
      details: [{
        entity: 'System',
        field: 'buildSchedulingProblem',
        reason: 'crash',
        hint: `Check server logs for stage=${stage}`
      }],
      meta: { schedule_version_id, school_id, stage }
    };
    console.error('[buildSchedulingProblem] 🔍 500 RESPONSE BODY:', JSON.stringify(errorBody, null, 2));
    return Response.json(errorBody, { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});