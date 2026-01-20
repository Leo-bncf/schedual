import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserSchoolId } from './securityHelper.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { schedule_version_id, programmes = ['DP', 'MYP', 'PYP'] } = body;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    const schoolId = await getUserSchoolId(base44);

    // Load all data in parallel
    const [school, students, teachers, rooms, subjects, scheduleVersion, constraints] = await Promise.all([
      base44.entities.School.filter({ id: schoolId }).then(d => d[0]),
      base44.entities.Student.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId }),
      base44.entities.Room.filter({ school_id: schoolId }),
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id }).then(d => d[0]),
      base44.entities.Constraint.filter({ school_id: schoolId })
    ]);

    console.log('=== SCHEDULE ENGINE START ===');
    console.log(`School: ${schoolId}, Programmes: ${programmes.join(', ')}`);

    // Validate data
    const activeStudents = students.filter(s => s.is_active !== false && programmes.includes(s.ib_programme));
    const activeTeachers = teachers.filter(t => t.is_active !== false);
    const activeRooms = rooms.filter(r => r.is_active !== false);

    if (activeStudents.length === 0) {
      return Response.json({ error: 'No active students found', stage: 'validation' }, { status: 400 });
    }

    console.log(`Active: ${activeStudents.length} students, ${activeTeachers.length} teachers, ${activeRooms.length} rooms`);

    // Step 1: Generate groups dynamically by analysing student choices
    const groupsToCreate = [];
    const groupMap = new Map(); // key: subject_id__year_group__group_type -> group data

    const getIBLevel = (yearGroup) => {
      if (!yearGroup) return null;
      if (yearGroup.startsWith('DP')) return 'DP';
      if (yearGroup.startsWith('MYP')) return 'MYP';
      if (yearGroup.startsWith('PYP')) return 'PYP';
      return null;
    };

    // Group DP students by subject + level
    activeStudents
      .filter(s => s.ib_programme === 'DP' && programmes.includes('DP'))
      .forEach(student => {
        const choices = Array.isArray(student.subject_choices) ? student.subject_choices : [];
        if (choices.length === 0) {
          console.warn(`Student ${student.full_name} has no subject choices`);
          return;
        }
        choices.forEach(choice => {
          if (!choice.subject_id) return;
          const subject = subjects.find(s => s.id === choice.subject_id);
          if (!subject) return;

          const isHL = choice.level === 'HL';
          const yearGroup = student.year_group || 'DP1';
          const slHours = subject.sl_hours_per_week || 4;
          const hlHours = subject.hl_hours_per_week || 6;

          // Shared group: all students (SL+HL) learning SL content
          if (slHours > 0) {
            const sharedKey = `${choice.subject_id}__${yearGroup}__shared`;
            if (!groupMap.has(sharedKey)) {
              groupMap.set(sharedKey, {
                subject_id: choice.subject_id,
                subject_name: subject.name,
                year_group: yearGroup,
                group_type: 'shared',
                level: 'SL',
                hours_per_week: slHours,
                student_ids: new Set()
              });
            }
            groupMap.get(sharedKey).student_ids.add(student.id);
          }

          // HL-only group: only HL students, HL extension hours
          if (isHL && (hlHours - slHours) > 0) {
            const hlOnlyKey = `${choice.subject_id}__${yearGroup}__hl_only`;
            if (!groupMap.has(hlOnlyKey)) {
              groupMap.set(hlOnlyKey, {
                subject_id: choice.subject_id,
                subject_name: subject.name,
                year_group: yearGroup,
                group_type: 'hl_only',
                level: 'HL',
                hours_per_week: hlHours - slHours,
                student_ids: new Set()
              });
            }
            groupMap.get(hlOnlyKey).student_ids.add(student.id);
          }
        });
      });

    // Convert to array and prepare for creation
    groupMap.forEach((groupData, key) => {
      const studentIds = Array.from(groupData.student_ids);
      if (studentIds.length === 0) return;

      // Find best teacher for this group
      const subject = subjects.find(s => s.id === groupData.subject_id);
      let bestTeacher = null;
      if (subject) {
        const candidates = activeTeachers
          .filter(t => {
            const quals = Array.isArray(t.qualifications) ? t.qualifications : [];
            return quals.some(q => q.subject_id === subject.id);
          })
          .sort((a, b) => (a.subjects?.length || 0) - (b.subjects?.length || 0));
        bestTeacher = candidates[0];
      }

      groupsToCreate.push({
        school_id: schoolId,
        name: `${groupData.subject_name} (${groupData.group_type === 'shared' ? 'SL+HL' : 'HL'}) - ${groupData.year_group}`,
        subject_id: groupData.subject_id,
        level: groupData.level,
        year_group: groupData.year_group,
        group_type: groupData.group_type,
        student_ids: studentIds,
        teacher_id: bestTeacher?.id || null,
        hours_per_week: groupData.hours_per_week,
        is_active: true,
        min_students: 1,
        max_students: 20
      });
    });

    console.log(`Generated ${groupsToCreate.length} DP groups with teacher assignments`);

    // Step 2: Create groups
    let createdGroups = [];
    if (groupsToCreate.length > 0) {
      createdGroups = await base44.entities.TeachingGroup.bulkCreate(groupsToCreate);
    }

    // Step 3: Generate schedule slots using created groups
    const schoolConfig = {
      periods_per_day: school?.periods_per_day || 8,
      period_duration_minutes: school?.period_duration_minutes || 45,
      days_per_week: school?.days_per_week || 5,
      break_periods: school?.settings?.break_periods || [2, 6],
      lunch_period: school?.settings?.lunch_period || 4
    };

    const slots = generateScheduleSlots(
      createdGroups,
      schoolId,
      schedule_version_id,
      schoolConfig,
      subjects,
      teachers,
      rooms,
      activeStudents,
      constraints
    );

    console.log(`Generated ${slots.length} schedule slots`);

    // Step 4: Bulk create slots
    let createdSlots = [];
    if (slots.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < slots.length; i += batchSize) {
        const batch = slots.slice(i, i + batchSize);
        const created = await base44.entities.ScheduleSlot.bulkCreate(batch);
        createdSlots.push(...created);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`Created ${createdSlots.length} schedule slots`);

    // Update schedule version with stats
    await base44.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      score: Math.floor((createdSlots.length / (groupsToCreate.length * 6)) * 100) || 0,
      conflicts_count: 0,
      warnings_count: 0,
      notes: `Generated ${groupsToCreate.length} groups and ${createdSlots.length} slots`
    });

    return Response.json({
      success: true,
      groups_created: createdGroups.length,
      slots_created: createdSlots.length,
      message: `Generated schedule with ${createdGroups.length} groups and ${createdSlots.length} slots`
    });
  } catch (error) {
    console.error('Schedule engine error:', error.message);
    return Response.json({ error: error.message, stage: 'execution' }, { status: 500 });
  }
});

// Helper: Generate schedule slots
function generateScheduleSlots(groups, schoolId, versionId, config, subjects, teachers, rooms, students, constraints) {
  const slots = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].slice(0, config.days_per_week);
  const periods = Array.from({ length: config.periods_per_day }, (_, i) => i + 1);
  const blockedPeriods = new Set([...config.break_periods, config.lunch_period]);

  // Track usage
  const teacherSchedule = {};
  const roomSchedule = {};

  teachers.forEach(t => { teacherSchedule[t.id] = []; });
  rooms.forEach(r => { roomSchedule[r.id] = []; });

  // Filter active constraints
  const hardConstraints = constraints.filter(c => c.is_active && c.type === 'hard') || [];

  // Schedule each group
  for (const group of groups) {
    const subject = subjects.find(s => s.id === group.subject_id);
    if (!subject) continue;

    const requiredSessions = group.hours_per_week || 0;
    if (requiredSessions <= 0) continue;

    let scheduled = 0;

    // Find available teacher
    let assignedTeacher = null;
    const candidateTeachers = teachers
      .filter(t => t.is_active !== false)
      .filter(t => {
        const quals = Array.isArray(t.qualifications) ? t.qualifications : [];
        return quals.some(q => q.subject_id === group.subject_id);
      })
      .sort((a, b) => (teacherSchedule[a.id]?.length || 0) - (teacherSchedule[b.id]?.length || 0));

    if (candidateTeachers.length > 0) {
      assignedTeacher = candidateTeachers[0];
    }

    // Try to schedule sessions
    const dayOrder = [...days].sort(() => Math.random() - 0.5); // randomize for variety
    for (const day of dayOrder) {
      if (scheduled >= requiredSessions) break;
      for (const period of periods) {
        if (scheduled >= requiredSessions) break;
        if (blockedPeriods.has(period)) continue;

        // Check teacher availability
        let teacherFree = true;
        if (assignedTeacher) {
          teacherFree = !teacherSchedule[assignedTeacher.id]?.some(s => s.day === day && s.period === period);
          
          // Check hard constraints
          for (const constraint of hardConstraints) {
            if (constraint.category === 'teacher' && (!constraint.rule?.teacher_id || constraint.rule.teacher_id === assignedTeacher.id)) {
              if (constraint.rule?.prohibited_days?.includes(day)) {
                teacherFree = false;
                break;
              }
              if (constraint.rule?.unavailable_slots?.some(u => u.day === day && u.period === period)) {
                teacherFree = false;
                break;
              }
            }
          }
        }

        // Find available room
        let availableRoom = null;
        for (const room of rooms) {
          const roomFree = !roomSchedule[room.id]?.some(s => s.day === day && s.period === period);
          const hasCapacity = !room.capacity || (group.student_ids?.length || 0) <= room.capacity;
          if (roomFree && hasCapacity) {
            availableRoom = room;
            break;
          }
        }

        if (teacherFree && availableRoom) {
          slots.push({
            school_id: schoolId,
            schedule_version: versionId,
            teaching_group_id: group.id,
            teacher_id: assignedTeacher?.id || null,
            room_id: availableRoom.id,
            day,
            period,
            status: assignedTeacher ? 'scheduled' : 'tentative'
          });

          if (assignedTeacher) teacherSchedule[assignedTeacher.id].push({ day, period });
          roomSchedule[availableRoom.id].push({ day, period });
          scheduled++;
        }
      }
    }

    console.log(`Scheduled ${group.name}: ${scheduled}/${requiredSessions} sessions`);
  }

  return slots;
}