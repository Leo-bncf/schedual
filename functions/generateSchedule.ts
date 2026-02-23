import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'No school assigned' }, { status: 403 });
    }

    const { schedule_version_id } = await req.json();

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    console.log('[generateSchedule] Starting for schedule version:', schedule_version_id);

    // 1. Charger toutes les données
    const [school, teachers, students, rooms, teachingGroups, subjects, constraints, scheduleVersion] = await Promise.all([
      base44.entities.School.filter({ id: user.school_id }).then(r => r[0]),
      base44.entities.Teacher.filter({ school_id: user.school_id }),
      base44.entities.Student.filter({ school_id: user.school_id }),
      base44.entities.Room.filter({ school_id: user.school_id }),
      base44.entities.TeachingGroup.filter({ school_id: user.school_id }),
      base44.entities.Subject.filter({ school_id: user.school_id }),
      base44.entities.Constraint.filter({ school_id: user.school_id, is_active: true }),
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id }).then(r => r[0])
    ]);

    if (!school || !scheduleVersion) {
      return Response.json({ error: 'School or ScheduleVersion not found' }, { status: 404 });
    }

    console.log('[generateSchedule] Data loaded:', {
      teachers: teachers.length,
      students: students.length,
      rooms: rooms.length,
      teachingGroups: teachingGroups.length,
      subjects: subjects.length,
      constraints: constraints.length
    });

    // 2. Construire le JSON OptaPlanner selon template exact
    const dayStart = school.day_start_time || '08:00';
    const dayEnd = school.day_end_time || '18:00';
    const periodDuration = school.period_duration_minutes || 60;
    const breaks = school.breaks || [];
    const daysOfWeek = school.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

    // Générer les periods (timeslots) en excluant les pauses
    const periods = [];
    let periodId = 1;

    daysOfWeek.forEach(day => {
      const [startHour, startMin] = dayStart.split(':').map(Number);
      const [endHour, endMin] = dayEnd.split(':').map(Number);
      let currentMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      while (currentMinutes < endMinutes) {
        const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((currentMinutes + periodDuration) / 60)).padStart(2, '0')}:${String((currentMinutes + periodDuration) % 60).padStart(2, '0')}`;

        // Vérifier si overlap avec une pause
        const isBreak = breaks.some(b => {
          const [bStartH, bStartM] = b.start.split(':').map(Number);
          const [bEndH, bEndM] = b.end.split(':').map(Number);
          const bStart = bStartH * 60 + bStartM;
          const bEnd = bEndH * 60 + bEndM;
          return currentMinutes < bEnd && (currentMinutes + periodDuration) > bStart;
        });

        if (!isBreak) {
          periods.push({
            id: `P${periodId}`,
            start: slotStart,
            end: slotEnd
          });
          periodId++;
        }

        currentMinutes += periodDuration;
      }
    });

    console.log('[generateSchedule] Generated periods:', periods.length);

    // Construire rooms pour OptaPlanner
    const optaRooms = rooms.filter(r => r.is_active).map(room => ({
      id: room.id,
      name: room.name,
      capacity: room.capacity || 30,
      tags: room.room_type ? [room.room_type] : ['standard']
    }));

    // Construire teachers pour OptaPlanner
    const optaTeachers = teachers.filter(t => t.is_active).map(teacher => ({
      id: teacher.id,
      name: teacher.full_name,
      subjects: teacher.subjects || [],
      unavailable: (teacher.unavailable_slots || []).map(slot => ({
        day: slot.day?.toUpperCase(),
        period_ids: [`P${slot.period}`]
      })),
      max_periods_per_day: teacher.max_hours_per_week ? Math.floor(teacher.max_hours_per_week / 5) : 8
    }));

    // Construire lessons pour OptaPlanner
    const optaLessons = [];
    
    teachingGroups.filter(g => g.is_active).forEach(group => {
      const subject = subjects.find(s => s.id === group.subject_id);
      if (!subject) return;

      // Calculer weekly_sessions
      const minutesPerWeek = group.minutes_per_week || 
        (group.level === 'HL' ? (subject.hl_minutes_per_week_default || 300) : (subject.sl_minutes_per_week_default || 180));
      const weeklyPeriods = Math.ceil(minutesPerWeek / periodDuration);

      optaLessons.push({
        id: group.id,
        group_id: group.id,
        subject: subject.code,
        teacher_id: group.teacher_id,
        required_room_tags: subject.requires_special_room ? [subject.requires_special_room] : ['standard'],
        duration_periods: 1,
        weekly_sessions: weeklyPeriods,
        student_ids: group.student_ids || [],
        hard_constraints: {
          same_teacher: true
        },
        soft_constraints: {
          prefer_morning: subject.preferred_time === 'morning',
          prefer_afternoon: subject.preferred_time === 'afternoon'
        }
      });
    });

    console.log('[generateSchedule] Built lessons:', optaLessons.length);

    // Construire payload OptaPlanner
    const payload = {
      request_id: `gen_${new Date().toISOString().split('T')[0].replace(/-/g, '_')}_${schedule_version_id.slice(-4)}`,
      schedule_version_id: schedule_version_id,
      input_hash: `sha256:${Date.now()}`,
      options: {
        solver_timeout_seconds: 540, // 9 minutes (garde 1min de marge sur 10min total)
        max_unassigned_lessons: 0,
        optimize_for: ['teacher_gaps', 'room_stability', 'student_balance']
      },
      calendar: {
        timezone: school.timezone || 'Europe/Paris',
        week_pattern: 'A/B',
        days: daysOfWeek,
        periods: periods
      },
      rooms: optaRooms,
      teachers: optaTeachers,
      teaching_groups: [],
      lessons: optaLessons,
      ib_constraints: {
        enforce_subject_distribution: true,
        max_same_subject_per_day: 2,
        min_break_between_double_blocks: 1
      }
    };

    console.log('[generateSchedule] Payload built:', {
      rooms: optaRooms.length,
      teachers: optaTeachers.length,
      lessons: optaLessons.length,
      periods: periods.length
    });

    // 3. Envoyer au VPS OptaPlanner avec timeout 10min
    const vpsUrl = Deno.env.get('OPTAPLANNER_ENDPOINT');
    const apiKey = Deno.env.get('OPTAPLANNER_API_KEY');

    if (!vpsUrl || !apiKey) {
      return Response.json({
        ok: false,
        error: 'OptaPlanner VPS not configured',
        message: 'OPTAPLANNER_ENDPOINT and OPTAPLANNER_API_KEY secrets not set'
      }, { status: 500 });
    }

    console.log('[generateSchedule] Calling OptaPlanner VPS:', vpsUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes

    let vpsResponse;
    try {
      vpsResponse = await fetch(vpsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        return Response.json({
          ok: false,
          error: 'SOLVER_TIMEOUT',
          message: 'OptaPlanner exceeded 10 minute timeout',
          stage: 'VPS_TIMEOUT'
        }, { status: 504 });
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    // 4. Parser la réponse
    const result = await vpsResponse.json();
    console.log('[generateSchedule] VPS response:', result);

    // 5. Traiter la réponse
    if (result.status === 'SOLVED') {
      console.log('[generateSchedule] Solution found:', {
        score: result.score,
        solve_time_ms: result.solve_time_ms,
        slots: result.slots?.length || 0
      });

      // Supprimer anciens slots
      const oldSlots = await base44.asServiceRole.entities.ScheduleSlot.filter({ 
        schedule_version: schedule_version_id 
      });
      
      console.log('[generateSchedule] Deleting old slots:', oldSlots.length);
      
      await Promise.all(
        oldSlots.map(slot => base44.asServiceRole.entities.ScheduleSlot.delete(slot.id))
      );

      // Convertir et créer nouveaux slots
      const newSlots = (result.slots || []).map(slot => {
        // Extraire le numéro de période de period_id (ex: "P1" → 1)
        const periodNum = parseInt(slot.period_id.replace('P', ''));

        return {
          school_id: user.school_id,
          schedule_version: schedule_version_id,
          teaching_group_id: slot.lesson_id,
          teacher_id: slot.teacher_id,
          room_id: slot.room_id,
          day: slot.day.charAt(0).toUpperCase() + slot.day.slice(1).toLowerCase(), // Monday format
          period: periodNum,
          status: 'scheduled'
        };
      });

      console.log('[generateSchedule] Creating new slots:', newSlots.length);

      // Créer par batch
      const batchSize = 50;
      let totalCreated = 0;

      for (let i = 0; i < newSlots.length; i += batchSize) {
        const batch = newSlots.slice(i, i + batchSize);
        const created = await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(batch);
        totalCreated += created.length;
      }

      // Mettre à jour ScheduleVersion
      await base44.asServiceRole.entities.ScheduleVersion.update(schedule_version_id, {
        generated_at: new Date().toISOString(),
        score: parseInt(result.score.split('/')[1]?.replace('soft', '') || '0')
      });

      return Response.json({
        ok: true,
        status: 'SOLVED',
        slotsCreated: totalCreated,
        slotsDeleted: oldSlots.length,
        score: result.score,
        solve_time_ms: result.solve_time_ms,
        warnings: result.warnings || []
      });

    } else if (result.status === 'FAILED') {
      return Response.json({
        ok: false,
        status: 'FAILED',
        stage: 'SOLVER_ERROR',
        error: result.error?.code || 'UNKNOWN_ERROR',
        message: result.error?.message || 'Solver failed',
        details: result.error?.details || {}
      });
    } else {
      return Response.json({
        ok: false,
        status: 'UNKNOWN',
        error: 'Unexpected response from OptaPlanner',
        message: `Received status: ${result.status || 'undefined'}`
      });
    }

  } catch (error) {
    console.error('[generateSchedule] Error:', error);
    return Response.json({
      ok: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});