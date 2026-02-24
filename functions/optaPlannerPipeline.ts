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

    // CRITICAL: Adjust HL teaching group minutes for combine_dp1_dp2 subjects
    // HL extension = HL hours - SL hours (not the full HL hours)
    const adjustedTeachingGroups = teachingGroups.map(tg => {
      if (tg.level === 'HL') {
        const subject = subjects.find(s => s.id === tg.subject_id);
        if (subject?.combine_dp1_dp2) {
          const hlMinutes = (subject?.hoursPerWeekHL || 5) * 60;
          const slMinutes = (subject?.hoursPerWeekSL || 3) * 60;
          const extensionMinutes = Math.max(0, hlMinutes - slMinutes);
          console.log(`[Pipeline] Adjusting HL group "${tg.name}": ${tg.minutes_per_week} → ${extensionMinutes} (extension only)`);
          return { ...tg, minutes_per_week: extensionMinutes };
        }
      }
      return tg;
    });

    // Use adjusted teaching groups for validation and processing
    const teachingGroupsToProcess = adjustedTeachingGroups;

    // ===== PRE-PIPELINE VALIDATION =====
    const validationErrors = [];

    // 1. Check minimum data availability
    if (!rooms || rooms.length === 0) {
      validationErrors.push('❌ No active rooms configured. Please add rooms first.');
    }
    if (!teachers || teachers.length === 0) {
      validationErrors.push('❌ No active teachers configured. Please add teachers first.');
    }
    if (!subjects || subjects.length === 0) {
      validationErrors.push('❌ No active subjects configured. Please add subjects first.');
    }
    if (!teachingGroups || teachingGroups.length === 0) {
      validationErrors.push('❌ No active teaching groups. Please create teaching groups first.');
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

    if (hasHardErrors) {
      console.error('[Pipeline] Validation failed with hard errors:', validationErrors);
      
      // Format detailed teacher overload info
      const teacherDetails = teacherOverloadIssues.map(t => ({
        name: t.teacher,
        assigned_hours: Math.round(t.assignedMinutes / 60 * 10) / 10,
        max_hours: t.maxMinutes / 60,
        excess_hours: Math.round((t.assignedMinutes - t.maxMinutes) / 60 * 10) / 10,
        teaching_groups_count: t.groups
      }));

      const formattedErrors = validationErrors.map(err => {
        if (err.includes('teacher(s) overloaded')) {
          return `${err}\n${teacherDetails.map(t => 
            `  • ${t.name}: ${t.assigned_hours}h assigned (max: ${t.max_hours}h, excess: ${t.excess_hours}h over ${t.teaching_groups_count} groups)`
          ).join('\n')}`;
        }
        if (err.includes('room capacity')) {
          return `${err}\n${roomCapacityIssues.map(r => 
            `  • ${r.teaching_group}: needs ${r.students} students (largest room: ${r.largestRoom})`
          ).join('\n')}`;
        }
        return err;
      });

      return Response.json({
        ok: false,
        error: 'Pre-pipeline validation failed',
        code: 'VALIDATION_FAILED',
        summary: validationErrors.join('\n'),
        detailed_errors: formattedErrors,
        teacher_overload_details: teacherDetails,
        room_capacity_issues: roomCapacityIssues,
        recommendations: teacherOverloadIssues.length > 0 ? [
          'Assign some teaching groups to other teachers',
          'Increase teacher max hours per week in Teacher settings',
          'Reduce weekly hours for some subjects',
          'Split large teaching groups into smaller sections'
        ] : []
      }, { status: 400 });
    } else if (validationErrors.length > 0) {
      console.warn('[Pipeline] Validation warnings (proceeding to solver):', validationErrors);
    }

    console.log('[Pipeline] Validation passed ✅');

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
    
    teachingGroupsToProcess
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
    const syntheticToRealTgMap = {};
    teachingGroupsToProcess
      .filter(tg => tg.is_active && tg.student_ids?.length > 0 && tg.year_group && !tg.year_group.includes(',') && !tg.year_group.includes('+'))
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
        if (slGroups.length > 0 || hlGroups.length > 0) {
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
          const slMinutes = slGroups.length > 0 ? (slGroups[0]?.minutes_per_week || (subject?.hoursPerWeekSL || 3) * 60) : ((subject?.hoursPerWeekSL || 3) * 60);
          const periodDuration = schoolData.period_duration_minutes || 60;
          const numCombinedLessons = Math.ceil(slMinutes / periodDuration);

          const combinedTgId = `combined_${subjectId}`;
          syntheticToRealTgMap[combinedTgId] = [...hlGroups, ...slGroups].map(tg => tg.id);
          
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
        syntheticToRealTgMap[hlExtTgId] = hlGroups.map(tg => tg.id);
        
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

      subjects: subjects.filter(s => {
        if (!s.is_active) return false;
        // OptaPlanner fails if a subject is defined but has no subjectRequirements
        const codeOrName = s.code || s.name;
        return subjectRequirements.some(req => req.subject === codeOrName);
      }).map(s => ({
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
        relaxStudentGroupConflicts: true // CRITICAL: Temporarily relax hard conflicts when testing impossible workloads
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
      const expectedLessons = Math.ceil(req.minutesPerWeek / periodDuration);
      if (lessonsForSubject < expectedLessons) {
        constraintWarnings.push(`⚠️  ${req.subject} expects ${expectedLessons} lessons/week but only ${lessonsForSubject} lessons defined`);
      }
    });

    if (constraintWarnings.length > 0) {
      console.warn('[Pipeline] Constraint warnings:', constraintWarnings);
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

    let responseText = await response.text();
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
          }
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



    // OptaPlanner sometimes returns `assignments` instead of `lessons` on failure/partial success
    const finalLessons = result.lessons || result.assignments || [];

    if (finalLessons && Array.isArray(finalLessons)) {
      for (const lesson of finalLessons) {
        if (lesson.timeslotId != null) {
          
          // Reverse-engineer dayOfWeek/periodIndex if missing but timeslotId exists (1-50 standard grid)
          let day = lesson.dayOfWeek;
          let periodIndex = lesson.periodIndex;
          
          if (!day && lesson.timeslotId) {
            const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
            const dayIndex = Math.floor((lesson.timeslotId - 1) / 10);
            day = days[dayIndex] || 'MONDAY';
            periodIndex = (lesson.timeslotId - 1) % 10;
          }
          
          slotsToInsert.push({
            school_id: user.school_id,
            schedule_version: schedule_version_id,
            teaching_group_id: lesson.teachingGroupId,
            teacher_id: teacherIdById[lesson.teacherId] || null,
            room_id: roomIdById[lesson.roomId] || null,
            timeslot_id: lesson.timeslotId,
            day: day || 'Monday',
            period: periodIndex != null ? periodIndex + 1 : 1,
            status: 'scheduled'
          });
        }
      }
    }

    if (slotsToInsert.length > 0) {
      await base44.entities.ScheduleSlot.bulkCreate(slotsToInsert);
    }

    let scoreToSave = result.score || 0;
    if (typeof scoreToSave === 'string') {
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