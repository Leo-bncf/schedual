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

        // Find a qualified teacher
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
          console.warn(`No qualified teacher found for ${subject.name} (${level})`);
          continue;
        }

        // Track this ClassGroup's schedule to avoid conflicts
        const classGroupSchedule = slots
          .filter(s => s.classgroup_id === classGroup.id)
          .map(s => ({ day: s.day, period: s.period }));

        // Schedule 1 period per day (5 days = full week coverage)
        for (const day of days) {
          let scheduled = false;

          for (const period of periods) {
            // Check ClassGroup availability
            const classGroupBusy = classGroupSchedule.some(s => s.day === day && s.period === period);
            if (classGroupBusy) continue;

            // Check teacher availability
            const teacherBusy = teacherSchedules[assignedTeacher.id]?.some(s => s.day === day && s.period === period);
            if (teacherBusy) continue;

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
              teacher_id: assignedTeacher.id,
              room_id: assignedRoom.id,
              day,
              period,
              status: 'scheduled'
            };

            slots.push(slot);
            classGroupSchedule.push({ day, period });
            teacherSchedules[assignedTeacher.id].push({ day, period });
            roomSchedules[assignedRoom.id].push({ day, period });
            scheduled = true;
            break; // Move to next day
          }

          if (!scheduled) {
            console.warn(`Could not schedule ${subject.name} for ${classGroup.name} on ${day}`);
          }
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