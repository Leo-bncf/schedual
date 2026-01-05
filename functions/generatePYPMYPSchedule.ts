import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserSchoolId } from './securityHelper.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const schoolId = await getUserSchoolId(base44);

    const { schedule_version_id, level } = await req.json();
    
    if (!schedule_version_id || !level) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`Generating ${level} schedule for version ${schedule_version_id}`);

    // Fetch school settings for test configuration
    const schools = await base44.asServiceRole.entities.School.filter({ id: schoolId });
    const school = schools[0];
    const testConfig = school?.settings?.test_config || {};
    
    // Fetch data
    const classGroups = await base44.entities.ClassGroup.filter({ 
      school_id: schoolId,
      ib_programme: level 
    });
    
    const students = await base44.entities.Student.filter({ 
      school_id: schoolId,
      ib_programme: level
    });
    
    const subjects = await base44.entities.Subject.filter({ 
      school_id: schoolId 
    });
    
    const teachers = await base44.entities.Teacher.filter({ 
      school_id: schoolId 
    });
    
    const rooms = await base44.entities.Room.filter({ 
      school_id: schoolId,
      is_active: true 
    });
    
    // Fetch constraints
    const constraints = await base44.entities.Constraint.filter({ 
      school_id: schoolId,
      is_active: true 
    });
    const hardConstraints = constraints.filter(c => c.type === 'hard');
    console.log(`Loaded ${hardConstraints.length} hard constraints for ${level}`);

    console.log(`Found ${classGroups.length} ClassGroups, ${students.length} students, ${subjects.length} subjects`);

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = Array.from({ length: 12 }, (_, i) => i + 1);
    const slots = [];

    // Track teacher and room availability globally
    const teacherSchedules = {};
    const roomSchedules = {};
    teachers.forEach(t => { teacherSchedules[t.id] = []; });
    rooms.forEach(r => { roomSchedules[r.id] = []; });
    
    // Reserve test slots based on level configuration
    const levelTestConfig = testConfig[level] || { tests_per_week: 0, test_duration_minutes: 0 };
    const testsPerWeek = levelTestConfig.tests_per_week || 0;
    const testDurationPeriods = Math.ceil(levelTestConfig.test_duration_minutes / (school?.period_duration_minutes || 45));
    
    const reservedTestSlots = [];
    
    if (testsPerWeek > 0) {
      const daysForTests = Math.min(testsPerWeek, days.length);
      const dayInterval = Math.floor(days.length / daysForTests);
      
      for (let i = 0; i < testsPerWeek; i++) {
        const dayIndex = (i * dayInterval) % days.length;
        const day = days[dayIndex];
        const startPeriod = 1;
        
        for (let p = startPeriod; p < startPeriod + testDurationPeriods; p++) {
          if (p <= periods.length) {
            reservedTestSlots.push({ day, period: p });
          }
        }
      }
      
      console.log(`Reserved ${reservedTestSlots.length} test slot periods for ${level}`);
    }

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

            // Check if this is a reserved test slot
            const isTestSlot = reservedTestSlots.some(ts => ts.day === day && ts.period === period);
            if (isTestSlot) continue;
            
            // Check ClassGroup availability
            const classGroupBusy = classGroupSchedule.some(s => s.day === day && s.period === period);
            if (classGroupBusy) continue;

            // Check teacher availability (only if teacher assigned)
            if (assignedTeacher) {
              const teacherBusy = teacherSchedules[assignedTeacher.id]?.some(s => s.day === day && s.period === period);
              if (teacherBusy) continue;
            }
            
            // Check hard constraints
            let violatesConstraint = false;
            for (const constraint of hardConstraints) {
              // Teacher constraints
              if (constraint.category === 'teacher' && assignedTeacher) {
                if (!constraint.rule?.teacher_id || constraint.rule?.teacher_id === assignedTeacher.id) {
                  if (constraint.rule?.max_hours_per_week && (teacherSchedules[assignedTeacher.id]?.length || 0) >= constraint.rule.max_hours_per_week) {
                    violatesConstraint = true;
                    break;
                  }
                  if (constraint.rule?.prohibited_days?.includes(day)) {
                    violatesConstraint = true;
                    break;
                  }
                  if (constraint.rule?.unavailable_slots?.some(u => u.day === day && u.period === period)) {
                    violatesConstraint = true;
                    break;
                  }
                }
              }
              // Subject constraints
              if (constraint.category === 'subject' && constraint.rule?.subject_id === subject.id) {
                if (constraint.rule?.prohibited_days?.includes(day) || 
                    constraint.rule?.prohibited_slots?.some(slot => slot.day === day && (!slot.period || slot.period === period))) {
                  violatesConstraint = true;
                  break;
                }
              }
              // Time constraints
              if (constraint.category === 'time' && constraint.rule?.prohibited_slots?.some(slot => slot.day === day && slot.period === period)) {
                violatesConstraint = true;
                break;
              }
            }
            if (violatesConstraint) continue;

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
              school_id: schoolId,
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

              const isTestSlot = reservedTestSlots.some(ts => ts.day === day && ts.period === period);
              if (isTestSlot) continue;
              
              const classGroupBusy = classGroupSchedule.some(s => s.day === day && s.period === period);
              if (classGroupBusy) continue;

              if (assignedTeacher) {
                const teacherBusy = teacherSchedules[assignedTeacher.id]?.some(s => s.day === day && s.period === period);
                if (teacherBusy) continue;
              }
              
              // Check hard constraints (second pass)
              let violatesConstraint = false;
              for (const constraint of hardConstraints) {
                if (constraint.category === 'teacher' && assignedTeacher) {
                  if (!constraint.rule?.teacher_id || constraint.rule?.teacher_id === assignedTeacher.id) {
                    if (constraint.rule?.max_hours_per_week && (teacherSchedules[assignedTeacher.id]?.length || 0) >= constraint.rule.max_hours_per_week) {
                      violatesConstraint = true;
                      break;
                    }
                    if (constraint.rule?.prohibited_days?.includes(day) || constraint.rule?.unavailable_slots?.some(u => u.day === day && u.period === period)) {
                      violatesConstraint = true;
                      break;
                    }
                  }
                }
                if (constraint.category === 'subject' && constraint.rule?.subject_id === subject.id) {
                  if (constraint.rule?.prohibited_days?.includes(day) || constraint.rule?.prohibited_slots?.some(slot => slot.day === day && (!slot.period || slot.period === period))) {
                    violatesConstraint = true;
                    break;
                  }
                }
                if (constraint.category === 'time' && constraint.rule?.prohibited_slots?.some(slot => slot.day === day && slot.period === period)) {
                  violatesConstraint = true;
                  break;
                }
              }
              if (violatesConstraint) continue;

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
                school_id: schoolId,
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