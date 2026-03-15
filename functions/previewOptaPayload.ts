import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function buildTeacherMap(teachers) {
  const map = new Map();
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

function buildDPPayload({ schoolId, scheduleVersionId, school, students, teachers, subjects, rooms, teachingGroups }) {
  const { teacherList, teacherMap } = buildTeacherMap(teachers);
  const { roomList } = buildRoomMap(rooms);
  const scheduleSettings = buildScheduleSettings(school);
  const periodDuration = school.period_duration_minutes || 60;

  const dpStudents = students.filter(s => s.ib_programme === 'DP' && s.is_active !== false);

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
    const teachingGroupId = repTg ? `tg_${repTg.id}` : null;
    const hoursForLevel = level === 'HL' ? Number(subject.hoursPerWeekHL || 0) : Number(subject.hoursPerWeekSL || 0);
    const minutesPerWeek = hoursForLevel * 60;
    const periodsPerWeek = Math.max(1, Math.ceil(minutesPerWeek / periodDuration));
    const teacherId = bucketTgs.reduce((acc, tg) => acc || (tg.teacher_id ? (teacherMap.get(tg.teacher_id) ?? null) : null), null);
    const studentIds = [...new Set(bucketTgs.flatMap(tg => (tg.student_ids || []).map(base44StudentId => studentMap.get(base44StudentId)).filter(Boolean)))];

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

    for (const tg of bucketTgs) {
      for (const base44StudentId of (tg.student_ids || [])) {
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
    }
  }

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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json().catch(() => ({}));
    const schoolId = body.school_id || user?.school_id;

    if (!schoolId) {
      return Response.json({ error: 'school_id is required' }, { status: 400 });
    }

    const [schools, students, teachers, subjects, rooms, teachingGroups, scheduleVersions] = await Promise.all([
      base44.asServiceRole.entities.School.filter({ id: schoolId }),
      base44.asServiceRole.entities.Student.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Room.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.ScheduleVersion.filter({ school_id: schoolId }, '-created_date', 10),
    ]);

    const school = schools[0];
    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const scheduleVersionId = body.schedule_version_id || scheduleVersions[0]?.id || null;
    const payload = buildDPPayload({
      schoolId,
      scheduleVersionId,
      school,
      students,
      teachers,
      subjects,
      rooms,
      teachingGroups,
    });

    const requestedTeachingGroupIds = Array.isArray(body.teaching_group_ids) ? body.teaching_group_ids : [];
    const sampleLimit = Number(body.sample_limit || 20);
    const filteredLessons = requestedTeachingGroupIds.length > 0
      ? payload.lessons.filter((lesson) => requestedTeachingGroupIds.includes(lesson.teachingGroupId))
      : payload.lessons;
    const filteredRequirements = requestedTeachingGroupIds.length > 0
      ? payload.subject_requirements.filter((item) => requestedTeachingGroupIds.includes(item.teachingGroupId))
      : payload.subject_requirements;
    const filteredChoices = requestedTeachingGroupIds.length > 0
      ? payload.studentSubjectChoices.filter((item) => requestedTeachingGroupIds.includes(item.teachingGroupId))
      : payload.studentSubjectChoices;
    const filteredTeachingGroups = requestedTeachingGroupIds.length > 0
      ? payload.teaching_groups.filter((item) => requestedTeachingGroupIds.includes(item.id))
      : payload.teaching_groups;
    const filteredGroupSummaries = requestedTeachingGroupIds.length > 0
      ? requestedTeachingGroupIds.map((groupId) => {
          const lessonsForGroup = filteredLessons.filter((lesson) => lesson.teachingGroupId === groupId);
          const requirement = filteredRequirements.find((item) => item.teachingGroupId === groupId) || null;
          const choicesForGroup = filteredChoices.filter((item) => item.teachingGroupId === groupId);
          const tgMeta = filteredTeachingGroups.find((item) => item.id === groupId) || null;
          const teacher = lessonsForGroup[0]?.teacherId ? payload.teachers.find((t) => t.id === lessonsForGroup[0].teacherId) : null;
          const subject = lessonsForGroup[0]?.subject ? payload.subjects.find((s) => s.code === lessonsForGroup[0].subject) : null;
          return {
            teachingGroupId: groupId,
            subject: subject?.code || lessonsForGroup[0]?.subject || null,
            subjectName: subject?.name || null,
            yearGroup: lessonsForGroup[0]?.yearGroup || null,
            level: lessonsForGroup[0]?.level || tgMeta?.level || null,
            teacherId: lessonsForGroup[0]?.teacherId || null,
            teacherName: teacher?.name || null,
            requiredCapacity: lessonsForGroup[0]?.requiredCapacity || 0,
            studentIdsCount: lessonsForGroup[0]?.studentIds?.length || 0,
            studentIds: lessonsForGroup[0]?.studentIds || [],
            lessonsCount: lessonsForGroup.length,
            requirementMinutes: requirement?.minutesPerWeek || 0,
            sectionId: lessonsForGroup[0]?.sectionId || tgMeta?.section_id || null,
            studentGroup: lessonsForGroup[0]?.studentGroup || tgMeta?.student_group || null,
          };
        })
      : null;

    const payloadSample = requestedTeachingGroupIds.length > 0 ? null : {
      payloadType: payload.payloadType,
      programType: payload.programType,
      schoolId: payload.schoolId,
      scheduleVersionId: payload.scheduleVersionId,
      timezone: payload.timezone,
      calendar: payload.calendar,
      scheduleSettings: payload.scheduleSettings,
      counts: {
        teachers: payload.teachers.length,
        rooms: payload.rooms.length,
        subjects: payload.subjects.length,
        teaching_groups: payload.teaching_groups.length,
        lessons: payload.lessons.length,
        subject_requirements: payload.subject_requirements.length,
        studentSubjectChoices: payload.studentSubjectChoices.length,
      },
      teachers: payload.teachers.slice(0, sampleLimit),
      rooms: payload.rooms.slice(0, sampleLimit),
      subjects: payload.subjects.slice(0, sampleLimit),
      teaching_groups: payload.teaching_groups.slice(0, sampleLimit),
      lessons: payload.lessons.slice(0, sampleLimit),
      subject_requirements: payload.subject_requirements.slice(0, sampleLimit),
      studentSubjectChoices: payload.studentSubjectChoices.slice(0, sampleLimit),
    };

    return Response.json({
      ok: true,
      scheduleVersionId,
      summary: {
        teachers: payload.teachers.length,
        rooms: payload.rooms.length,
        subjects: payload.subjects.length,
        teaching_groups: payload.teaching_groups.length,
        lessons: payload.lessons.length,
        subject_requirements: payload.subject_requirements.length,
        studentSubjectChoices: payload.studentSubjectChoices.length,
      },
      filtered: requestedTeachingGroupIds.length > 0 ? {
        teaching_group_ids: requestedTeachingGroupIds,
        group_summaries: filteredGroupSummaries,
        teaching_groups: filteredTeachingGroups,
        lessons: filteredLessons,
        subject_requirements: filteredRequirements,
        studentSubjectChoices: filteredChoices,
      } : null,
      payload: payloadSample,
    });
  } catch (error) {
    console.error('[previewOptaPayload] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});