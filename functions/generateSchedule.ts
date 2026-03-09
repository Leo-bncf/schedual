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

  // teaching_groups metadata — the sectionId on each lesson is the authoritative grouping.
  // We still register each TG so the solver can look up metadata by tg id.
  const teachingGroupsPayload = dpGroups.map(tg => {
    const subj = subjectMap.get(tg.subject_id);
    const sameSubjectLevel = dpGroups.filter(g => g.subject_id === tg.subject_id && (g.level || 'HL') === (tg.level || 'HL'));
    const crossYear = sameSubjectLevel.some(g => g.year_group !== tg.year_group);
    const baseYearForTg = (subj?.combine_dp1_dp2 || crossYear) ? 'DP1_DP2' : tg.year_group;
    const subjectKeyForTg = tg.subject_id.replace(/-/g, '');
    const levelForTg = tg.level || 'HL';
    // student_group must match the subject-scoped group used in lessons for this TG
    const studentGroupForTg = `${baseYearForTg}_${levelForTg}_${subjectKeyForTg}`;
    return {
      id: `tg_${tg.id}`,
      section_id: `sec_${tg.id}`,
      student_group: studentGroupForTg,
      subject_id: tg.subject_id,
      level: levelForTg,
    };
  });

  const lessons = [];
  const subject_requirements = [];
  const studentSubjectChoices = [];
  let lessonId = 1;

  // ── Group ALL teaching groups by subject + level, merging DP1 and DP2 together.
  // A subject can have DP1-HL and DP2-HL TGs — they should become ONE combined lesson bucket
  // because those students share the same classroom. Same for SL.
  // combine_dp1_dp2 flag only controls the studentGroup label sent to the solver.
  const tgBySubjectLevel = new Map(); // key: `{subjectId}__{level}`
  for (const tg of dpGroups) {
    const level = tg.level || 'HL';
    const key = `${tg.subject_id}__${level}`;
    if (!tgBySubjectLevel.has(key)) tgBySubjectLevel.set(key, []);
    tgBySubjectLevel.get(key).push(tg);
  }

  // Now group by subject only to pair HL + SL buckets
  const tgBySubject = new Map(); // key: subjectId → { HL: [tgs], SL: [tgs] }
  for (const [key, tgs] of tgBySubjectLevel) {
    const [subjectId, level] = key.split('__');
    if (!tgBySubject.has(subjectId)) tgBySubject.set(subjectId, { HL: [], SL: [] });
    tgBySubject.get(subjectId)[level] = tgs;
  }

  for (const [subjectId, { HL: hlTgs, SL: slTgs }] of tgBySubject) {
    const subject = subjectMap.get(subjectId);
    if (!subject) continue;

    const hoursHL = subject.hoursPerWeekHL > 0 ? subject.hoursPerWeekHL : 5;
    const hoursSL = subject.hoursPerWeekSL > 0 ? subject.hoursPerWeekSL : 3;

    // Merge all student IDs across all TGs for each level
    const allHLStudentIds = [...new Set(hlTgs.flatMap(tg => (tg.student_ids || []).map(sid => studentMap.get(sid)).filter(Boolean)))];
    const allSLStudentIds = [...new Set(slTgs.flatMap(tg => (tg.student_ids || []).map(sid => studentMap.get(sid)).filter(Boolean)))];
    // SL-only students: those in SL but NOT in HL.
    // CRITICAL for studentOverlapConflict: each studentId must appear in at most ONE lesson's studentIds per timeslot.
    // HL students → tracked via HL-only lessons' studentIds (or omitted there too; see below).
    // Shared lessons → only SL-only students, so no student appears in both HL-only and shared studentIds.
    const hlStudentIdSet = new Set(allHLStudentIds);
    const slOnlyStudentIds = allSLStudentIds.filter(id => !hlStudentIdSet.has(id));
    // Capacity for shared room = all bodies in the room (HL + SL), but studentIds only = SL-only to avoid overlap conflicts.
    const allSharedStudentIds = [...new Set([...allHLStudentIds, ...allSLStudentIds])]; // for requiredCapacity only

    // Pick a representative TG for metadata (first one per level)
    const repHLTg = hlTgs[0];
    const repSLTg = slTgs[0];

    // Determine the year-group label for this subject's cohort.
    const allTgsForSubject = [...hlTgs, ...slTgs];
    const allYearGroups = new Set(allTgsForSubject.map(tg => tg.year_group));
    const baseYear = (subject.combine_dp1_dp2 || allYearGroups.size > 1) ? 'DP1_DP2' : (repHLTg?.year_group || repSLTg?.year_group || 'DP1');

    // Use a stable section key derived from subjectId (not a single TG id) since we merged TGs
    const subjectKey = subjectId.replace(/-/g, '');

    // CRITICAL: HL-only and shared lessons MUST have DIFFERENT studentGroup values.
    // The solver's studentGroupConflict fires on any two lessons sharing the same studentGroup+timeslot.
    // Using a subject-scoped studentGroup prevents cross-subject conflicts and avoids intra-subject false positives.
    const hlStudentGroup = `${baseYear}_HL_${subjectKey}`;
    const slStudentGroup = `${baseYear}_SL_${subjectKey}`;

    // Determine teacher: prefer first TG that has one assigned
    const hlTeacherId = hlTgs.reduce((acc, tg) => acc || (tg.teacher_id ? teacherMap.get(tg.teacher_id) ?? null : null), null);
    const slTeacherId = slTgs.reduce((acc, tg) => acc || (tg.teacher_id ? teacherMap.get(tg.teacher_id) ?? null : null), null);

    if (hlTgs.length > 0 && slTgs.length > 0) {
      // ── Paired HL + SL: shared periods + HL-only extra periods ──
      // Priority: TG minutes_per_week > subject hours > defaults
      const minutesSL = repSLTg?.minutes_per_week || (hoursSL > 0 ? hoursSL * 60 : null) || 180;
      const minutesHL = repHLTg?.minutes_per_week || (hoursHL > 0 ? hoursHL * 60 : null) || 300;
      const minutesHLOnly = Math.max(0, minutesHL - minutesSL);

      const sharedPeriods = Math.max(1, Math.round(minutesSL / periodDuration));
      const hlOnlyPeriods = Math.max(0, Math.round(minutesHLOnly / periodDuration));

      const hlOnlySectionId = `sec_hl_${subjectKey}`;
      const sharedSectionId = `sec_shared_${subjectKey}`;

      // HL-only lessons: unique studentGroup (hlStudentGroup) so studentGroupConflict never fires
      // against the shared lessons. studentIds = allHLStudentIds for accurate capacity/conflict tracking
      // within the HL-only section itself.
      for (let i = 0; i < hlOnlyPeriods; i++) {
        lessons.push({
          id: lessonId++,
          subject: subject.code,
          studentGroup: hlStudentGroup,
          teachingGroupId: repHLTg ? `tg_${repHLTg.id}` : null,
          sectionId: hlOnlySectionId,
          yearGroup: baseYear,
          level: 'HL',
          requiredCapacity: allHLStudentIds.length || 10,
          teacherId: hlTeacherId,
          timeslotId: null,
          studentIds: allHLStudentIds,
        });
      }

      // Shared lessons: unique studentGroup (slStudentGroup). studentIds = SL-only students only.
      // HL students are NOT in this list — they are tracked via the HL-only section above.
      // This ensures no studentId appears in two different lessons, satisfying studentOverlapConflict.
      for (let i = 0; i < sharedPeriods; i++) {
        lessons.push({
          id: lessonId++,
          subject: subject.code,
          studentGroup: slStudentGroup,
          teachingGroupId: repSLTg ? `tg_${repSLTg.id}` : null,
          sectionId: sharedSectionId,
          yearGroup: baseYear,
          level: 'SL',
          requiredCapacity: allSharedStudentIds.length || 10,
          teacherId: slTeacherId || hlTeacherId,
          timeslotId: null,
          studentIds: slOnlyStudentIds,
        });
      }

      subject_requirements.push({
        studentGroup: hlStudentGroup,
        teachingGroupId: repHLTg ? `tg_${repHLTg.id}` : null,
        sectionId: hlOnlySectionId,
        subject: subject.code,
        minutesPerWeek: hlOnlyPeriods * periodDuration,
      });
      subject_requirements.push({
        studentGroup: slStudentGroup,
        teachingGroupId: repSLTg ? `tg_${repSLTg.id}` : null,
        sectionId: sharedSectionId,
        subject: subject.code,
        minutesPerWeek: sharedPeriods * periodDuration,
      });

      // studentSubjectChoices — HL students
      for (const tg of hlTgs) {
        for (const base44StudentId of (tg.student_ids || [])) {
          const numericStudentId = studentMap.get(base44StudentId);
          if (!numericStudentId) continue;
          if (!studentSubjectChoices.find(c => c.studentId === numericStudentId && c.subjectId === subject.id)) {
            studentSubjectChoices.push({ studentId: numericStudentId, subjectId: subject.id, subject: subject.code, level: 'HL', yearGroup: baseYear });
          }
        }
      }
      // studentSubjectChoices — SL students
      for (const tg of slTgs) {
        for (const base44StudentId of (tg.student_ids || [])) {
          const numericStudentId = studentMap.get(base44StudentId);
          if (!numericStudentId) continue;
          if (!studentSubjectChoices.find(c => c.studentId === numericStudentId && c.subjectId === subject.id)) {
            studentSubjectChoices.push({ studentId: numericStudentId, subjectId: subject.id, subject: subject.code, level: 'SL', yearGroup: baseYear });
          }
        }
      }

      console.log(`[buildDPPayload] ${subject.code} (${baseYear}): ${hlOnlyPeriods} HL-only [${hlStudentGroup}] + ${sharedPeriods} shared [${slStudentGroup}] | HL: ${allHLStudentIds.length}, SL-only: ${slOnlyStudentIds.length}`);

    } else {
      // ── Single-level (only HL or only SL) ──
      const tgsForLevel = hlTgs.length > 0 ? hlTgs : slTgs;
      const level = hlTgs.length > 0 ? 'HL' : 'SL';
      const allStudentIds = hlTgs.length > 0 ? allHLStudentIds : allSLStudentIds;
      // Use the subject-scoped group name to avoid studentGroupConflict across subjects
      const singleLevelGroup = hlTgs.length > 0 ? hlStudentGroup : slStudentGroup;
      const teacherId = hlTgs.length > 0 ? hlTeacherId : slTeacherId;
      const repTg = tgsForLevel[0];

      // Priority: TG minutes_per_week > subject hours > defaults
      const minutesPerWeek = repTg?.minutes_per_week || (level === 'HL' ? (hoursHL > 0 ? hoursHL * 60 : 300) : (hoursSL > 0 ? hoursSL * 60 : 180));
      const periodsPerWeek = Math.max(1, Math.round(minutesPerWeek / periodDuration));
      const sectionId = `sec_${level.toLowerCase()}_${subjectKey}`;

      for (let i = 0; i < periodsPerWeek; i++) {
        lessons.push({
          id: lessonId++,
          subject: subject.code,
          studentGroup: singleLevelGroup,
          teachingGroupId: repTg ? `tg_${repTg.id}` : null,
          sectionId,
          yearGroup: baseYear,
          level,
          requiredCapacity: allStudentIds.length || 10,
          teacherId,
          timeslotId: null,
          studentIds: allStudentIds,
        });
      }

      subject_requirements.push({
        studentGroup: singleLevelGroup,
        teachingGroupId: repTg ? `tg_${repTg.id}` : null,
        sectionId,
        subject: subject.code,
        minutesPerWeek,
      });

      for (const tg of tgsForLevel) {
        for (const base44StudentId of (tg.student_ids || [])) {
          const numericStudentId = studentMap.get(base44StudentId);
          if (!numericStudentId) continue;
          if (!studentSubjectChoices.find(c => c.studentId === numericStudentId && c.subjectId === subject.id)) {
            studentSubjectChoices.push({ studentId: numericStudentId, subjectId: subject.id, subject: subject.code, level, yearGroup: baseYear });
          }
        }
      }

      console.log(`[buildDPPayload] ${subject.code} ${singleLevelGroup} (${level} only): ${periodsPerWeek} lessons | students: ${allStudentIds.length}`);
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

// ─── Auto-sync students to teaching groups ────────────────────────────────────

async function syncStudentsToTeachingGroups(base44, schoolId, students, subjects, existingTeachingGroups) {
  const tgMap = new Map(); // key: "${subjectId}__${level}__${yearGroup}" → teaching group
  const missingSubjectIds = new Set();
  
  // Index existing teaching groups
  for (const tg of existingTeachingGroups) {
    const key = `${tg.subject_id}__${tg.level}__${tg.year_group}`;
    tgMap.set(key, { ...tg, student_ids: [...(tg.student_ids || [])] });
  }

  // For each student, add them to teaching groups matching their subject choices
  for (const student of students) {
    if (!Array.isArray(student.subject_choices)) continue;
    
    const yearGroup = student.year_group;
    for (const choice of student.subject_choices) {
      const { subject_id, level } = choice;
      const key = `${subject_id}__${level}__${yearGroup}`;
      
      if (!tgMap.has(key)) {
        // Create new teaching group for this subject/level/year combo
        const subject = subjects.find(s => s.id === subject_id);
        if (!subject) {
          missingSubjectIds.add(subject_id);
          console.warn(`[syncStudentsToTeachingGroups] Student ${student.full_name} chose subject ${subject_id} which does not exist in database`);
          continue;
        }
        
        const tgName = `${subject.name} ${level} - ${yearGroup}`;
        const newTg = {
          school_id: schoolId,
          name: tgName,
          subject_id,
          level,
          year_group: yearGroup,
          teacher_id: null,
          student_ids: [student.id],
          minutes_per_week: level === 'HL' ? (subject.hoursPerWeekHL || 5) * 60 : (subject.hoursPerWeekSL || 3) * 60,
          is_active: true,
        };
        
        console.log(`[syncStudentsToTeachingGroups] Creating teaching group: ${tgName}`);
        const created = await base44.entities.TeachingGroup.create(newTg);
        tgMap.set(key, { ...newTg, id: created.id, student_ids: [student.id] });
      } else {
        // Add student to existing teaching group if not already there
        const tg = tgMap.get(key);
        if (!tg.student_ids.includes(student.id)) {
          tg.student_ids.push(student.id);
        }
      }
    }
  }

  // Log missing subjects
  if (missingSubjectIds.size > 0) {
    console.error(`[syncStudentsToTeachingGroups] MISSING SUBJECTS: ${Array.from(missingSubjectIds).join(', ')}`);
    console.error(`[syncStudentsToTeachingGroups] Students chose subjects not in database. Please add these subjects in Settings > Subjects.`);
  }

  // Update all modified teaching groups
  for (const [key, tg] of tgMap) {
    if (tg.id && tg.student_ids) {
      await base44.entities.TeachingGroup.update(tg.id, { student_ids: tg.student_ids });
    }
  }

  return Object.fromEntries(tgMap);
}

// ─── Parse OptaPlanner response → ScheduleSlots ──────────────────────────────

function parseResponseToSlots({ responseData, payload, scheduleVersionId, schoolId, teacherMap, roomMap }) {
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

    if (entry.subject && payload.subjectIdByCode) {
      slot.subject_id = payload.subjectIdByCode[entry.subject] ?? null;
    }

    // teachingGroupId from solver still has our `tg_` prefix (mapper only strips `TG_` uppercase prefix)
    // Strip our `tg_` prefix to get the raw base44 entity ID
    if (entry.teachingGroupId) {
      slot.teaching_group_id = entry.teachingGroupId.startsWith('tg_') 
        ? entry.teachingGroupId.slice(3) 
        : entry.teachingGroupId;
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

    // ── AUTO-SYNC: Create/update teaching groups based on student subject choices ──
    console.log(`[generateSchedule] Syncing students to teaching groups...`);
    const updatedTeachingGroups = await syncStudentsToTeachingGroups(base44, schoolId, activeStudents, subjects, teachingGroups);
    console.log(`[generateSchedule] Sync complete: ${Object.keys(updatedTeachingGroups).length} teaching groups updated`);

    // ── AUTO-SYNC: Update student.assigned_groups to match their subject choices ──
    console.log(`[generateSchedule] Syncing student assignments to teaching groups...`);
    try {
      const syncResult = await base44.functions.invoke('syncStudentTeachingGroups', {});
      console.log(`[generateSchedule] Student assignment sync: ${syncResult.data?.studentsUpdated} students updated, ${syncResult.data?.teachingGroupsUpdated} groups updated`);
      if (syncResult.data?.integrityReport?.missingAssignments?.length > 0) {
        console.warn(`[generateSchedule] ⚠️ ${syncResult.data.integrityReport.missingAssignments.length} students have missing subject assignments`);
      }
    } catch (syncErr) {
      console.error('[generateSchedule] Student assignment sync failed:', syncErr);
    }

    const common = { schoolId, scheduleVersionId: schedule_version_id, school, students, teachers, subjects, rooms, teachingGroups: Object.values(updatedTeachingGroups) };

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

      // Check if this is a hard pre-solve validation failure (no assignments at all)
      // vs a soft solver failure (ran but has conflicts) — the latter still has assignments to save
      const solverOk = result.data?.ok;
      const solverErrorCode = result.data?.errorCode;
      const solverReason = result.data?.reason;
      // Check for assigned lessons — solver returns `lessons` (cohort) or `assignments` (DP)
      const allLessons = result.data?.lessons || result.data?.data?.lessons || [];
      const allAssignments = result.data?.assignments || result.data?.data?.assignments || [];
      const allEntries = [...allLessons, ...allAssignments];
      const hasAssignments = allEntries.some(e => e.timeslotId != null);

      console.log(`[generateSchedule] ${payload.programType} solverOk=${solverOk}, reason=${solverReason}, lessons=${allLessons.length}, assignments=${allAssignments.length}, assigned=${allEntries.filter(e => e.timeslotId != null).length}, score=${result.data?.score}`);

      // Pre-solve validation failure: errorCode present OR solver explicitly failed with no assignments at all
      if (solverErrorCode || (!hasAssignments && solverOk === false)) {
        const errMsg = result.data?.message || result.data?.errorCode || result.data?.reason || 'Solver validation failed';
        const validationErrors = result.data?.validationErrors || result.data?.validationErrorSamples || [];
        console.error(`[generateSchedule] ${payload.programType} pre-solve failure: ${errMsg}`);
        console.error(`[generateSchedule] ${payload.programType} validationErrors: ${JSON.stringify(validationErrors)}`);
        failedProgrammes.push({ programme: payload.programType, error: `${errMsg}${validationErrors.length ? ' | ' + JSON.stringify(validationErrors).slice(0, 300) : ''}` });
        continue;
      }

      // Solver ran but has constraint violations — log and fall through to save partial slots
      if (solverOk === false && hasAssignments) {
        console.warn(`[generateSchedule] ${payload.programType} solver finished with conflicts: reason=${solverReason}, score=${result.data?.score}, studentConflicts=${result.data?.studentConflictCount}, hardViolations=${result.data?.conflictsCount}`);
        console.warn(`[generateSchedule] ${payload.programType} violations: ${JSON.stringify(result.data?.violations || result.data?.violatingConstraints || []).slice(0, 500)}`);
        console.warn(`[generateSchedule] ${payload.programType} unmet requirements: ${JSON.stringify(result.data?.unmetRequirements || []).slice(0, 500)}`);
        // Don't continue — fall through to save the partial schedule
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