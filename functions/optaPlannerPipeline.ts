import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_version_id } = await req.json();
    
    if (!schedule_version_id) {
      return Response.json({ ok: false, error: 'Missing schedule_version_id' }, { status: 400 });
    }

    console.log('[Pipeline] Starting for version:', schedule_version_id);

    const OPTAPLANNER_ENDPOINT = Deno.env.get('OPTAPLANNER_ENDPOINT');
    const OPTAPLANNER_API_KEY = Deno.env.get('OPTAPLANNER_API_KEY');

    if (!OPTAPLANNER_ENDPOINT || !OPTAPLANNER_API_KEY) {
      return Response.json({
        ok: false,
        error: 'OptaPlanner not configured'
      }, { status: 500 });
    }

    const [scheduleVersion, teachers, students, rooms, teachingGroups, subjects, school] = await Promise.all([
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id }),
      base44.entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.Student.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.Room.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.School.filter({ id: user.school_id })
    ]);

    if (!scheduleVersion?.[0]) {
      return Response.json({ ok: false, error: 'Schedule version not found' }, { status: 404 });
    }

    const schoolData = school[0];

    // Create ID mappings for reverse lookup
    const roomIdMap = new Map();
    const teacherIdMap = new Map();
    const studentIdMap = new Map();

    rooms.forEach((r, idx) => roomIdMap.set(r.id, idx + 1));
    teachers.forEach((t, idx) => teacherIdMap.set(t.id, idx + 1));
    students.forEach((s, idx) => studentIdMap.set(s.id, idx + 1000));

    // Build reverse mappings
    const subjectIdByCode = {};
    const teacherIdById = {};
    const roomIdById = {};

    subjects.forEach(s => {
      if (s.code) subjectIdByCode[s.code] = s.id;
    });

    teachers.forEach((t, idx) => {
      teacherIdById[idx + 1] = t.id;
    });

    rooms.forEach((r, idx) => {
      roomIdById[idx + 1] = r.id;
    });

    // Build teachingGroups array
    const teachingGroupsPayload = teachingGroups
      .filter(tg => tg.is_active)
      .map(tg => {
        const subject = subjects.find(s => s.id === tg.subject_id);
        return {
          id: tg.id,
          subjectId: tg.subject_id,
          studentGroup: tg.year_group || 'DP1',
          sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
          level: tg.level || 'SL',
          requiredMinutesPerWeek: tg.minutes_per_week || 180
        };
      });

    // Build lessons - one lesson per teaching group per required session
    const lessons = [];
    let lessonId = 1;

    teachingGroups
      .filter(tg => tg.is_active && tg.teacher_id && tg.student_ids?.length > 0)
      .forEach(tg => {
        const subject = subjects.find(s => s.id === tg.subject_id);
        const teacherId = teacherIdMap.get(tg.teacher_id);
        const studentIds = (tg.student_ids || []).map(sid => studentIdMap.get(sid)).filter(id => id != null);
        const requiredMinutes = tg.minutes_per_week || 180;
        const periodDuration = schoolData.period_duration_minutes || 60;
        const numLessons = Math.ceil(requiredMinutes / periodDuration);

        for (let i = 0; i < numLessons; i++) {
          lessons.push({
            id: lessonId++,
            teachingGroupId: tg.id,
            sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
            subject: subject?.code || subject?.name || 'Unknown',
            studentGroup: tg.year_group || 'DP1',
            teacherId: teacherId || null,
            requiredCapacity: studentIds.length,
            studentIds: studentIds,
            timeslotId: null,
            roomId: null
          });
        }
      });

    // Build subjectRequirements
    const subjectRequirements = teachingGroups
      .filter(tg => {
        const subject = subjects.find(s => s.id === tg.subject_id);
        const hasValidSubject = subject && (subject.code || subject.name);
        const hasValidYearGroup = tg.year_group && tg.year_group.trim().length > 0;
        return tg.is_active && hasValidSubject && hasValidYearGroup;
      })
      .map(tg => {
        const subject = subjects.find(s => s.id === tg.subject_id);
        return {
          teachingGroupId: tg.id,
          sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
          studentGroup: tg.year_group,
          subject: subject.code || subject.name,
          minutesPerWeek: tg.minutes_per_week || 180
        };
      });

    const payload = {
      schoolId: user.school_id,
      scheduleVersionId: schedule_version_id,
      scheduleVersion: `v${new Date().toISOString().split('T')[0]}`,
      
      scheduleSettings: {
        periodDurationMinutes: schoolData.period_duration_minutes || 60,
        dayStartTime: schoolData.day_start_time || "08:00",
        dayEndTime: schoolData.day_end_time || "18:00",
        daysOfWeek: schoolData.days_of_week || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
        breaks: schoolData.breaks || []
      },

      rooms: rooms.map((r, idx) => ({
        id: idx + 1,
        name: r.name,
        capacity: r.capacity,
        externalId: r.id
      })),

      teachers: teachers.map((t, idx) => ({
        id: idx + 1,
        name: t.full_name,
        maxPeriodsPerWeek: t.max_hours_per_week || 25,
        unavailableSlotIds: [],
        externalId: t.id
      })),

      subjects: subjects.filter(s => s.is_active).map(s => ({
        id: s.id,
        code: s.code || s.name,
        name: s.name
      })),

      subjectIdByCode,
      teacherIdById,
      roomIdById,

      teachingGroups: teachingGroupsPayload,
      lessons,
      subjectRequirements,

      blockedSlotIds: [],
      
      constraints: {
        maxSameSubjectPerDayHardEnabled: true,
        maxSameSubjectPerDayLimit: 2
      },

      randomSeed: 42,
      randomizeSearch: false,
      numSearchWorkers: 1,
      shuffleInputOrder: false
    };

    console.log('[Pipeline] Calling OptaPlanner:', OPTAPLANNER_ENDPOINT);
    console.log('[Pipeline] Payload summary:', {
      rooms: rooms.length,
      teachers: teachers.length,
      teachingGroups: teachingGroupsPayload.length,
      lessons: lessons.length,
      subjectRequirements: subjectRequirements.length
    });

    const response = await fetch(OPTAPLANNER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OPTAPLANNER_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('[Pipeline] Response status:', response.status);
    console.log('[Pipeline] Full response:', responseText);

    if (!response.ok) {
      console.error('[Pipeline] OptaPlanner error:', responseText);
      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = responseText;
      }
      return Response.json({
        ok: false,
        error: `OptaPlanner validation failed`,
        details: errorDetails,
        payloadSummary: {
          lessons: lessons.length,
          teachers: teachers.length,
          rooms: rooms.length,
          teachingGroups: teachingGroupsPayload.length
        }
      }, { status: 400 });
    }

    const result = JSON.parse(responseText);

    const existingSlots = await base44.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });

    if (existingSlots.length > 0) {
      for (const slot of existingSlots) {
        await base44.entities.ScheduleSlot.delete(slot.id);
      }
    }

    const slotsToInsert = [];

    // Reverse mappings: numeric ID → Base44 string ID
    const roomIdReverse = new Map(Array.from(roomIdMap.entries()).map(([k, v]) => [v, k]));
    const teacherIdReverse = new Map(Array.from(teacherIdMap.entries()).map(([k, v]) => [v, k]));

    if (result.lessons && Array.isArray(result.lessons)) {
      for (const lesson of result.lessons) {
        if (lesson.timeslotId != null) {
          slotsToInsert.push({
            school_id: user.school_id,
            schedule_version: schedule_version_id,
            teaching_group_id: lesson.teachingGroupId,
            teacher_id: teacherIdById[lesson.teacherId] || null,
            room_id: roomIdById[lesson.roomId] || null,
            timeslot_id: lesson.timeslotId,
            day: lesson.dayOfWeek || 'Monday',
            period: lesson.periodIndex != null ? lesson.periodIndex + 1 : 1,
            status: 'scheduled'
          });
        }
      }
    }

    if (slotsToInsert.length > 0) {
      await base44.entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    await base44.entities.ScheduleVersion.update(schedule_version_id, {
      score: result.score || 0,
      generated_at: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      result: {
        slotsInserted: slotsToInsert.length,
        score: result.score || 0
      }
    });

  } catch (error) {
    console.error('[Pipeline] Error:', error);
    return Response.json({
      ok: false,
      error: error.message
    }, { status: 500 });
  }
});