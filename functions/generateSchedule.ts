import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OPTAPLANNER_ENDPOINT = Deno.env.get('OPTAPLANNER_ENDPOINT') || 'http://87.106.27.27:8080';
const OPTAPLANNER_API_KEY = Deno.env.get('OPTAPLANNER_API_KEY') || 'ib-scheduler-987654321';
const INGEST_URL = `${OPTAPLANNER_ENDPOINT}/base44/ingest`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a stable payload-wide teacher index map.
 * Returns: { numericId (number), name, externalId (base44 id), unavailableSlotIds }[]
 * And a Map<base44Id, numericId> for quick lookup.
 */
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

/**
 * Build a stable payload-wide room list with numeric ids.
 * Returns: { numericId, name, capacity, externalId }[]
 * And a Map<base44Id, numericId>.
 */
function buildRoomMap(rooms) {
  const map = new Map();
  const list = [];
  rooms.filter(r => r.is_active !== false).forEach((r, idx) => {
    const numericId = idx + 1;
    map.set(r.id, numericId);
    list.push({
      id: numericId,
      name: r.name,
      capacity: r.capacity || 30,
      externalId: r.id,
    });
  });
  return { roomList: list, roomMap: map };
}

/**
 * Build scheduleSettings from school entity.
 */
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

function buildCohortPayload({
  programType,
  schoolId,
  scheduleVersionId,
  school,
  students,
  teachers,
  subjects,
  rooms,
  teachingGroups,
}) {
  const { teacherList, teacherMap } = buildTeacherMap(teachers);
  const { roomList } = buildRoomMap(rooms);
  const scheduleSettings = buildScheduleSettings(school);

  // Filter to this programme's students and teaching groups
  const progStudents = students.filter(s => s.ib_programme === programType && s.is_active !== false);
  const progYearGroups = [...new Set(progStudents.map(s => s.year_group).filter(Boolean))];
  const progGroups = teachingGroups.filter(
    tg => tg.is_active !== false && progYearGroups.includes(tg.year_group)
  );

  // Subjects used by these teaching groups
  const usedSubjectIds = new Set(progGroups.map(tg => tg.subject_id).filter(Boolean));
  const progSubjects = subjects.filter(s => usedSubjectIds.has(s.id));

  // subjectIdByCode map and subjects array
  const subjectIdByCode = {};
  const subjectsPayload = progSubjects.map(s => {
    const code = s.code;
    subjectIdByCode[code] = s.id;
    return { id: s.id, code, name: s.name };
  });

  // lessons: one lesson per teaching group per required weekly period
  // Fixed count: use subject.pyp_myp_minutes_per_week_default / periodDurationMinutes
  const periodDuration = school.period_duration_minutes || 60;
  const lessons = [];
  const subject_requirements = [];
  let lessonId = 1;

  for (const tg of progGroups) {
    const subject = progSubjects.find(s => s.id === tg.subject_id);
    if (!subject) continue;

    const minutesPerWeek = tg.minutes_per_week || subject.pyp_myp_minutes_per_week_default || 180;
    const periodsPerWeek = Math.round(minutesPerWeek / periodDuration);
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

    // subject_requirements: one entry per (studentGroup, subject) combination
    const alreadyAdded = subject_requirements.find(
      r => r.studentGroup === studentGroup && r.subject === subject.code
    );
    if (!alreadyAdded) {
      subject_requirements.push({
        studentGroup,
        subject: subject.code,
        minutesPerWeek,
      });
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

function buildDPPayload({
  schoolId,
  scheduleVersionId,
  school,
  students,
  teachers,
  subjects,
  rooms,
  teachingGroups,
}) {
  const { teacherList, teacherMap } = buildTeacherMap(teachers);
  const { roomList } = buildRoomMap(rooms);
  const scheduleSettings = buildScheduleSettings(school);
  const periodDuration = school.period_duration_minutes || 60;

  const dpStudents = students.filter(s => s.ib_programme === 'DP' && s.is_active !== false);
  const dpGroups = teachingGroups.filter(
    tg => tg.is_active !== false && (tg.year_group === 'DP1' || tg.year_group === 'DP2')
  );

  // Build numeric student ID map
  const studentMap = new Map(); // base44Id -> numericId
  dpStudents.forEach((s, idx) => studentMap.set(s.id, idx + 1));

  // Subjects used by DP teaching groups
  const usedSubjectIds = new Set(dpGroups.map(tg => tg.subject_id).filter(Boolean));
  const dpSubjects = subjects.filter(s => usedSubjectIds.has(s.id));

  const subjectIdByCode = {};
  const subjectsPayload = dpSubjects.map(subj => {
    const code = subj.code;
    subjectIdByCode[code] = subj.id;
    return { id: subj.id, code, name: subj.name };
  });

  // teaching_groups array for payload
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
    const minutesPerWeek = tg.minutes_per_week ||
      (level === 'HL' ? (subject.hoursPerWeekHL || 5) * 60 : (subject.hoursPerWeekSL || 3) * 60);
    const periodsPerWeek = Math.round(minutesPerWeek / periodDuration);
    const numericTeacherId = tg.teacher_id ? teacherMap.get(tg.teacher_id) ?? null : null;

    // Students in this teaching group
    const tgStudentIds = (tg.student_ids || [])
      .map(sid => studentMap.get(sid))
      .filter(Boolean);

    const requiredCapacity = tgStudentIds.length || tg.student_ids?.length || 10;

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
        studentIds: tgStudentIds,
      });
    }

    subject_requirements.push({
      studentGroup: tg.year_group,
      teachingGroupId: `tg_${tg.id}`,
      sectionId: `sec_${tg.id}`,
      subject: subject.code,
      minutesPerWeek,
    });

    // studentSubjectChoices: one entry per student in this TG
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

  return {
    payloadType: 'individual_payload',
    programType: 'DP',
    schoolId,
    scheduleVersionId,
    timezone: school.timezone || 'UTC',
    calendar: {
      academicYear: school.academic_year || '2025-2026',
      termId: 'T1',
    },
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

// ─── OptaPlanner call ─────────────────────────────────────────────────────────

async function sendToOptaPlanner(payload) {
  const programType = payload.programType;
  console.log(`[OptaPlanner] Sending ${programType} payload: ${payload.lessons.length} lessons, ${payload.teachers.length} teachers, ${payload.rooms.length} rooms`);

  const res = await fetch(INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': OPTAPLANNER_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  console.log(`[OptaPlanner] ${programType} HTTP ${res.status}: ${text.slice(0, 500)}`);

  if (!res.ok) {
    return { ok: false, programType, status: res.status, error: text };
  }

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { ok: true, programType, data: json };
}

// ─── Parse OptaPlanner response → ScheduleSlots ──────────────────────────────

/**
 * OptaPlanner returns scheduled lessons with timeslotId assigned.
 * We map them back to ScheduleSlot records.
 * 
 * Expected response shape (adjust if OptaPlanner differs):
 * { lessons: [{ id, timeslotId, teacherId, subject, studentGroup, ... }], timeslots: [{ id, day, startTime, endTime }] }
 */
function parseResponseToSlots({ responseData, payload, scheduleVersionId, schoolId, teacherMap, roomMap }) {
  const lessons = responseData?.lessons || responseData?.data?.lessons || [];
  const timeslots = responseData?.timeslots || responseData?.data?.timeslots || [];

  // Reverse maps: numericId -> base44Id
  const teacherReverseMap = new Map();
  teacherMap.forEach((numId, base44Id) => teacherReverseMap.set(numId, base44Id));

  const roomReverseMap = new Map();
  roomMap.forEach((numId, base44Id) => roomReverseMap.set(numId, base44Id));

  // Timeslot lookup: id -> { day, startTime }
  const timeslotById = new Map();
  for (const ts of timeslots) {
    timeslotById.set(ts.id, ts);
  }

  // For DP: build reverse map tg_base44Id from payload
  const tgPayloadMap = new Map(); // "tg_xxx" -> base44 tg id
  if (payload.payloadType === 'individual_payload') {
    for (const tg of (payload.teaching_groups || [])) {
      // tg.id = "tg_<base44id>"
      const base44TgId = tg.id.replace(/^tg_/, '');
      tgPayloadMap.set(tg.id, base44TgId);
    }
  }

  const DAY_MAP = {
    MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday', FRIDAY: 'Friday',
    Monday: 'Monday', Tuesday: 'Tuesday', Wednesday: 'Wednesday',
    Thursday: 'Thursday', Friday: 'Friday',
  };

  const slots = [];

  for (const lesson of lessons) {
    if (lesson.timeslotId == null) continue; // unscheduled

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

    // Subject id
    if (lesson.subject && payload.subjectIdByCode) {
      slot.subject_id = payload.subjectIdByCode[lesson.subject] ?? null;
    }

    // Teaching group (DP)
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

    // ── Fetch all school data in parallel ──
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

    // ── Determine which programmes have students ──
    const programmes = new Set(students.filter(s => s.is_active !== false).map(s => s.ib_programme).filter(Boolean));
    console.log(`[generateSchedule] Programmes with students: ${[...programmes].join(', ')}`);

    // ── Build payloads ──
    const payloads = [];
    const common = { schoolId, scheduleVersionId: schedule_version_id, school, students, teachers, subjects, rooms, teachingGroups };

    if (programmes.has('PYP')) {
      payloads.push(buildCohortPayload({ programType: 'PYP', ...common }));
    }
    if (programmes.has('MYP')) {
      payloads.push(buildCohortPayload({ programType: 'MYP', ...common }));
    }
    if (programmes.has('DP')) {
      payloads.push(buildDPPayload(common));
    }

    if (payloads.length === 0) {
      return Response.json({ error: 'No students found in any IB programme' }, { status: 400 });
    }

    console.log(`[generateSchedule] Sending ${payloads.length} payload(s) to OptaPlanner`);

    // ── Send all payloads concurrently ──
    const results = await Promise.all(payloads.map(p => sendToOptaPlanner(p)));

    // Log results
    for (const r of results) {
      if (r.ok) {
        console.log(`[generateSchedule] ${r.programType} success`);
      } else {
        console.error(`[generateSchedule] ${r.programType} failed: ${r.error}`);
      }
    }

    // ── Parse responses and save ScheduleSlots ──
    const { teacherMap } = buildTeacherMap(teachers);
    const { roomMap } = buildRoomMap(rooms);

    let totalSlotsInserted = 0;
    const failedProgrammes = [];
    const successProgrammes = [];

    for (const result of results) {
      const matchingPayload = payloads.find(p => p.programType === result.programType);

      if (!result.ok) {
        failedProgrammes.push({ programme: result.programType, error: result.error });
        continue;
      }

      const slots = parseResponseToSlots({
        responseData: result.data,
        payload: matchingPayload,
        scheduleVersionId: schedule_version_id,
        schoolId,
        teacherMap,
        roomMap,
      });

      console.log(`[generateSchedule] ${result.programType}: ${slots.length} slots to insert`);

      // Bulk create slots (in batches of 50 to avoid timeouts)
      const BATCH = 50;
      for (let i = 0; i < slots.length; i += BATCH) {
        const batch = slots.slice(i, i + BATCH);
        await base44.entities.ScheduleSlot.bulkCreate(batch);
      }

      totalSlotsInserted += slots.length;
      successProgrammes.push({ programme: result.programType, slots: slots.length });
    }

    // ── Update ScheduleVersion metadata ──
    await base44.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      generation_params: { programmes: [...programmes] },
      notes: `Generated: ${successProgrammes.map(s => `${s.programme}(${s.slots} slots)`).join(', ')}`,
    });

    console.log(`[generateSchedule] Done. Total slots inserted: ${totalSlotsInserted}`);

    return Response.json({
      ok: true,
      slotsInserted: totalSlotsInserted,
      programmes: successProgrammes,
      failed: failedProgrammes,
    });

  } catch (error) {
    console.error('[generateSchedule] Fatal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});