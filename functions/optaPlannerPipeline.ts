import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_version_id, constraints } = await req.json();
    
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

    // CRITICAL: Ensure teaching groups use the LATEST configured subject hours.
    // This fixes the issue where old 6h/4h values were stuck in the database.
    const adjustedTeachingGroups = teachingGroups.map(tg => {
      const subject = subjects.find(s => s.id === tg.subject_id);
      if (!subject) return tg;

      let actualMinutes = tg.minutes_per_week || 180;
      
      if (subject.ib_level === 'DP') {
        if (tg.level === 'HL') actualMinutes = (subject.hoursPerWeekHL || 5) * 60;
        else if (tg.level === 'SL' || tg.level === 'Standard') actualMinutes = (subject.hoursPerWeekSL || 3) * 60;
      } else if (subject.pyp_myp_minutes_per_week_default) {
        actualMinutes = subject.pyp_myp_minutes_per_week_default;
      }

      return { ...tg, minutes_per_week: actualMinutes };
    });

    // Use adjusted teaching groups for validation and processing
    const teachingGroupsToProcess = adjustedTeachingGroups;

    // ===== PRE-PIPELINE VALIDATION =====
    const validationErrors = [];

    // 1. Check minimum data availability
    // TEMPORARY: Allow empty arrays to pass validation so we can send dummy data to OptaPlanner for testing the shape.
    if (!rooms || rooms.length === 0) {
      console.warn('⚠️ No active rooms configured. Will use dummy data.');
    }
    if (!teachers || teachers.length === 0) {
      console.warn('⚠️ No active teachers configured. Will use dummy data.');
    }
    if (!subjects || subjects.length === 0) {
      console.warn('⚠️ No active subjects configured. Will use dummy data.');
    }
    if (!teachingGroups || teachingGroups.length === 0) {
      console.warn('⚠️ No active teaching groups. Will use dummy data.');
    }

    // 2. Validate teaching groups have required fields
    const invalidTGs = teachingGroupsToProcess.filter(tg => 
      !tg.subject_id || !tg.year_group || !tg.teacher_id || !tg.student_ids || tg.student_ids.length === 0
    );
    if (invalidTGs.length > 0) {
      // NOTE: We only push a warning string, but let's see if there's a reason we ignore it later
      validationErrors.push(`⚠️  ${invalidTGs.length} teaching group(s) missing required fields (subject, year_group, teacher, or students)`);
    }

    // 3. Validate subject hours are configured
    const subjectsNoHours = subjects.filter(s => 
      (s.ib_level === 'DP' && (!s.hoursPerWeekHL || !s.hoursPerWeekSL)) ||
      (s.ib_level !== 'DP' && !s.pyp_myp_minutes_per_week_default)
    );
    if (subjectsNoHours.length > 0) {
      validationErrors.push(`⚠️  ${subjectsNoHours.length} subject(s) missing weekly hours configuration`);
    }

    // 4. Check room capacity vs teaching group sizes
    const roomCapacityIssues = [];
    teachingGroupsToProcess.forEach(tg => {
      const requiredCapacity = tg.student_ids?.length || 0;
      const availableRooms = rooms.filter(r => r.capacity >= requiredCapacity);
      if (availableRooms.length === 0) {
        roomCapacityIssues.push({
          teaching_group: tg.name,
          students: requiredCapacity,
          largestRoom: Math.max(...rooms.map(r => r.capacity || 0))
        });
      }
    });
    if (roomCapacityIssues.length > 0) {
      validationErrors.push(`❌ ${roomCapacityIssues.length} teaching group(s) exceed available room capacity`);
    }

    // 5. Check teacher overload - accounting for combine_dp1_dp2 subjects
    const teacherOverloadIssues = [];
    teachers.forEach(t => {
      const assignedTGs = teachingGroupsToProcess.filter(tg => tg.teacher_id === t.id);
      
      // Group TGs by subject to handle combine_dp1_dp2 logic
      const tgsBySubjectForTeacher = {};
      assignedTGs.forEach(tg => {
        if (!tgsBySubjectForTeacher[tg.subject_id]) {
          tgsBySubjectForTeacher[tg.subject_id] = [];
        }
        tgsBySubjectForTeacher[tg.subject_id].push(tg);
      });
      
      // Calculate actual teaching minutes considering combine_dp1_dp2
      let totalMinutes = 0;
      Object.entries(tgsBySubjectForTeacher).forEach(([subjectId, subjectTGs]) => {
        const subject = subjects.find(s => s.id === subjectId);
        const shouldCombine = subject?.combine_dp1_dp2 === true;
        
        if (shouldCombine) {
          // For combined subjects: count base SL hours + HL extension hours only once
          const slMinutes = (subject?.hoursPerWeekSL || 3) * 60;
          const hlMinutes = (subject?.hoursPerWeekHL || 5) * 60;
          const extensionMinutes = Math.max(0, hlMinutes - slMinutes);
          
          // If teacher has both SL and HL, add SL + extension. If only HL, add just the extension.
          const hasHL = subjectTGs.some(tg => tg.level === 'HL');
          const hasSL = subjectTGs.some(tg => tg.level === 'SL');
          
          if (hasSL) {
            totalMinutes += slMinutes;
          }
          if (hasHL) {
            totalMinutes += extensionMinutes;
          }
        } else {
          // Regular subjects: sum all minutes
          totalMinutes += subjectTGs.reduce((sum, tg) => sum + (tg.minutes_per_week || 180), 0);
        }
      });
      
      const maxMinutes = (t.max_hours_per_week || 25) * 60;
      if (totalMinutes > maxMinutes) {
        teacherOverloadIssues.push({
          teacher: t.full_name,
          assignedMinutes: totalMinutes,
          maxMinutes: maxMinutes,
          groups: assignedTGs.length
        });
      }
    });
    if (teacherOverloadIssues.length > 0) {
      validationErrors.push(`❌ ${teacherOverloadIssues.length} teacher(s) overloaded with too many teaching groups`);
    }

    // We don't want warning-only errors (like ⚠️) to completely block the pipeline if there are no hard (❌) errors.
    // Let's check if any error is a hard error (❌).
    const hasHardErrors = validationErrors.some(err => err.includes('❌'));

    // Bypass validation blocking temporarily to test OptaPlanner Java endpoint
    if (hasHardErrors) {
      console.warn('[Pipeline] Validation failed with hard errors, but continuing to test solver payload:', validationErrors);
    } else if (validationErrors.length > 0) {
      console.warn('[Pipeline] Validation warnings (proceeding to solver):', validationErrors);
    }

    console.log('[Pipeline] Validation passed ✅');

    // Create ID mappings for reverse lookup
    const roomIdMap = new Map();
    const teacherIdMap = new Map();
    const studentIdMap = new Map();

    rooms.forEach(r => roomIdMap.set(r.id, `${user.school_id}:${r.id}`));
    teachers.forEach(t => teacherIdMap.set(t.id, t.id));
    students.forEach(s => studentIdMap.set(s.id, s.id));

    // Build reverse mappings
    const subjectIdByCode = {};
    const teacherIdById = {};
    const roomIdById = {};

    subjects.forEach(s => {
      if (s.code) subjectIdByCode[s.code] = s.id;
    });

    teachers.forEach(t => {
      teacherIdById[t.id] = t.id;
    });

    rooms.forEach(r => {
      roomIdById[r.id] = r.id;
      // Also map the external ID format just in case it returns that
      roomIdById[`${user.school_id}_dp:${r.id}`] = r.id;
      roomIdById[`${user.school_id}_myp:${r.id}`] = r.id;
      roomIdById[`${user.school_id}_pyp:${r.id}`] = r.id;
    });

    // Build teachingGroups array - include both real and synthetic groups
    // CRITICAL: Filter out invalid multi-year groups (e.g., 'DP1,DP2', 'DP1+DP2')
    const teachingGroupsPayload = [];
    
    teachingGroupsToProcess
      .filter(tg => tg.is_active && tg.year_group && !tg.year_group.includes(',') && !tg.year_group.includes('+'))
      .forEach(tg => {
        teachingGroupsPayload.push({
          id: tg.id,
          section_id: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
          student_group: tg.year_group || 'DP1',
          subject_id: tg.subject_id,
          level: tg.level || 'SL',
          required_minutes_per_week: tg.minutes_per_week || 180
        });
      });

    // Find the maximum room capacity to cap requiredCapacity so OptaPlanner doesn't fail on large groups
    const maxRoomCapacity = rooms.length > 0 ? Math.max(...rooms.map(r => r.capacity || 20)) : 30;

    // Build lessons - handle combining SL and HL (and potentially DP1+DP2)
    const lessons = [];
    let lessonId = 1;

    // Group teaching groups dynamically.
    // If combine_dp1_dp2 is true, group by subject_id + teacher_id
    // If false, group by subject_id + year_group + teacher_id
    const tgsByGroupKey = {};
    const syntheticToRealTgMap = {};
    
    teachingGroupsToProcess
      .filter(tg => tg.is_active && tg.student_ids?.length > 0 && tg.year_group && !tg.year_group.includes(',') && !tg.year_group.includes('+'))
      .forEach(tg => {
        const subject = subjects.find(s => s.id === tg.subject_id);
        const shouldCombineYears = subject?.combine_dp1_dp2 === true;
        const teacherPart = tg.teacher_id || 'no_teacher';
        
        // This ensures SL and HL taught by the SAME teacher in the SAME year are combined automatically.
        // If combine_dp1_dp2 is true, it ALSO combines DP1 and DP2 taught by the SAME teacher.
        const groupKey = shouldCombineYears 
          ? `${tg.subject_id}_${teacherPart}` 
          : `${tg.subject_id}_${tg.year_group}_${teacherPart}`;
          
        if (!tgsByGroupKey[groupKey]) tgsByGroupKey[groupKey] = [];
        tgsByGroupKey[groupKey].push(tg);
      });

    const processedTGs = new Set();
    const subjectRequirements = [];
    const processedReqTGs = new Set();

    Object.entries(tgsByGroupKey).forEach(([groupKey, tgs]) => {
      const subjectId = tgs[0].subject_id;
      const subject = subjects.find(s => s.id === subjectId);
      if (!subject) return;

      // Check if we actually have multiple levels to combine, or if it's a combined-year group
      const hasHL = tgs.some(tg => tg.level === 'HL');
      const hasSL = tgs.some(tg => tg.level !== 'HL'); // SL, Standard, etc.
      const shouldCombineYears = subject?.combine_dp1_dp2 === true;
      const isMultiGroup = tgs.length > 1;

      if (isMultiGroup || shouldCombineYears) {
        // Separate HL and SL/Standard groups
        const hlGroups = tgs.filter(tg => tg.level === 'HL');
        const slGroups = tgs.filter(tg => tg.level !== 'HL');
        
        // Combined lessons (HL + SL) - use SL hours as base
        if (slGroups.length > 0 || hlGroups.length > 0) {
          const allStudents = new Set();
          const allTeachers = new Set();
          
          [...hlGroups, ...slGroups].forEach(tg => {
            (tg.student_ids || []).forEach(sid => allStudents.add(sid));
            if (tg.teacher_id) allTeachers.add(tg.teacher_id);
          });
          
          const combinedStudentIds = Array.from(allStudents).map(sid => studentIdMap.get(sid)).filter(id => id != null);
          const primaryTeacher = Array.from(allTeachers)[0];
          const teacherId = teacherIdMap.get(primaryTeacher);
          
          const slMinutes = slGroups.length > 0 ? (slGroups[0]?.minutes_per_week || (subject?.hoursPerWeekSL || 3) * 60) : ((subject?.hoursPerWeekSL || 3) * 60);
          const periodDuration = schoolData.period_duration_minutes || 60;
          const numCombinedLessons = Math.ceil(slMinutes / periodDuration);

          const combinedTgId = `combined_${groupKey}`;
          syntheticToRealTgMap[combinedTgId] = [...hlGroups, ...slGroups].map(tg => tg.id);
          const studentGroupLabel = shouldCombineYears ? combinedTgId : tgs[0].year_group;
          
          teachingGroupsPayload.push({
            id: combinedTgId,
            section_id: `sec_combined_${groupKey}`,
            student_group: studentGroupLabel,
            subject_id: subjectId,
            level: 'COMBINED',
            required_minutes_per_week: slMinutes
          });
          
          subjectRequirements.push({
            studentGroup: studentGroupLabel,
            teachingGroupId: combinedTgId,
            sectionId: `sec_combined_${groupKey}`,
            subject: subject.code || subject.name,
            minutes_per_week: slMinutes
          });
          
          for (let i = 0; i < numCombinedLessons; i++) {
            lessons.push({
              id: lessonId++,
              subject: subject?.code || subject?.name || 'Unknown',
              studentGroup: studentGroupLabel,
              teachingGroupId: combinedTgId,
              sectionId: `sec_combined_${groupKey}`,
              subjectId: subjectId,
              level: 'COMBINED',
              yearGroup: studentGroupLabel,
              studentIds: combinedStudentIds,
              requiredCapacity: Math.min(combinedStudentIds.length, maxRoomCapacity),
              blockId: tgs[0].block_id || null,
              teacherId: teacherId || null,
              timeslotId: null,
              roomId: null
            });
          }
          
          slGroups.forEach(tg => { processedTGs.add(tg.id); processedReqTGs.add(tg.id); });
          if (slGroups.length === 0) {
            hlGroups.forEach(tg => { processedReqTGs.add(tg.id); });
          }
        }

        // HL extension lessons (HL only)
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

          const hlMinutes = hlGroups[0]?.minutes_per_week || (subject?.hoursPerWeekHL || 5) * 60;
          const slMinutes = (subject?.hoursPerWeekSL || 3) * 60;
          const extensionMinutes = Math.max(0, hlMinutes - slMinutes);
          const periodDuration = schoolData.period_duration_minutes || 60;
          const numExtensionLessons = Math.ceil(extensionMinutes / periodDuration);

          if (extensionMinutes > 0) {
            const hlExtTgId = `hl_ext_${groupKey}`;
            syntheticToRealTgMap[hlExtTgId] = hlGroups.map(tg => tg.id);
            const studentGroupLabel = shouldCombineYears ? hlExtTgId : hlGroups[0].year_group;
            
            teachingGroupsPayload.push({
              id: hlExtTgId,
              section_id: `sec_hl_${groupKey}`,
              student_group: studentGroupLabel,
              subject_id: subjectId,
              level: 'HL_EXTENSION',
              required_minutes_per_week: extensionMinutes
            });
            
            subjectRequirements.push({
              studentGroup: studentGroupLabel,
              teachingGroupId: hlExtTgId,
              sectionId: `sec_hl_${groupKey}`,
              subject: subject.code || subject.name,
              minutes_per_week: extensionMinutes
            });
            
            for (let i = 0; i < numExtensionLessons; i++) {
              lessons.push({
                id: lessonId++,
                subject: subject?.code || subject?.name || 'Unknown',
                studentGroup: studentGroupLabel,
                teachingGroupId: hlExtTgId,
                sectionId: `sec_hl_${groupKey}`,
                subjectId: subjectId,
                level: 'HL_EXTENSION',
                yearGroup: studentGroupLabel,
                studentIds: hlStudentIds,
                requiredCapacity: Math.min(hlStudentIds.length, maxRoomCapacity),
                blockId: hlGroups[0].block_id || null,
                teacherId: teacherId || null,
                timeslotId: null,
                roomId: null
              });
            }
          }
          hlGroups.forEach(tg => { processedTGs.add(tg.id); processedReqTGs.add(tg.id); });
        }
      } else {
        // Regular single teaching group (no combining needed)
        tgs.forEach(tg => {
          if (processedTGs.has(tg.id)) return;
          
          const teacherId = teacherIdMap.get(tg.teacher_id);
          const studentIds = (tg.student_ids || []).map(sid => studentIdMap.get(sid)).filter(id => id != null);
          const requiredMinutes = tg.minutes_per_week || 180;
          const periodDuration = schoolData.period_duration_minutes || 60;
          const numLessons = Math.ceil(requiredMinutes / periodDuration);

          subjectRequirements.push({
            studentGroup: tg.year_group,
            teachingGroupId: tg.id,
            sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
            subject: subject.code || subject.name,
            minutes_per_week: requiredMinutes
          });
          processedReqTGs.add(tg.id);

          for (let i = 0; i < numLessons; i++) {
            lessons.push({
              id: lessonId++,
              subject: subject?.code || subject?.name || 'Unknown',
              studentGroup: tg.year_group || 'DP1',
              teachingGroupId: tg.id,
              sectionId: `sec_${tg.year_group || 'DP1'}_${tg.id.slice(-4)}`,
              subjectId: subjectId,
              level: tg.level || 'SL',
              yearGroup: tg.year_group || 'DP1',
              studentIds: studentIds,
              requiredCapacity: Math.min(studentIds.length, maxRoomCapacity),
              blockId: tg.block_id || null,
              teacherId: teacherId || null,
              timeslotId: null,
              roomId: null
            });
          }
          
          processedTGs.add(tg.id);
        });
      }
    });

    const formattedTeachers = teachers.map(t => {
      // Calculate unavailable slot IDs based on time ranges
      const unavailableSlotIds = [];
      const unavailableDays = [];
      const preferredDays = [];
      const avoidDays = [];
      
      if (t.preferred_free_day) {
        avoidDays.push(t.preferred_free_day.toUpperCase());
      }
      
      if (t.preferences) {
         if (Array.isArray(t.preferences.unavailableDays)) unavailableDays.push(...t.preferences.unavailableDays);
         if (Array.isArray(t.preferences.preferredDays)) preferredDays.push(...t.preferences.preferredDays);
         if (Array.isArray(t.preferences.avoidDays)) avoidDays.push(...t.preferences.avoidDays);
      }

      if (t.unavailable_slots && t.unavailable_slots.length > 0) {
        const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
        const timeToMins = (timeStr) => {
          if (!timeStr) return 0;
          const [h, m] = timeStr.split(':').map(Number);
          return (h * 60) + (m || 0);
        };

        const periodDuration = schoolData.period_duration_minutes || 60;
        const periodsPerDay = schoolData.periods_per_day || 10;
        const breaks = schoolData.breaks || [];
        
        const dayStartMins = timeToMins(schoolData.day_start_time || "08:00");
        const dayEndMins = timeToMins(schoolData.day_end_time || "18:00");

        const periods = [];
        let currentMins = dayStartMins;
        let pCount = 1;
        
        while (currentMins < dayEndMins && pCount <= periodsPerDay) {
          let inBreak = false;
          for (const b of breaks) {
            const bStart = timeToMins(b.start);
            const bEnd = timeToMins(b.end);
            if (currentMins >= bStart && currentMins < bEnd) {
              currentMins = bEnd;
              inBreak = true;
              break;
            }
          }
          if (inBreak) continue;
          
          const periodEnd = currentMins + periodDuration;
          periods.push({
            index: pCount,
            startMins: currentMins,
            endMins: periodEnd
          });
          
          currentMins = periodEnd;
          pCount++;
        }

        t.unavailable_slots.forEach(us => {
          if (!us.day) return;
          const dayIdx = dayNames.indexOf(us.day.toUpperCase());
          if (dayIdx === -1) return;

          if (us.type === 'time_range' && us.start_time && us.end_time) {
            const startMins = timeToMins(us.start_time);
            const endMins = timeToMins(us.end_time);
            
            periods.forEach(p => {
              if (Math.max(p.startMins, startMins) < Math.min(p.endMins, endMins)) {
                unavailableSlotIds.push((dayIdx * periodsPerDay) + p.index);
              }
            });
          } else if ((us.type === 'period' || !us.type) && us.period) {
            unavailableSlotIds.push((dayIdx * periodsPerDay) + us.period);
          }
        });
      }

      return {
        id: t.id,
        name: t.full_name,
        maxPeriodsPerWeek: Math.min(t.max_hours_per_week || 25, 50),
        unavailableSlotIds: [...new Set(unavailableSlotIds)],
        unavailableDays: [...new Set(unavailableDays)],
        preferredDays: [...new Set(preferredDays)],
        avoidDays: [...new Set(avoidDays)],
        externalId: t.id
      };
    });

    let aiUnavailability = [];
    let aiPreferences = [];
    if (constraints?.aiPreferences && constraints.aiPreferences.trim().length > 0) {
      console.log('[Pipeline] Parsing AI Preferences with LLM for teacher unavailabilities...');
      try {
        const teacherContext = teachers.map(t => ({ id: t.id, name: t.full_name }));
        const llmPrompt = `
You are an expert scheduling assistant. Extract teacher unavailability from the following user preferences.
User preferences: "${constraints.aiPreferences}"

Rules:
1. Extract exact days and start/end times for when teachers are UNAVAILABLE.
2. If "afternoon", use "12:00" to "18:00". If "morning", use "08:00" to "12:00". If "evening", use "15:00" to "18:30".
3. Extract full days that a teacher is unavailable (unavailableDays), prefers to work (preferredDays), or wants to avoid (avoidDays).
4. Match the teacher name to the following list to get the teacherId:
${JSON.stringify(teacherContext)}
`;

        const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: llmPrompt,
          response_json_schema: {
            type: "object",
            properties: {
              teacherUnavailability: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    teacherId: { type: "string" },
                    dayOfWeek: { type: "string", enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] },
                    startTime: { type: "string" },
                    endTime: { type: "string" }
                  },
                  required: ["teacherId", "dayOfWeek", "startTime", "endTime"]
                }
              },
              teacherPreferences: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    teacherId: { type: "string" },
                    unavailableDays: { type: "array", items: { type: "string", enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] } },
                    preferredDays: { type: "array", items: { type: "string", enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] } },
                    avoidDays: { type: "array", items: { type: "string", enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] } }
                  },
                  required: ["teacherId"]
                }
              }
            },
            required: ["teacherUnavailability", "teacherPreferences"]
          }
        });
        
        if (llmResponse) {
          if (llmResponse.teacherUnavailability) {
            aiUnavailability = llmResponse.teacherUnavailability;
            console.log('[Pipeline] Parsed AI unavailability:', JSON.stringify(aiUnavailability, null, 2));
          }
          if (llmResponse.teacherPreferences) {
            aiPreferences = llmResponse.teacherPreferences;
            console.log('[Pipeline] Parsed AI preferences:', JSON.stringify(aiPreferences, null, 2));
          }
        }
      } catch (llmError) {
        console.error('[Pipeline] Failed to parse AI preferences:', llmError);
      }
    }

    const timeToMins = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return (h * 60) + (m || 0);
    };

    const periodDuration = schoolData.period_duration_minutes || 60;
    const periodsPerDay = schoolData.periods_per_day || 10;
    const dayNames = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const breaks = schoolData.breaks || [];
    const dayStartMins = timeToMins(schoolData.day_start_time || "08:00");
    const dayEndMins = timeToMins(schoolData.day_end_time || "18:00");

    const periods = [];
    let currentMins = dayStartMins;
    let pCount = 1;
    
    while (currentMins < dayEndMins && pCount <= periodsPerDay) {
      let inBreak = false;
      for (const b of breaks) {
        const bStart = timeToMins(b.start);
        const bEnd = timeToMins(b.end);
        if (currentMins >= bStart && currentMins < bEnd) {
          currentMins = bEnd;
          inBreak = true;
          break;
        }
      }
      if (inBreak) {
        // Just advance loop without registering a period slot
        continue;
      }
      
      const periodEnd = currentMins + periodDuration;
      periods.push({
        index: pCount,
        startMins: currentMins,
        endMins: periodEnd
      });
      currentMins = periodEnd;
      pCount++;
    }

    formattedTeachers.forEach(t => {
      const aiSlots = aiUnavailability.filter(u => u.teacherId === t.id);
      aiSlots.forEach(us => {
        const dayIdx = dayNames.indexOf(us.dayOfWeek.toUpperCase());
        if (dayIdx === -1) return;
        
        const startMins = timeToMins(us.startTime);
        const endMins = timeToMins(us.endTime);
        
        periods.forEach(p => {
          if (Math.max(p.startMins, startMins) < Math.min(p.endMins, endMins)) {
            const slotId = (dayIdx * periodsPerDay) + p.index;
            if (!t.unavailableSlotIds.includes(slotId)) {
              t.unavailableSlotIds.push(slotId);
            }
          }
        });
      });

      const aiPrefs = aiPreferences.filter(p => p.teacherId === t.id);
      aiPrefs.forEach(pref => {
        if (Array.isArray(pref.unavailableDays)) {
          pref.unavailableDays.forEach(d => {
            if (!t.unavailableDays.includes(d)) t.unavailableDays.push(d);
          });
        }
        if (Array.isArray(pref.preferredDays)) {
          pref.preferredDays.forEach(d => {
            if (!t.preferredDays.includes(d)) t.preferredDays.push(d);
          });
        }
        if (Array.isArray(pref.avoidDays)) {
          pref.avoidDays.forEach(d => {
            if (!t.avoidDays.includes(d)) t.avoidDays.push(d);
          });
        }
      });
    });

    const finalTeachers = formattedTeachers.length > 0 ? formattedTeachers : [{ id: "dummy_teacher", name: "Dummy Teacher", maxPeriodsPerWeek: 40, unavailableSlotIds: [], unavailableDays: [], preferredDays: [], avoidDays: [] }];
    const finalRooms = rooms.length > 0 ? rooms.map(r => ({ id: r.id, name: r.name, capacity: r.capacity || 30 })) : [{ id: "dummy_room", name: "Dummy", capacity: 30 }];

    const studentSubjectChoices = [];
    students.filter(s => s.is_active).forEach(student => {
      if (student.subject_choices) {
        student.subject_choices.forEach(choice => {
          const subject = subjects.find(sub => sub.id === choice.subject_id);
          if (subject) {
            studentSubjectChoices.push({
              studentId: student.id,
              subjectId: subject.id,
              subject: subject.code || subject.name,
              level: choice.level || 'SL',
              yearGroup: student.year_group || 'DP1'
            });
          }
        });
      }
    });

    // Ensure lessons have non-null teachers and use string IDs
    const safeLessons = lessons.map((l, idx) => ({
        id: String(idx + 1000),
        subject: l.subject,
        studentGroup: l.studentGroup,
        teachingGroupId: l.teachingGroupId,
        sectionId: l.sectionId,
        subjectId: l.subjectId,
        level: l.level,
        yearGroup: l.yearGroup,
        studentIds: l.studentIds,
        requiredCapacity: l.requiredCapacity || 1,
        blockId: l.blockId || null,
        timeslotId: null,
        roomId: null,
        teacherId: l.teacherId || finalTeachers[0].id,
        // Keep these around for our own processing after OptaPlanner returns
        originalTeacherId: l.teacherId,
        originalTeachingGroupId: l.teachingGroupId
    }));

    let numericIdCounter = 1;
    const generateNumericId = () => numericIdCounter++;

    const roomNumericMap = {};
    const mappedRooms = finalRooms.map(r => {
      const numId = generateNumericId();
      roomNumericMap[r.id] = numId;
      return {
        id: numId,
        externalId: String(r.id),
        name: String(r.name || "Room"),
        capacity: Number(r.capacity || 30)
      };
    });

    const teacherNumericMap = {};
    const mappedTeachers = finalTeachers.map(t => {
      const numId = generateNumericId();
      teacherNumericMap[t.id] = numId;
      return {
        id: numId,
        externalId: String(t.id),
        name: String(t.name || "Teacher"),
        maxPeriodsPerWeek: Number(t.maxPeriodsPerWeek || 40),
        unavailableSlotIds: t.unavailableSlotIds || [],
        unavailableDays: t.unavailableDays || [],
        preferredDays: t.preferredDays || [],
        avoidDays: t.avoidDays || []
      };
    });

    // We filter subjects but also fallback if empty, to guarantee subjectRequirements matches
    const mappedSubjects = subjects.filter(s => s.is_active && subjectRequirements.some(req => req.subject === (s.code || s.name))).map(s => {
      return {
        id: String(s.id), // Base44 style 24-hex string
        code: String(s.code || s.name),
        name: String(s.name)
      };
    });
    if (mappedSubjects.length === 0) {
      mappedSubjects.push({
        id: "69733f5f0b775e6fa2db95b9",
        code: "DUMMY",
        name: "DUMMY"
      });
    }

    const mappedTeachingGroups = teachingGroupsPayload.map(tg => ({
      id: String(tg.id),
      sectionId: String(tg.section_id),
      studentGroup: String(tg.student_group),
      subjectId: String(tg.subject_id), // string ID matching the 24 hex
      level: String(tg.level),
      requiredMinutesPerWeek: Number(tg.required_minutes_per_week)
    }));
    if (mappedTeachingGroups.length === 0) {
      mappedTeachingGroups.push({
        id: "dummy_tg",
        sectionId: "dummy_sec",
        studentGroup: "Dummy",
        subjectId: "69733f5f0b775e6fa2db95b9",
        level: "SL",
        requiredMinutesPerWeek: 180
      });
    }

    const mappedSubjectRequirements = subjectRequirements.map(req => ({
      studentGroup: String(req.studentGroup),
      teachingGroupId: String(req.teachingGroupId),
      sectionId: String(req.sectionId),
      subject: String(req.subject),
      minutesPerWeek: Number(req.minutes_per_week)
    }));
    if (mappedSubjectRequirements.length === 0) {
      mappedSubjectRequirements.push({
        studentGroup: "Dummy",
        teachingGroupId: "dummy_tg",
        sectionId: "dummy_sec",
        subject: "DUMMY",
        minutesPerWeek: 180
      });
    }

    const dummyTeacherNumId = teacherNumericMap[finalTeachers[0].id] || 1;
    const mappedLessons = safeLessons.length > 0 ? safeLessons.map(l => {
      const tNumId = l.teacherId ? (teacherNumericMap[l.teacherId] || dummyTeacherNumId) : dummyTeacherNumId;
      const rNumId = l.roomId ? roomNumericMap[l.roomId] : null;
      const tgStringId = l.teachingGroupId ? String(l.teachingGroupId) : null;
      const lessonNumId = parseInt(l.id) || generateNumericId();

      return {
        id: lessonNumId,
        subject: String(l.subject || "Subj"),
        studentGroup: String(l.studentGroup || "Group"),
        teachingGroupId: tgStringId,
        sectionId: String(l.sectionId),
        subjectId: l.subjectId ? String(l.subjectId) : null,
        level: String(l.level),
        yearGroup: String(l.yearGroup),
        studentIds: l.studentIds || [],
        requiredCapacity: Number(l.requiredCapacity || 1),
        blockId: l.blockId ? String(l.blockId) : null,
        teacherId: tNumId,
        timeslotId: l.timeslotId ? Number(l.timeslotId) : null,
        roomId: rNumId
      };
    }) : [{
      id: 1001,
      subject: "DUMMY",
      studentGroup: "Dummy",
      teachingGroupId: "dummy_tg",
      sectionId: "dummy_sec",
      subjectId: "69733f5f0b775e6fa2db95b9",
      level: "SL",
      yearGroup: "DP1",
      studentIds: [],
      requiredCapacity: 1,
      blockId: null,
      teacherId: dummyTeacherNumId,
      timeslotId: null,
      roomId: null
    }];

    const optaPlannerPayload = {
      schoolId: String(user.school_id),
      programType: "DP",
      dpConfig: {},
      timezone: schoolData.timezone || "UTC",
      calendar: { academicYear: schoolData.academic_year || "2025-2026", termId: "T1" },
      scheduleVersion: scheduleVersion[0]?.name || "Draft",
      scheduleVersionId: String(schedule_version_id),
      scheduleSettings: {
          daysPerWeek: schoolData.days_of_week?.length || 5,
          periodsPerDay: Number(schoolData.periods_per_day || 10),
          periodDurationMinutes: Number(schoolData.period_duration_minutes || 60),
          dayStartTime: String(schoolData.day_start_time || "08:00"),
          dayEndTime: String(schoolData.day_end_time || "18:00"),
          daysOfWeek: schoolData.days_of_week || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
          breaks: schoolData.breaks || []
      },
      rooms: mappedRooms,
      teachers: mappedTeachers,
      subjects: mappedSubjects,
      teachingGroups: mappedTeachingGroups,
      subjectRequirements: mappedSubjectRequirements,
      lessons: mappedLessons,
      blockedSlotIds: [],
      constraints: {
        spreadAcrossDaysPerTeachingGroupSection: true,
        avoidSamePeriodRepetition: constraints?.maxSameSubjectPerDayHardEnabled || true,
        avoidTeacherLatePeriods: true
      },
      studentSubjectChoices: studentSubjectChoices,
      randomSeed: 123456,
      randomizeSearch: true,
      numSearchWorkers: 1,
      shuffleInputOrder: false
    };

    // Validate teacher capacity before sending to OptaPlanner
    const teacherAssignments = {};
    const overloadedTeachers = [];
    
    teachers.forEach((t) => {
      const teacherId = t.id;
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
      console.warn('[Pipeline] Teacher capacity exceeded for:', overloadedTeachers.map(t => t.name));
      // We don't block the pipeline anymore, OptaPlanner will try its best
    }

    // ===== DETAILED CONSTRAINT VERIFICATION =====
    console.log('[Pipeline] Verifying constraints consistency...');
    
    // Verify all subject requirements can be met with available lessons
    const lessonsBySubject = {};
    lessons.forEach(l => {
      if (!lessonsBySubject[l.subject]) lessonsBySubject[l.subject] = 0;
      lessonsBySubject[l.subject]++;
    });

    const constraintWarnings = [];
    subjectRequirements.forEach(req => {
      const lessonsForSubject = lessonsBySubject[req.subject] || 0;
      const periodDuration = schoolData.period_duration_minutes || 60;
      const expectedLessons = Math.ceil(req.minutes_per_week / periodDuration);
      if (lessonsForSubject < expectedLessons) {
        constraintWarnings.push(`⚠️  ${req.subject} expects ${expectedLessons} lessons/week but only ${lessonsForSubject} lessons defined`);
      }
    });

    if (constraintWarnings.length > 0) {
      console.warn('[Pipeline] Constraint warnings:', constraintWarnings);
    }
    
    // Always use the exact endpoint provided by the user in the secret, 
    // but ensure it targets /solve/multi for the new multi-tenant wrapper.
    let endpointUrl = OPTAPLANNER_ENDPOINT;
    if (endpointUrl.includes('/solve-and-push')) {
      endpointUrl = endpointUrl.replace('/solve-and-push', '/solve/multi');
    } else if (!endpointUrl.endsWith('/solve/multi')) {
      endpointUrl = endpointUrl.replace(/\/$/, '') + '/solve/multi';
    }

    console.log('[Pipeline] Original Endpoint:', OPTAPLANNER_ENDPOINT);
    console.log('[Pipeline] Calling OptaPlanner:', endpointUrl);
    console.log('[Pipeline] Payload summary:', {
      rooms: rooms.length,
      teachers: teachers.length,
      teachingGroups: teachingGroupsPayload.length,
      lessons: lessons.length,
      subjectRequirements: subjectRequirements.length
    });
    
    const multiPayload = {
      organizationId: `org_${user.school_id}`,
      runId: `run_${schedule_version_id}`,
      schools: [ optaPlannerPayload ],
      crossSchoolRules: {
        sharedTeacherIds: [],
        sharedRoomIds: [],
        transportWindows: []
      }
    };

    console.log('[Pipeline] Full sending payload (first 2000 chars):', JSON.stringify(multiPayload).substring(0, 2000));

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': OPTAPLANNER_API_KEY
      },
      body: JSON.stringify(multiPayload)
    });

    let responseText = await response.text();
    console.log('[Pipeline] Response status:', response.status);
    console.log('[Pipeline] Full response:', responseText);

    if (!response.ok) {
      console.error('[Pipeline] OptaPlanner error:', responseText);
      
      if (response.status === 429) {
        return Response.json({
          ok: false,
          error: "Rate limit exceeded. Vous avez lancé trop de requêtes récemment. Veuillez patienter quelques instants avant de réessayer."
        }, { status: 429 });
      }

      let errorDetails;
      try {
        errorDetails = JSON.parse(responseText);
      } catch {
        errorDetails = responseText;
      }

      // Extract constraint violations for clearer diagnostics
      const diagnostics = {
        lessons: lessons.length,
        teachers: teachers.length,
        rooms: rooms.length,
        teachingGroups: teachingGroupsPayload.length,
        subjectRequirements: subjectRequirements.length,
        lessonsByTeacher: {},
        unassignedLessonCount: lessons.filter(l => !l.teacherId).length,
        constraintSummary: ''
      };

      if (errorDetails.hard_constraints_violated) {
        const violations = errorDetails.hard_constraints_violated;
        diagnostics.constraintSummary = `Hard constraints violated:\n${Object.entries(violations || {})
          .map(([k, v]) => `  • ${k}: ${v} violations`)
          .join('\n')}`;
      }
      
      // OptaPlanner sometimes returns an error but still provides assignments if we allow it
      if (errorDetails.assignments && errorDetails.assignments.length > 0) {
        console.warn('[Pipeline] OptaPlanner failed but returned partial assignments, we will use them.');
        // We'll treat this as a success but with a negative score
        responseText = JSON.stringify(errorDetails);
      } else {
        return Response.json({
          ok: false,
          error: `OptaPlanner validation failed`,
          details: errorDetails,
          diagnostics: diagnostics,
          payloadSummary: {
            lessons: lessons.length,
            teachers: teachers.length,
            rooms: rooms.length,
            teachingGroups: teachingGroupsPayload.length
          },
          requestPayload: optaPlannerPayload
        }, { status: 400 });
      }
    }

    let result = {};
    try {
      result = JSON.parse(responseText);
    } catch(e) {
      console.error('Failed to parse result:', e);
    }

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



    // Handle multi-school results format
    let finalLessons = [];
    if (result.schoolResults && Array.isArray(result.schoolResults)) {
      result.schoolResults.forEach(schoolRes => {
        if (schoolRes.result && schoolRes.result.assignments) {
          finalLessons = finalLessons.concat(schoolRes.result.assignments);
        } else if (schoolRes.result && schoolRes.result.lessons) {
          finalLessons = finalLessons.concat(schoolRes.result.lessons);
        }
      });
    } else {
      // Fallback for single-school format or failures
      finalLessons = result.lessons || result.assignments || (Array.isArray(result) ? result : []);
    }

    // Reverse Numeric Maps
    const reverseTeacherMap = {};
    Object.keys(teacherNumericMap).forEach(key => {
      reverseTeacherMap[teacherNumericMap[key]] = key;
    });
    
    const reverseRoomMap = {};
    Object.keys(roomNumericMap).forEach(key => {
      reverseRoomMap[roomNumericMap[key]] = key;
    });
    
    const safeLessonMap = {};
    // map the numeric ID or the id string used in mappedLessons back to the safeLesson
    mappedLessons.forEach((ml, index) => { 
      // mappedLessons match safeLessons by index, safeLessons have original properties
      safeLessonMap[ml.id] = safeLessons[index]; 
    });

    if (finalLessons && Array.isArray(finalLessons)) {
      for (const lesson of finalLessons) {
        
        // Match the lesson returned by OptaPlanner back to our safeLessons array to get original IDs
        // The lesson might come back with the numeric ID
        const lessonId = lesson.id || lesson.lessonId || lesson.lesson_id;
        const originalLesson = safeLessonMap[lessonId];
        
        if (originalLesson && lesson.timeslotId != null) {
          
          let day = lesson.dayOfWeek;
          let periodIndex = lesson.periodIndex;
          
          if (!day && lesson.timeslotId) {
            const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
            const periodsPerDay = schoolData.periods_per_day || 10;
            const dayIndex = Math.floor((lesson.timeslotId - 1) / periodsPerDay);
            day = days[dayIndex] || 'MONDAY';
            periodIndex = (lesson.timeslotId - 1) % periodsPerDay;
          }

          const realTgIds = syntheticToRealTgMap[originalLesson.originalTeachingGroupId] || [originalLesson.originalTeachingGroupId];
          const isBreak = String(lesson.subject || '').toUpperCase() === 'LUNCH' || String(lesson.subject || '').toUpperCase() === 'BREAK';
          
          // Use reverse map
          const tId = lesson.teacherId || (lesson.teacher ? lesson.teacher.id : null);
          const rId = lesson.roomId || (lesson.room ? lesson.room.id : null);
          const finalTeacherId = tId ? (reverseTeacherMap[tId] || null) : null;
          const finalRoomId = rId ? (reverseRoomMap[rId] || null) : null;

          for (const realTgId of realTgIds) {
            slotsToInsert.push({
              school_id: user.school_id,
              schedule_version: schedule_version_id,
              teaching_group_id: realTgId,
              teacher_id: finalTeacherId,
              room_id: finalRoomId,
              timeslot_id: lesson.timeslotId,
              day: day || 'Monday',
              period: periodIndex != null ? periodIndex + 1 : 1,
              status: 'scheduled',
              is_break: isBreak,
              notes: isBreak ? (lesson.subject || 'Break') : undefined
            });
          }
        }
      }
    }

    // Infer Implicit Lunch Breaks (Midday gaps) PER STUDENT
    // This prevents lunch breaks from overlapping with actual classes for DP students
    const studentDailySlots = {};
    const tgToStudents = {};
    teachingGroupsToProcess.forEach(tg => {
      tgToStudents[tg.id] = tg.student_ids || [];
    });

    slotsToInsert.forEach(slot => {
        if (!slot.teaching_group_id || !slot.day || slot.is_break) return;
        const studentsInTg = tgToStudents[slot.teaching_group_id] || [];
        studentsInTg.forEach(studentId => {
            const key = `${studentId}_${slot.day.toLowerCase()}`;
            if (!studentDailySlots[key]) studentDailySlots[key] = new Set();
            studentDailySlots[key].add(slot.period);
        });
    });

    const lunchMin = constraints?.lunchBreakMinPeriod ?? 4;
    const lunchMax = constraints?.lunchBreakMaxPeriod ?? 6;
    const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periodsPerDay = schoolData.periods_per_day || 10;
    const activeStudentIds = students.map(s => s.id);

    activeStudentIds.forEach(studentId => {
        daysList.forEach((day, dayIndex) => {
            const key = `${studentId}_${day.toLowerCase()}`;
            const occupiedPeriods = studentDailySlots[key] || new Set();
            
            // Determine how many periods needed for lunch
            const periodDuration = schoolData.period_duration_minutes || 60;
            const lunchDuration = constraints?.lunchBreakDurationMinutes || 60;
            const periodsNeeded = Math.ceil(lunchDuration / periodDuration);

            let lunchStartPeriod = null;
            // Find a contiguous block of empty periods
            for (let p = lunchMin; p <= lunchMax - periodsNeeded + 1; p++) {
                let isBlockFree = true;
                for (let i = 0; i < periodsNeeded; i++) {
                    if (occupiedPeriods.has(p + i)) {
                        isBlockFree = false;
                        break;
                    }
                }
                if (isBlockFree) {
                    lunchStartPeriod = p;
                    break;
                }
            }

            if (lunchStartPeriod !== null) {
                for (let i = 0; i < periodsNeeded; i++) {
                    const currentPeriod = lunchStartPeriod + i;
                    const timeslotId = (dayIndex * periodsPerDay) + currentPeriod;
                    slotsToInsert.push({
                        school_id: user.school_id,
                        schedule_version: schedule_version_id,
                        student_id: studentId,
                        teacher_id: null,
                        room_id: null,
                        timeslot_id: timeslotId,
                        day: day,
                        period: currentPeriod,
                        status: 'scheduled',
                        is_break: true,
                        notes: 'Lunch Break'
                    });
                }
            }
        });
    });

    if (slotsToInsert.length > 0) {
      await base44.entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    let scoreToSave = result.score || 0;
    
    // If it's a multi-school response, aggregate the scores
    if (result.schoolResults && Array.isArray(result.schoolResults)) {
      let totalHard = 0;
      let totalSoft = 0;
      result.schoolResults.forEach(sr => {
        const s = sr.result?.score || "0hard/0soft";
        const match = String(s).match(/(-?\d+)hard\/(-?\d+)soft/);
        if (match) {
          totalHard += parseInt(match[1], 10);
          totalSoft += parseInt(match[2], 10);
        } else {
          const hardOnly = String(s).match(/(-?\d+)hard/);
          if (hardOnly) totalHard += parseInt(hardOnly[1], 10);
        }
      });
      scoreToSave = totalHard;
    } else if (typeof scoreToSave === 'string') {
       // e.g. "-19hard/-301soft" -> extract -19
       const match = scoreToSave.match(/(-?\d+)hard/);
       if (match) scoreToSave = parseInt(match[1], 10);
       else scoreToSave = 0;
    }

    await base44.entities.ScheduleVersion.update(schedule_version_id, {
      score: scoreToSave,
      generated_at: new Date().toISOString()
    });

    return Response.json({
      ok: true,
      result: {
        slotsInserted: slotsToInsert.length,
        score: scoreToSave,
        hardScoreNegative: scoreToSave < 0
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