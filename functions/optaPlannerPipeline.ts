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

    console.log('[optaPlannerPipeline] Starting for version:', schedule_version_id);

    // Get OptaPlanner config from environment
    const OPTAPLANNER_ENDPOINT = Deno.env.get('OPTAPLANNER_ENDPOINT');
    const OPTAPLANNER_API_KEY = Deno.env.get('OPTAPLANNER_API_KEY');

    if (!OPTAPLANNER_ENDPOINT || !OPTAPLANNER_API_KEY) {
      return Response.json({
        ok: false,
        error: 'OptaPlanner not configured. Please set OPTAPLANNER_ENDPOINT and OPTAPLANNER_API_KEY in environment secrets.'
      }, { status: 500 });
    }

    // Load all required data
    const [scheduleVersion, teachers, students, rooms, teachingGroups, subjects, school] = await Promise.all([
      base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version_id }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.School.filter({ id: user.school_id })
    ]);

    if (!scheduleVersion?.[0]) {
      return Response.json({ ok: false, error: 'Schedule version not found' }, { status: 404 });
    }

    const schoolData = school[0];
    const periodsPerDay = schoolData.periods_per_day || 10;
    const daysPerWeek = schoolData.days_per_week || 5;

    console.log('[optaPlannerPipeline] Data loaded:', {
      teachers: teachers.length,
      students: students.length,
      rooms: rooms.length,
      teachingGroups: teachingGroups.length,
      subjects: subjects.length
    });

    // Build timeslots (periods)
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

    console.log('[optaPlannerPipeline] Generated timeslots:', timeslots.length);

    // Build lessons from teaching groups
    const lessons = teachingGroups.map((tg, idx) => {
      const subject = subjects.find(s => s.id === tg.subject_id);
      const teacher = teachers.find(t => t.id === tg.teacher_id);
      const room = rooms.find(r => r.id === tg.preferred_room_id);

      return {
        id: idx,
        teachingGroupId: tg.id,
        subjectName: subject?.name || 'Unknown',
        teacherId: teacher?.id || null,
        studentIds: tg.student_ids || [],
        roomId: room?.id || null,
        durationMinutes: tg.minutes_per_week || 180
      };
    });

    console.log('[optaPlannerPipeline] Built lessons:', lessons.length);

    // Build payload
    const payload = {
      timeslots,
      rooms: rooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity })),
      teachers: teachers.map(t => ({ id: t.id, name: t.full_name })),
      lessons
    };

    console.log('[optaPlannerPipeline] Payload built:', {
      timeslots: payload.timeslots.length,
      rooms: payload.rooms.length,
      teachers: payload.teachers.length,
      lessons: payload.lessons.length
    });

    // Call OptaPlanner
    console.log('[optaPlannerPipeline] Calling OptaPlanner:', OPTAPLANNER_ENDPOINT);

    const response = await fetch(OPTAPLANNER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OPTAPLANNER_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log('[optaPlannerPipeline] OptaPlanner status:', response.status);
    console.log('[optaPlannerPipeline] OptaPlanner response:', responseText.substring(0, 500));

    if (!response.ok) {
      return Response.json({
        ok: false,
        error: `OptaPlanner returned ${response.status}: ${responseText}`
      }, { status: 500 });
    }

    const result = JSON.parse(responseText);

    // Delete existing slots for this version
    const existingSlots = await base44.asServiceRole.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });

    if (existingSlots.length > 0) {
      console.log('[optaPlannerPipeline] Deleting', existingSlots.length, 'existing slots');
      for (const slot of existingSlots) {
        await base44.asServiceRole.entities.ScheduleSlot.delete(slot.id);
      }
    }

    // Insert new slots
    const slotsToInsert = [];
    const dayNames2 = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    if (result.lessons && Array.isArray(result.lessons)) {
      for (const lesson of result.lessons) {
        if (lesson.timeslot != null) {
          const timeslot = timeslots.find(t => t.id === lesson.timeslot);
          if (timeslot) {
            slotsToInsert.push({
              school_id: user.school_id,
              schedule_version: schedule_version_id,
              teaching_group_id: lesson.teachingGroupId,
              teacher_id: lesson.teacherId,
              room_id: lesson.roomId || lesson.room,
              timeslot_id: lesson.timeslot,
              day: timeslot.dayOfWeek,
              period: timeslot.periodIndex + 1,
              status: 'scheduled'
            });
          }
        }
      }
    }

    console.log('[optaPlannerPipeline] Inserting', slotsToInsert.length, 'slots');

    if (slotsToInsert.length > 0) {
      await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    // Update schedule version
    await base44.asServiceRole.entities.ScheduleVersion.update(schedule_version_id, {
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
    console.error('[optaPlannerPipeline] Error:', error);
    return Response.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});