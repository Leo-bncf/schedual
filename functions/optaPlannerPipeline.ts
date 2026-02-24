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
    const periodsPerDay = schoolData.periods_per_day || 10;
    const daysPerWeek = schoolData.days_per_week || 5;

    const timeslots = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    
    for (let day = 0; day < daysPerWeek; day++) {
      for (let period = 0; period < periodsPerDay; period++) {
        timeslots.push({
          id: day * periodsPerDay + period,
          dayOfWeek: dayNames[day],
          periodIndex: period
        });
      }
    }

    // Create ID mappings: Base44 string IDs → numeric IDs for OptaPlanner
    const roomIdMap = new Map();
    const teacherIdMap = new Map();
    const studentIdMap = new Map();
    const tgIdMap = new Map();

    rooms.forEach((r, idx) => roomIdMap.set(r.id, idx));
    teachers.forEach((t, idx) => teacherIdMap.set(t.id, idx));
    students.forEach((s, idx) => studentIdMap.set(s.id, idx));
    teachingGroups.forEach((tg, idx) => tgIdMap.set(tg.id, idx));

    const lessons = teachingGroups
      .filter(tg => tg.teacher_id && tg.student_ids?.length > 0)
      .map((tg) => {
        const subject = subjects.find(s => s.id === tg.subject_id);
        const teacher = teachers.find(t => t.id === tg.teacher_id);
        const room = rooms.find(r => r.id === tg.preferred_room_id);

        return {
          id: tgIdMap.get(tg.id),
          teachingGroupId: tg.id,
          subject: subject?.code || subject?.name || 'Unknown',
          subjectName: subject?.name || 'Unknown',
          subjectCode: subject?.code || 'UNK',
          studentGroup: tg.year_group || 'DP1',
          teacherId: teacher ? teacherIdMap.get(teacher.id) : null,
          teacherName: teacher?.full_name || 'Unknown',
          studentIds: (tg.student_ids || []).map(sid => studentIdMap.get(sid)).filter(id => id != null),
          roomId: room ? roomIdMap.get(room.id) : null,
          durationMinutes: tg.minutes_per_week || 180,
          yearGroup: tg.year_group || 'DP1',
          level: tg.level || 'SL'
        };
      });

    // Build subjects list
    const subjectsList = subjects
      .filter(s => s.is_active)
      .map((s, idx) => ({
        id: idx,
        code: s.code || s.name,
        name: s.name,
        ibLevel: s.ib_level
      }));

    // Build subject requirements with proper fields - filter out invalid entries
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
          subject: subject.code || subject.name,
          studentGroup: tg.year_group,
          level: tg.level || 'SL',
          minutesPerWeek: tg.minutes_per_week || 180
        };
      });

    const payload = {
      timeslots,
      rooms: rooms.map((r, idx) => ({ id: idx, name: r.name, capacity: r.capacity })),
      teachers: teachers.map((t, idx) => ({ id: idx, name: t.full_name })),
      students: students.map((s, idx) => ({
        id: idx,
        name: s.full_name,
        yearGroup: s.year_group,
        programme: s.ib_programme
      })),
      subjects: subjectsList,
      lessons,
      subjectRequirements,
      scheduleSettings: {
        periodsPerDay,
        daysPerWeek,
        schoolId: user.school_id,
        periodDurationMinutes: school.period_duration_minutes || 60
      }
    };

    console.log('[Pipeline] Calling OptaPlanner:', OPTAPLANNER_ENDPOINT);
    console.log('[Pipeline] Payload summary:', {
      timeslots: timeslots.length,
      rooms: rooms.length,
      teachers: teachers.length,
      students: students.length,
      lessons: lessons.length
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
          timeslots: timeslots.length,
          teachers: teachers.length,
          rooms: rooms.length,
          students: students.length
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
        if (lesson.timeslot != null) {
          const timeslot = timeslots.find(t => t.id === lesson.timeslot);
          if (timeslot) {
            slotsToInsert.push({
              school_id: user.school_id,
              schedule_version: schedule_version_id,
              teaching_group_id: lesson.teachingGroupId,
              teacher_id: typeof lesson.teacherId === 'number' ? teacherIdReverse.get(lesson.teacherId) : lesson.teacherId,
              room_id: lesson.roomId != null ? (typeof lesson.roomId === 'number' ? roomIdReverse.get(lesson.roomId) : lesson.roomId) : (lesson.room != null ? roomIdReverse.get(lesson.room) : null),
              timeslot_id: lesson.timeslot,
              day: timeslot.dayOfWeek,
              period: timeslot.periodIndex + 1,
              status: 'scheduled'
            });
          }
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