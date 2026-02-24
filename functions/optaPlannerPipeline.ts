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

    // CRITICAL: Create/update TOK/CAS/EE groups BEFORE fetching teaching groups
    console.log('[Pipeline] Ensuring core DP groups are properly split by year...');
    try {
      await base44.functions.invoke('createCoreDPGroups', {});
      console.log('[Pipeline] Core DP groups synchronized');
    } catch (coreGroupError) {
      console.error('[Pipeline] Failed to create core groups:', coreGroupError);
      // Continue anyway - core groups may already exist
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

    // Build teachingGroups array - include both real and synthetic groups
    // CRITICAL: Filter out invalid multi-year groups (e.g., 'DP1,DP2', 'DP1+DP2')
    const teachingGroupsPayload = [];
    
    teachingGroups
      .filter(tg => tg.is_active && tg.year_group && !tg.year_group.includes(',') && !tg.year_group.includes('+'))
      .forEach(tg => {
        teachingGroupsPayload.push({
          id: tg.id,
          subjectId: tg.subject_id,
          studentGroup: tg.year_group || 'DP1',
          sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
          level: tg.level || 'SL',
          requiredMinutesPerWeek: tg.minutes_per_week || 180
        });
      });

    // Build lessons - handle combine_dp1_dp2 subjects
    const lessons = [];
    let lessonId = 1;

    // Group teaching groups by subject for combine_dp1_dp2 logic
    // CRITICAL: Filter out invalid multi-year groups (e.g., 'DP1,DP2', 'DP1+DP2')
    const tgsBySubject = {};
    teachingGroups
      .filter(tg => tg.is_active && tg.teacher_id && tg.student_ids?.length > 0 && tg.year_group && !tg.year_group.includes(',') && !tg.year_group.includes('+'))
      .forEach(tg => {
        if (!tgsBySubject[tg.subject_id]) tgsBySubject[tg.subject_id] = [];
        tgsBySubject[tg.subject_id].push(tg);
      });

    const processedTGs = new Set();

    Object.entries(tgsBySubject).forEach(([subjectId, tgs]) => {
      const subject = subjects.find(s => s.id === subjectId);
      const shouldCombine = subject?.combine_dp1_dp2 === true;

      if (shouldCombine) {
        // Separate HL and SL groups
        const hlGroups = tgs.filter(tg => tg.level === 'HL');
        const slGroups = tgs.filter(tg => tg.level === 'SL');
        
        // Combined lessons (HL + SL, DP1 + DP2) - use SL hours as base
        if (slGroups.length > 0) {
          const allStudents = new Set();
          const allTeachers = new Set();
          
          [...hlGroups, ...slGroups].forEach(tg => {
            (tg.student_ids || []).forEach(sid => allStudents.add(sid));
            if (tg.teacher_id) allTeachers.add(tg.teacher_id);
          });
          
          const combinedStudentIds = Array.from(allStudents).map(sid => studentIdMap.get(sid)).filter(id => id != null);
          const primaryTeacher = Array.from(allTeachers)[0]; // Use first teacher
          const teacherId = teacherIdMap.get(primaryTeacher);
          
          // Use SL hours for combined lessons (typically 3h)
          const slMinutes = slGroups[0]?.minutes_per_week || (subject?.hoursPerWeekSL || 3) * 60;
          const periodDuration = schoolData.period_duration_minutes || 60;
          const numCombinedLessons = Math.ceil(slMinutes / periodDuration);

          const combinedTgId = `combined_${subjectId}`;
          
          // Add synthetic teaching group for combined lessons
          teachingGroupsPayload.push({
            id: combinedTgId,
            subjectId: subjectId,
            studentGroup: combinedTgId,
            sectionId: `sec_combined_${subjectId}`,
            level: 'COMBINED',
            requiredMinutesPerWeek: slMinutes
          });
          
          for (let i = 0; i < numCombinedLessons; i++) {
            lessons.push({
              id: lessonId++,
              teachingGroupId: combinedTgId,
              sectionId: `sec_combined_${subjectId}`,
              subject: subject?.code || subject?.name || 'Unknown',
              studentGroup: combinedTgId,
              teacherId: teacherId || null,
              requiredCapacity: combinedStudentIds.length,
              studentIds: combinedStudentIds,
              timeslotId: null,
              roomId: null
            });
          }
          
          slGroups.forEach(tg => processedTGs.add(tg.id));
        }

        // HL extension lessons (HL only, DP1 + DP2)
        if (hlGroups.length > 0) {
        const hlStudents = new Set();
        const hlTeachers = new Set();

        hlGroups.forEach(tg => {
          (tg.student_ids || []).forEach(sid => hlStudents.add(sid));
          if (tg.teacher_id) hlTeachers.add(tg.teacher_id);
        });

        const hlStudentIds = Array.from(hlStudents).map(sid => studentIdMap.get(sid)).filter(id => id != null);
        const primaryTeacher = Array.from(hlTeachers)[0];
        const teacherId = teacherIdMap.get(primaryTeacher);

        // HL extension = HL hours - SL hours (typically 5h - 3h = 2h)
        const hlMinutes = hlGroups[0]?.minutes_per_week || (subject?.hoursPerWeekHL || 5) * 60;
        const slMinutes = (subject?.hoursPerWeekSL || 3) * 60;
        const extensionMinutes = Math.max(0, hlMinutes - slMinutes);
        const periodDuration = schoolData.period_duration_minutes || 60;
        const numExtensionLessons = Math.ceil(extensionMinutes / periodDuration);

        const hlExtTgId = `hl_ext_${subjectId}`;
        
        // Add synthetic teaching group for HL extensions
        teachingGroupsPayload.push({
          id: hlExtTgId,
          subjectId: subjectId,
          studentGroup: hlExtTgId,
          sectionId: `sec_hl_${subjectId}`,
          level: 'HL_EXTENSION',
          requiredMinutesPerWeek: extensionMinutes
        });
        
        for (let i = 0; i < numExtensionLessons; i++) {
          lessons.push({
            id: lessonId++,
            teachingGroupId: hlExtTgId,
            sectionId: `sec_hl_${subjectId}`,
            subject: subject?.code || subject?.name || 'Unknown',
            studentGroup: hlExtTgId,
            teacherId: teacherId || null,
            requiredCapacity: hlStudentIds.length,
            studentIds: hlStudentIds,
            timeslotId: null,
            roomId: null
          });
        }

        hlGroups.forEach(tg => processedTGs.add(tg.id));
        }
      } else {
        // Regular teaching groups (no combining)
        tgs.forEach(tg => {
          if (processedTGs.has(tg.id)) return;
          
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
          
          processedTGs.add(tg.id);
        });
      }
    });

    // Build subjectRequirements - must match lesson structure for combine_dp1_dp2
    const subjectRequirements = [];
    const processedReqTGs = new Set();

    Object.entries(tgsBySubject).forEach(([subjectId, tgs]) => {
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) return;

      const shouldCombine = subject?.combine_dp1_dp2 === true;

      if (shouldCombine) {
        const hlGroups = tgs.filter(tg => tg.level === 'HL');
        const slGroups = tgs.filter(tg => tg.level === 'SL');
        
        // Combined requirement (SL hours)
        if (slGroups.length > 0) {
          const slMinutes = slGroups[0]?.minutes_per_week || (subject?.hoursPerWeekSL || 3) * 60;
          const combinedTgId = `combined_${subjectId}`;
          subjectRequirements.push({
            teachingGroupId: combinedTgId,
            sectionId: `sec_combined_${subjectId}`,
            studentGroup: combinedTgId,
            subject: subject.code || subject.name,
            minutesPerWeek: slMinutes
          });
          slGroups.forEach(tg => processedReqTGs.add(tg.id));
        }

        // HL extension requirement
        if (hlGroups.length > 0) {
          const hlMinutes = hlGroups[0]?.minutes_per_week || (subject?.hoursPerWeekHL || 5) * 60;
          const slMinutes = (subject?.hoursPerWeekSL || 3) * 60;
          const extensionMinutes = Math.max(0, hlMinutes - slMinutes);
          
          if (extensionMinutes > 0) {
            const hlExtTgId = `hl_ext_${subjectId}`;
            subjectRequirements.push({
              teachingGroupId: hlExtTgId,
              sectionId: `sec_hl_${subjectId}`,
              studentGroup: hlExtTgId,
              subject: subject.code || subject.name,
              minutesPerWeek: extensionMinutes
            });
          }
          hlGroups.forEach(tg => processedReqTGs.add(tg.id));
        }
      } else {
        // Regular requirements
        tgs.forEach(tg => {
          if (processedReqTGs.has(tg.id)) return;
          if (!tg.is_active || !tg.year_group || !tg.year_group.trim()) return;

          subjectRequirements.push({
            teachingGroupId: tg.id,
            sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
            studentGroup: tg.year_group,
            subject: subject.code || subject.name,
            minutesPerWeek: tg.minutes_per_week || 180
          });
          processedReqTGs.add(tg.id);
        });
      }
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
        maxPeriodsPerWeek: Math.min(t.max_hours_per_week || 25, 50),
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
        maxSameSubjectPerDayHardEnabled: false,
        maxSameSubjectPerDayLimit: 4,
        exactWeeklyCountEnabled: false,
        allowFlexibleWeeklyCounts: true,
        relaxStudentGroupConflicts: false
      },

      randomSeed: 42,
      randomizeSearch: false,
      numSearchWorkers: 1,
      shuffleInputOrder: false
    };

    // Validate teacher capacity before sending to OptaPlanner
    const teacherAssignments = {};
    const overloadedTeachers = [];
    
    teachers.forEach((t, idx) => {
      const teacherId = idx + 1;
      const assignedLessons = lessons.filter(l => l.teacherId === teacherId);
      const maxPeriods = Math.min(t.max_hours_per_week || 25, 45);
      const isOverloaded = assignedLessons.length > maxPeriods;
      
      teacherAssignments[t.full_name] = {
        maxPeriods: maxPeriods,
        assignedLessons: assignedLessons.length,
        overload: isOverloaded
      };
      
      if (isOverloaded) {
        overloadedTeachers.push({
          name: t.full_name,
          assigned: assignedLessons.length,
          max: maxPeriods,
          teachingGroups: teachingGroups
            .filter(tg => tg.teacher_id === t.id)
            .map(tg => {
              const subject = subjects.find(s => s.id === tg.subject_id);
              const requiredMinutes = tg.minutes_per_week || 180;
              const periodDuration = schoolData.period_duration_minutes || 60;
              const numLessons = Math.ceil(requiredMinutes / periodDuration);
              return {
                subject: subject?.name || 'Unknown',
                yearGroup: tg.year_group,
                minutesPerWeek: requiredMinutes,
                lessonsNeeded: numLessons
              };
            })
        });
      }
    });
    
    console.log('[Pipeline] Teacher capacity check:', teacherAssignments);
    
    if (overloadedTeachers.length > 0) {
      console.error('[Pipeline] Teacher capacity exceeded:', overloadedTeachers);
      return Response.json({
        ok: false,
        error: 'Teacher capacity exceeded',
        code: 'TEACHER_CAPACITY_EXCEEDED',
        details: {
          message: `${overloadedTeachers.length} teacher(s) have been assigned more lessons than their weekly capacity allows.`,
          overloadedTeachers: overloadedTeachers,
          solution: 'Either increase the teacher\'s max hours per week, assign some teaching groups to other teachers, or reduce the weekly hours required for some subjects.'
        }
      }, { status: 400 });
    }
    
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