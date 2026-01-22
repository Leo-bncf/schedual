import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generates PYP/MYP schedules using ClassGroup-based approach
 * All students in a ClassGroup have identical schedules
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_version_id, level } = await req.json();

    if (!schedule_version_id || !level) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const school_id = user.school_id;

    // Fetch data
    const [school, classGroups, subjects, teachers, rooms] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(data => data[0]),
      base44.entities.ClassGroup.filter({ school_id, ib_programme: level }),
      base44.entities.Subject.filter({ school_id, ib_level: level }),
      base44.entities.Teacher.filter({ school_id, is_active: true }),
      base44.entities.Room.filter({ school_id, is_active: true })
    ]);

    if (classGroups.length === 0) {
      return Response.json({ 
        success: true, 
        slots: [],
        message: `No ${level} ClassGroups found` 
      });
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periodsPerDay = school?.periods_per_day || 8;
    const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
    
    // Block breaks and lunch
    const breakPeriods = school?.settings?.break_periods || [];
    const lunchPeriod = school?.settings?.lunch_period || 4;
    const blockedPeriods = new Set([...breakPeriods, lunchPeriod]);

    const slots = [];
    const teacherSchedules = {};
    const roomSchedules = {};

    // For each ClassGroup, schedule all their subjects
    for (const classGroup of classGroups) {
      const yearGroup = classGroup.year_group;
      
      // Get subjects for this level
      const classSubjects = subjects.filter(s => s.is_active);
      
      // Distribute subjects across the week
      for (const subject of classSubjects) {
        const hoursPerWeek = subject.pyp_myp_hours_per_week || 4;
        let scheduled = 0;

        // Find qualified teacher
        const qualifiedTeachers = teachers.filter(t => 
          t.subjects && t.subjects.includes(subject.id)
        ).sort((a, b) => 
          (teacherSchedules[a.id]?.length || 0) - (teacherSchedules[b.id]?.length || 0)
        );

        const teacher = qualifiedTeachers[0] || null;
        if (!teacher) continue;

        if (!teacherSchedules[teacher.id]) teacherSchedules[teacher.id] = [];

        // Try to schedule required hours
        for (const day of days) {
          if (scheduled >= hoursPerWeek) break;
          
          for (const period of periods) {
            if (scheduled >= hoursPerWeek) break;
            if (blockedPeriods.has(period)) continue;

            // Check teacher availability
            const teacherFree = !teacherSchedules[teacher.id]?.some(s => 
              s.day === day && s.period === period
            );
            
            if (!teacherFree) continue;

            // Check teacher unavailable slots
            const teacherAvailable = !teacher.unavailable_slots?.some(u => 
              u.day === day && u.period === period
            );
            
            if (!teacherAvailable) continue;

            // Find available room
            const preferredRooms = subject.requires_special_room
              ? rooms.filter(r => r.room_type === subject.requires_special_room)
              : rooms;

            let assignedRoom = null;
            for (const room of preferredRooms) {
              const roomFree = !roomSchedules[room.id]?.some(s => 
                s.day === day && s.period === period
              );
              if (roomFree) {
                assignedRoom = room;
                break;
              }
            }

            if (!assignedRoom) continue;

            // Create slot
            slots.push({
              school_id,
              schedule_version: schedule_version_id,
              classgroup_id: classGroup.id,
              subject_id: subject.id,
              teacher_id: teacher.id,
              room_id: assignedRoom.id,
              day,
              period,
              status: 'scheduled'
            });

            // Track usage
            teacherSchedules[teacher.id].push({ day, period });
            if (!roomSchedules[assignedRoom.id]) roomSchedules[assignedRoom.id] = [];
            roomSchedules[assignedRoom.id].push({ day, period });

            scheduled++;
          }
        }
      }
    }

    return Response.json({ 
      success: true,
      slots,
      message: `Generated ${slots.length} ${level} schedule slots`
    });

  } catch (error) {
    console.error('Generate PYP/MYP schedule error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate schedule' 
    }, { status: 500 });
  }
});