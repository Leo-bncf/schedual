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
    const errors = [];

    // Step 1: Build scheduling problem
    const buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
      schedule_version_id,
      school_id: user.school_id
    });

    if (!buildResponse.data.success) {
      return Response.json({ 
        error: 'Failed to build scheduling problem',
        details: buildResponse.data 
      }, { status: 500 });
    }

    const problem = buildResponse.data.problem;
    const expectedLessonsBySubject = (buildResponse.data?.stats?.expectedLessonsBySubject) || {};

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
    console.log('[callORToolScheduler] solver score =', solution.score);

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
    const assignmentsReturnedBySubject = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      assignmentsReturnedBySubject[subj] = (assignmentsReturnedBySubject[subj] || 0) + 1;
    }
    console.log('[callORToolScheduler] assignmentsReturnedBySubject =', assignmentsReturnedBySubject);
    const assignedBySubjectCode = {};
    const unassignedBySubjectCode = {};
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (l.timeslotId) {
        assignedBySubjectCode[subj] = (assignedBySubjectCode[subj] || 0) + 1;
      } else {
        unassignedBySubjectCode[subj] = (unassignedBySubjectCode[subj] || 0) + 1;
      }
    }
    console.log('[callORToolScheduler] assignedBySubjectCode =', assignedBySubjectCode);
    console.log('[callORToolScheduler] unassignedBySubjectCode =', unassignedBySubjectCode);
    const coreKeys = ['TOK','CAS','EE'];
    const coreAssignmentSummary = {};
    for (const k of coreKeys) {
      coreAssignmentSummary[k] = {
        assigned: assignedBySubjectCode[k] || 0,
        unassigned: unassignedBySubjectCode[k] || 0,
        total: (assignedBySubjectCode[k] || 0) + (unassignedBySubjectCode[k] || 0)
      };
    }
    console.log('[callORToolScheduler] coreAssignmentSummary =', coreAssignmentSummary);

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



    // Map timeslot ID → day/period
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const dayMapping = {
      'MONDAY': 'Monday',
      'TUESDAY': 'Tuesday',
      'WEDNESDAY': 'Wednesday',
      'THURSDAY': 'Thursday',
      'FRIDAY': 'Friday'
    };

    // Core assignments (TOK/CAS/EE) with timeslotId + mapped day/period
    const periodsPerDay = problem.timeslots.length / 5;
    const coreAssignments = { TOK: [], CAS: [], EE: [] };
    for (const l of solvedLessons) {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (!['TOK','CAS','EE'].includes(subj)) continue;
      let day = null, period = null;
      if (l.timeslotId) {
        const ts = problem.timeslots.find(t => t.id === l.timeslotId) || null;
        if (ts) {
          day = dayMapping[ts.dayOfWeek] || ts.dayOfWeek;
          period = ((ts.id - 1) % periodsPerDay) + 1;
        }
      }
      coreAssignments[subj].push({
        subject: subj,
        studentGroup: l.studentGroup || null,
        timeslotId: l.timeslotId || null,
        day, period,
        teacherId: l.teacherId || null,
        roomId: l.roomId || null
      });
    }

    // Step 5: Map OptaPlanner solution back to Base44 ScheduleSlot entities
    const periods_per_day = problem.timeslots.length / 5; // 50 slots / 5 days = 10 periods
    const slots = [];
    
    for (const lesson of solvedLessons) {
      if (!lesson.timeslotId) continue; // Skip if no timeslot assigned

      const timeslot = problem.timeslots.find(ts => ts.id === lesson.timeslotId);
      if (!timeslot) continue;

      const normalizedSubject = String(lesson.subject || lesson.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const subjectId = subjectIdByCode[normalizedSubject] || null;
      const teacherId = lesson.teacherId ? numericToTeacherId[lesson.teacherId] : null;
      const roomId = numericToRoomId[lesson.roomId] || null;
      const tgIdFromGroup = (lesson.studentGroup && lesson.studentGroup.startsWith('TG_')) ? lesson.studentGroup.slice(3) : null;
      
      // Allow null room for STUDY and any DP core subject (based on is_core or well-known codes)
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      const isCore = (() => {
        const subjId = subjectId;
        const byFlag = subjId && subjects.some(s => s.id === subjId && s.is_core === true);
        return byFlag || allowNullRoomSubjects.has(normalizedSubject);
      })();
      if (!roomId && !isCore) continue;
      
      // Calculate period from timeslot ID: ((id - 1) % periods_per_day) + 1
      const period = ((timeslot.id - 1) % periods_per_day) + 1;

      slots.push({
        school_id: user.school_id,
        schedule_version: schedule_version_id,
        teaching_group_id: tgIdFromGroup || null,
        subject_id: subjectId || null,
        teacher_id: teacherId,
        room_id: roomId,
        day: dayMapping[timeslot.dayOfWeek] || timeslot.dayOfWeek,
        period: period,
        is_double_period: false,
        status: 'scheduled',
        notes: normalizedSubject === 'STUDY' ? 'Study / Free Period' : undefined
      });
    }

    // Log slots prepared by subject and sample core slots
    const codeBySubjectId = {};
    Object.entries(subjectIdByCode || {}).forEach(([code, id]) => { codeBySubjectId[id] = code; });
    const slotsPreparedBySubject = {};
    for (const s of slots) {
      const code = s.subject_id ? (codeBySubjectId[s.subject_id] || 'UNKNOWN') : (s.notes?.includes('Study') ? 'STUDY' : 'UNKNOWN');
      slotsPreparedBySubject[code] = (slotsPreparedBySubject[code] || 0) + 1;
    }
    console.log('[callORToolScheduler] slotsPreparedBySubject =', slotsPreparedBySubject);

    // Counts by subject_id
    const slotsToInsertBySubjectId = {};
    for (const s of slots) {
      const key = s.subject_id || 'null';
      slotsToInsertBySubjectId[key] = (slotsToInsertBySubjectId[key] || 0) + 1;
    }
    console.log('[callORToolScheduler] slotsToInsertBySubjectId =', slotsToInsertBySubjectId);

    // Full JSON samples for TOK/CAS/EE
    const sampleTok = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'TOK') || null;
    const sampleCas = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'CAS') || null;
    const sampleEe  = slots.find(s => s.subject_id && codeBySubjectId[s.subject_id] === 'EE')  || null;
    console.log('[callORToolScheduler] sampleSlot.TOK =', sampleTok);
    console.log('[callORToolScheduler] sampleSlot.CAS =', sampleCas);
    console.log('[callORToolScheduler] sampleSlot.EE  =', sampleEe);

    // Step 6: Delete existing slots for this version
    const existingSlots = await base44.asServiceRole.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });
    const deletedCount = existingSlots.length;
    for (const slot of existingSlots) {
      try {
        await base44.asServiceRole.entities.ScheduleSlot.delete(slot.id);
      } catch (e) {
        errors.push(`delete:${slot.id}:${e?.message || 'error'}`);
      }
    }

    // Step 7: Create new slots
    let insertedCount = 0;
    let sampleSlotsInserted = null;
    if (slots.length > 0) {
      const inserted = await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(slots);
      const createdIds = Array.isArray(inserted) ? inserted.map(r => r.id) : null;
      insertedCount = Array.isArray(inserted) ? inserted.length : slots.length;
      console.log('[callORToolScheduler] insertedCount =', insertedCount);
      console.log('[callORToolScheduler] insertedCountBySubject =', slotsPreparedBySubject);
      if (createdIds) {
        console.log('[callORToolScheduler] createdIds (first 20) =', createdIds.slice(0, 20));
      }
      // Build sampleSlotsInserted (5 max, ensure one core if exists)
      if (Array.isArray(inserted)) {
        const toCode = (s) => s.subject_id ? (codeBySubjectId[s.subject_id] || 'UNKNOWN') : (s.notes?.includes('Study') ? 'STUDY' : 'UNKNOWN');
        const coreList = inserted.filter(s => ['TOK','CAS','EE'].includes(toCode(s)));
        const nonCore = inserted.filter(s => !['TOK','CAS','EE'].includes(toCode(s)));
        sampleSlotsInserted = [...coreList.slice(0,1), ...nonCore.slice(0,4)];
      }
    }

    // Step 8: Create conflict reports for unassigned lessons
    const unassignedLessons = solvedLessons.filter(l => {
      const subj = String(l.subject || l.subjectCode || '')
        .toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      const allowNullRoomSubjects = new Set(['STUDY','TOK','CAS','EE']);
      const subjId = (problem.subjectIdByCode && problem.subjectIdByCode[subj]) || null;
      const isCore = (subjId && subjects.some(s => s.id === subjId && s.is_core === true)) || allowNullRoomSubjects.has(subj);
      return !l.timeslotId || (!l.roomId && !isCore);
    });
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

    // Step 9: Off-by-one mismatch check and warnings
            const offByOneIssues = {};
            for (const [code, exp] of Object.entries(expectedLessonsBySubject || {})) {
              const got = assignedBySubjectCode[code] || 0;
              if (got !== exp) {
                offByOneIssues[code] = { expected: exp, assigned: got, diff: got - exp };
              }
            }
            console.log('[callORToolScheduler] offByOneIssues =', offByOneIssues);
            let warningsCount = Object.keys(offByOneIssues).length;
            if (warningsCount > 0) {
              for (const [code, info] of Object.entries(offByOneIssues)) {
                try {
                  await base44.asServiceRole.entities.ConflictReport.create({
                    school_id: user.school_id,
                    schedule_version_id,
                    conflict_type: info.assigned < info.expected ? 'insufficient_hours' : 'ib_requirement_violation',
                    severity: 'medium',
                    description: `Subject ${code}: assigned ${info.assigned} vs expected ${info.expected} (diff ${info.diff >= 0 ? '+' : ''}${info.diff})`,
                    affected_entities: { subject_code: code },
                    status: 'unresolved'
                  });
                } catch (e) {
                  errors.push(`warn:${code}:${e?.message || 'error'}`);
                }
              }
            }
            // Step 9: Update schedule version metadata
            await base44.asServiceRole.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      score: solution.score || 0,
      conflicts_count: unassignedLessons.length,
      warnings_count: warningsCount
      });

    return Response.json({
      success: true,
      school_id: user.school_id,
      schedule_version_id,
      expectedLessonsBySubject,
      assignmentsBySubjectCode: assignedBySubjectCode,
      unassignedBySubjectCode,
      coreAssignments,
      slotsToInsertBySubjectId,
      insertedCount,
      deletedCount: typeof deletedCount === 'number' ? deletedCount : 0,
      errors,
      offByOneIssues,
      sampleSlotsInserted,
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