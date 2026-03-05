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
    // Build a unique code per subject using name only (no hex suffix in display).
    // We guarantee uniqueness by tracking used codes and appending a counter only when there's a collision.
    const _usedSubjectCodes = new Map(); // code → subjectId (first owner)
    const _subjectCodeCache = new Map(); // subjectId → assigned code
    const getSafeSubjectCode = (subj) => {
      if (_subjectCodeCache.has(subj.id)) return _subjectCodeCache.get(subj.id);
      const base = String(subj.name || subj.code || 'SUBJ')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .trim()
        .toUpperCase()
        .substring(0, 20);
      let candidate = base;
      let counter = 2;
      while (_usedSubjectCodes.has(candidate) && _usedSubjectCodes.get(candidate) !== subj.id) {
        candidate = base.substring(0, 17) + counter;
        counter++;
      }
      _usedSubjectCodes.set(candidate, subj.id);
      _subjectCodeCache.set(subj.id, candidate);
      return candidate;
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

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ STEP 1: BUILD DETERMINISTIC (NO SOLVER YET)
    // ═══════════════════════════════════════════════════════════════════════════

    // ─── STUDENT MEMBERSHIP ENGINE: Single source of truth ────────────────────
    // Maps each teaching group → actual enrolled student raw IDs
    const tgStudentEnrollment = new Map(); // tg.id (raw) → Set of student raw IDs
    activeTGs.forEach(tg => {
      const validStudents = (tg.student_ids || []).filter(sid => students.some(s => s.id === sid));
      tgStudentEnrollment.set(String(tg.id), new Set(validStudents));
    });

    // ─── Build teaching groups + lessons ──────────────────────────────────────
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
      const sectionId = String(tg.id);
      const tgLessonIds = [];

      subjectRequirements.push({
        studentGroup: String(tg.year_group),
        teachingGroupId: numId,
        sectionId,
        subject: subjectCode,
        originalSubjectId: String(subject.id),
        minutesPerWeek: requiredMinutes
      });

      // Get enrolled students from the SINGLE SOURCE OF TRUTH
      const enrolledRawIds = Array.from(tgStudentEnrollment.get(String(tg.id)) || []);
      const enrolledNumericIds = enrolledRawIds.map(sid => studentIdMap[sid]).filter(Boolean);

      for (let i = 0; i < numLessons; i++) {
        const lessonNumId = lessonIdCounter++;
        tgLessonIds.push(lessonNumId);

        mappedLessons.push({
          id: lessonNumId,
          subject: subjectCode,
          studentGroup: String(tg.year_group),
          teachingGroupId: numId,
          sectionId,
          yearGroup: String(tg.year_group),
          level: String(tg.level || 'SL'),
          requiredCapacity: Math.max(1, enrolledRawIds.length),
          teacherId: tg.teacher_id ? (teacherIdMap[tg.teacher_id] || null) : null,
          studentIds: enrolledNumericIds, // ONLY from enrollment engine (numeric 1001+)
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
        lessonIds: tgLessonIds,
        enrolledStudentCount: enrolledRawIds.length  // Track for diagnostics
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

    // ─── DP: Student subject choices derived from ENROLLMENT ENGINE ───────────
    const studentSubjectChoices = [];
    const choicesByStudent = new Map(); // rawStudentId → Set of subject codes
    if (programType === 'DP') {
      const choiceSet = new Set(); // rawStudentId_subjectId → dedup

      // Build choices from enrolled TGs only
      tgStudentEnrollment.forEach((enrolledStudents, tgRawId) => {
        const tg = activeTGs.find(t => String(t.id) === tgRawId);
        if (!tg) return;
        const subject = subjects.find(s => String(s.id) === tg.subject_id);
        if (!subject) return;

        const subjCode = getSafeSubjectCode(subject);
        enrolledStudents.forEach(rawStudentId => {
          const key = `${rawStudentId}_${tg.subject_id}`;
          if (choiceSet.has(key)) return;
          choiceSet.add(key);

          if (!choicesByStudent.has(rawStudentId)) choicesByStudent.set(rawStudentId, new Set());
          choicesByStudent.get(rawStudentId).add(subjCode);

          const student = students.find(s => s.id === rawStudentId);
          const level = tg.level || 'SL';
          studentSubjectChoices.push({
            studentId: studentIdMap[rawStudentId],
            subjectId: String(tg.subject_id),
            subject: subjCode,
            level: String(level),
            yearGroup: String(student?.year_group || tg.year_group || 'DP1')
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

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ STEP 2: HARD PREFLIGHT (BLOCKING)
    // ═══════════════════════════════════════════════════════════════════════════

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

      // SUBJECTS: IDs must be valid hex24, codes must be present
      const subjectCodeToId = new Map();
      for (const s of subjs) {
        const id = clean(s?.id);
        const code = codeNorm(s?.code || s?.name);
        if (!id || !HEX24.test(id)) errors.push(`subjects[] invalid id: ${id}`);
        if (!code) errors.push(`subjects[] missing code/name for id=${id}`);
        if (code && id) subjectCodeToId.set(code, id);
      }

      // LESSONS: IDs present, subject exists, studentGroup exists, studentIds cohere with TG
      for (const l of lessons) {
        const lid = l?.id;
        const subj = codeNorm(l?.subject);
        const sg = clean(l?.studentGroup);
        const si = l?.sectionId;
        const studIds = Array.isArray(l?.studentIds) ? l.studentIds : [];

        if (lid == null) errors.push(`lessons[] missing id`);
        if (!subj) errors.push(`lessons[] missing subject id=${lid}`);
        if (!sg) errors.push(`lessons[] missing studentGroup id=${lid}`);
        if (subj && !subjectCodeToId.has(subj)) {
          errors.push(`lessons[] subject not in subjects[]: lessonId=${lid} subject=${subj}`);
        }

        // For DP: validate studentIds match enrollment
        if (payload.payloadType === 'individual_payload' && si) {
          const enrolledSet = tgStudentEnrollment.get(si);
          if (enrolledSet) {
            const enrolledNumericIds = Array.from(enrolledSet).map(rawId => studentIdMap[rawId]).filter(Boolean);
            const enrolledSet_num = new Set(enrolledNumericIds);
            for (const studentNumId of studIds) {
              if (!enrolledSet_num.has(studentNumId)) {
                errors.push(`lessons[] student ${studentNumId} not enrolled in TG ${si}: lessonId=${lid}`);
              }
            }
          }
        }
      }

      // REQUIREMENTS: positive load, subject exists
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

      // SCOPE COHERENCE: every lesson scope must have a matching requirement
      const lessonScopes = new Set(lessons.map(scopeKey));
      for (const k of lessonScopes) {
        if (!reqByScope.has(k)) errors.push(`missing requirement for lesson scope=${k}`);
      }

      // DUPLICATE TIMESLOTS: if any lesson has prefilled timeslotId, check no duplicates
      {
        const tsSeenByScope = new Map(); // scope + tsId → true
        for (const l of lessons) {
          const tsId = l?.timeslotId;
          if (tsId == null) continue;
          const scope = scopeKey(l);
          const dupKey = `${scope}||${tsId}`;
          if (tsSeenByScope.has(dupKey)) {
            errors.push(`duplicate prefilled timeslotId=${tsId} for scope ${scope}`);
          }
          tsSeenByScope.set(dupKey, true);
        }
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

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ STEP 3: STUDENT MEMBERSHIP ENGINE + COHERENCE CHECKS
    // ═══════════════════════════════════════════════════════════════════════════

    const preCheckErrors = [];
    const preCheckWarnings = [];
    const maxSlotsPerWeek = (schoolData.days_of_week?.length || 5) * (schoolData.periods_per_day || 10);

    // ─── Validate: All lessons[].studentIds come ONLY from enrollment ────────
    mappedLessons.forEach(lesson => {
      const enrolledSet = tgStudentEnrollment.get(lesson.sectionId) || new Set();
      const enrolledNumeric = Array.from(enrolledSet).map(rawId => studentIdMap[rawId]).filter(Boolean);
      const enrolledSet_num = new Set(enrolledNumeric);

      (lesson.studentIds || []).forEach(numId => {
        if (!enrolledSet_num.has(numId)) {
          preCheckErrors.push({
            lessonId: lesson.id,
            tgId: lesson.originalTgId,
            issue: 'lesson_student_not_enrolled',
            studentNumId: numId,
            message: `Lesson ${lesson.id}: student ${numId} not enrolled in TG ${lesson.sectionId}`
          });
        }
      });
    });

    // ─── Validate: DP studentSubjectChoices ↔ enrollment ↔ lessons ───────────
    if (programType === 'DP') {
      // Each choice should have at least one lesson for that subject
      const lessonsBySubject = new Map(); // subject code → Set of sectionIds
      mappedLessons.forEach(lesson => {
        if (!lessonsBySubject.has(lesson.subject)) lessonsBySubject.set(lesson.subject, new Set());
        lessonsBySubject.get(lesson.subject).add(lesson.sectionId);
      });

      studentSubjectChoices.forEach(choice => {
        const lessonSections = lessonsBySubject.get(choice.subject) || new Set();
        if (lessonSections.size === 0) {
          preCheckWarnings.push({
            studentId: choice.studentId,
            subject: choice.subject,
            issue: 'choice_no_lessons',
            message: `Student choice for "${choice.subject}" has no matching lessons`
          });
        }
      });
    }

    // ─── Validate: Block conflicts (student in multiple groups of same block) ──
    const studentTGMap = new Map(); // rawStudentId → Set of TG IDs
    tgStudentEnrollment.forEach((enrolledIds, tgRawId) => {
      enrolledIds.forEach(rawStudentId => {
        if (!studentTGMap.has(rawStudentId)) studentTGMap.set(rawStudentId, new Set());
        studentTGMap.get(rawStudentId).add(tgRawId);
      });
    });

    studentTGMap.forEach((tgIdSet, rawStudentId) => {
      const student = students.find(s => s.id === rawStudentId);
      if (!student) return;

      const blockMap = new Map(); // block_id → Array of TG names
      tgIdSet.forEach(tgId => {
        const tg = activeTGs.find(t => String(t.id) === tgId);
        if (tg && tg.block_id) {
          if (!blockMap.has(tg.block_id)) blockMap.set(tg.block_id, []);
          blockMap.get(tg.block_id).push(tg.name || tgId);
        }
      });

      blockMap.forEach((tgNames, blockId) => {
        if (tgNames.length > 1) {
          preCheckErrors.push({
            studentId: rawStudentId,
            studentName: student.full_name,
            issue: 'block_conflict',
            blockId,
            conflictingGroups: tgNames,
            message: `${student.full_name} assigned to multiple groups in block "${blockId}": ${tgNames.join(', ')}`
          });
        }
      });
    });

    // ─── Validate: TG under-enrollment ────────────────────────────────────────
    mappedTeachingGroups.forEach(tg => {
      const enrolled = tg.enrolledStudentCount || 0;
      const minReq = activeTGs.find(a => a.id === tg.rawCode)?.min_students || 1;
      if (enrolled < minReq) {
        preCheckWarnings.push({
          tgId: tg.rawCode,
          tgName: `TG ${tg.rawCode}`,
          issue: 'under_enrolled',
          enrolled,
          required: minReq,
          message: `Teaching group has ${enrolled} student(s) but ${minReq} required`
        });
      }
    });

    // ─── Validate: Student weekly overload ────────────────────────────────────
    choicesByStudent.forEach((subjCodes, rawStudentId) => {
      const student = students.find(s => s.id === rawStudentId);
      if (!student) return;

      let totalMinutesPerWeek = 0;
      subjCodes.forEach(subjCode => {
        const reqs = finalPayload.subject_requirements.filter(r => r.subject === subjCode && r.studentGroup === student.year_group);
        reqs.forEach(req => {
          totalMinutesPerWeek += (Number(req.minutesPerWeek) || 0);
        });
      });

      const totalPeriodsNeeded = Math.ceil(totalMinutesPerWeek / (schoolData.period_duration_minutes || 60));
      if (totalPeriodsNeeded > maxSlotsPerWeek) {
        preCheckErrors.push({
          studentId: rawStudentId,
          studentName: student.full_name,
          issue: 'student_overload',
          minutesPerWeek: totalMinutesPerWeek,
          periodsNeeded: totalPeriodsNeeded,
          maxAvailable: maxSlotsPerWeek,
          message: `${student.full_name} needs ${totalPeriodsNeeded} periods/week but only ${maxSlotsPerWeek} available`
        });
      }
    });

    // ─── BLOCK if hard errors ─────────────────────────────────────────────────
    if (preCheckErrors.length > 0) {
      console.error('[Pipeline] ✗ PRECHECK FAILED:', preCheckErrors);
      return Response.json({
        ok: false,
        error: 'Schedule validation failed',
        code: 'PRECHECK_FAILED',
        errors: preCheckErrors,
        warnings: preCheckWarnings,
        explanation: 'Structural conflicts or impossible assignments detected. Please review teaching group memberships and subject choices.'
      }, { status: 400 });
    }

    if (preCheckWarnings.length > 0) {
      console.warn('[Pipeline] ⚠ PRECHECK WARNINGS:', preCheckWarnings);
    }

    console.log('[Pipeline] ✓ Precheck passed | students:', choicesByStudent.size, '| TGs:', activeTGs.length);

    console.log('[Pipeline] Feasibility check passed for', choicesByStudent.size, 'DP students');
    console.log('[Pipeline] Payload type:', finalPayload.payloadType, '| programType:', finalPayload.programType);
    console.log('[Pipeline] subjects:', finalPayload.subjects?.length, '| lessons:', finalPayload.lessons?.length, '| requirements:', finalPayload.subject_requirements?.length);

    if (mock_school_id) {
      return Response.json({ ok: true, payload: finalPayload });
    }

    // ─── Call solver ──────────────────────────────────────────────────────────
    const endpointUrl = OPTAPLANNER_ENDPOINT;
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
    let result = {};
    try { result = JSON.parse(responseText); } catch(e) {}

    // ─── Helper: extract a flat assignments list from any solver response shape ──
    const extractAssignments = (r) => {
      if (r.schoolResults && Array.isArray(r.schoolResults)) {
        return r.schoolResults.flatMap(sr =>
          sr.result?.assignments || sr.result?.lessons || sr.result?.assignedLessons || []
        );
      }
      return r.assignedLessons || r.lessons || r.assignments || (Array.isArray(r) ? r : []);
    };

    // ─── Helper: build a deduplicated scope-key → lessonId map from lessonMappings in error details ──
    const codeNorm = (v) => v == null ? '' : String(v).trim().toUpperCase();
    const scopeKey = (sectionId, studentGroup, subject, timeslotId) =>
      `${codeNorm(sectionId)}||${codeNorm(studentGroup)}||${codeNorm(subject)}||${timeslotId}`;

    // Build a fast lookup: lessonId (numeric) → mappedLesson metadata
    const lessonMetaMap = new Map(mappedLessons.map(l => [l.id, l]));

    // ─── Handle solver response ────────────────────────────────────────────────
    let rawAssignments = [];
    let partialRecovery = false;

    if (!response.ok) {
      const bodyAssignments = extractAssignments(result);

      if (bodyAssignments.length > 0) {
        // Solver returned 400 but included assignment list — use it (dedup below)
        console.warn(`[Pipeline] Solver ${response.status} but has ${bodyAssignments.length} assignments — will dedup and save.`);
        rawAssignments = bodyAssignments;
        partialRecovery = true;

      } else if (Array.isArray(result.details) && result.details.some(d => Array.isArray(d.lessonMappings))) {
        // Solver returned 400 with only lessonMappings diagnostics — reconstruct from those,
        // picking the FIRST (non-duplicate) timeslot per scope.
        console.warn(`[Pipeline] Solver 400 with lessonMappings — reconstructing deduplicated assignments.`);
        const lessonTimeslotMap = new Map(); // lessonId → timeslotId (first-seen)
        for (const detail of result.details) {
          if (!Array.isArray(detail.lessonMappings)) continue;
          const seenTs = new Set();
          for (const lm of detail.lessonMappings) {
            if (lm.timeslotId == null) continue;
            if (seenTs.has(lm.timeslotId)) {
              console.warn(`[Pipeline] Dropping dup lessonId=${lm.lessonId} timeslotId=${lm.timeslotId} sectionId=${detail.sectionId}`);
              continue;
            }
            seenTs.add(lm.timeslotId);
            lessonTimeslotMap.set(lm.lessonId, lm.timeslotId);
          }
        }
        // Synthesise assignment objects for the lessons that had a confirmed (deduped) timeslot
        for (const [lessonId, timeslotId] of lessonTimeslotMap.entries()) {
          const meta = lessonMetaMap.get(lessonId);
          if (!meta) continue;
          rawAssignments.push({
            id: lessonId,
            timeslotId,
            sectionId: meta.sectionId,
            studentGroup: meta.studentGroup,
            subject: meta.subject,
            teacherId: meta.teacherId,
          });
        }
        console.log(`[Pipeline] Reconstructed ${rawAssignments.length} assignments from lessonMappings.`);
        partialRecovery = true;

      } else {
        // No assignments recoverable at all
        console.error('[Pipeline] OptaPlanner error — no assignments to recover:', responseText.slice(0, 500));
        return Response.json({
          ok: false,
          error: result.error || 'OptaPlanner validation failed',
          details: result.details || result,
        }, { status: 400 });
      }

    } else if (result.ok === false || result.errorCode || result.errorMessage ||
               (Array.isArray(result.validationErrors) && result.validationErrors.length > 0)) {
      const bodyAssignments = extractAssignments(result);
      if (bodyAssignments.length > 0) {
        console.warn(`[Pipeline] Solver logical error but has ${bodyAssignments.length} assignments — will dedup and save.`);
        rawAssignments = bodyAssignments;
        partialRecovery = true;
      } else {
        console.error('[Pipeline] OptaPlanner logical error:', result.errorMessage, result.validationErrors);
        return Response.json({
          ok: false,
          error: result.title || result.errorMessage || result.message || 'OptaPlanner Validation Error',
          details: result.validationErrors || result.details || result,
        }, { status: 400 });
      }
    } else {
      rawAssignments = extractAssignments(result);
    }

    console.log(`[Pipeline] rawAssignments before dedup: ${rawAssignments.length}`);

    // ── STEP 1: Enrich assignments with metadata from lessonMetaMap (fills missing sectionId/studentGroup/subject) ──
    // The solver sometimes omits these fields on output assignments; fill them from our known lesson list.
    rawAssignments = rawAssignments.map(lesson => {
      const lessonId = lesson.id ?? lesson.lessonId ?? lesson.lesson_id;
      const meta = lessonMetaMap.get(lessonId);
      return {
        ...lesson,
        id: lessonId,
        sectionId: lesson.sectionId ?? meta?.sectionId ?? null,
        studentGroup: lesson.studentGroup ?? meta?.studentGroup ?? null,
        subject: lesson.subject ?? meta?.subject ?? null,
        teacherId: lesson.teacherId ?? meta?.teacherId ?? null,
      };
    });

    // ── STEP 2: Deduplicate on (sectionId || studentGroup || subject || timeslotId) ──
    // This is the core sanitizer. Any assignment the solver assigned to the same scope+timeslot twice
    // is stripped here — keeping the first occurrence and nullifying the timeslot on duplicates.
    let dedupDropped = 0;
    const dedupSeen = new Set();
    let finalAssignments = rawAssignments.map(lesson => {
      const tsId = lesson.timeslotId != null ? lesson.timeslotId : (lesson.timeslot?.id != null ? lesson.timeslot.id : null);
      if (tsId == null) return lesson; // unassigned — keep as-is

      const key = scopeKey(lesson.sectionId, lesson.studentGroup, lesson.subject, tsId);
      if (dedupSeen.has(key)) {
        dedupDropped++;
        console.warn(`[Pipeline] Dedup: nullifying timeslot for lessonId=${lesson.id} scope=${key}`);
        return { ...lesson, timeslotId: null }; // nullify instead of drop, to preserve unscheduled count
      }
      dedupSeen.add(key);
      return lesson;
    });

    console.log(`[Pipeline] After dedup: ${finalAssignments.length} total, ${dedupDropped} timeslots nullified.`);

    // ── STEP 3: FINAL GUARD — assert zero duplicates remain before save ──
    {
      const assertSeen = new Set();
      const assertErrors = [];
      for (const lesson of finalAssignments) {
        const tsId = lesson.timeslotId != null ? lesson.timeslotId : (lesson.timeslot?.id != null ? lesson.timeslot.id : null);
        if (tsId == null) continue;
        const key = scopeKey(lesson.sectionId, lesson.studentGroup, lesson.subject, tsId);
        if (assertSeen.has(key)) {
          assertErrors.push(`ASSERT FAIL: lessonId=${lesson.id} key=${key}`);
        }
        assertSeen.add(key);
      }
      if (assertErrors.length > 0) {
        console.error('[Pipeline] PRE-SAVE ASSERT FAILED:', assertErrors);
        return Response.json({
          ok: false,
          error: 'Internal pipeline error: duplicate timeslots remain after sanitization. Save blocked.',
          details: assertErrors,
        }, { status: 500 });
      }
      console.log(`[Pipeline] Pre-save assert passed — 0 duplicate scopes.`);
    }

    // Keep only assigned lessons for slot insertion
    finalAssignments = finalAssignments.filter(l => {
      const tsId = l.timeslotId != null ? l.timeslotId : (l.timeslot?.id != null ? l.timeslot.id : null);
      return tsId != null;
    });
    console.log(`[Pipeline] Assigned lessons to save: ${finalAssignments.length}`);

    // Reverse maps
    const revTeacherMap = Object.fromEntries(Object.entries(teacherIdMap).map(([k, v]) => [v, k]));
    const revRoomMap = Object.fromEntries(Object.entries(roomIdMap).map(([k, v]) => [v, k]));

    const slotsToInsert = [];
    for (const lesson of finalAssignments) {
      const lessonId = lesson.id ?? lesson.lessonId ?? lesson.lesson_id;
      const originalLesson = lessonMetaMap.get(lessonId);
      const timeslotId = lesson.timeslotId != null ? lesson.timeslotId : (lesson.timeslot?.id != null ? lesson.timeslot.id : null);

      if (timeslotId == null) continue;

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
        teaching_group_id: originalLesson?.originalTgId || null,
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

    // ═══════════════════════════════════════════════════════════════════════════
    // ★ STEP 4: SAFE OUTPUT PIPELINE
    // ═══════════════════════════════════════════════════════════════════════════

    if (slotsToInsert.length > 0) {
      await b44Entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    // ─── Extract & validate score ────────────────────────────────────────────
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

    // ─── INFEASIBLE DETECTION: negative hard score means schedule not valid ────
    if (scoreToSave < 0) {
      console.error('[Pipeline] ✗ INFEASIBLE: hardScore =', scoreToSave);

      // Analyze unassigned lessons
      const unassignedByTG = new Map(); // tg raw id → count
      const unassignedByStudent = new Map(); // raw student id → count

      finalAssignments.forEach(lesson => {
        const tsId = lesson.timeslotId != null ? lesson.timeslotId : (lesson.timeslot?.id != null ? lesson.timeslot.id : null);
        if (tsId != null) return;

        const tgId = lesson.sectionId;
        if (tgId) {
          unassignedByTG.set(tgId, (unassignedByTG.get(tgId) || 0) + 1);

          // Mark all enrolled students as conflicted
          const enrolledSet = tgStudentEnrollment.get(tgId) || new Set();
          enrolledSet.forEach(sid => {
            unassignedByStudent.set(sid, (unassignedByStudent.get(sid) || 0) + 1);
          });
        }
      });

      const tgWantVsGot = mappedTeachingGroups.map(tg => {
        const unassignedCount = unassignedByTG.get(tg.sectionId) || 0;
        const assignedCount = mappedLessons.filter(l => l.sectionId === tg.sectionId).length - unassignedCount;
        return {
          tgId: tg.sectionId,
          want: mappedLessons.filter(l => l.sectionId === tg.sectionId).length,
          got: assignedCount,
          unassigned: unassignedCount
        };
      }).filter(x => x.want > 0);

      const studentConflicts = Array.from(unassignedByStudent.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([sid, count]) => {
          const student = students.find(s => s.id === sid);
          return { student: student?.full_name || sid, conflicts: count };
        });

      const diagnostics = {
        hardScore: scoreToSave,
        outputStats: {
          totalAssigned: finalAssignments.filter(l => {
            const ts = l.timeslotId != null ? l.timeslotId : (l.timeslot?.id != null ? l.timeslot.id : null);
            return ts != null;
          }).length,
          totalLessons: finalAssignments.length,
          unassignedLessons: finalAssignments.filter(l => {
            const ts = l.timeslotId != null ? l.timeslotId : (l.timeslot?.id != null ? l.timeslot.id : null);
            return ts == null;
          }).length
        },
        tgWantVsGot,
        studentConflicts,
        partialRecovery
      };

      return Response.json({
        ok: false,
        error: 'Schedule infeasible: constraints cannot be satisfied',
        code: 'INFEASIBLE_RESULT',
        hardScore: scoreToSave,
        diagnostics,
        explanation: `Failed to schedule all lessons. ${diagnostics.outputStats.unassignedLessons}/${diagnostics.outputStats.totalLessons} lessons unassigned.`
      }, { status: 400 });
    }

    // ─── FEASIBLE: Save the schedule ──────────────────────────────────────
    await b44Entities.ScheduleVersion.update(schedule_version_id, {
      score: scoreToSave,
      generated_at: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      result: {
        slotsInserted: slotsToInsert.length,
        score: scoreToSave,
        hardScoreNegative: false,
        partialRecovery,
        dedupDropped,
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