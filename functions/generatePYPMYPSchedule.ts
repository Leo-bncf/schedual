import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    console.log(`Generating ${level} schedule for version ${schedule_version_id}`);

    // Fetch data
    const classGroups = await base44.entities.ClassGroup.filter({ 
      school_id: user.school_id,
      ib_programme: level 
    });
    
    const students = await base44.entities.Student.filter({ 
      school_id: user.school_id,
      ib_programme: level
    });
    
    const subjects = await base44.entities.Subject.filter({ 
      school_id: user.school_id 
    });
    
    const teachers = await base44.entities.Teacher.filter({ 
      school_id: user.school_id 
    });
    
    const rooms = await base44.entities.Room.filter({ 
      school_id: user.school_id,
      is_active: true 
    });

    console.log(`Found ${classGroups.length} ClassGroups, ${students.length} students, ${subjects.length} subjects`);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = Array.from({ length: 12 }, (_, i) => i + 1);
    const slots = [];

    // Track teacher and room availability globally
    const teacherSchedules = {};
    const roomSchedules = {};
    teachers.forEach(t => { teacherSchedules[t.id] = []; });
    rooms.forEach(r => { roomSchedules[r.id] = []; });

    // For each ClassGroup, schedule all their subjects
    for (const classGroup of classGroups) {
      console.log(`Scheduling ClassGroup: ${classGroup.name}`);

      // Get students in this ClassGroup
      const classGroupStudents = students.filter(s => s.classgroup_id === classGroup.id);
      
      if (classGroupStudents.length === 0) {
        console.warn(`No students in ClassGroup ${classGroup.name}`);
        continue;
      }

      // For PYP/MYP: All students take ALL subjects for their level
      // Get all subjects for this IB level
      const levelSubjects = subjects.filter(s => s.ib_level === level && s.is_active !== false);

      console.log(`ClassGroup ${classGroup.name} will be scheduled for ${levelSubjects.length} subjects`);

      // For each subject, schedule periods
      for (const subject of levelSubjects) {

        // Find a qualified teacher (but continue even if none found)
        let assignedTeacher = null;
        for (const teacher of teachers) {
          const isQualified = teacher.qualifications?.some(q => 
            q.subject_id === subject.id && 
            q.ib_levels?.includes(level)
          );
          if (isQualified) {
            assignedTeacher = teacher;
            break;
          }
        }

        if (!assignedTeacher) {
          console.warn(`No qualified teacher found for ${subject.name} (${level}) - scheduling anyway`);
        }

        // Track this ClassGroup's schedule to avoid conflicts
        const classGroupSchedule = slots
          .filter(s => s.classgroup_id === classGroup.id)
          .map(s => ({ day: s.day, period: s.period }));

        // Determine periods needed based on subject hours
        const hoursPerWeek = subject.pyp_myp_hours_per_week || 4;
        const periodsNeeded = Math.ceil(hoursPerWeek);
        
        // Distribute across the week with variety
        const daysToUse = Math.min(periodsNeeded, 5);
        const periodsPerDay = Math.ceil(periodsNeeded / daysToUse);
        let periodsScheduled = 0;

        // Create varied period assignments for each day
        const periodsByDay = {};
        days.forEach((day, dayIndex) => {
          const offset = dayIndex * 2;
          const dayPeriods = [...periods]
            .map(p => ((p - 1 + offset) % 12) + 1)
            .sort(() => Math.random() - 0.5);
          periodsByDay[day] = dayPeriods;
        });

        const dayPeriodCount = {};
        days.forEach(d => { dayPeriodCount[d] = 0; });

        // First pass: Try to schedule with variety
        for (const day of days) {
          if (periodsScheduled >= periodsNeeded) break;

          const targetForDay = dayPeriodCount[day] < Math.floor(periodsNeeded / daysToUse) 
            ? Math.floor(periodsNeeded / daysToUse)
            : (periodsScheduled < periodsNeeded ? 1 : 0);

          for (const period of periodsByDay[day]) {
            if (periodsScheduled >= periodsNeeded) break;
            if (dayPeriodCount[day] >= targetForDay && targetForDay > 0) break;

            // Check ClassGroup availability
            const classGroupBusy = classGroupSchedule.some(s => s.day === day && s.period === period);
            if (classGroupBusy) continue;

            // Check teacher availability (only if teacher assigned)
            if (assignedTeacher) {
              const teacherBusy = teacherSchedules[assignedTeacher.id]?.some(s => s.day === day && s.period === period);
              if (teacherBusy) continue;
            }

            // Find available room
            let assignedRoom = null;
            for (const room of rooms) {
              const roomBusy = roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
              if (!roomBusy) {
                assignedRoom = room;
                break;
              }
            }

            if (!assignedRoom) continue;

            // Create slot
            const slot = {
              school_id: user.school_id,
              schedule_version: schedule_version_id,
              classgroup_id: classGroup.id,
              subject_id: subject.id,
              teacher_id: assignedTeacher ? assignedTeacher.id : null,
              room_id: assignedRoom.id,
              day,
              period,
              status: assignedTeacher ? 'scheduled' : 'tentative'
            };

            slots.push(slot);
            classGroupSchedule.push({ day, period });
            if (assignedTeacher) {
              teacherSchedules[assignedTeacher.id].push({ day, period });
            }
            roomSchedules[assignedRoom.id].push({ day, period });
            periodsScheduled++;
            dayPeriodCount[day]++;
          }
        }

        // Second pass: Fill remaining periods more flexibly if needed
        if (periodsScheduled < periodsNeeded) {
          for (const day of days) {
            if (periodsScheduled >= periodsNeeded) break;

            for (const period of periods) {
              if (periodsScheduled >= periodsNeeded) break;

              const classGroupBusy = classGroupSchedule.some(s => s.day === day && s.period === period);
              if (classGroupBusy) continue;

              if (assignedTeacher) {
                const teacherBusy = teacherSchedules[assignedTeacher.id]?.some(s => s.day === day && s.period === period);
                if (teacherBusy) continue;
              }

              let assignedRoom = null;
              for (const room of rooms) {
                const roomBusy = roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
                if (!roomBusy) {
                  assignedRoom = room;
                  break;
                }
              }

              if (!assignedRoom) continue;

              const slot = {
                school_id: user.school_id,
                schedule_version: schedule_version_id,
                classgroup_id: classGroup.id,
                subject_id: subject.id,
                teacher_id: assignedTeacher ? assignedTeacher.id : null,
                room_id: assignedRoom.id,
                day,
                period,
                status: assignedTeacher ? 'scheduled' : 'tentative'
              };

              slots.push(slot);
              classGroupSchedule.push({ day, period });
              if (assignedTeacher) {
                teacherSchedules[assignedTeacher.id].push({ day, period });
              }
              roomSchedules[assignedRoom.id].push({ day, period });
              periodsScheduled++;
            }
          }
        }

        if (periodsScheduled < periodsNeeded) {
          console.warn(`${subject.name} for ${classGroup.name}: only scheduled ${periodsScheduled}/${periodsNeeded} periods`);
        }
      }
    }

    console.log(`Generated ${slots.length} slots for ${level}`);

    return Response.json({ 
      success: true, 
      slots_generated: slots.length,
      slots
    });

  } catch (error) {
    console.error('Error generating schedule:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});