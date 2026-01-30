import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calls OR-Tool scheduling service and processes results
 * 
 * Sends clean schedule_problem_v1 payload
 * Receives schedule_solution_v1 response
 * Maps assignments back to Base44 entities (ScheduleSlot)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { schedule_version_id } = await req.json();

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    // Step 1: Build scheduling problem
    const buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
      schedule_version_id
    });

    if (!buildResponse.data.success) {
      return Response.json({ 
        error: 'Failed to build scheduling problem',
        details: buildResponse.data 
      }, { status: 500 });
    }

    const problem = buildResponse.data.problem;

    // Step 2: Call OR-Tool service
    const OR_TOOL_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT') || Deno.env.get('OR_TOOL_API_URL');
    const OR_TOOL_API_KEY = Deno.env.get('OR_TOOL_API_KEY');

    if (!OR_TOOL_ENDPOINT || !OR_TOOL_API_KEY) {
      return Response.json({ 
        error: 'OR-Tool service not configured. Set OR_TOOL_ENDPOINT/OR_TOOL_API_URL and OR_TOOL_API_KEY.'
      }, { status: 503 });
    }

    console.log(`Calling OR-Tool at ${OR_TOOL_ENDPOINT}...`);

    const solverResponse = await fetch(OR_TOOL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OR_TOOL_API_KEY}`
      },
      body: JSON.stringify(problem)
    });

    if (!solverResponse.ok) {
      const errorText = await solverResponse.text();
      console.error('OR-Tool error:', errorText);
      return Response.json({ 
        error: 'OR-Tool scheduling failed',
        details: errorText 
      }, { status: 500 });
    }

    const solution = await solverResponse.json();

    // Step 3: Validate solution format (support lessons or legacy assignments)
    const solvedLessons = Array.isArray(solution.lessons)
      ? solution.lessons
      : (Array.isArray(solution.assignments) ? solution.assignments : null);
    if (!solvedLessons) {
      return Response.json({ 
        error: 'Invalid solution format from OR-Tool (expected lessons[] or assignments[])',
        solution 
      }, { status: 500 });
    }

    // Step 4: Get Base44 entities to reverse-map IDs
    const [subjects, teachingGroups, rooms, teachers] = await Promise.all([
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id })
    ]);

    // Use mappings provided by the problem payload (no DB index ordering)
    const subjectIdByCode = problem.subjectIdByCode || {};
    const numericToRoomId = problem.roomNumericIdToBase44Id || {};
    const numericToTeacherId = problem.teacherNumericIdToBase44Id || {};

    const numericToRoomId = {};
    problem.rooms.forEach((room, index) => {
      numericToRoomId[index + 1] = rooms[index]?.id;
    });

    const numericToTeacherId = {};
    problem.teachers.forEach((teacher, index) => {
      numericToTeacherId[index + 1] = teachers[index]?.id;
    });

    // Map timeslot ID → day/period
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const dayMapping = {
      'MONDAY': 'Monday',
      'TUESDAY': 'Tuesday',
      'WEDNESDAY': 'Wednesday',
      'THURSDAY': 'Thursday',
      'FRIDAY': 'Friday'
    };

    // Step 5: Map OptaPlanner solution back to Base44 ScheduleSlot entities
    const periods_per_day = problem.timeslots.length / 5; // 50 slots / 5 days = 10 periods
    const slots = [];
    
    for (const lesson of solvedLessons) {
      if (!lesson.timeslotId || !lesson.roomId) continue; // Skip unassigned

      const timeslot = problem.timeslots.find(ts => ts.id === lesson.timeslotId);
      if (!timeslot) continue;

      const normalizedSubject = String(lesson.subject || lesson.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const subjectId = subjectIdByCode[normalizedSubject] || null;
      const teacherId = lesson.teacherId ? numericToTeacherId[lesson.teacherId] : null;
      const roomId = numericToRoomId[lesson.roomId] || null;
      
      // Calculate period from timeslot ID: ((id - 1) % periods_per_day) + 1
      const period = ((timeslot.id - 1) % periods_per_day) + 1;

      slots.push({
        school_id: user.school_id,
        schedule_version: schedule_version_id,
        teaching_group_id: null,
        subject_id: subjectId || null,
        teacher_id: teacherId,
        room_id: roomId,
        day: dayMapping[timeslot.dayOfWeek] || timeslot.dayOfWeek,
        period: period,
        is_double_period: false,
        status: 'scheduled'
      });
    }

    // Step 6: Delete existing slots for this version
    const existingSlots = await base44.asServiceRole.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });

    for (const slot of existingSlots) {
      await base44.asServiceRole.entities.ScheduleSlot.delete(slot.id);
    }

    // Step 7: Create new slots
    if (slots.length > 0) {
      await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(slots);
    }

    // Step 8: Create conflict reports for unassigned lessons
    const unassignedLessons = solvedLessons.filter(l => !l.timeslotId || !l.roomId);
    if (unassignedLessons.length > 0) {
      for (const lesson of unassignedLessons) {
        await base44.asServiceRole.entities.ConflictReport.create({
          school_id: user.school_id,
          schedule_version_id,
          conflict_type: 'unassigned_teaching_unit',
          severity: 'critical',
          description: `Lesson "${lesson.subject} - ${lesson.studentGroup}" could not be scheduled. No valid time slots found.`,
          affected_entities: {
            subject_code: lesson.subject,
            student_group: lesson.studentGroup
          },
          suggested_resolution: 'Try adding more rooms, adjusting teacher availability, or reducing required sessions.',
          status: 'unresolved'
        });
      }
    }

    // Step 9: Update schedule version metadata
    await base44.asServiceRole.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      score: solution.score || 0,
      conflicts_count: unassignedLessons.length
    });

    return Response.json({
      success: true,
      message: 'Schedule generated successfully',
      stats: {
        slots_created: slots.length,
        unassigned_lessons: unassignedLessons.length,
        score: solution.score || 0
      }
    });

  } catch (error) {
    console.error('OR-Tool scheduler error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate schedule' 
    }, { status: 500 });
  }
});