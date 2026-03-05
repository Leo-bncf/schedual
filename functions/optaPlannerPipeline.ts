import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { schedule_version_id, constraints, mock_school_id } = body;
    
    let user = null;
    let b44Entities = base44.entities;

    if (mock_school_id) {
        user = { school_id: mock_school_id };
        b44Entities = base44.asServiceRole.entities;
    } else {
        user = await base44.auth.me();
        if (!user?.school_id) {
          return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
    }
    if (!schedule_version_id) {
      return Response.json({ ok: false, error: 'Missing schedule_version_id' }, { status: 400 });
    }

    const OPTAPLANNER_ENDPOINT = Deno.env.get('OPTAPLANNER_ENDPOINT');
    const OPTAPLANNER_API_KEY = Deno.env.get('OPTAPLANNER_API_KEY');

    if (!OPTAPLANNER_ENDPOINT || !OPTAPLANNER_API_KEY) {
      return Response.json({ ok: false, error: 'OptaPlanner not configured' }, { status: 500 });
    }

    // Fetch all data in parallel
    const [scheduleVersion, teachers, students, rooms, teachingGroups, subjects, school] = await Promise.all([
      b44Entities.ScheduleVersion.filter({ id: schedule_version_id }),
      b44Entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.Student.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.Room.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      b44Entities.School.filter({ id: user.school_id })
    ]);

    if (!scheduleVersion?.[0]) {
      return Response.json({ ok: false, error: 'Schedule version not found' }, { status: 404 });
    }

    const schoolData = school[0];

    // Determine program type
    let programType = 'DP';
    const vName = scheduleVersion[0].name.toUpperCase();
    if (vName.includes('MYP')) programType = 'MYP';
    else if (vName.includes('PYP')) programType = 'PYP';
    else if (constraints?.programType) programType = constraints.programType;

    // ─── Numeric ID generators ───────────────────────────────────────────────
    let numIdGen = 1;
    const generateNum = () => numIdGen++;

    // Student numeric IDs start at 1001
    const studentIdMap = {};
    let studentNumGen = 1001;
    students.forEach(s => { studentIdMap[s.id] = studentNumGen++; });

    // ─── Rooms ───────────────────────────────────────────────────────────────
    const roomIdMap = {};
    const mappedRooms = rooms.map(r => {
      const numId = generateNum();
      roomIdMap[r.id] = numId;
      return { id: numId, name: String(r.name), capacity: Number(r.capacity || 30), externalId: String(r.id) };
    });

    // ─── Teachers ────────────────────────────────────────────────────────────
    const teacherIdMap = {};
    const mappedTeachers = teachers.map(t => {
      const numId = generateNum();
      teacherIdMap[t.id] = numId;

      const unavailableSlotIds = [];
      const preferredDays = [];
      const avoidDays = [];

      if (t.preferred_free_day) avoidDays.push(t.preferred_free_day.toUpperCase());
      if (t.preferences) {
        if (Array.isArray(t.preferences.preferredDays)) preferredDays.push(...t.preferences.preferredDays);
        if (Array.isArray(t.preferences.avoidDays)) avoidDays.push(...t.preferences.avoidDays);
      }

      if (t.unavailable_slots && t.unavailable_slots.length > 0) {
        const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
        const periodsPerDay = schoolData.periods_per_day || 10;
        t.unavailable_slots.forEach(us => {
          if (!us.day) return;
          const dayIdx = dayNames.indexOf(us.day.toUpperCase());
          if (dayIdx === -1) return;
          if ((us.type === 'period' || !us.type) && us.period) {
            unavailableSlotIds.push((dayIdx * periodsPerDay) + us.period);
          }
        });
      }

      return {
        id: numId,
        name: String(t.full_name),
        unavailableSlotIds,
        preferredDays,
        avoidDays,
        externalId: String(t.id)
      };
    });

    // ─── Subject code helper ──────────────────────────────────────────────────
    const getSafeSubjectCode = (subj) => {
      return String(subj.name || subj.code || 'SUBJ')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .substring(0, 15) + String(subj.id).slice(-6).toUpperCase();
    };

    // ─── Filter active teaching groups ───────────────────────────────────────
    const isCoreSubject = (s) => {
      if (!s) return true;
      if (s.is_core) return true;
      const n = String(s.name || '').toUpperCase();
      return n === 'TOK' || n.includes('THEORY OF KNOWLEDGE') ||
             n === 'CAS' || n.includes('CREATIVITY, ACTIVITY, SERVICE') ||
             n.includes('EXTENDED ESSAY') || n === 'EE';
    };

    const activeTGs = teachingGroups.filter(tg => {
      if (!tg.is_active || !tg.year_group || tg.year_group.includes(',')) return false;
      const subject = subjects.find(s => s.id === tg.subject_id);
      if (!subject || isCoreSubject(subject)) return false;
      return true;
    });

    // ─── Build teaching groups + lessons ─────────────────────────────────────
    const mappedTeachingGroups = [];
    const mappedLessons = [];
    const subjectRequirements = [];
    let lessonIdCounter = 1;

    activeTGs.forEach(tg => {
      const numId = generateNum();
      const subject = subjects.find(s => s.id === tg.subject_id);
      if (!subject) return;

      let requiredMinutes = tg.minutes_per_week || 180;
      if (subject.ib_level === 'DP') {
        requiredMinutes = tg.level === 'HL'
          ? (subject.hoursPerWeekHL || 5) * 60
          : (subject.hoursPerWeekSL || 3) * 60;
      } else if (subject.pyp_myp_minutes_per_week_default) {
        requiredMinutes = subject.pyp_myp_minutes_per_week_default;
      }

      const periodDuration = schoolData.period_duration_minutes || 60;
      const numLessons = Math.ceil(requiredMinutes / periodDuration);
      if (numLessons <= 0) return;

      const subjectCode = getSafeSubjectCode(subject);
      const sectionId = `sec_${tg.id}`;
      const tgLessonIds = [];

      subjectRequirements.push({
        studentGroup: String(tg.year_group),
        teachingGroupId: numId,
        sectionId,
        subject: subjectCode,
        originalSubjectId: String(subject.id),
        minutesPerWeek: requiredMinutes
      });

      for (let i = 0; i < numLessons; i++) {
        const lessonNumId = lessonIdCounter++;
        tgLessonIds.push(lessonNumId);

        const rawStudentIds = (tg.student_ids || []).filter(sid => students.some(s => s.id === sid));
        const numericStudentIds = rawStudentIds.map(sid => studentIdMap[sid]).filter(Boolean);

        mappedLessons.push({
          id: lessonNumId,
          subject: subjectCode,
          studentGroup: String(tg.year_group),
          teachingGroupId: numId,
          sectionId,
          yearGroup: String(tg.year_group),
          level: String(tg.level || 'SL'),
          requiredCapacity: Math.max(1, rawStudentIds.length),
          teacherId: tg.teacher_id ? (teacherIdMap[tg.teacher_id] || null) : null,
          studentIds: numericStudentIds, // numeric 1001+
          timeslotId: null,
          roomId: null,
          originalTgId: tg.id,
          originalSubjectId: String(subject.id)
        });
      }

      mappedTeachingGroups.push({
        id: numId,
        rawCode: String(tg.id),
        sectionId,
        studentGroup: String(tg.year_group),
        subject_id: String(subject.id),
        level: String(tg.level || 'SL'),
        requiredMinutesPerWeek: requiredMinutes,
        lessonIds: tgLessonIds
      });
    });

    // Determine active subject IDs
    const activeSubjectOriginalIds = new Set(mappedLessons.map(l => l.originalSubjectId));

    if (activeSubjectOriginalIds.size === 0) {
      return Response.json({ ok: false, error: 'No active lessons or subjects to schedule. Please check Teaching Groups.' }, { status: 400 });
    }

    // ─── Build subjects list ──────────────────────────────────────────────────
    const mappedSubjects = subjects
      .filter(sub => activeSubjectOriginalIds.has(String(sub.id)))
      .map(sub => ({
        id: String(sub.id),      // raw 24-hex
        code: getSafeSubjectCode(sub),
        name: String(sub.name || sub.code || getSafeSubjectCode(sub))
      }));

    // subjectIdByCode: code → raw 24-hex id
    const subjectIdByCode = Object.fromEntries(mappedSubjects.map(s => [s.code, s.id]));
    const subjectCodeById = Object.fromEntries(mappedSubjects.map(s => [s.id, s.code]));

    // ─── DP: Student subject choices ──────────────────────────────────────────
    const studentSubjectChoices = [];
    if (programType === 'DP') {
      const choiceSet = new Set();

      students.filter(s => s.is_active).forEach(student => {
        if (student.subject_choices) {
          student.subject_choices.forEach(choice => {
            const choiceSubId = String(choice.subject_id);
            if (!activeSubjectOriginalIds.has(choiceSubId)) return;
            const subject = subjects.find(sub => String(sub.id) === choiceSubId);
            if (!subject) return;
            const key = `${student.id}_${choiceSubId}`;
            if (choiceSet.has(key)) return;
            choiceSet.add(key);
            studentSubjectChoices.push({
              studentId: studentIdMap[student.id] || String(student.id),
              subjectId: choiceSubId,
              subject: getSafeSubjectCode(subject),
              level: String(choice.level || 'SL'),
              yearGroup: String(student.year_group || 'DP1')
            });
          });
        }
      });

      // Inject missing choices from lesson membership
      mappedLessons.forEach(lesson => {
        const subId = lesson.originalSubjectId;
        const subject = subjects.find(sub => String(sub.id) === subId);
        if (!subject) return;
        (lesson.studentIds || []).forEach(numericStudentId => {
          // reverse map numeric → raw id
          const rawStudentId = Object.keys(studentIdMap).find(k => studentIdMap[k] === numericStudentId);
          if (!rawStudentId) return;
          const key = `${rawStudentId}_${subId}`;
          if (choiceSet.has(key)) return;
          choiceSet.add(key);
          const student = students.find(s => s.id === rawStudentId);
          studentSubjectChoices.push({
            studentId: numericStudentId,
            subjectId: subId,
            subject: getSafeSubjectCode(subject),
            level: String(lesson.level || 'SL'),
            yearGroup: String(student?.year_group || lesson.yearGroup || 'DP1')
          });
        });
      });
    }

    // ─── scheduleSettings (trimmed) ──────────────────────────────────────────
    const scheduleSettings = {
      periodDurationMinutes: Number(schoolData.period_duration_minutes || 60),
      dayStartTime: String(schoolData.day_start_time || '08:00'),
      dayEndTime: String(schoolData.day_end_time || '18:00'),
      daysOfWeek: schoolData.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      breaks: (schoolData.breaks || []).map(b => ({ startTime: b.start, endTime: b.end }))
    };

    // ─── constraints object ───────────────────────────────────────────────────
    const constraintsBlock = {
      spreadAcrossDaysPerTeachingGroupSection: true,
      avoidSamePeriodRepetition: constraints?.maxSameSubjectPerDayHardEnabled !== false,
      avoidTeacherLatePeriods: true
    };

    // ─── Build final payload per program type ─────────────────────────────────
    let finalPayload = {};

    if (programType === 'DP') {
      // DP: teaching_groups use section_id (not sectionId), drop requiredMinutesPerWeek
      const dpTeachingGroups = mappedTeachingGroups.map(tg => ({
        id: `tg_${tg.rawCode}`,
        section_id: tg.sectionId,
        student_group: tg.studentGroup,
        subject_id: tg.subject_id,
        level: tg.level
      }));

      const dpLessons = mappedLessons.map(l => {
        const tg = mappedTeachingGroups.find(t => t.id === l.teachingGroupId);
        return {
          id: l.id,
          subject: l.subject,
          studentGroup: l.studentGroup,
          teachingGroupId: `tg_${tg?.rawCode || l.teachingGroupId}`,
          sectionId: l.sectionId,
          yearGroup: l.yearGroup,
          level: l.level,
          requiredCapacity: l.requiredCapacity,
          teacherId: l.teacherId,
          studentIds: l.studentIds,  // numeric 1001+
          timeslotId: null
        };
      });

      const dpRequirements = subjectRequirements.map(req => {
        const tg = mappedTeachingGroups.find(t => t.id === req.teachingGroupId);
        return {
          studentGroup: req.studentGroup,
          teachingGroupId: `tg_${tg?.rawCode || req.teachingGroupId}`,
          sectionId: req.sectionId,
          subject: req.subject,
          minutesPerWeek: req.minutesPerWeek
        };
      });

      finalPayload = {
        schoolId: String(user.school_id),
        scheduleVersionId: String(schedule_version_id),
        payloadType: 'individual_payload',
        programType: 'DP',
        scheduleSettings,
        rooms: mappedRooms,
        teachers: mappedTeachers,
        subjects: mappedSubjects,
        subjectIdByCode,
        teaching_groups: dpTeachingGroups,
        lessons: dpLessons,
        subject_requirements: dpRequirements,
        studentSubjectChoices,
        blockedSlotIds: [],
        constraints: constraintsBlock
      };

    } else {
      // MYP / PYP: no teaching_groups, no sectionId/teachingGroupId in lessons/requirements
      const cohortLessons = mappedLessons.map(l => ({
        id: l.id,
        subject: l.subject,
        studentGroup: l.studentGroup,
        yearGroup: l.yearGroup,
        requiredCapacity: l.requiredCapacity,
        teacherId: l.teacherId,
        timeslotId: null
        // no studentIds, no sectionId, no teachingGroupId
      }));

      const cohortRequirements = subjectRequirements.map(req => ({
        studentGroup: req.studentGroup,
        subject: req.subject,
        minutesPerWeek: req.minutesPerWeek
      }));

      const programConfig = programType === 'PYP'
        ? { pypConfig: { campus: 'Main', notes: 'Auto-generated PYP schedule' } }
        : { mypConfig: { campus: 'Main', notes: 'Auto-generated MYP schedule' } };

      finalPayload = {
        schoolId: String(user.school_id),
        scheduleVersionId: String(schedule_version_id),
        payloadType: 'cohort_payload',
        programType,
        scheduleSettings,
        rooms: mappedRooms,
        teachers: mappedTeachers,
        subjects: mappedSubjects,
        subjectIdByCode,
        lessons: cohortLessons,
        subject_requirements: cohortRequirements,
        blockedSlotIds: [],
        constraints: constraintsBlock,
        llmSoftConstraints: { teacherPreferences: [] },
        ...programConfig
      };
    }

    // ─── Preflight validator ──────────────────────────────────────────────────
    function preflightPayload(payload) {
      const errors = [];
      const HEX24 = /^[a-f0-9]{24}$/i;
      const clean = (v) => (v == null ? null : String(v).trim());
      const codeNorm = (v) => clean(v)?.replace(/_/g, ' ').replace(/\s+/g, ' ').toUpperCase() || null;
      const scopeKey = (x) => {
        if (payload.payloadType === 'individual_payload') {
          return `${clean(x.sectionId) || ''}||${clean(x.studentGroup) || ''}||${codeNorm(x.subject) || ''}`;
        }
        return `${clean(x.studentGroup) || ''}||${codeNorm(x.subject) || ''}`;
      };

      const subjs = Array.isArray(payload.subjects) ? payload.subjects : [];
      const lessons = Array.isArray(payload.lessons) ? payload.lessons : [];
      const reqs = Array.isArray(payload.subject_requirements) ? payload.subject_requirements : [];

      const subjectCodeToId = new Map();
      for (const s of subjs) {
        const id = clean(s?.id);
        const code = codeNorm(s?.code || s?.name);
        if (!id || !HEX24.test(id)) errors.push(`subjects[] invalid id: ${id}`);
        if (!code) errors.push(`subjects[] missing code/name for id=${id}`);
        if (code && id) subjectCodeToId.set(code, id);
      }

      for (const l of lessons) {
        const lid = l?.id;
        const subj = codeNorm(l?.subject);
        const sg = clean(l?.studentGroup);
        if (lid == null) errors.push(`lessons[] missing id`);
        if (!subj) errors.push(`lessons[] missing subject id=${lid}`);
        if (!sg) errors.push(`lessons[] missing studentGroup id=${lid}`);
        if (subj && !subjectCodeToId.has(subj)) {
          errors.push(`lessons[] subject not in subjects[]: lessonId=${lid} subject=${subj}`);
        }
      }

      const reqByScope = new Map();
      for (const r of reqs) {
        const k = scopeKey(r);
        const mpw = Number(r?.minutesPerWeek ?? 0);
        if (!(mpw > 0)) errors.push(`subject_requirements non-positive load for scope=${k}`);
        reqByScope.set(k, mpw);
        const subj = codeNorm(r?.subject);
        if (subj && !subjectCodeToId.has(subj)) {
          errors.push(`subject_requirements subject not in subjects[]: scope=${k} subject=${subj}`);
        }
      }

      const lessonScopes = new Set(lessons.map(scopeKey));
      for (const k of lessonScopes) {
        if (!reqByScope.has(k)) errors.push(`missing requirement for lesson scope=${k}`);
      }

      return { ok: errors.length === 0, errors };
    }

    // ── MANDATORY: Force timeslotId = null and strip roomId on ALL lessons. ──
    // This is applied unconditionally here as the final authoritative strip,
    // regardless of what any upstream builder set.
    if (Array.isArray(finalPayload.lessons)) {
      finalPayload.lessons = finalPayload.lessons.map(l => {
        const { timeslotId, roomId, ...rest } = l;
        return { ...rest, timeslotId: null };
      });
    }

    // ── HARD ASSERT: No duplicate (sectionId|studentGroup|subject|timeslotId) ──
    // Catches any non-null prefill that survived the strip above.
    {
      const dupSeen = new Set();
      const codeNorm = (v) => v == null ? '' : String(v).trim().toUpperCase();
      const dupErrors = [];
      for (const l of (finalPayload.lessons || [])) {
        if (l.timeslotId == null) continue; // nulls are fine, skip
        const key = `${codeNorm(l.sectionId)}||${codeNorm(l.studentGroup)}||${codeNorm(l.subject)}||${l.timeslotId}`;
        if (dupSeen.has(key)) {
          dupErrors.push(`duplicate prefilled timeslotId=${l.timeslotId} for scope: ${key} (lesson id=${l.id})`);
        } else {
          dupSeen.add(key);
        }
      }
      if (dupErrors.length > 0) {
        console.error('[Pipeline] ASSERT FAILED - duplicate timeslotIds detected:', dupErrors);
        return Response.json({ ok: false, error: 'Duplicate prefilled timeslotId detected', details: dupErrors }, { status: 400 });
      }
    }

    const preflight = preflightPayload(finalPayload);
    if (!preflight.ok) {
      return Response.json({ ok: false, error: 'Preflight failed', errors: preflight.errors }, { status: 400 });
    }

    console.log('[Pipeline] Payload type:', finalPayload.payloadType, '| programType:', finalPayload.programType);
    console.log('[Pipeline] subjects:', finalPayload.subjects?.length, '| lessons:', finalPayload.lessons?.length, '| requirements:', finalPayload.subject_requirements?.length);

    if (mock_school_id) {
      return Response.json({ ok: true, payload: finalPayload });
    }

    // ─── Call solver ──────────────────────────────────────────────────────────
    const endpointUrl = 'http://87.106.27.27:8080/base44/ingest';
    const requestBody = JSON.stringify(finalPayload);

    console.log('[Pipeline] POST to', endpointUrl, '| body length:', requestBody.length);

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OPTAPLANNER_API_KEY
      },
      body: requestBody
    });

    let responseText = await response.text();
    if (!response.ok) {
      console.error('[Pipeline] OptaPlanner error:', responseText);
      let errorDetails;
      try { errorDetails = JSON.parse(responseText); } catch { errorDetails = responseText; }
      return Response.json({
        ok: false,
        error: 'OptaPlanner validation failed',
        details: errorDetails,
        debug_payload_preview: {
          subjects: (finalPayload.subjects || []).slice(0, 5),
          lessons: (finalPayload.lessons || []).slice(0, 3),
          subject_requirements: (finalPayload.subject_requirements || []).slice(0, 3)
        }
      }, { status: 400 });
    }

    let result = {};
    try { result = JSON.parse(responseText); } catch(e) {}

    if (result.ok === false || result.errorCode || result.errorMessage || (Array.isArray(result.validationErrors) && result.validationErrors.length > 0)) {
      console.error('[Pipeline] OptaPlanner logical error:', result.errorMessage, result.validationErrors);
      return Response.json({
        ok: false,
        error: result.title || result.errorMessage || result.message || 'OptaPlanner Validation Error',
        details: result.validationErrors || result.details || result,
        debug_payload: finalPayload
      }, { status: 400 });
    }

    // ─── Process results & save ───────────────────────────────────────────────
    const existingSlots = await b44Entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });
    if (existingSlots.length > 0) {
      for (const slot of existingSlots) await b44Entities.ScheduleSlot.delete(slot.id);
    }

    let finalAssignments = [];
    if (result.schoolResults && Array.isArray(result.schoolResults)) {
      result.schoolResults.forEach(sr => {
        if (sr.result?.assignments) finalAssignments = finalAssignments.concat(sr.result.assignments);
        else if (sr.result?.lessons) finalAssignments = finalAssignments.concat(sr.result.lessons);
        else if (sr.result?.assignedLessons) finalAssignments = finalAssignments.concat(sr.result.assignedLessons);
      });
    } else {
      finalAssignments = result.assignedLessons || result.lessons || result.assignments || (Array.isArray(result) ? result : []);
    }

    console.log(`[Pipeline] Found ${finalAssignments.length} assignments to process.`);

    // Reverse maps
    const revTeacherMap = Object.fromEntries(Object.entries(teacherIdMap).map(([k, v]) => [v, k]));
    const revRoomMap = Object.fromEntries(Object.entries(roomIdMap).map(([k, v]) => [v, k]));
    const safeLessonMap = Object.fromEntries(mappedLessons.map(l => [l.id, l]));

    const slotsToInsert = [];
    for (const lesson of finalAssignments) {
      const lessonId = lesson.id || lesson.lessonId || lesson.lesson_id;
      const originalLesson = safeLessonMap[lessonId];
      const timeslotId = lesson.timeslotId != null ? lesson.timeslotId : (lesson.timeslot?.id != null ? lesson.timeslot.id : null);

      if (originalLesson && timeslotId != null) {
        const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
        const periodsPerDay = schoolData.periods_per_day || 10;
        const dayIndex = Math.floor((timeslotId - 1) / periodsPerDay);
        const day = lesson.dayOfWeek || lesson.timeslot?.dayOfWeek || days[dayIndex] || 'MONDAY';
        const periodIndex = lesson.periodIndex != null ? lesson.periodIndex : (timeslotId - 1) % periodsPerDay;

        const subjectNameStr = String(lesson.subject || '').toUpperCase();
        const isBreak = subjectNameStr === 'LUNCH' || subjectNameStr === 'BREAK';

        const tId = lesson.teacherId || lesson.teacher?.id;
        const rId = lesson.roomId || lesson.room?.id;

        slotsToInsert.push({
          school_id: user.school_id,
          schedule_version: schedule_version_id,
          teaching_group_id: originalLesson.originalTgId || null,
          teacher_id: tId ? revTeacherMap[tId] : null,
          room_id: rId ? revRoomMap[rId] : null,
          timeslot_id: timeslotId,
          day: day || 'Monday',
          period: periodIndex + 1,
          status: 'scheduled',
          is_break: isBreak,
          notes: isBreak ? (lesson.subject || 'Break') : undefined
        });
      }
    }

    if (slotsToInsert.length > 0) {
      await b44Entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    let scoreToSave = 0;
    if (result.schoolResults && Array.isArray(result.schoolResults)) {
      let totalHard = 0;
      result.schoolResults.forEach(sr => {
        const s = sr.result?.score || '0hard/0soft';
        const match = String(s).match(/(-?\d+)hard/);
        if (match) totalHard += parseInt(match[1], 10);
      });
      scoreToSave = totalHard;
    } else if (typeof result.score === 'string') {
      const match = result.score.match(/(-?\d+)hard/);
      if (match) scoreToSave = parseInt(match[1], 10);
    } else {
      scoreToSave = result.score || 0;
    }

    await b44Entities.ScheduleVersion.update(schedule_version_id, {
      score: scoreToSave,
      generated_at: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      result: {
        slotsInserted: slotsToInsert.length,
        score: scoreToSave,
        hardScoreNegative: scoreToSave < 0,
        debug: {
          assignmentsFound: finalAssignments.length,
          sampleAssignment: finalAssignments.length > 0 ? finalAssignments[0] : null,
          resultKeys: Object.keys(result)
        }
      }
    });

  } catch (error) {
    console.error('[Pipeline] Error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});