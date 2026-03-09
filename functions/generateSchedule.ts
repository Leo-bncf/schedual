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

  // teaching_groups with consistent id, section_id, subject_id
  const teachingGroupsPayload = dpGroups.map(tg => ({
    id: `tg_${tg.id}`,
    section_id: `sec_${tg.id}`,
    student_group: tg.year_group,
    subject_id: tg.subject_id,
    level: tg.level || 'HL',
  }));

  const lessons = [];
  const subject_requirements = [];
  const studentSubjectChoices = [];
  let lessonId = 1;

  for (const tg of dpGroups) {
    const subject = dpSubjects.find(s => s.id === tg.subject_id);
    if (!subject) continue;

    const level = tg.level || 'HL';
    const hoursHL = subject.hoursPerWeekHL > 0 ? subject.hoursPerWeekHL : 5;
    const hoursSL = subject.hoursPerWeekSL > 0 ? subject.hoursPerWeekSL : 3;
    const minutesPerWeek = tg.minutes_per_week ||
      (level === 'HL' ? hoursHL * 60 : hoursSL * 60);
    const periodsPerWeek = Math.max(1, Math.round(minutesPerWeek / periodDuration));
    const numericTeacherId = tg.teacher_id ? teacherMap.get(tg.teacher_id) ?? null : null;

    const tgStudentNumericIds = (tg.student_ids || []).map(sid => studentMap.get(sid)).filter(Boolean);
    const requiredCapacity = tgStudentNumericIds.length || 10;

    for (let i = 0; i < periodsPerWeek; i++) {
      lessons.push({
        id: lessonId++,
        subject: subject.code,
        studentGroup: tg.year_group,
        teachingGroupId: `tg_${tg.id}`,
        sectionId: `sec_${tg.id}`,
        yearGroup: tg.year_group,
        level,
        requiredCapacity,
        teacherId: numericTeacherId,
        timeslotId: null,
        studentIds: tgStudentNumericIds,
      });
    }

    subject_requirements.push({
      studentGroup: tg.year_group,
      teachingGroupId: `tg_${tg.id}`,
      sectionId: `sec_${tg.id}`,
      subject: subject.code,
      minutesPerWeek,
    });

    for (const base44StudentId of (tg.student_ids || [])) {
      const numericStudentId = studentMap.get(base44StudentId);
      if (!numericStudentId) continue;
      const alreadyAdded = studentSubjectChoices.find(
        c => c.studentId === numericStudentId && c.subjectId === subject.id && c.yearGroup === tg.year_group
      );
      if (!alreadyAdded) {
        studentSubjectChoices.push({
          studentId: numericStudentId,
          subjectId: subject.id,
          subject: subject.code,
          level,
          yearGroup: tg.year_group,
        });
      }
    }
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

function parseTimeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
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
  console.log(`[OptaPlanner] ${programType} HTTP ${res.status}: ${text.slice(0, 1000)}`);

  if (!res.ok) {
    return { ok: false, programType, status: res.status, error: text };
  }

  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { ok: true, programType, data: json };
}

// ─── Parse OptaPlanner response → ScheduleSlots ──────────────────────────────

function parseResponseToSlots({ responseData, payload, scheduleVersionId, schoolId, teacherMap, roomMap }) {
  const lessons = responseData?.lessons || responseData?.data?.lessons || [];
  const timeslots = responseData?.timeslots || responseData?.data?.timeslots || [];

  const teacherReverseMap = new Map();
  teacherMap.forEach((numId, base44Id) => teacherReverseMap.set(numId, base44Id));

  const roomReverseMap = new Map();
  roomMap.forEach((numId, base44Id) => roomReverseMap.set(numId, base44Id));

  const timeslotById = new Map();
  for (const ts of timeslots) timeslotById.set(ts.id, ts);

  // For DP: build tg reverse map
  const tgPayloadMap = new Map();
  if (payload.payloadType === 'individual_payload') {
    for (const tg of (payload.teaching_groups || [])) {
      tgPayloadMap.set(tg.id, tg.id.replace(/^tg_/, ''));
    }
  }

  const DAY_MAP = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday',
    Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday',
  };

  const slots = [];

  for (const lesson of lessons) {
    if (lesson.timeslotId == null) continue;

    const ts = timeslotById.get(lesson.timeslotId);
    const day = ts ? DAY_MAP[ts.day] || ts.day : null;
    if (!day) continue;

    const teacherBase44Id = lesson.teacherId ? teacherReverseMap.get(lesson.teacherId) ?? null : null;
    const roomBase44Id = lesson.roomId ? roomReverseMap.get(lesson.roomId) ?? null : null;

    const slot = {
      school_id: schoolId,
      schedule_version: scheduleVersionId,
      day,
      period: ts?.period ?? null,
      timeslot_id: lesson.timeslotId,
      teacher_id: teacherBase44Id,
      room_id: roomBase44Id,
      status: 'scheduled',
    };

    if (lesson.subject && payload.subjectIdByCode) {
      slot.subject_id = payload.subjectIdByCode[lesson.subject] ?? null;
    }

    if (lesson.teachingGroupId) {
      const base44TgId = tgPayloadMap.get(lesson.teachingGroupId);
      if (base44TgId) slot.teaching_group_id = base44TgId;
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

    const { teacherMap } = buildTeacherMap(teachers);
    const { roomMap } = buildRoomMap(rooms);

    // ── Send ONE payload at a time (rule: one programme shape per run) ──
    let totalSlotsInserted = 0;
    const failedProgrammes = [];
    const successProgrammes = [];

    for (const payload of payloadsToRun) {
      console.log(`[generateSchedule] Processing ${payload.programType}...`);
      const result = await sendToOptaPlanner(payload);

      if (!result.ok) {
        console.error(`[generateSchedule] ${payload.programType} failed: ${result.error}`);
        failedProgrammes.push({ programme: payload.programType, error: result.error, status: result.status });
        continue;
      }

      console.log(`[generateSchedule] ${payload.programType} success, parsing response...`);

      // Check if solver returned ok:false with a validation error
      const solverOk = result.data?.ok;
      const solverError = result.data?.errorCode || result.data?.code || result.data?.message;
      if (solverOk === false || solverError) {
        const errMsg = result.data?.message || result.data?.errorCode || 'Solver validation failed';
        const validationErrors = result.data?.validationErrors || [];
        console.error(`[generateSchedule] ${payload.programType} solver rejected: ${errMsg} | ${validationErrors.join(', ')}`);
        failedProgrammes.push({ programme: payload.programType, error: `${errMsg} (${validationErrors.join(', ')})` });
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

      console.log(`[generateSchedule] ${payload.programType}: ${slots.length} slots to insert`);

      const BATCH = 50;
      for (let i = 0; i < slots.length; i += BATCH) {
        await base44.entities.ScheduleSlot.bulkCreate(slots.slice(i, i + BATCH));
      }

      totalSlotsInserted += slots.length;
      successProgrammes.push({ programme: payload.programType, slots: slots.length });
    }

    await base44.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      generation_params: { programmes: [...programmes] },
      notes: `Generated: ${successProgrammes.map(s => `${s.programme}(${s.slots} slots)`).join(', ')}`,
    });

    console.log(`[generateSchedule] Done. Total slots inserted: ${totalSlotsInserted}`);

    const allFailed = failedProgrammes.length > 0 && successProgrammes.length === 0;
    return Response.json({
      ok: !allFailed && totalSlotsInserted > 0,
      slotsInserted: totalSlotsInserted,
      programmes: successProgrammes,
      failed: failedProgrammes,
      error: allFailed ? failedProgrammes.map(f => `${f.programme}: ${f.error}`).join('\n') : null,
    });

  } catch (error) {
    console.error('[generateSchedule] Fatal error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});