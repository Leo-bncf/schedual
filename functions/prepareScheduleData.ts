import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Phase 2: Prepare and validate schedule data for OptaPlanner
 * Returns: { ok: true, payload, meta, input_hash } or { ok: false, errors: [] }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ 
        ok: false, 
        errors: [{ code: 'UNAUTHORIZED', message: 'Admin access required' }] 
      }, { status: 403 });
    }

    const { schedule_version_id } = await req.json();
    
    if (!schedule_version_id) {
      return Response.json({
        ok: false,
        errors: [{ code: 'INVALID_INPUT', message: 'schedule_version_id required' }]
      }, { status: 400 });
    }

    const schoolId = user.school_id;
    
    // Load all required data
    const [school, teachingGroups, subjects, teachers, rooms, students, scheduleVersion] = await Promise.all([
      base44.entities.School.filter({ id: schoolId }).then(r => r[0]),
      base44.entities.TeachingGroup.filter({ school_id: schoolId, is_active: true }),
      base44.entities.Subject.filter({ school_id: schoolId, is_active: true }),
      base44.entities.Teacher.filter({ school_id: schoolId, is_active: true }),
      base44.entities.Room.filter({ school_id: schoolId, is_active: true }),
      base44.entities.Student.filter({ school_id: schoolId, is_active: true }),
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id }).then(r => r[0])
    ]);

    if (!school) {
      return Response.json({
        ok: false,
        errors: [{ code: 'SCHOOL_NOT_FOUND', message: 'School not found' }]
      }, { status: 404 });
    }

    if (!scheduleVersion) {
      return Response.json({
        ok: false,
        errors: [{ code: 'VERSION_NOT_FOUND', message: 'Schedule version not found' }]
      }, { status: 404 });
    }

    // === VALIDATIONS BLOQUANTES ===
    const errors = [];

    // 1. Teaching Groups validation
    if (teachingGroups.length === 0) {
      errors.push({
        code: 'NO_TEACHING_GROUPS',
        message: 'No active teaching groups found',
        details: { hint: 'Create teaching groups first' }
      });
    }

    const incompleteGroups = teachingGroups.filter(g => 
      !g.teacher_id || !g.student_ids || g.student_ids.length === 0 || !g.minutes_per_week
    );
    
    if (incompleteGroups.length > 0) {
      errors.push({
        code: 'INCOMPLETE_GROUPS',
        message: `${incompleteGroups.length} teaching groups are incomplete`,
        details: {
          groups: incompleteGroups.map(g => ({
            id: g.id,
            name: g.name,
            missing: [
              !g.teacher_id && 'teacher',
              (!g.student_ids || g.student_ids.length === 0) && 'students',
              !g.minutes_per_week && 'minutes_per_week'
            ].filter(Boolean)
          }))
        }
      });
    }

    // 2. DP IB Requirements validation (6 groups + core)
    const dpStudents = students.filter(s => s.ib_programme === 'DP');
    const dpViolations = [];

    for (const student of dpStudents) {
      const choices = student.subject_choices || [];
      const groupNumbers = new Set(choices.map(c => c.ib_group));
      
      if (groupNumbers.size < 6) {
        dpViolations.push({
          student_id: student.id,
          student_name: student.full_name,
          issue: `Only ${groupNumbers.size}/6 IB groups selected`
        });
      }

      // Check HL/SL distribution (3-4 HL standard)
      const hlCount = choices.filter(c => c.level === 'HL').length;
      if (hlCount < 3 || hlCount > 4) {
        dpViolations.push({
          student_id: student.id,
          student_name: student.full_name,
          issue: `${hlCount} HL subjects (should be 3-4)`
        });
      }
    }

    if (dpViolations.length > 0) {
      errors.push({
        code: 'DP_IB_VIOLATIONS',
        message: `${dpViolations.length} DP students have IB requirement violations`,
        details: { violations: dpViolations.slice(0, 10) } // First 10
      });
    }

    // 3. Resources validation
    if (teachers.length === 0) {
      errors.push({
        code: 'NO_TEACHERS',
        message: 'No active teachers found'
      });
    }

    if (rooms.length === 0) {
      errors.push({
        code: 'NO_ROOMS',
        message: 'No active rooms found'
      });
    }

    // 4. School configuration
    if (!school.period_duration_minutes || school.period_duration_minutes < 30) {
      errors.push({
        code: 'INVALID_PERIOD_DURATION',
        message: 'Invalid period duration in school settings',
        details: { current: school.period_duration_minutes, minimum: 30 }
      });
    }

    if (!school.days_of_week || school.days_of_week.length === 0) {
      errors.push({
        code: 'NO_SCHOOL_DAYS',
        message: 'No school days configured'
      });
    }

    // If blocking errors, return now
    if (errors.length > 0) {
      return Response.json({
        ok: false,
        errors
      }, { status: 400 });
    }

    // === BUILD OPTAPLANNER PAYLOAD ===
    
    // Create subject map
    const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t]));
    const roomMap = Object.fromEntries(rooms.map(r => [r.id, r]));

    // Build timeslots (simple grid)
    const periodDuration = school.period_duration_minutes || 60;
    const periodsPerDay = school.target_periods_per_day || 10;
    const daysOfWeek = school.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    
    const timeslots = [];
    let timeslotId = 0;
    for (const day of daysOfWeek) {
      for (let period = 0; period < periodsPerDay; period++) {
        timeslots.push({
          id: timeslotId++,
          dayOfWeek: day,
          startTime: `${8 + Math.floor((period * periodDuration) / 60)}:${((period * periodDuration) % 60).toString().padStart(2, '0')}`,
          endTime: `${8 + Math.floor(((period + 1) * periodDuration) / 60)}:${(((period + 1) * periodDuration) % 60).toString().padStart(2, '0')}`,
          periodIndex: period
        });
      }
    }

    // Build lessons from teaching groups
    const lessons = teachingGroups.map((group, idx) => {
      const subject = subjectMap[group.subject_id];
      const teacher = teacherMap[group.teacher_id];
      const preferredRoom = group.preferred_room_id ? roomMap[group.preferred_room_id] : null;
      
      // Calculate required lessons per week
      const minutesPerWeek = group.minutes_per_week || 180;
      const lessonsPerWeek = Math.ceil(minutesPerWeek / periodDuration);

      return {
        id: `lesson-${idx}`,
        teachingGroupId: group.id,
        teachingGroupName: group.name,
        subjectId: group.subject_id,
        subjectName: subject?.name || 'Unknown',
        teacherId: group.teacher_id,
        teacherName: teacher?.full_name || 'Unknown',
        studentIds: group.student_ids || [],
        studentCount: (group.student_ids || []).length,
        preferredRoomId: group.preferred_room_id,
        roomCapacityNeeded: (group.student_ids || []).length,
        lessonsPerWeek,
        requiresDoublePeriod: group.requires_double_periods || false,
        yearGroup: group.year_group,
        level: group.level,
        blockId: group.block_id // For concurrent electives
      };
    });

    const payload = {
      school: {
        id: schoolId,
        name: school.name,
        periodsPerDay,
        daysPerWeek: daysOfWeek.length,
        periodDurationMinutes: periodDuration
      },
      timeslots,
      rooms: rooms.map(r => ({
        id: r.id,
        name: r.name,
        capacity: r.capacity,
        roomType: r.room_type
      })),
      teachers: teachers.map(t => ({
        id: t.id,
        name: t.full_name,
        maxHoursPerWeek: t.max_hours_per_week || 25,
        maxConsecutivePeriods: t.max_consecutive_periods || 4,
        unavailableSlots: t.unavailable_slots || []
      })),
      lessons,
      constraints: {
        hardConstraints: [
          'NO_TEACHER_CONFLICTS',
          'NO_STUDENT_CONFLICTS',
          'NO_ROOM_CONFLICTS',
          'ROOM_CAPACITY',
          'TEACHER_MAX_HOURS'
        ],
        softConstraints: [
          'MINIMIZE_TEACHER_GAPS',
          'DISTRIBUTE_LESSONS_EVENLY',
          'PREFERRED_ROOMS',
          'TEACHER_PREFERRED_FREE_DAY'
        ]
      }
    };

    // Calculate input_hash (SHA-256 of stable data representation)
    const stableInput = JSON.stringify({
      teachingGroups: teachingGroups.map(g => ({ id: g.id, updated_date: g.updated_date })),
      subjects: subjects.map(s => ({ id: s.id, updated_date: s.updated_date })),
      school_settings: {
        periods: periodsPerDay,
        duration: periodDuration,
        days: daysOfWeek
      }
    });

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(stableInput));
    const input_hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const meta = {
      total_lessons: lessons.length,
      total_students: students.length,
      total_teachers: teachers.length,
      total_rooms: rooms.length,
      total_timeslots: timeslots.length,
      dp_students: dpStudents.length
    };

    return Response.json({
      ok: true,
      payload,
      meta,
      input_hash
    });

  } catch (error) {
    console.error('prepareScheduleData error:', error);
    return Response.json({
      ok: false,
      errors: [{
        code: 'INTERNAL_ERROR',
        message: error.message,
        details: { stack: error.stack }
      }]
    }, { status: 500 });
  }
});