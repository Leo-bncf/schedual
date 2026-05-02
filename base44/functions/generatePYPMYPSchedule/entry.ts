import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Generates PYP/MYP schedules using ClassGroup-based approach
 * All students in a ClassGroup have identical schedules
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    const dbUsers = authUser ? await base44.asServiceRole.entities.User.filter({ id: authUser.id }) : [];
    const user = dbUsers[0] || authUser;
    const school_id = user?.school_id || user?.data?.school_id;
    const role = user?.role || user?.data?.role;

    if (!user || !school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { schedule_version_id, level } = await req.json();

    if (!schedule_version_id || !level) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Fetch data
    const [school, classGroups, subjects, teachers, rooms, scheduleVersions] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then((data: any[]) => data[0]),
      base44.entities.ClassGroup.filter({ school_id, ib_programme: level }),
      base44.entities.Subject.filter({ school_id, ib_level: level }),
      base44.entities.Teacher.filter({ school_id, is_active: true }),
      base44.entities.Room.filter({ school_id, is_active: true }),
      base44.entities.ScheduleVersion.filter({ school_id }, '-created_date', 1000),
    ]);

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'];
    if (!ACTIVE_SUBSCRIPTION_STATUSES.includes((school as any).subscription_status)) {
      return Response.json({ error: 'Your subscription is not active. Please renew your plan to generate schedules.' }, { status: 403 });
    }

    // Enforce generation limit
    const GENERATION_LIMITS: Record<string, number | null> = { tier1: 3, tier2: null, tier3: null };
    const generationLimit = GENERATION_LIMITS[(school as any)?.subscription_tier] ?? 3;
    const generatedCount = (scheduleVersions as any[]).filter((v: any) => v.generated_at).length;
    if (generationLimit !== null && generatedCount >= generationLimit) {
      return Response.json({ error: `Generation limit reached for your tier (${generatedCount}/${generationLimit})` }, { status: 400 });
    }

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