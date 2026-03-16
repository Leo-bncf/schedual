import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPTAPLANNER_API_KEY = Deno.env.get('OPTAPLANNER_API_KEY') || 'ib-scheduler-987654321';

// Build ingest URL: strip trailing slash, append /base44/ingest if not already present
function getIngestUrl() {
  const ep = (Deno.env.get('OPTAPLANNER_ENDPOINT') || 'http://87.106.27.27:8080').replace(/\/$/, '');
  const url = ep.endsWith('/base44/ingest') ? ep : `${ep}/base44/ingest`;
  console.log(`[OptaPlanner] Ingest URL: ${url}`);
  return url;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildTeacherMap(teachers) {
  const map = new Map(); // base44Id -> numericId
  const list = [];
  teachers.filter(t => t.is_active !== false).forEach((t, idx) => {
    const numericId = idx + 1;
    map.set(t.id, numericId);
    list.push({
      id: numericId,
      name: t.full_name,
      unavailableSlotIds: [],
      externalId: t.id,
    });
  });
  return { teacherList: list, teacherMap: map };
}

function buildRoomMap(rooms) {
  const map = new Map();
  const list = [];
  rooms.filter(r => r.is_active !== false).forEach((r, idx) => {
    const numericId = idx + 1;
    map.set(r.id, numericId);
    list.push({ id: numericId, name: r.name, capacity: r.capacity || 30, externalId: r.id });
  });
  return { roomList: list, roomMap: map };
}

function buildScheduleSettings(school) {
  return {
    periodDurationMinutes: school.period_duration_minutes || 60,
    dayStartTime: school.day_start_time || '08:00',
    dayEndTime: school.day_end_time || '18:00',
    daysOfWeek: school.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
    breaks: school.breaks || [],
  };
}

// Build solverTimeslots array from school schedule config
function buildSolverTimeslots(school) {
  const daysOfWeek = school.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const dayStartTime = school.day_start_time || '08:00';
  const dayEndTime = school.day_end_time || '18:00';
  const periodDurationMinutes = school.period_duration_minutes || 60;
  const breaks = school.breaks || [];

  const timeslots = [];
  let timeslotId = 1;

  const [startHour, startMin] = dayStartTime.split(':').map(Number);
  const [endHour, endMin] = dayEndTime.split(':').map(Number);
  const startTotalMins = startHour * 60 + startMin;
  const endTotalMins = endHour * 60 + endMin;

  for (const day of daysOfWeek) {
    let currentMins = startTotalMins;

    while (currentMins < endTotalMins) {
      const slotEndMins = currentMins + periodDurationMinutes;

      // Check if this slot overlaps with any breaks
      const isBreak = breaks.some(brk => {
        const [brkStartHour, brkStartMin] = brk.start.split(':').map(Number);
        const [brkEndHour, brkEndMin] = brk.end.split(':').map(Number);
        const brkStartMins = brkStartHour * 60 + brkStartMin;
        const brkEndMins = brkEndHour * 60 + brkEndMin;
        return currentMins < brkEndMins && slotEndMins > brkStartMins;
      });

      if (!isBreak) {
        const startHour2 = Math.floor(currentMins / 60);
        const startMin2 = currentMins % 60;
        const endHour2 = Math.floor(slotEndMins / 60);
        const endMin2 = slotEndMins % 60;

        timeslots.push({
          id: timeslotId++,
          dayOfWeek: day,
          startTime: `${String(startHour2).padStart(2, '0')}:${String(startMin2).padStart(2, '0')}`,
          endTime: `${String(endHour2).padStart(2, '0')}:${String(endMin2).padStart(2, '0')}`,
        });
      }

      currentMins = slotEndMins;
    }
  }

  return timeslots;
}

// ─── PYP / MYP cohort_payload builder ────────────────────────────────────────

function buildCohortPayload({ programType, schoolId, scheduleVersionId, school, students, teachers, subjects, rooms, teachingGroups }) {
  const { teacherList, teacherMap } = buildTeacherMap(teachers);
  const { roomList } = buildRoomMap(rooms);
  const scheduleSettings = buildScheduleSettings(school);
  const periodDuration = school.period_duration_minutes || 60;

  const progStudents = students.filter(s => s.ib_programme === programType && s.is_active !== false);
  const progYearGroups = [...new Set(progStudents.map(s => s.year_group).filter(Boolean))];
  const progGroups = teachingGroups.filter(tg => tg.is_active !== false && progYearGroups.includes(tg.year_group));

  const usedSubjectIds = new Set(progGroups.map(tg => tg.subject_id).filter(Boolean));
  const progSubjects = subjects.filter(s => usedSubjectIds.has(s.id));

  const subjectIdByCode = {};
  const subjectsPayload = progSubjects.map(s => {
    subjectIdByCode[s.code] = s.id;
    return { id: s.id, code: s.code, name: s.name };
  });

  const lessons = [];
  const subject_requirements = [];
  let lessonId = 1;

  for (const tg of progGroups) {
    const subject = progSubjects.find(s => s.id === tg.subject_id);
    if (!subject) continue;

    // Priority: tg.minutes_per_week > subject.pyp_myp_minutes_per_week_default
    const minutesPerWeek = tg.minutes_per_week || subject.pyp_myp_minutes_per_week_default || 180;
    const periodsPerWeek = Math.max(1, Math.round(minutesPerWeek / periodDuration));
    const numericTeacherId = tg.teacher_id ? teacherMap.get(tg.teacher_id) ?? null : null;
    const studentGroup = tg.year_group;
    const requiredCapacity = tg.student_ids?.length || progStudents.filter(s => s.year_group === studentGroup).length || 20;

    for (let i = 0; i < periodsPerWeek; i++) {
      lessons.push({
        id: lessonId++,
        subject: subject.code,
        studentGroup,
        requiredCapacity,
        teacherId: numericTeacherId,
        timeslotId: null,
      });
    }

    const alreadyAdded = subject_requirements.find(r => r.studentGroup === studentGroup && r.subject === subject.code);
    if (!alreadyAdded) {
      subject_requirements.push({ studentGroup, subject: subject.code, minutesPerWeek });
    }
  }

  return {
    payloadType: 'cohort_payload',
    programType,
    schoolId,
    scheduleVersionId,
    timezone: school.timezone || 'UTC',
    scheduleSettings,
    rooms: roomList,
    teachers: teacherList,
    subjects: subjectsPayload,
    lessons,
    subject_requirements,
    subjectIdByCode,
    constraints: {
      spreadAcrossDaysPerTeachingGroupSection: true,
      avoidSamePeriodRepetition: true,
      avoidTeacherLatePeriods: true,
    },
  };
}

// ─── DP individual_payload builder ───────────────────────────────────────────

function buildDPPayload({ schoolId, scheduleVersionId, school, students, teachers, subjects, rooms, teachingGroups }) {
  const { teacherList, teacherMap } = buildTeacherMap(teachers);
  const { roomList } = buildRoomMap(rooms);
  const scheduleSettings = buildScheduleSettings(school);
  const periodDuration = school.period_duration_minutes || 60;

  const dpStudents = students.filter(s => s.ib_programme === 'DP' && s.is_active !== false);

  // Exclude TOK, CAS, EE core components from scheduling
  const coreSubjectCodes = new Set(['TOK', 'CAS', 'EE', 'tok', 'cas', 'ee']);
  const coreSubjectIds = new Set(
    subjects.filter(s => s.is_core === true || coreSubjectCodes.has(s.code?.toUpperCase())).map(s => s.id)
  );

  const dpGroups = teachingGroups.filter(tg =>
    tg.is_active !== false &&
    (tg.year_group === 'DP1' || tg.year_group === 'DP2') &&
    !coreSubjectIds.has(tg.subject_id)
  );

  const studentMap = new Map();
  dpStudents.forEach((s, idx) => studentMap.set(s.id, idx + 1));

  const usedSubjectIds = new Set(dpGroups.map(tg => tg.subject_id).filter(Boolean));
  const dpSubjects = subjects.filter(s => usedSubjectIds.has(s.id));

  const subjectIdByCode = {};
  const subjectsPayload = dpSubjects.map(subj => {
    subjectIdByCode[subj.code] = subj.id;
    return { id: subj.id, code: subj.code, name: subj.name };
  });

  const subjectMap = new Map(dpSubjects.map(s => [s.id, s]));

  // Canonical teaching group mapping: one entry per actual scheduling scope.
  // The same identity is used across teaching_groups, lessons, subject_requirements and studentSubjectChoices.
  const tgByBucket = new Map();
  for (const tg of dpGroups) {
    const subject = subjectMap.get(tg.subject_id);
    if (!subject) continue;

    const level = tg.level || 'HL';
    const yearScope = subject.combine_dp1_dp2 ? 'DP1_DP2' : tg.year_group;
    const bucketKey = `${tg.subject_id}__${yearScope}__${level}`;

    if (!tgByBucket.has(bucketKey)) {
      tgByBucket.set(bucketKey, []);
    }
    tgByBucket.get(bucketKey).push(tg);
  }

  const teachingGroupsPayload = [];
  const lessons = [];
  const subject_requirements = [];
  const studentSubjectChoices = [];
  let lessonId = 1;

  for (const [bucketKey, bucketTgs] of tgByBucket.entries()) {
    const [subjectId, yearScope, level] = bucketKey.split('__');
    const subject = subjectMap.get(subjectId);
    if (!subject) continue;

    const subjectKey = subjectId.replace(/-/g, '');
    const repTg = bucketTgs[0];
    const studentGroup = `${yearScope}_${level}_${subjectKey}`;
    const sectionId = `sec_${level.toLowerCase()}_${subjectKey}_${yearScope}`;
    const teachingGroupId = repTg ? repTg.id : null;
    const hoursForLevel = level === 'HL' ? Number(subject.hoursPerWeekHL || 0) : Number(subject.hoursPerWeekSL || 0);
    const minutesPerWeek = hoursForLevel * 60;
    const periodsPerWeek = Math.max(1, Math.ceil(minutesPerWeek / periodDuration));
    const teacherId = bucketTgs.reduce((acc, tg) => acc || (tg.teacher_id ? (teacherMap.get(tg.teacher_id) ?? null) : null), null);

    // Only include students who actually have this subject+level in their subject_choices.
    // This ensures lessons.studentIds always matches studentSubjectChoices — preventing STUDENT_MEMBERSHIP_INCONSISTENT.
    const validYearGroups = yearScope === 'DP1_DP2' ? ['DP1', 'DP2'] : [yearScope];
    const rawStudentIds = [...new Set(bucketTgs.flatMap(tg => (tg.student_ids || [])))];
    const studentIds = rawStudentIds.map(base44Id => {
      const student = dpStudents.find(s => s.id === base44Id);
      if (!student) return null;
      const hasChoice = (student.subject_choices || []).some(c =>
        c.subject_id === subjectId &&
        String(c.level || '').toUpperCase() === level.toUpperCase() &&
        validYearGroups.includes(student.year_group)
      );
      return hasChoice ? studentMap.get(base44Id) : null;
    }).filter(Boolean);

    teachingGroupsPayload.push({
      id: teachingGroupId,
      section_id: sectionId,
      student_group: studentGroup,
      subject_id: subjectId,
      level,
    });

    for (let i = 0; i < periodsPerWeek; i++) {
      lessons.push({
        id: lessonId++,
        subject: subject.code,
        studentGroup,
        teachingGroupId,
        sectionId,
        yearGroup: yearScope,
        level,
        requiredCapacity: studentIds.length || 10,
        teacherId,
        timeslotId: null,
        studentIds,
      });
    }

    subject_requirements.push({
      studentGroup,
      teachingGroupId,
      sectionId,
      subject: subject.code,
      minutesPerWeek,
    });

    // Build studentSubjectChoices from the SAME filtered set used in studentIds
    // so that lessons.studentIds always exactly matches studentSubjectChoices entries.
    for (const base44StudentId of rawStudentIds) {
      const student = dpStudents.find(s => s.id === base44StudentId);
      if (!student) continue;
      const hasChoice = (student.subject_choices || []).some(c =>
        c.subject_id === subjectId &&
        String(c.level || '').toUpperCase() === level.toUpperCase() &&
        validYearGroups.includes(student.year_group)
      );
      if (!hasChoice) continue;
      const numericStudentId = studentMap.get(base44StudentId);
      if (!numericStudentId) continue;
      if (!studentSubjectChoices.find(c => c.studentId === numericStudentId && c.subjectId === subject.id && c.yearGroup === yearScope && c.level === level)) {
        studentSubjectChoices.push({
          studentId: numericStudentId,
          subjectId: subject.id,
          subject: subject.code,
          level,
          yearGroup: yearScope,
          teachingGroupId,
        });
      }
    }

    console.log(`[buildDPPayload] ${subject.code} ${yearScope} (${level}): ${periodsPerWeek} lessons | merged groups: ${bucketTgs.length} | students: ${studentIds.length}`);
  }

  console.log(`[buildDPPayload] lessons=${lessons.length}, teachers=${teacherList.length}`);

  return {
    payloadType: 'individual_payload',
    programType: 'DP',
    schoolId,
    scheduleVersionId,
    timezone: school.timezone || 'UTC',
    calendar: { academicYear: school.academic_year || '2025-2026', termId: 'T1' },
    scheduleSettings,
    rooms: roomList,
    teachers: teacherList,
    subjects: subjectsPayload,
    teaching_groups: teachingGroupsPayload,
    lessons,
    subject_requirements,
    studentSubjectChoices,
    subjectIdByCode,
    constraints: {
      spreadAcrossDaysPerTeachingGroupSection: true,
      avoidSamePeriodRepetition: true,
      avoidTeacherLatePeriods: true,
    },
  };
}

function validateDPPayload(payload) {
  const errors = [];
  const periodDuration = Number(payload?.scheduleSettings?.periodDurationMinutes || 60);
  const groupMap = new Map((payload.teaching_groups || []).map((group) => [group.id, group]));
  const subjectByCode = new Map((payload.subjects || []).map((subject) => [subject.code, subject]));
  const lessonsByScope = new Map();
  const requirementsByScope = new Map();

  for (const lesson of payload.lessons || []) {
    const group = groupMap.get(lesson.teachingGroupId);
    if (!group) {
      errors.push(`Missing teaching group for lesson ${lesson.id}: ${lesson.teachingGroupId}`);
      continue;
    }

    const subject = subjectByCode.get(lesson.subject);
    if (!subject || subject.id !== group.subject_id) {
      errors.push(`Subject mismatch for lesson ${lesson.id}: lesson.subject=${lesson.subject}, teaching_group.subject_id=${group.subject_id}`);
    }

    if (lesson.studentGroup !== group.student_group) {
      errors.push(`studentGroup mismatch for lesson ${lesson.id}: ${lesson.studentGroup} !== ${group.student_group}`);
    }

    if (lesson.sectionId !== group.section_id) {
      errors.push(`sectionId mismatch for lesson ${lesson.id}: ${lesson.sectionId} !== ${group.section_id}`);
    }

    const scopeKey = `${lesson.teachingGroupId}__${lesson.sectionId}__${lesson.subject}`;
    const current = lessonsByScope.get(scopeKey) || [];
    current.push(lesson);
    lessonsByScope.set(scopeKey, current);
  }

  for (const requirement of payload.subject_requirements || []) {
    const group = groupMap.get(requirement.teachingGroupId);
    if (!group) {
      errors.push(`Missing teaching group for requirement: ${requirement.teachingGroupId}`);
      continue;
    }

    if (requirement.studentGroup !== group.student_group) {
      errors.push(`Requirement studentGroup mismatch for ${requirement.teachingGroupId}`);
    }

    if (requirement.sectionId !== group.section_id) {
      errors.push(`Requirement sectionId mismatch for ${requirement.teachingGroupId}`);
    }

    const scopeKey = `${requirement.teachingGroupId}__${requirement.sectionId}__${requirement.subject}`;
    requirementsByScope.set(scopeKey, requirement);

    const requiredPeriods = Math.ceil(Number(requirement.minutesPerWeek || 0) / periodDuration);
    const actualPeriods = (lessonsByScope.get(scopeKey) || []).length;
    if (actualPeriods !== requiredPeriods) {
      errors.push(`Hour parity mismatch for ${scopeKey}: expected ${requiredPeriods}, got ${actualPeriods}`);
    }
  }

  const choiceKeys = new Set();
  const levelKeys = new Map();
  for (const choice of payload.studentSubjectChoices || []) {
    const group = groupMap.get(choice.teachingGroupId);
    if (!group) {
      errors.push(`Missing teaching group for choice: ${choice.teachingGroupId}`);
      continue;
    }

    const duplicateKey = `${choice.studentId}__${choice.subjectId}__${choice.yearGroup}`;
    if (choiceKeys.has(duplicateKey)) {
      errors.push(`Duplicate student choice: ${duplicateKey}`);
    }
    choiceKeys.add(duplicateKey);

    const levelKey = `${choice.studentId}__${choice.subjectId}__${choice.yearGroup}`;
    const currentLevels = levelKeys.get(levelKey) || new Set();
    currentLevels.add(choice.level);
    levelKeys.set(levelKey, currentLevels);

    const subject = payload.subjects.find((item) => item.id === choice.subjectId);
    const scopeKey = `${choice.teachingGroupId}__${group.section_id}__${subject?.code || choice.subject}`;
    const req = requirementsByScope.get(scopeKey);
    const lessons = lessonsByScope.get(scopeKey) || [];
    if (!req || lessons.length === 0) {
      errors.push(`Choice scope missing requirement/lessons for ${choice.teachingGroupId}`);
    }
  }

  for (const [key, levels] of levelKeys.entries()) {
    if (levels.has('HL') && levels.has('SL')) {
      errors.push(`Student has both HL and SL for same subject/yearGroup: ${key}`);
    }
  }

  return errors;
}

function validatePostSolveStudentOverlaps(responseData, payload) {
  const entries = [
    ...(responseData?.lessons || responseData?.data?.lessons || []),
    ...(responseData?.assignments || responseData?.data?.assignments || []),
  ];
  const payloadLessonMap = new Map((payload?.lessons || []).map((lesson) => [String(lesson.id), lesson]));
  const seen = new Map();
  const overlaps = [];

  for (const entry of entries) {
    if (entry?.timeslotId == null) continue;
    const payloadLesson = payloadLessonMap.get(String(entry.lessonId ?? entry.id));
    if (!payloadLesson || !Array.isArray(payloadLesson.studentIds)) continue;

    for (const studentId of payloadLesson.studentIds) {
      const key = `${studentId}__${entry.timeslotId}`;
      if (seen.has(key)) {
        overlaps.push({
          studentId,
          timeslotId: entry.timeslotId,
          firstLessonId: seen.get(key).lessonId,
          secondLessonId: entry.lessonId ?? entry.id,
          firstTeachingGroupId: seen.get(key).teachingGroupId,
          secondTeachingGroupId: entry.teachingGroupId || null,
        });
      } else {
        seen.set(key, {
          lessonId: entry.lessonId ?? entry.id,
          teachingGroupId: entry.teachingGroupId || null,
        });
      }
    }
  }

  return overlaps;
}

function validatePostSolveAssignmentCoverage(responseData, payload) {
  const entries = [
    ...(responseData?.lessons || responseData?.data?.lessons || []),
    ...(responseData?.assignments || responseData?.data?.assignments || []),
  ];

  const payloadLessonMap = new Map((payload?.lessons || []).map((lesson) => [String(lesson.id), lesson]));
  const expectedCounts = new Map();
  const actualCounts = new Map();

  (payload?.lessons || []).forEach((lesson) => {
    const key = `${lesson.sectionId || ''}__${lesson.teachingGroupId || ''}__${lesson.subject || ''}`;
    expectedCounts.set(key, (expectedCounts.get(key) || 0) + 1);
  });

  entries.forEach((entry) => {
    if (entry?.timeslotId == null) return;
    const payloadLesson = payloadLessonMap.get(String(entry.lessonId ?? entry.id));
    if (!payloadLesson) return;
    const key = `${payloadLesson.sectionId || ''}__${payloadLesson.teachingGroupId || ''}__${payloadLesson.subject || ''}`;
    actualCounts.set(key, (actualCounts.get(key) || 0) + 1);
  });

  const missingScopes = [];
  expectedCounts.forEach((expected, key) => {
    const actual = actualCounts.get(key) || 0;
    if (actual !== expected) {
      missingScopes.push({ key, expected, actual });
    }
  });

  return missingScopes;
}

// ─── OptaPlanner call — ONE payload per call ──────────────────────────────────

async function sendToOptaPlanner(payload) {
  const ingestUrl = getIngestUrl();
  const programType = payload.programType;
  console.log(`[OptaPlanner] Sending ${programType} payload: ${payload.lessons.length} lessons, ${payload.teachers.length} teachers, ${payload.rooms.length} rooms`);

  const res = await fetch(ingestUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': OPTAPLANNER_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`[OptaPlanner] ${programType} HTTP ${res.status}: ${text.slice(0, 3000)}`);
  if (text.length > 3000) console.log(`[OptaPlanner] ${programType} response truncated, full length: ${text.length}`);

  if (!res.ok) {
    return { ok: false, programType, status: res.status, error: text };
  }

  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  console.log(`[OptaPlanner] ${programType} parsed response keys: ${Object.keys(json || {}).join(', ')}`);
  console.log(`[OptaPlanner] ${programType} response.ok=${json?.ok}, response.errorCode=${json?.errorCode}, response.validationErrors=${JSON.stringify(json?.validationErrors)}`);

  // Detect server-level NOT_FOUND / routing errors returned as HTTP 200 with an error body
  if (json?.error && !json?.lessons && !json?.data?.lessons) {
    console.error(`[OptaPlanner] ${programType} server-level error in body: ${JSON.stringify(json)}`);
    return { ok: false, programType, status: res.status, error: JSON.stringify(json) };
  }

  return { ok: true, programType, data: json };
}

// ─── Parse OptaPlanner response → ScheduleSlots ──────────────────────────────

function parseResponseToSlots({ responseData, payload, scheduleVersionId, schoolId, teacherMap, roomMap }) {
  // Build lookup tables from the payload we sent so persisted slots always use
  // the same Base44 metadata even when the solver returns synthetic IDs.
  const sectionIdToRealTgId = new Map();
  const payloadLessonById = new Map();
  for (const lesson of (payload?.lessons || [])) {
    payloadLessonById.set(String(lesson.id), lesson);
    if (lesson.sectionId && lesson.teachingGroupId) {
      sectionIdToRealTgId.set(lesson.sectionId, lesson.teachingGroupId);
    }
  }
  // Server returns either `lessons` (cohort) or `assignments` (DP/individual)
  const lessons = responseData?.lessons || responseData?.data?.lessons || [];
  const assignments = responseData?.assignments || responseData?.data?.assignments || [];

  // solverTimeslots: List<{id, dayOfWeek, startTime, endTime}> — echoed back from scheduleSettings
  const solverTimeslots = responseData?.solverTimeslots || responseData?.data?.solverTimeslots || 
                          responseData?.timeslots || responseData?.data?.timeslots || [];

  const teacherReverseMap = new Map();
  teacherMap.forEach((numId, base44Id) => teacherReverseMap.set(numId, base44Id));

  const roomReverseMap = new Map();
  roomMap.forEach((numId, base44Id) => roomReverseMap.set(numId, base44Id));

  // Build timeslot lookup by id → {day, period}
  // dayOfWeek field is used (not `day`). Period = index within that day's slots sorted by startTime + 1.
  const DAY_MAP = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday',
  };

  // Group timeslots by day and sort by startTime to derive period numbers
  const timeslotsByDay = {};
  for (const ts of solverTimeslots) {
    const d = ts.dayOfWeek;
    if (!timeslotsByDay[d]) timeslotsByDay[d] = [];
    timeslotsByDay[d].push(ts);
  }
  for (const d of Object.keys(timeslotsByDay)) {
    timeslotsByDay[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const timeslotById = new Map();
  for (const [dayOfWeek, slots] of Object.entries(timeslotsByDay)) {
    const day = DAY_MAP[dayOfWeek] || dayOfWeek;
    slots.forEach((ts, idx) => {
      timeslotById.set(ts.id, { day, period: idx + 1, startTime: ts.startTime, endTime: ts.endTime });
    });
  }

  console.log(`[parseResponseToSlots] lessons=${lessons.length}, assignments=${assignments.length}, solverTimeslots=${solverTimeslots.length}, timeslotLookup=${timeslotById.size}`);
  if (solverTimeslots.length > 0) console.log(`[parseResponseToSlots] sample solverTimeslot: ${JSON.stringify(solverTimeslots[0])}`);

  const allEntries = [...lessons, ...assignments];
  if (allEntries.length > 0) console.log(`[parseResponseToSlots] sample entry: ${JSON.stringify(allEntries[0])}`);

  const slots = [];

  for (const entry of allEntries) {
    if (entry.timeslotId == null) continue;

    const ts = timeslotById.get(entry.timeslotId);
    if (!ts) {
      console.warn(`[parseResponseToSlots] No timeslot found for timeslotId=${entry.timeslotId}`);
      continue;
    }

    const payloadLesson = payloadLessonById.get(String(entry.lessonId ?? entry.id));
    const teacherBase44Id = entry.teacherId ? teacherReverseMap.get(entry.teacherId) ?? null : null;
    const roomBase44Id = entry.roomId ? roomReverseMap.get(entry.roomId) ?? null : null;

    const slot = {
      school_id: schoolId,
      schedule_version: scheduleVersionId,
      day: ts.day,
      period: ts.period,
      timeslot_id: entry.timeslotId,
      teacher_id: teacherBase44Id,
      room_id: roomBase44Id,
      status: 'scheduled',
    };

    const subjectCode = payloadLesson?.subject || entry.subject;
    if (subjectCode && payload.subjectIdByCode) {
      slot.subject_id = payload.subjectIdByCode[subjectCode] ?? null;
    }

    if (payloadLesson?.level) {
      slot.display_level_override = payloadLesson.level;
    }
    if (payloadLesson?.sectionId || entry.sectionId) {
      slot.section_id = payloadLesson?.sectionId || entry.sectionId;
    }
    if (payloadLesson?.yearGroup) {
      slot.year_group_scope = payloadLesson.yearGroup;
    }
    if (entry.teachingGroupId) {
      slot.solver_teaching_group_id = String(entry.teachingGroupId);
    }

    // Always prefer the teaching group ID from the lesson we sent to the solver.
    if (payloadLesson?.teachingGroupId) {
      slot.teaching_group_id = payloadLesson.teachingGroupId;
    } else if (entry.sectionId && sectionIdToRealTgId.has(entry.sectionId)) {
      slot.teaching_group_id = sectionIdToRealTgId.get(entry.sectionId);
    } else if (entry.teachingGroupId) {
      const raw = String(entry.teachingGroupId);
      slot.teaching_group_id = raw.startsWith('tg_') ? raw.slice(3)
        : raw.startsWith('TG_') ? raw.slice(3)
        : raw;
    }

    slots.push(slot);
  }

  return slots;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { schedule_version_id } = body;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id is required' }, { status: 400 });
    }

    const schoolId = user.school_id;

    const [schools, students, teachers, subjects, rooms, teachingGroups] = await Promise.all([
      base44.entities.School.filter({ id: schoolId }),
      base44.entities.Student.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId }),
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.Room.filter({ school_id: schoolId }),
      base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    ]);

    const school = schools[0];
    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    console.log(`[generateSchedule] School: ${school.name}, Students: ${students.length}, Teachers: ${teachers.length}`);

    const activeStudents = students.filter(s => s.is_active !== false);
    const programmes = new Set(activeStudents.map(s => s.ib_programme).filter(Boolean));
    console.log(`[generateSchedule] Programmes with students: ${[...programmes].join(', ')}`);

    const common = { schoolId, scheduleVersionId: schedule_version_id, school, students, teachers, subjects, rooms, teachingGroups };

    // Build payloads — ONE per programme
    const payloadsToRun = [];
    if (programmes.has('PYP')) payloadsToRun.push(buildCohortPayload({ programType: 'PYP', ...common }));
    if (programmes.has('MYP')) payloadsToRun.push(buildCohortPayload({ programType: 'MYP', ...common }));
    if (programmes.has('DP'))  payloadsToRun.push(buildDPPayload(common));

    if (payloadsToRun.length === 0) {
      return Response.json({ error: 'No students found in any IB programme' }, { status: 400 });
    }

    // Build maps once for reverse-lookup during slot parsing
    const { teacherMap } = buildTeacherMap(teachers);
    const { roomMap } = buildRoomMap(rooms);

    // ── Build solverTimeslots from school config ──
    const solverTimeslots = buildSolverTimeslots(school);
    console.log(`[generateSchedule] Built ${solverTimeslots.length} solverTimeslots from school schedule`);

    // ── Send ONE payload at a time and reject anything inconsistent ──
    let totalSlotsInserted = 0;
    const failedProgrammes = [];
    const successProgrammes = [];
    const slotsToPersist = [];

    for (const payload of payloadsToRun) {
      console.log(`[generateSchedule] Processing ${payload.programType}...`);

      if (payload.programType === 'DP') {
        const payloadErrors = validateDPPayload(payload);
        if (payloadErrors.length > 0) {
          failedProgrammes.push({ programme: payload.programType, error: `Payload validation failed: ${payloadErrors.slice(0, 10).join(' | ')}` });
          continue;
        }
      }

      const result = await sendToOptaPlanner(payload);

      if (!result.ok) {
        console.error(`[generateSchedule] ${payload.programType} failed: ${result.error}`);
        failedProgrammes.push({ programme: payload.programType, error: result.error, status: result.status });
        continue;
      }

      const hardScore = Number(result.data?.hardScore ?? NaN);
      const conflictsCount = Number(result.data?.conflictsCount || 0);
      const topConstraint = result.data?.hardConstraintsBreakdown?.[0]?.constraintName || null;
      const solveStage = result.data?.stage || 'SOLVE';
      const solverErrorCode = result.data?.errorCode || null;
      const validationErrors = result.data?.validationErrors || [];
      const isStrictlyValid = result.data?.ok === true && hardScore === 0 && result.data?.isFeasible === true && conflictsCount === 0;

      if (!isStrictlyValid) {
        let reasonCode = 'SOLUTION_INFEASIBLE';
        if (solverErrorCode === 'PRE_SOLVE_VALIDATION_FAILED' || solveStage === 'PRE_SOLVE_VALIDATION') {
          reasonCode = 'PRE_SOLVE_VALIDATION_FAILED';
        } else if (!Number.isNaN(hardScore) && hardScore < 0) {
          reasonCode = 'HARD_CONSTRAINTS_VIOLATED';
        }

        const blocker = topConstraint || validationErrors[0] || result.data?.reason || result.data?.error || 'unknown';
        const errorBits = [
          `code=${reasonCode}`,
          `ok=${result.data?.ok}`,
          `hardScore=${result.data?.hardScore}`,
          `isFeasible=${result.data?.isFeasible}`,
          `conflictsCount=${result.data?.conflictsCount}`,
          `constraint=${blocker}`,
          `error=${result.data?.error || result.data?.reason || reasonCode}`
        ];
        failedProgrammes.push({
          programme: payload.programType,
          stage: solveStage,
          reason_code: reasonCode,
          blocker,
          error: errorBits.join(' | ')
        });
        continue;
      }

      const postSolveOverlaps = payload.programType === 'DP'
        ? validatePostSolveStudentOverlaps(result.data, payload)
        : [];

      if (postSolveOverlaps.length > 0) {
        failedProgrammes.push({
          programme: payload.programType,
          stage: 'POST_SOLVE_VALIDATION_FAILED',
          reason_code: 'STUDENT_OVERLAP_DETECTED',
          blocker: 'Student appears in multiple lessons in same timeslot',
          error: `POST_SOLVE_VALIDATION_FAILED | code=STUDENT_OVERLAP_DETECTED | overlaps=${JSON.stringify(postSolveOverlaps.slice(0, 5))}`
        });
        continue;
      }

      const missingScopes = validatePostSolveAssignmentCoverage(result.data, payload);
      if (missingScopes.length > 0) {
        failedProgrammes.push({
          programme: payload.programType,
          stage: 'POST_SOLVE_VALIDATION_FAILED',
          reason_code: 'ASSIGNMENT_COUNT_MISMATCH',
          blocker: 'Solver returned fewer lessons than requested for one or more sections',
          error: `POST_SOLVE_VALIDATION_FAILED | code=ASSIGNMENT_COUNT_MISMATCH | missing=${JSON.stringify(missingScopes.slice(0, 10))}`
        });
        continue;
      }

      const slots = parseResponseToSlots({
        responseData: result.data,
        payload,
        scheduleVersionId: schedule_version_id,
        schoolId,
        teacherMap,
        roomMap,
      });

      slotsToPersist.push(...slots);
      totalSlotsInserted += slots.length;
      successProgrammes.push({ programme: payload.programType, slots: slots.length });
    }

    if (failedProgrammes.length > 0 || successProgrammes.length === 0) {
      const primaryFailure = failedProgrammes[0] || null;
      return Response.json({
        ok: false,
        stage: primaryFailure?.stage || 'SOLVE',
        code: primaryFailure?.reason_code || 'SOLUTION_INFEASIBLE',
        slotsInserted: 0,
        programmes: successProgrammes,
        failed: failedProgrammes,
        solverTimeslots,
        error: failedProgrammes.map(f => `${f.programme}: ${f.error}`).join('\n'),
      });
    }

    const existingVersionSlots = await base44.entities.ScheduleSlot.filter({ schedule_version: schedule_version_id }, '-created_date', 1000);
    console.log(`[generateSchedule] Found ${existingVersionSlots.length} existing slots for version ${schedule_version_id}`);
    for (let i = 0; i < existingVersionSlots.length; i += 50) {
      await Promise.all(
        existingVersionSlots.slice(i, i + 50).map((slot) => base44.entities.ScheduleSlot.delete(slot.id))
      );
    }
    console.log(`[generateSchedule] Cleared ${existingVersionSlots.length} existing slots for version ${schedule_version_id}`);

    const BATCH = 50;
    for (let i = 0; i < slotsToPersist.length; i += BATCH) {
      await base44.entities.ScheduleSlot.bulkCreate(slotsToPersist.slice(i, i + BATCH));
    }

    await base44.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      generation_params: { 
        programmes: [...programmes],
        solverTimeslots: solverTimeslots
      },
      notes: `Generated: ${successProgrammes.map(s => `${s.programme}(${s.slots} slots)`).join(', ')}`,
    });

    console.log(`[generateSchedule] Done. Total slots inserted: ${totalSlotsInserted}, solverTimeslots saved: ${solverTimeslots.length}`);
    console.log(`[generateSchedule] First 3 solverTimeslots: ${JSON.stringify(solverTimeslots.slice(0, 3))}`);

    return Response.json({
      ok: true,
      slotsInserted: totalSlotsInserted,
      programmes: successProgrammes,
      failed: [],
      solverTimeslots: solverTimeslots,
      error: null,
    });

  } catch (error) {
    console.error('[generateSchedule] Fatal error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});