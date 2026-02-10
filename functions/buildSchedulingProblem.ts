import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/*
REFACTORED: Cohort-Centered Schedule Builder
- Each TeachingGroup = ONE canonical section/cohort (identified by teaching_group_id)
- NO aggressive filtering - include all TGs unless completely invalid
- Comprehensive fallback system ensures all TGs have duration (minutes_per_week)
- Detailed diagnostics log all adjustments, warnings, and skips
- Stable, predictable solver input with complete subject coverage
*/

Deno.serve(async (req) => {
  let stage = 'init';
  let school_id = null;
  let schedule_version_id = null;
  let base44 = null;
  
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
    
    const [school, allRooms, allTeachers, allSubjects, allTeachingGroups] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(r => r?.[0] || null).catch(() => null),
      base44.entities.Room.filter({ school_id }).catch(() => []),
      base44.entities.Teacher.filter({ school_id }).catch(() => []),
      base44.entities.Subject.filter({ school_id }).catch(() => []),
      base44.entities.TeachingGroup.filter({ school_id }).catch(() => []),
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
      subjectById[subj.id] = subj;
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
    const breaks = Array.isArray(school.breaks) ? school.breaks : [];
    const minPeriodsPerDay = Number(school.min_periods_per_day || 10);
    const targetPeriodsPerDay = Number(school.target_periods_per_day || 10);
    
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
    
    recordLog(`Timeslots generated: ${timeslots.length}`);

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
    
    // COMPREHENSIVE FALLBACK SYSTEM
    const getSubjectDefaults = (subj, tgLevel) => {
      if (!subj) return null;
      const level = String(tgLevel || '').toUpperCase();
      const ibLevel = String(subj.ib_level || '').toUpperCase();
      
      if (ibLevel === 'DP') {
        if (level === 'HL' && typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          return { minutes: subj.hl_minutes_per_week_default, source: 'SUBJECT_HL_DEFAULT' };
        }
        if (level === 'SL' && typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          return { minutes: subj.sl_minutes_per_week_default, source: 'SUBJECT_SL_DEFAULT' };
        }
        if (typeof subj.hl_minutes_per_week_default === 'number' && subj.hl_minutes_per_week_default > 0) {
          return { minutes: subj.hl_minutes_per_week_default, source: 'SUBJECT_HL_DEFAULT', note: 'level_unclear' };
        }
        if (typeof subj.sl_minutes_per_week_default === 'number' && subj.sl_minutes_per_week_default > 0) {
          return { minutes: subj.sl_minutes_per_week_default, source: 'SUBJECT_SL_DEFAULT', note: 'level_unclear' };
        }
      }
      
      if (['PYP', 'MYP'].includes(ibLevel)) {
        if (typeof subj.pyp_myp_minutes_per_week_default === 'number' && subj.pyp_myp_minutes_per_week_default > 0) {
          return { minutes: subj.pyp_myp_minutes_per_week_default, source: 'SUBJECT_PYP_MYP_DEFAULT' };
        }
      }
      
      return null;
    };
    
    const getIBStandardFallback = (tg, subj) => {
      const level = String(tg.level || '').toUpperCase().trim();
      const yearGroupStr = String(tg.year_group || '').toUpperCase();
      const nameStr = String(tg.name || '').toUpperCase();
      const ibLevel = subj ? String(subj.ib_level || '').toUpperCase() : null;

      // ROBUST DP detection: check year_group, subject.ib_level, AND tg.name
      const isDPGroup = yearGroupStr.includes('DP') || ibLevel === 'DP' || nameStr.includes('DP');

      if (isDPGroup) {
        // CRITICAL: Never return 0 for DP groups - use IB standard minimums
        if (level === 'HL') return { minutes: 300, source: 'IB_STANDARD_HL' };
        if (level === 'SL') return { minutes: 180, source: 'IB_STANDARD_SL' };
        // FALLBACK: If level unclear, default to SL minimum (safer than 0)
        return { minutes: 180, source: 'IB_STANDARD_SL_ASSUMED', note: 'level_unclear_defaulted_to_SL' };
      }

      if (['PYP', 'MYP'].includes(ibLevel) || yearGroupStr.includes('MYP') || yearGroupStr.includes('PYP')) {
        return { minutes: 150, source: 'IB_STANDARD_PYP_MYP' };
      }

      // FINAL FALLBACK: Never return 0 - use minimum viable schedule
      return { minutes: 120, source: 'GENERIC_FALLBACK_MINIMUM' };
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

      // Priority 1: TG-level explicit config (SOURCE OF TRUTH)
      if (typeof tg.minutes_per_week === 'number' && tg.minutes_per_week > 0) {
        debugMinutesSourceByTG[tg.id] = { source: 'TG_MINUTES', value: tg.minutes_per_week };
        return tg.minutes_per_week;
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

      // Priority 4: IB standard fallbacks (NEVER return 0)
      const ibFallback = getIBStandardFallback(tg, subj);
      debugMinutesSourceByTG[tg.id] = { source: ibFallback.source, value: ibFallback.minutes, subject: subjCode, note: ibFallback.note };
      recordAdjustment(tg, `Applied IB standard fallback (${ibFallback.source})`, 'missing', `${ibFallback.minutes} min/week`);
      return ibFallback.minutes;
    };
    
    const minutesToPeriods = (m) => Math.max(0, Math.ceil((m || 0) / periodDurationMinutes));

    // CREATE LESSONS: One section (cohort) per TeachingGroup
    const lessons = [];
    let lessonId = 1;
    const expectedLessonsBySubject = {};
    const expectedMinutesBySubject = {};
    const dpStudyWeekly = Number(body?.dp_study_weekly ?? Deno.env.get('DP_STUDY_WEEKLY') ?? 0);
    const dpMinEndTime = String(body?.dp_min_end_time || Deno.env.get('DP_MIN_END_TIME') || '14:30');
    const studentGroupSoftPreferences = {};
    
    recordLog(`Creating lessons for ${teachingGroupsDb.length} TeachingGroups (cohort-centered)`);
    
    for (const tg of teachingGroupsDb) {
      if (!tg) continue;
      
      // CRITICAL: teaching_group_id = canonical section ID (one cohort)
      const sectionId = tg.id;
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
      
      // VALIDATION 3: Resolve duration - FAIL HARD if minutes can't be resolved
      const minutesUsed = minutesForTG(tg);
      
      if (!minutesUsed || minutesUsed <= 0) {
        recordSkipped(tg, 'MISSING_MINUTES_CONFIG');
        continue; // Will fail at end if any critical groups missing
      }
      
      const weeklyCount = minutesToPeriods(minutesUsed);
      
      if (!weeklyCount || weeklyCount <= 0) {
        recordSkipped(tg, 'INVALID_PERIOD_COUNT');
        continue;
      }
      
      // SUCCESS: Include this section
      teachingGroupsIncludedCount++;
      
      const studentGroup = `TG_${sectionId}`;
      const cap = Math.max(1, (tg.student_ids || []).length);
      
      const teacherIdx = (tg.teacher_id && teachersDb) ? teachersDb.findIndex(t => t?.id === tg.teacher_id) : -1;
      const roomIdx = (tg.preferred_room_id && roomsDb) ? roomsDb.findIndex(r => r?.id === tg.preferred_room_id) : -1;
      const teacherNumeric = teacherIdx >= 0 ? teacherIdx + 1 : null;
      const roomNumeric = roomIdx >= 0 ? roomIdx + 1 : null;
      
      // Track diagnostics
      teachingGroupsDiagnostics.push({
        tg_id: sectionId,
        name: tg.name,
        subject_code: subjCode,
        minutesSource: debugMinutesSourceByTG[sectionId],
        minutesUsed,
        requiredPeriods: weeklyCount,
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
      
      // Create lessons for this section
      // CRITICAL: Include studentIds for cohort integrity enforcement
      const studentIds = Array.isArray(tg.student_ids) ? tg.student_ids : [];
      const blockId = tg.block_id || null; // For elective concurrency (same blockId => same timeslot)
      
      for (let i = 0; i < weeklyCount; i++) {
        lessons.push({
          id: lessonId++,
          subject: subjCode,
          studentGroup,
          sectionId, // Add explicit section identifier
          studentIds, // SOLVER NEEDS THIS: prevent student overlaps
          blockId, // SOLVER NEEDS THIS: enforce concurrent electives
          requiredCapacity: cap,
          timeslotId: null,
          roomId: roomNumeric || null,
          teacherId: teacherNumeric || null,
        });
      }
      
      // DP: add study blocks + preferences
      const isDP = (String(tg.year_group || '').toUpperCase().includes('DP')) || (subj?.ib_level === 'DP');
      if (isDP) {
        studentGroupSoftPreferences[studentGroup] = { minEndTime: dpMinEndTime, penalty: 5 };
        const studyCount = Math.max(0, dpStudyWeekly - weeklyCount);
        for (let s = 0; s < studyCount; s++) {
          lessons.push({
            id: lessonId++,
            subject: 'STUDY',
            studentGroup,
            sectionId,
            studentIds, // Include studentIds for study blocks too
            blockId: null, // Study blocks don't have block constraints
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
    
    // HARD FAIL if critical groups are missing minutes configuration
    const missingMinutesGroups = teachingGroupsSkipped.filter(s => s.reason === 'MISSING_MINUTES_CONFIG');
    if (missingMinutesGroups.length > 0) {
      const errorDetails = missingMinutesGroups.map(g => ({
        id: g.tg_id,
        name: g.name,
        subject: g.subject_code,
        year_group: g.year_group,
        ib_level: g.ib_level,
        student_count: g.student_count
      }));
      
      recordLog(`❌ CRITICAL: ${missingMinutesGroups.length} TeachingGroups have no minutes/periods configuration`);
      
      return Response.json({
        ok: false,
        stage: 'buildLessons',
        error: 'MISSING_MINUTES_CONFIGURATION',
        errorMessage: `${missingMinutesGroups.length} TeachingGroups are missing minutes/periods configuration and cannot be scheduled`,
        missingConfigurationCount: missingMinutesGroups.length,
        missingGroups: errorDetails,
        suggestion: 'Please configure minutes_per_week, periods_per_week, or hours_per_week for these TeachingGroups, OR set subject-level defaults (hl_minutes_per_week_default, sl_minutes_per_week_default, or pyp_myp_minutes_per_week_default)',
        validationReport: {
          totalTeachingGroups: teachingGroupsDb.length,
          included: teachingGroupsIncludedCount,
          excluded: teachingGroupsSkipped.length,
          missingConfiguration: missingMinutesGroups.length,
          excludedGroups: teachingGroupsSkipped
        }
      }, { status: 200 });
    }
    
    const daysCount = daysOfWeek.length || 5;
    const periodsPerDay = Math.floor(timeslots.length / Math.max(1, daysCount));
    
    const isValidMongoId = (id) => /^[a-f0-9]{24}$/i.test(String(id || ''));
    const subjectCodesInLessons = Array.from(new Set(lessons.map(l => l.subject).filter(Boolean)));
    const subjectsList = subjectCodesInLessons.map(code => {
      const subjId = subjectIdByCode[code] || null;
      const subj = subjId ? subjectById[subjId] : null;
      const validId = subjId && isValidMongoId(subjId) ? subjId : '000000000000000000000000';
      return {
        id: validId,
        code: code,
        name: subj?.name || code
      };
    });
    
    // Build subjectRequirements (one per section)
    const subjectRequirements = [];
    for (const tg of teachingGroupsDb) {
      const subjCode = subjectIdToCode[tg.subject_id];
      if (!subjCode) continue;
      
      const minutesUsed = minutesForTG(tg);
      if (!minutesUsed || minutesUsed <= 0) continue;
      
      const requiredPeriods = minutesToPeriods(minutesUsed);
      
      subjectRequirements.push({
        studentGroup: `TG_${tg.id}`,
        subject: subjCode,
        minutesPerWeek: minutesUsed,
        requiredPeriods
      });
    }
    
    // CRITICAL: Only exclude STUDY from solver (keep TEST for scheduling)
    const excludeFromSolver = new Set(['STUDY']);
    const problemForSolver = {
      timeslots,
      rooms,
      teachers,
      lessons: lessons.filter(l => !excludeFromSolver.has(l.subject)),
      subjects: subjectsList.filter(s => !excludeFromSolver.has(s.code)),
      subjectRequirements: subjectRequirements.filter(r => !excludeFromSolver.has(r.subject)),
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
        ib_level: subjectById[tg.subject_id]?.ib_level || null,
        studentIds: Array.isArray(tg.student_ids) ? tg.student_ids : [],
        blockId: tg.block_id || null
      }))
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
    
    return Response.json({
      success: true,
      ok: true,
      problem: problemForSolver,
      validationReport, // NEW: Explicit report of what's excluded and why
      subjectIdByCode,
      debugMinutesSourceByTG,
      teachingGroupsDiagnostics,
      builderDiagnostics: {
        adjustments: teachingGroupsAdjusted,
        skipped: teachingGroupsSkipped,
        diagnosticLog
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
      stats: {
        timeslots: timeslots.length,
        rooms: rooms.length,
        teachers: teachers.length,
        lessons: problemForSolver.lessons.length,
        expectedLessonsBySubject,
        expectedMinutesBySubject
      }
    });
  } catch (error) {
    console.error(`[buildSchedulingProblem] ERROR at stage="${stage}":`, error);
    
    return Response.json({ 
      ok: false,
      stage,
      errorMessage: String(error?.message || error),
      errorStack: String(error?.stack || ''),
      meta: { schedule_version_id, school_id }
    }, { status: 200 });
  }
});