import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/*
Build scheduling problem from TeachingGroups using minutes/week + school schedule settings
Request body:
{
  schedule_version_id: string,
  school_id?: string,
  dp_study_weekly?: number,
  dp_min_end_time?: string, // e.g. "14:30"
}
Response:
{
  success: true,
  problem: {
    timeslots: [...],
    rooms: [...],
    teachers: [...],
    lessons: [...],
    subjectIdByCode: {...},
    teacherNumericIdToBase44Id: {...},
    roomNumericIdToBase44Id: {...},
    teacherNumericIdToExternalRef: {...},
    roomNumericIdToExternalRef: {...},
    studentGroupSoftPreferences: {...},
    // NEW
    scheduleSettings: {
      periodDurationMinutes,
      dayStartTime,
      dayEndTime,
      daysOfWeek,
      breaks,
      minPeriodsPerDay,
      targetPeriodsPerDay
    },
    teachingGroups: [
      { id, subject_id, minutesPerWeek, teacher_id, room_id, ib_level }
    ]
  },
  meta: {...},
  stats: {...}
}
*/

Deno.serve(async (req) => {
  let stage = 'init';
  let school_id = null;
  let schedule_version_id = null;
  let base44 = null;
  
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
    let scheduleVersionSchoolId = null;

    if (!user) {
      return Response.json({ error: 'Unauthorized', code: 'NO_USER', guardFailureCode: 'NOT_AUTHENTICATED', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 401 });
    }
    if (!user.school_id) {
      return Response.json({ error: 'Forbidden: user missing school_id', code: 'NO_SCHOOL_ON_USER', guardFailureCode: 'NO_SCHOOL_ON_USER', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }
    if (requestedSchoolId && requestedSchoolId !== user.school_id) {
      return Response.json({ error: 'Forbidden: Cross-school access', code: 'CROSS_SCHOOL', guardFailureCode: 'CROSS_SCHOOL', whoami, requestedSchoolId, scheduleVersionSchoolId }, { status: 403 });
    }

    school_id = user.school_id;

    stage = 'loadSchool';
    console.log(`[buildSchedulingProblem] ${stage}: school_id=${school_id}, schedule_version_id=${schedule_version_id}`);
    
    // Fetch school + resources (with null-safety)
    // CRITICAL: Fetch ALL entities then filter locally (is_active: true excludes null/undefined)
    const [school, allRooms, allTeachers, allSubjects, allTeachingGroups] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(r => r?.[0] || null).catch(() => null),
      base44.entities.Room.filter({ school_id }).catch(() => []),
      base44.entities.Teacher.filter({ school_id }).catch(() => []),
      base44.entities.Subject.filter({ school_id }).catch(() => []),
      base44.entities.TeachingGroup.filter({ school_id }).catch(() => []),
    ]);
    
    // Filter locally: is_active !== false (includes null/undefined/true)
    const roomsDb = (allRooms || []).filter(r => r?.is_active !== false);
    const teachersDb = (allTeachers || []).filter(t => t?.is_active !== false);
    const subjectsDb = (allSubjects || []).filter(s => s?.is_active !== false);
    const teachingGroupsDb = (allTeachingGroups || []).filter(tg => tg?.is_active !== false);

    if (!school) {
      return Response.json({ ok: false, stage, error: 'School not found', meta: { schedule_version_id, school_id } }, { status: 404 });
    }

    stage = 'validateSchoolSettings';
    console.log(`[buildSchedulingProblem] ${stage}: validating school settings`);
    
    // Validate required school settings
    const periodDurationMinutes = Number(school.period_duration_minutes || 60);
    const dayStartTime = String(school.day_start_time || school.school_start_time || '08:00');
    const dayEndTime = String(school.day_end_time || '18:00');
    const daysOfWeek = Array.isArray(school.days_of_week) && school.days_of_week.length > 0
      ? school.days_of_week
      : ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'];
    
    if (!periodDurationMinutes || periodDurationMinutes <= 0) {
      return Response.json({ 
        ok: false, stage, 
        error: 'Invalid period_duration_minutes in school settings', 
        meta: { schedule_version_id, school_id, period_duration_minutes: school.period_duration_minutes } 
      }, { status: 400 });
    }
    
    if (!daysOfWeek || daysOfWeek.length === 0) {
      return Response.json({ 
        ok: false, stage, 
        error: 'Invalid or missing days_of_week in school settings', 
        meta: { schedule_version_id, school_id, days_of_week: school.days_of_week } 
      }, { status: 400 });
    }

    stage = 'validateResources';
    console.log(`[buildSchedulingProblem] ${stage}: subjects=${subjectsDb.length}, teachingGroups=${teachingGroupsDb.length}, rooms=${roomsDb.length}, teachers=${teachersDb.length}`);
    
    if (subjectsDb.length === 0) {
      return Response.json({ 
        ok: false, stage, 
        error: 'No subjects found in database', 
        meta: { schedule_version_id, school_id, subjects: 0, teachingGroups: teachingGroupsDb.length } 
      }, { status: 400 });
    }
    
    if (teachingGroupsDb.length === 0) {
      return Response.json({ 
        ok: false, stage, 
        error: 'No teaching groups found in database', 
        meta: { schedule_version_id, school_id, subjects: subjectsDb.length, teachingGroups: 0 } 
      }, { status: 400 });
    }

    stage = 'buildSubjectsIndex';
    console.log(`[buildSchedulingProblem] ${stage}: building subject mappings`);
    
    // CRITICAL: Helpers declared FIRST to avoid Temporal Dead Zone
    const normalizeSubjectCode = (raw) => {
      if (!raw) return null;
      const s = String(raw).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      return s || null;
    };
    
    const normalizeCode = (raw) => {
      if (!raw) return '';
      return String(raw).trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_');
    };

    // Subject id->code and lookups (null-safe)
    const subjectIdToCode = {};
    const subjectIdByCode = {};
    const subjectById = {};
    for (const subj of (subjectsDb || [])) {
      if (!subj?.id) continue;
      subjectById[subj.id] = subj;
      const raw = String(subj.code || subj.name || subj.id || '').trim();
      const norm = normalizeSubjectCode(raw);
      if (norm) subjectIdToCode[subj.id] = norm;
      const aliases = new Set([raw.toUpperCase(), norm, norm?.replace(/_/g, ' ')]);
      aliases.forEach((k) => { if (k) subjectIdByCode[k] = subj.id; });
    }

    stage = 'generateTimeslots';
    console.log(`[buildSchedulingProblem] ${stage}: period=${periodDurationMinutes}min, days=${daysOfWeek.length}`);
    
    const breaks = Array.isArray(school.breaks) ? school.breaks : [];
    const minPeriodsPerDay = Number(school.min_periods_per_day || 10);
    const targetPeriodsPerDay = Number(school.target_periods_per_day || 10);

    // Build timeslots across dayStart->dayEnd, step by periodDuration, skip break overlaps
    const timeToMin = (hhmm) => {
      const [h,m] = String(hhmm).split(':').map(Number);
      return (h||0) * 60 + (m||0);
    };
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

    // Rooms/Teachers numeric format & maps (null-safe)
    const rooms = (roomsDb || []).map((r, idx) => ({ id: idx + 1, name: r?.name || `Room ${idx+1}`, capacity: r?.capacity || 0 }));
    const teachers = (teachersDb || []).map((t, idx) => ({ id: idx + 1, name: t?.full_name || `Teacher ${idx+1}` }));
    const roomNumericIdToBase44Id = {};
    const teacherNumericIdToBase44Id = {};
    (roomsDb || []).forEach((r, idx) => { if (r?.id) roomNumericIdToBase44Id[idx+1] = r.id; });
    (teachersDb || []).forEach((t, idx) => { if (t?.id) teacherNumericIdToBase44Id[idx+1] = t.id; });
    const roomNumericIdToExternalRef = {};
    const teacherNumericIdToExternalRef = {};
    (roomsDb || []).forEach((r, idx) => { if (r) roomNumericIdToExternalRef[idx+1] = r.external_id || r.externalId || r.id; });
    (teachersDb || []).forEach((t, idx) => { if (t) teacherNumericIdToExternalRef[idx+1] = t.external_id || t.externalId || t.employee_id || t.id; });

    stage = 'buildLessons';
    console.log(`[buildSchedulingProblem] ${stage}: processing ${teachingGroupsDb.length} teaching groups`);
    
    // CRITICAL: Validate teacher mappings BEFORE creating lessons
    const invalidTeacherMappings = [];
    for (const tg of teachingGroupsDb) {
      if (!tg?.teacher_id) continue; // null/undefined is OK
      const teacherIdx = teachersDb.findIndex(t => t?.id === tg.teacher_id);
      if (teacherIdx === -1) {
        const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN';
        invalidTeacherMappings.push({
          tg_id: tg.id,
          tg_name: tg.name,
          subject_code: subjCode,
          teacher_id: tg.teacher_id,
          reason: 'Teacher ID not found in teachersDb'
        });
      }
    }
    
    if (invalidTeacherMappings.length > 0) {
      console.error('[buildSchedulingProblem] TEACHER_MAPPING_ERROR:', invalidTeacherMappings);
      return Response.json({
        ok: false,
        stage: 'TEACHER_MAPPING_ERROR',
        error: `${invalidTeacherMappings.length} teaching groups reference non-existent teachers`,
        invalidTeacherMappings,
        suggestion: 'Check: 1) Teacher exists and is active, 2) teacher_id is correct, 3) No orphaned references after teacher deletion',
        meta: { schedule_version_id, school_id }
      }, { status: 400 });
    }
    
    // CRITICAL: Validate room mappings BEFORE creating lessons
    const invalidRoomMappings = [];
    for (const tg of teachingGroupsDb) {
      if (!tg?.preferred_room_id) continue; // null/undefined is OK
      const roomIdx = roomsDb.findIndex(r => r?.id === tg.preferred_room_id);
      if (roomIdx === -1) {
        const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || 'UNKNOWN';
        invalidRoomMappings.push({
          tg_id: tg.id,
          tg_name: tg.name,
          subject_code: subjCode,
          preferred_room_id: tg.preferred_room_id,
          reason: 'Room ID not found in roomsDb'
        });
      }
    }
    
    if (invalidRoomMappings.length > 0) {
      console.error('[buildSchedulingProblem] ROOM_MAPPING_ERROR:', invalidRoomMappings);
      return Response.json({
        ok: false,
        stage: 'ROOM_MAPPING_ERROR',
        error: `${invalidRoomMappings.length} teaching groups reference non-existent rooms`,
        invalidRoomMappings,
        suggestion: 'Check: 1) Room exists and is active, 2) preferred_room_id is correct, 3) No orphaned references after room deletion',
        meta: { schedule_version_id, school_id }
      }, { status: 400 });
    }
    
    // Compute lessons from minutes/week
    const lessons = [];
    let lessonId = 1;
    const perSubjectCount = {};
    const expectedLessonsBySubject = {};
    const expectedMinutesBySubject = {};
    const teachingGroupsFilteredOut = [];
    let teachingGroupsIncludedCount = 0;

    const teachingGroupFilteredPush = (tg, reason) => {
      if (!tg) return;
      const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || null;
      const has_students = Array.isArray(tg.student_ids) && tg.student_ids.length > 0;
      const subj = (tg.subject_id && subjectById[tg.subject_id]) || null;
      teachingGroupsFilteredOut.push({
        tg_id: tg.id || null,
        name: tg.name || null,
        subject_code: subjCode,
        minutes_per_week: typeof tg.minutes_per_week === 'number' ? tg.minutes_per_week : null,
        ib_level: subj?.ib_level || null,
        year_group: tg.year_group || null,
        is_active: !!tg.is_active,
        has_students,
        teacher_id: tg.teacher_id || null,
        room_id: tg.preferred_room_id || null,
        reason
      });
    };

    // Track minutes source for each TG (debug proof)
    const debugMinutesSourceByTG = {};
    
    const minutesForTG = (tg) => {
      if (!tg) return 0;
      
      // CRITICAL: Priority 1 - Use admin-configured minutes_per_week on teaching group
      // This is the SOURCE OF TRUTH - never override with fallbacks if set
      if (typeof tg.minutes_per_week === 'number' && tg.minutes_per_week > 0) {
        console.log(`[buildSchedulingProblem] TG ${tg.id}: using TG.minutes_per_week = ${tg.minutes_per_week} (SOURCE OF TRUTH)`);
        debugMinutesSourceByTG[tg.id] = { source: 'TG_MINUTES', value: tg.minutes_per_week };
        return tg.minutes_per_week;
      }
      
      // Priority 2: Use periods_per_week if set (convert to minutes)
      if (typeof tg.periods_per_week === 'number' && tg.periods_per_week > 0) {
        const minutes = tg.periods_per_week * periodDurationMinutes;
        console.log(`[buildSchedulingProblem] TG ${tg.id}: using TG.periods_per_week = ${tg.periods_per_week} → ${minutes} min (SOURCE OF TRUTH)`);
        debugMinutesSourceByTG[tg.id] = { source: 'TG_PERIODS', value: minutes, periods: tg.periods_per_week };
        return minutes;
      }
      
      // Priority 3: Use hours_per_week (convert to minutes)
      if (typeof tg.hours_per_week === 'number' && tg.hours_per_week > 0) {
        const minutes = Math.round(tg.hours_per_week * 60);
        console.log(`[buildSchedulingProblem] TG ${tg.id}: using TG.hours_per_week = ${tg.hours_per_week}h → ${minutes} min (SOURCE OF TRUTH)`);
        debugMinutesSourceByTG[tg.id] = { source: 'TG_HOURS', value: minutes, hours: tg.hours_per_week };
        return minutes;
      }
      
      const subj = (tg.subject_id && subjectById[tg.subject_id]) || null;
      const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || null;
      const normCode = normalizeCode(subjCode);
      
      // Fallback 1: Core subjects (TOK/CAS/EE) default to 60 min/week
      if (normCode && ['TOK', 'CAS', 'EE'].includes(normCode)) {
        debugMinutesSourceByTG[tg.id] = { source: 'CORE_FALLBACK', value: 60, subject: subjCode };
        return 60;
      }
      
      // Fallback 2: Subject-level defaults (HL/SL/PYP/MYP) based on admin config
      if (!subj) {
        debugMinutesSourceByTG[tg.id] = { source: 'NONE', value: 0, reason: 'no_subject' };
        return 0;
      }
      
      const level = String(tg.level || '').toUpperCase();
      const ibLevel = String(subj.ib_level || '').toUpperCase();
      
      // DP subjects: use HL/SL defaults
      if (ibLevel === 'DP') {
        if (level === 'HL' && typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          console.log(`[buildSchedulingProblem] TG ${tg.id} (${subjCode} HL): using Subject hl_minutes_per_week_default = ${subj.hl_minutes_per_week_default}`);
          debugMinutesSourceByTG[tg.id] = { source: 'SUBJECT_DEFAULT_HL', value: subj.hl_minutes_per_week_default, subject: subjCode };
          return subj.hl_minutes_per_week_default;
        }
        if (level === 'SL' && typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          console.log(`[buildSchedulingProblem] TG ${tg.id} (${subjCode} SL): using Subject sl_minutes_per_week_default = ${subj.sl_minutes_per_week_default}`);
          debugMinutesSourceByTG[tg.id] = { source: 'SUBJECT_DEFAULT_SL', value: subj.sl_minutes_per_week_default, subject: subjCode };
          return subj.sl_minutes_per_week_default;
        }
        // If level not specified or no default, try HL first then SL
        if (typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          console.log(`[buildSchedulingProblem] TG ${tg.id} (${subjCode}): level unclear, using HL default = ${subj.hl_minutes_per_week_default}`);
          debugMinutesSourceByTG[tg.id] = { source: 'SUBJECT_DEFAULT_HL', value: subj.hl_minutes_per_week_default, subject: subjCode, note: 'level_unclear' };
          return subj.hl_minutes_per_week_default;
        }
        if (typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          console.log(`[buildSchedulingProblem] TG ${tg.id} (${subjCode}): level unclear, using SL default = ${subj.sl_minutes_per_week_default}`);
          debugMinutesSourceByTG[tg.id] = { source: 'SUBJECT_DEFAULT_SL', value: subj.sl_minutes_per_week_default, subject: subjCode, note: 'level_unclear' };
          return subj.sl_minutes_per_week_default;
        }
      }
      
      // PYP/MYP subjects: use pyp_myp_minutes_per_week_default
      if (['PYP', 'MYP'].includes(ibLevel)) {
        if (typeof subj.pyp_myp_minutes_per_week_default === 'number' && subj.pyp_myp_minutes_per_week_default > 0) {
          console.log(`[buildSchedulingProblem] TG ${tg.id} (${subjCode} ${ibLevel}): using Subject pyp_myp_minutes_per_week_default = ${subj.pyp_myp_minutes_per_week_default}`);
          debugMinutesSourceByTG[tg.id] = { source: 'SUBJECT_DEFAULT_PYP_MYP', value: subj.pyp_myp_minutes_per_week_default, subject: subjCode, ibLevel };
          return subj.pyp_myp_minutes_per_week_default;
        }
      }
      
      // No config found anywhere
      debugMinutesSourceByTG[tg.id] = { source: 'NONE', value: 0, reason: 'no_config' };
      return 0;
    };

    const minutesToPeriods = (m) => Math.max(0, Math.ceil((m || 0) / periodDurationMinutes));

    // DIAGNOSTIC 1: Log all subjects before core check (null-safe)
    console.log('[buildSchedulingProblem] All subjects in DB:', (subjectsDb || []).map(s => ({ 
      id: s?.id || null, 
      code: s?.code || null, 
      name: s?.name || null, 
      normalized: normalizeSubjectCode(s?.code || s?.name),
      is_core: s?.is_core || false,
      ib_level: s?.ib_level || null
    })));

    // DIAGNOSTIC 2: Check DP students and their core assignments (null-safe)
    const dpStudents = await base44.entities.Student.filter({ school_id, ib_programme: 'DP', is_active: true }).catch(() => []);
    console.log('[buildSchedulingProblem] DP Students check:', {
      total: (dpStudents || []).length,
      sample: (dpStudents || []).slice(0, 3).map(s => ({
        id: s?.id || null,
        name: s?.full_name || null,
        year: s?.year_group || null,
        core_components: s?.core_components || null,
        subject_choices: s?.subject_choices?.length || 0,
        assigned_groups: s?.assigned_groups?.length || 0
      }))
    });

    stage = 'buildRequirements';
    console.log(`[buildSchedulingProblem] ${stage}: generating subjectRequirements for ${teachingGroupsDb.length} teaching groups`);

    console.log('[buildSchedulingProblem] Core subjects check: using existing TeachingGroups only');

    // Study filler for DP groups
    const dpStudyWeekly = Number(body?.dp_study_weekly ?? Deno.env.get('DP_STUDY_WEEKLY') ?? 0);
    const dpMinEndTime = String(body?.dp_min_end_time || Deno.env.get('DP_MIN_END_TIME') || '14:30');
    const studentGroupSoftPreferences = {};

    for (const tg of (teachingGroupsDb || [])) {
      if (!tg) continue;
      // CRITICAL: Already filtered locally, no need to re-check is_active here
      // Remove the is_active check - we want to include null/undefined (active by default)
      const subjCode = (tg.subject_id && subjectIdToCode[tg.subject_id]) || null;
      if (!subjCode) {
        teachingGroupFilteredPush(tg, 'MISSING_SUBJECT');
        continue;
      }

      let minutesUsed = minutesForTG(tg);
      const minutesOrig = typeof tg.minutes_per_week === 'number' ? tg.minutes_per_week : null;
      
      // CRITICAL: Core subjects (TOK/CAS/EE) MUST have minutes, force fallback BEFORE calculating weeklyCount
      const isCoreSubject = subjCode && ['TOK', 'CAS', 'EE', 'TEST'].includes(subjCode);
      if ((!minutesUsed || minutesUsed <= 0) && isCoreSubject) {
        minutesUsed = 60; // Force 60 min/week for core
        console.warn(`[buildSchedulingProblem] Core subject ${subjCode} TG ${tg.id} has 0/missing minutes, forcing 60 min/week`);
      }

      const weeklyCount = minutesToPeriods(minutesUsed);

      if (!weeklyCount || weeklyCount <= 0) {
        if (isCoreSubject) {
          // This should never happen after forcing 60 min, but safeguard
          console.error(`[buildSchedulingProblem] CRITICAL: Core subject ${subjCode} still has 0 weeklyCount after fallback!`);
        }
        teachingGroupFilteredPush(tg, minutesOrig === 0 ? 'ZERO_MINUTES' : 'MISSING_MINUTES');
        continue;
      }

      teachingGroupsIncludedCount++;

      // CRITICAL: Use consistent "TG_<id>" format for all groups
      const studentGroup = `TG_${tg.id}`;
      const cap = 20;
      
      // CRITICAL: Fix teacher/room mapping - findIndex returns -1 if not found
      const teacherIdx = (tg.teacher_id && teachersDb) ? teachersDb.findIndex(t => t?.id === tg.teacher_id) : -1;
      const roomIdx = (tg.preferred_room_id && roomsDb) ? roomsDb.findIndex(r => r?.id === tg.preferred_room_id) : -1;
      const teacherNumeric = teacherIdx >= 0 ? teacherIdx + 1 : null;
      const roomNumeric = roomIdx >= 0 ? roomIdx + 1 : null;
      
      // DEBUG LOG for each TG - verify TG_ format
      console.log(`[buildSchedulingProblem] TG ${tg.id} (${subjCode}):`, {
        name: tg.name,
        studentGroup, // Should ALWAYS be "TG_<id>"
        minutes_per_week_stored: tg.minutes_per_week,
        periods_per_week_stored: tg.periods_per_week,
        minutesUsed,
        weeklyCount,
        level: tg.level,
        teacher_id: tg.teacher_id,
        teacherIdx,
        teacherNumeric,
        preferred_room_id: tg.preferred_room_id,
        roomIdx,
        roomNumeric,
        student_count: (tg.student_ids || []).length
      });

      // Expected + created counters
      expectedLessonsBySubject[subjCode] = (expectedLessonsBySubject[subjCode] || 0) + weeklyCount;
      expectedMinutesBySubject[subjCode] = (expectedMinutesBySubject[subjCode] || 0) + minutesUsed;

      for (let i = 0; i < weeklyCount; i++) {
        lessons.push({
          id: lessonId++,
          subject: subjCode,
          studentGroup,
          requiredCapacity: cap,
          timeslotId: null,
          roomId: roomNumeric || null,
          teacherId: teacherNumeric || null,
        });
      }
      perSubjectCount[subjCode] = (perSubjectCount[subjCode] || 0) + weeklyCount;

      // DP preferences + Study blocks (null-safe)
      const subj = (tg.subject_id && subjectById[tg.subject_id]) || null;
      const isDP = (String(tg.year_group || '').toUpperCase().includes('DP')) || (subj?.ib_level === 'DP');
      if (isDP) {
        studentGroupSoftPreferences[studentGroup] = { minEndTime: dpMinEndTime, penalty: 5 };
        const studyCount = Math.max(0, dpStudyWeekly - weeklyCount);
        for (let s = 0; s < studyCount; s++) {
          lessons.push({
            id: lessonId++,
            subject: 'STUDY',
            studentGroup,
            requiredCapacity: cap,
            timeslotId: null,
            roomId: null,
            teacherId: null,
            isStudy: true,
            softConstraints: { maxConsecutive: 2, preferAfternoon: true }
          });
        }
        if (studyCount > 0) perSubjectCount['STUDY'] = (perSubjectCount['STUDY'] || 0) + studyCount;
      }
    }

    const lessonsCreatedBySubject = {};
    for (const l of lessons) {
      lessonsCreatedBySubject[l.subject] = (lessonsCreatedBySubject[l.subject] || 0) + 1;
    }

    const daysCount = daysOfWeek.length || 5;
    const periodsPerDay = Math.floor(timeslots.length / Math.max(1, daysCount));

    // CRITICAL: Declare subjectRequirements FIRST before any code that uses it
    const subjectRequirements = [];
    
    // Build subjects[] for solver validation
    const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ''));
    const subjectCodesInLessons = Array.from(new Set(lessons.map(l => l.subject).filter(Boolean)));
    const subjectsList = subjectCodesInLessons.map(code => {
      const subjId = subjectIdByCode[code] || null;
      const subj = subjId ? subjectById[subjId] : null;
      // Ensure valid MongoDB ObjectId format
      const validId = subjId && isValidMongoId(subjId) ? subjId : '000000000000000000000000';
      return {
        id: validId,
        code: code,
        name: subj?.name || code
      };
    });

    // Build reverse lookup: normalized code -> original subjCode
    const normalizedToOriginal = {};
    Object.entries(subjectIdToCode).forEach(([id, code]) => {
      const norm = normalizeCode(code);
      if (norm) normalizedToOriginal[norm] = code;
    });
    
    console.log('[buildSchedulingProblem] Building subjectRequirements from', teachingGroupsDb.length, 'TeachingGroups...');

    for (const tg of teachingGroupsDb) {
      const subjCode = subjectIdToCode[tg.subject_id];
      const normCode = normalizeCode(subjCode);
      const isCoreSubject = normCode && ['TOK', 'CAS', 'EE'].includes(normCode);

      // CRITICAL: Already filtered locally, no need to re-check is_active here

      if (!subjCode || !normCode) {
        if (isCoreSubject) console.error(`[buildSchedulingProblem] ❌ Core TG ${tg.id} has NO SUBJECT CODE!`);
        continue;
      }

      // Use admin-configured weekly load (minutes or periods)
      let minutesUsed = minutesForTG(tg);
      
      // Convert periods_per_week to minutes if that was the source
      let requiredPeriods = 0;
      if (typeof tg.periods_per_week === 'number' && tg.periods_per_week > 0) {
        requiredPeriods = tg.periods_per_week;
        minutesUsed = requiredPeriods * periodDurationMinutes;
      } else if (minutesUsed > 0) {
        requiredPeriods = Math.ceil(minutesUsed / periodDurationMinutes);
      }

      // RULE: Core subjects (TOK/CAS/EE/TEST) are MANDATORY and never skip
      // If no admin config, use fallback 60 min/week
      if ((!minutesUsed || minutesUsed <= 0) && !isCoreSubject) {
        // Skip non-core subjects with zero minutes
        console.log(`[buildSchedulingProblem] Skipping non-core TG ${tg.id} (${subjCode}): 0 minutes/periods configured`);
        continue;
      }
      if ((!minutesUsed || minutesUsed <= 0) && isCoreSubject) {
        // Core subjects: force 60 min/week fallback
        minutesUsed = 60;
        requiredPeriods = Math.ceil(minutesUsed / periodDurationMinutes);
        console.log(`[buildSchedulingProblem] ✅ Core ${normCode} TG ${tg.id}: 0/missing config, forcing fallback 60 min/week (${requiredPeriods} periods)`);
      }

      // DEBUG LOG for requirement
      console.log(`[buildSchedulingProblem] Adding requirement TG ${tg.id} (${subjCode}):`, {
        minutesPerWeek: minutesUsed,
        requiredPeriods,
        isCoreSubject
      });

      // CRITICAL: Ensure lessons count matches requiredPeriods exactly
      // subjectRequirements MUST match lesson count for solver consistency
      subjectRequirements.push({
        studentGroup: `TG_${tg.id}`,
        subject: subjCode,
        minutesPerWeek: minutesUsed,
        requiredPeriods: requiredPeriods // Add explicit period count for solver
      });
    }

    console.log('[buildSchedulingProblem] Total subjectRequirements:', subjectRequirements.length);
    const coreReqs = subjectRequirements.filter(r => {
      const norm = normalizeCode(r.subject);
      return ['TOK','CAS','EE'].includes(norm);
    });
    console.log('[buildSchedulingProblem] Core requirements:', coreReqs.length, coreReqs.slice(0, 10));

    // Diagnostic: Core Teaching Groups Detection & Requirements
    const coreSubjectsSet = new Set(['TOK', 'CAS', 'EE']);
    const coreTeachingGroupsDetected = teachingGroupsDb
      .filter(tg => {
        const code = subjectIdToCode[tg.subject_id];
        return code && coreSubjectsSet.has(code);
      })
      .map(tg => ({
        id: tg.id,
        subject_code: subjectIdToCode[tg.subject_id],
        minutes_per_week: minutesForTG(tg),
        dp_year: tg.year_group,
        is_active: tg.is_active,
        has_students: Array.isArray(tg.student_ids) && tg.student_ids.length > 0,
        student_count: Array.isArray(tg.student_ids) ? tg.student_ids.length : 0
      }));

    const normalizeForCheck = (s) => String(s||'').trim().toUpperCase().replace(/\s+/g,'_').replace(/[^A-Z0-9_]/g,'_');
    const coreRequirementsGeneratedByCode = {};
    for (const code of coreSubjectsSet) {
      coreRequirementsGeneratedByCode[code] = subjectRequirements.filter(r => normalizeForCheck(r.subject) === code).length;
    }
    console.log('[buildSchedulingProblem] coreRequirementsGeneratedByCode:', coreRequirementsGeneratedByCode);

    const problem = {
      timeslots,
      rooms,
      teachers,
      lessons,
      subjects: subjectsList,
      subjectRequirements,
      subjectIdByCode,
      teacherNumericIdToBase44Id,
      roomNumericIdToBase44Id,
      teacherNumericIdToExternalRef,
      roomNumericIdToExternalRef,
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
      teachingGroups: teachingGroupsDb.map((tg) => ({
        id: tg.id,
        subject_id: tg.subject_id,
        minutesPerWeek: minutesForTG(tg),
        teacher_id: tg.teacher_id || null,
        room_id: tg.preferred_room_id || null,
        ib_level: subjectById[tg.subject_id]?.ib_level || null
      }))
    };

    const lastTimeslot = timeslots[timeslots.length - 1] || null;

    // CRITICAL: Filter out STUDY from solver (injected post-solve to fill empty slots)
    // TEST is now INCLUDED in solver for proper scheduling
    const excludeFromSolver = new Set(['STUDY']);
    const problemSubjectsFiltered = problem.subjects.filter(s => !excludeFromSolver.has(s.code));
    const problemLessonsFiltered = problem.lessons.filter(l => !excludeFromSolver.has(l.subject));
    const problemRequirementsFiltered = problem.subjectRequirements.filter(r => !excludeFromSolver.has(r.subject));
    
    // Validate TEST slots existence
    const testLessonsCount = problemLessonsFiltered.filter(l => l.subject === 'TEST').length;
    const testRequirementsCount = problemRequirementsFiltered.filter(r => normalizeCode(r.subject) === 'TEST').length;
    
    if (testLessonsCount === 0 || testRequirementsCount === 0) {
      console.warn('[buildSchedulingProblem] WARNING: No TEST lessons/requirements found. TEST slots will not be scheduled.');
      console.warn('[buildSchedulingProblem] To enable TEST scheduling: Create TEST TeachingGroups with minutes_per_week configured');
    } else {
      console.log(`[buildSchedulingProblem] TEST validation: ${testLessonsCount} lessons, ${testRequirementsCount} requirements`);
    }

    console.log('[buildSchedulingProblem] Filtered for solver:', {
      subjects: { before: problem.subjects.length, after: problemSubjectsFiltered.length },
      lessons: { before: problem.lessons.length, after: problemLessonsFiltered.length },
      requirements: { before: problem.subjectRequirements.length, after: problemRequirementsFiltered.length },
      excluded: Array.from(excludeFromSolver),
      testIncluded: problemLessonsFiltered.some(l => l.subject === 'TEST'),
      testLessonsCount: problemLessonsFiltered.filter(l => l.subject === 'TEST').length
    });

    const problemForSolver = {
      ...problem,
      subjects: problemSubjectsFiltered,
      lessons: problemLessonsFiltered,
      subjectRequirements: problemRequirementsFiltered
    };

    // FINAL DEBUG: Log schedule settings and last timeslot
    const lastTimeslotAvailable = timeslots[timeslots.length - 1];
    console.log('[buildSchedulingProblem] Schedule Settings:', {
      periodDurationMinutes,
      dayStartTime,
      dayEndTime,
      daysOfWeek,
      timeslotsCount: timeslots.length,
      lastTimeslot: lastTimeslotAvailable ? { day: lastTimeslotAvailable.dayOfWeek, endTime: lastTimeslotAvailable.endTime } : null
    });
    
    // Count TEST lessons and requirements
    const testLessonsCreated = problemForSolver.lessons.filter(l => normalizeCode(l.subject) === 'TEST').length;
    const testRequirementsCreated = problemForSolver.subjectRequirements.filter(r => normalizeCode(r.subject) === 'TEST').length;
    const testTeachingGroups = teachingGroupsDb.filter(tg => {
      const code = tg.subject_id ? subjectIdToCode[tg.subject_id] : null;
      return normalizeCode(code) === 'TEST';
    }).map(tg => ({
      id: tg.id,
      name: tg.name,
      minutes_per_week: tg.minutes_per_week,
      periods_per_week: tg.periods_per_week,
      teacher_id: tg.teacher_id,
      minutesSource: debugMinutesSourceByTG[tg.id]
    }));

    console.log(`[buildSchedulingProblem] SUCCESS at stage="${stage}": returning problem with ${problemForSolver.lessons.length} lessons, ${problemForSolver.subjects.length} subjects, ${problemForSolver.subjectRequirements.length} requirements`);
    console.log(`[buildSchedulingProblem] TEST validation: ${testLessonsCreated} lessons, ${testRequirementsCreated} requirements, ${testTeachingGroups.length} TGs`);

    return Response.json({
      success: true,
      ok: true,
      problem: problemForSolver,
      subjectIdByCode,
      debugMinutesSourceByTG,
      // Debug summary
      schoolIdUsed: school_id,
      scheduleVersionIdUsed: schedule_version_id,
      periodDurationMinutes,
      dayStartTime,
      dayEndTime,
      daysOfWeek,
      breaks,
      timeslotsCount: timeslots.length,
      periodsPerDay,
      subjectsIncludedCodes: Object.keys(expectedLessonsBySubject || {}),
      teachingGroupsIncludedCount,
      teachingGroupsFilteredOutCount: teachingGroupsFilteredOut.length,
      teachingGroupsFilteredOut: teachingGroupsFilteredOut.slice(0, 200),
      expectedMinutesBySubject,
      expectedLessonsBySubject,
      totalRequiredMinutes: (Object.values(expectedMinutesBySubject || {}).reduce((a,b)=>a+b,0)),
      totalRequiredPeriods: (Object.values(expectedLessonsBySubject || {}).reduce((a,b)=>a+b,0)),
      meta: {
        schoolIdInput: requestedSchoolId,
        schoolIdUsed: school_id,
        timeslotsCount: timeslots.length,
        periodsPerDay,
        lastTimeslot,
        periodDurationMinutes,
      },
      stats: {
        timeslots: timeslots.length,
        rooms: rooms.length,
        teachers: teachers.length,
        lessons: lessons.length,
        perSubjectCount,
        periods_per_day: periodsPerDay,
        expectedLessonsBySubject,
        expectedMinutesBySubject,
        totalRequiredMinutes: (Object.values(expectedMinutesBySubject || {}).reduce((a,b)=>a+b,0)),
        totalRequiredPeriods: (Object.values(expectedLessonsBySubject || {}).reduce((a,b)=>a+b,0)),
        lessonsCreatedBySubject,
        coreTeachingGroupsDetected,
        coreRequirementsGeneratedByCode,
        coreExpectedLessons: {
          TOK: expectedLessonsBySubject['TOK'] || 0,
          CAS: expectedLessonsBySubject['CAS'] || 0,
          EE: expectedLessonsBySubject['EE'] || 0
        },
        testLessonsCreated,
        testRequirementsCreated,
        testTeachingGroups
      }
    });
  } catch (error) {
    console.error(`[buildSchedulingProblem] ERROR at stage="${stage}":`, error);
    console.error(`[buildSchedulingProblem] Error message:`, error?.message);
    console.error(`[buildSchedulingProblem] Error stack:`, error?.stack);
    
    // Gather diagnostic counts (safe access)
    const counts = {
      students: (await base44.entities.Student.filter({ school_id }).catch(() => [])).length,
      teachingGroups: (await base44.entities.TeachingGroup.filter({ school_id }).catch(() => [])).length,
      subjects: (await base44.entities.Subject.filter({ school_id }).catch(() => [])).length,
      teachers: (await base44.entities.Teacher.filter({ school_id }).catch(() => [])).length,
      rooms: (await base44.entities.Room.filter({ school_id }).catch(() => [])).length
    };
    
    const samples = {
      firstTG: (await base44.entities.TeachingGroup.filter({ school_id }).catch(() => []))[0] || null,
      firstSubject: (await base44.entities.Subject.filter({ school_id }).catch(() => []))[0] || null
    };
    
    return Response.json({ 
      ok: false,
      stage,
      errorMessage: String(error?.message || error),
      errorStack: String(error?.stack || ''),
      meta: { schedule_version_id, school_id },
      counts,
      samples
    }, { status: 200 }); // Return 200 so UI can always parse JSON
  }
});