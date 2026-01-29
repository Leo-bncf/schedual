import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Converts Base44 IB data into OptaPlanner format
 * 
 * Resolves all IB semantics (DP/MYP/PYP, HL/SL, subject choices, class groups)
 * into lessons for OptaPlanner constraint solver.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { schedule_version_id } = await req.json();

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    const school_id = user.school_id;

    // Fetch all relevant data
    const [school, teachers, rooms, teachingGroups, subjects, students, classGroups] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then(s => s[0]),
      base44.entities.Teacher.filter({ school_id, is_active: true }),
      base44.entities.Room.filter({ school_id, is_active: true }),
      base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
      base44.entities.Subject.filter({ school_id, is_active: true }),
      base44.entities.Student.filter({ school_id, is_active: true }),
      base44.entities.ClassGroup.filter({ school_id, is_active: true })
    ]);

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Build timeslots with OptaPlanner format - FIXED to respect school.periods_per_day
    const periods_per_day = school.periods_per_day || 10; // Should be 10 for 08:00-18:00 coverage
    const period_duration = school.period_duration_minutes || 60;
    const school_start = school.school_start_time || "08:00";
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const timeslots = [];
    let slot_id = 1;

    // Get break and lunch configuration
    const breakPeriods = school.settings?.break_periods || [];
    const lunchPeriod = school.settings?.lunch_period || 4;
    const testConfig = school.settings?.test_config || {};

    // Calculate start time in minutes from school start
    const [startHour, startMin] = school_start.split(':').map(Number);
    const schoolStartMinutes = startHour * 60 + startMin;

    for (const day of days) {
      for (let period = 1; period <= periods_per_day; period++) {
        // Calculate time for this period
        const periodStartMinutes = schoolStartMinutes + ((period - 1) * period_duration);
        const periodEndMinutes = periodStartMinutes + period_duration;
        
        const startTime = `${String(Math.floor(periodStartMinutes / 60)).padStart(2, '0')}:${String(periodStartMinutes % 60).padStart(2, '0')}`;
        const endTime = `${String(Math.floor(periodEndMinutes / 60)).padStart(2, '0')}:${String(periodEndMinutes % 60).padStart(2, '0')}`;

        timeslots.push({
          id: slot_id++,
          dayOfWeek: day,
          startTime,
          endTime
        });
      }
    }

    // Build rooms (OptaPlanner format - numeric IDs)
    const roomIdMap = {};
    const solver_rooms = rooms.map((room, index) => {
      const numericId = index + 1;
      roomIdMap[room.id] = numericId;
      return {
        id: numericId,
        name: room.name || `Room ${numericId}`,
        capacity: room.capacity
      };
    });

    // Build teachers (OptaPlanner format - numeric IDs)
    const teacherIdMap = {};
    const solver_teachers = teachers.map((teacher, index) => {
      const numericId = index + 1;
      teacherIdMap[teacher.id] = numericId;
      return {
        id: numericId,
        name: teacher.full_name || `Teacher ${numericId}`
      };
    });

    // Build subject capability map for lessons
    const subjectCapabilities = {};
    subjects.forEach(subject => {
      const code = subject.code || subject.name;
      subjectCapabilities[subject.id] = code
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '');
    });

    // Build lessons from teaching groups (OptaPlanner format)
    let lessonId = 1;
    const lessons = [];

    teachingGroups.forEach(group => {
      const subject = subjects.find(s => s.id === group.subject_id);
      if (!subject) return;

      // Determine required sessions based on level
      let required_sessions = group.hours_per_week;
      if (!required_sessions) {
        if (group.level === 'HL') {
          required_sessions = subject.hl_hours_per_week || 6;
        } else if (group.level === 'SL') {
          required_sessions = subject.sl_hours_per_week || 4;
        } else {
          required_sessions = subject.pyp_myp_hours_per_week || 4;
        }
      }

      const studentCount = (group.student_ids || []).length;
      const teacherNumericId = group.teacher_id ? teacherIdMap[group.teacher_id] : null;

      // Create one lesson per required session
      for (let i = 0; i < required_sessions; i++) {
        lessons.push({
          id: lessonId++,
          subject: subjectCapabilities[subject.id],
          studentGroup: group.name || group.id,
          requiredCapacity: studentCount || 20,
          timeslotId: null,
          roomId: null,
          teacherId: teacherNumericId
        });
      }
    });

    // Add TOK/CAS/EE core components as lessons
    const coreSubjects = subjects.filter(s => s.is_core && s.ib_level === 'DP');
    const dpStudents = students.filter(s => s.ib_programme === 'DP');

    coreSubjects.forEach(coreSubject => {
      const studentsByYear = {};
      dpStudents.forEach(student => {
        if (!studentsByYear[student.year_group]) {
          studentsByYear[student.year_group] = [];
        }
        studentsByYear[student.year_group].push(student.id);
      });

      Object.entries(studentsByYear).forEach(([year_group, student_ids]) => {
        const hoursPerWeek = coreSubject.code === 'TOK' ? 
          (school.settings?.tok_hours_per_week || 3) :
          (school.settings?.cas_ee_hours_per_week || 1);

        for (let i = 0; i < hoursPerWeek; i++) {
          lessons.push({
            id: lessonId++,
            subject: subjectCapabilities[coreSubject.id],
            studentGroup: `${coreSubject.code}_${year_group}`,
            requiredCapacity: student_ids.length,
            timeslotId: null,
            roomId: null,
            teacherId: null
          });
        }
      });
    });

    // Add test slots as lessons per level
    ['PYP', 'MYP', 'DP1', 'DP2'].forEach(level => {
      const config = testConfig[level] || { tests_per_week: 0, test_duration_minutes: 0, supervisor_id: null };
      const testsPerWeek = config.tests_per_week || 0;
      
      if (testsPerWeek > 0) {
        const levelStudents = students.filter(s => {
          if (level === 'PYP' || level === 'MYP') return s.ib_programme === level;
          return s.year_group === level;
        });

        if (levelStudents.length > 0) {
          const testSubject = subjects.find(s => s.code === `TEST_${level}`);
          const supervisorNumericId = testSubject?.supervisor_teacher_id ? teacherIdMap[testSubject.supervisor_teacher_id] : null;

          for (let i = 0; i < testsPerWeek; i++) {
            lessons.push({
              id: lessonId++,
              subject: 'TEST_ASSESSMENT',
              studentGroup: `TEST_${level}`,
              requiredCapacity: levelStudents.length,
              timeslotId: null,
              roomId: null,
              teacherId: supervisorNumericId
            });
          }
        }
      }
    });

    // Build OptaPlanner payload
    const problem = {
      timeslots,
      rooms: solver_rooms,
      teachers: solver_teachers,
      lessons
    };

    return Response.json({ 
      success: true, 
      problem,
      stats: {
        timeslots: timeslots.length,
        rooms: solver_rooms.length,
        teachers: solver_teachers.length,
        lessons: lessons.length
      }
    });

  } catch (error) {
    console.error('Build scheduling problem error:', error);
    return Response.json({ 
      error: error.message || 'Failed to build scheduling problem' 
    }, { status: 500 });
  }
});