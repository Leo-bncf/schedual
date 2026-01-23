import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Converts Base44 IB data into a clean schedule_problem_v1 payload for OR-Tools
 * 
 * Resolves all IB semantics (DP/MYP/PYP, HL/SL, subject choices, class groups)
 * into abstract teaching units before scheduling.
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

    // Build time slots and mark blocked periods
    const periods_per_day = school.periods_per_day || 8;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const time_slots = [];
    const blocked_slot_ids = [];
    let slot_id = 1;

    // Get break and lunch configuration
    const breakPeriods = school.settings?.break_periods || [];
    const lunchPeriod = school.settings?.lunch_period || 4;
    const testConfig = school.settings?.test_config || {};

    for (const day of days) {
      for (let period = 1; period <= periods_per_day; period++) {
        const currentSlotId = slot_id++;
        time_slots.push({ id: currentSlotId, day, period });

        // Block breaks and lunch for all teaching
        if (breakPeriods.includes(period) || period === lunchPeriod) {
          blocked_slot_ids.push(currentSlotId);
        }
      }
    }

    // Build capability taxonomy (subject_id → capability)
    const subjectCapabilities = {};
    subjects.forEach(subject => {
      // Map subject to capability code
      const code = subject.code || subject.name;
      subjectCapabilities[subject.id] = code
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '');
    });

    // Build rooms (clean format)
    const solver_rooms = rooms.map(room => ({
      id: room.id,
      capacity: room.capacity,
      type: room.room_type || 'classroom'
    }));

    // Build teachers with capabilities
    const solver_teachers = teachers.map(teacher => {
      // Extract capabilities from teacher's subjects
      const capabilities = (teacher.subjects || [])
        .map(subjectId => subjectCapabilities[subjectId])
        .filter(Boolean);

      // Map unavailable slots to slot IDs
      const unavailable_slot_ids = (teacher.unavailable_slots || []).map(slot => {
        const dayIndex = days.indexOf(slot.day);
        if (dayIndex === -1) return null;
        return (dayIndex * periods_per_day) + slot.period;
      }).filter(Boolean);

      return {
        id: teacher.id,
        capabilities: [...new Set(capabilities)], // unique capabilities
        max_sessions_per_week: teacher.max_hours_per_week || 25,
        unavailable_slot_ids
      };
    });

    // Build teaching units from teaching groups
    const teaching_units = teachingGroups.map(group => {
      const subject = subjects.find(s => s.id === group.subject_id);
      if (!subject) return null;

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

      // Determine allowed room types
      const allowed_room_types = [];
      if (subject.requires_lab) {
        allowed_room_types.push('lab');
      } else if (subject.requires_special_room) {
        allowed_room_types.push(subject.requires_special_room);
      } else {
        allowed_room_types.push('classroom');
      }

      return {
        id: group.id,
        type: 'teaching_group',
        student_ids: group.student_ids || [],
        required_sessions,
        required_capability: subjectCapabilities[subject.id],
        allowed_room_types,
        teacher_id: group.teacher_id || null,
        requires_double_periods: group.requires_double_periods || false
      };
    }).filter(Boolean);

    // Add TOK/CAS/EE core components as teaching units
    const coreSubjects = subjects.filter(s => s.is_core && s.ib_level === 'DP');
    const dpStudents = students.filter(s => s.ib_programme === 'DP');

    coreSubjects.forEach(coreSubject => {
      // Group students by year_group for core components
      const studentsByYear = {};
      dpStudents.forEach(student => {
        if (!studentsByYear[student.year_group]) {
          studentsByYear[student.year_group] = [];
        }
        studentsByYear[student.year_group].push(student.id);
      });

      // Create teaching units for each year group
      Object.entries(studentsByYear).forEach(([year_group, student_ids]) => {
        const hoursPerWeek = coreSubject.code === 'TOK' ? 
          (school.settings?.tok_hours_per_week || 3) :
          (school.settings?.cas_ee_hours_per_week || 1);

        teaching_units.push({
          id: `core_${coreSubject.id}_${year_group}`,
          type: 'core_component',
          student_ids,
          required_sessions: hoursPerWeek,
          required_capability: subjectCapabilities[coreSubject.id],
          allowed_room_types: ['classroom'],
          teacher_id: null,
          requires_double_periods: false,
          core_component: coreSubject.code
        });
      });
    });

    // Add test slots from test subjects
    const testSubjects = subjects.filter(s => s.is_test_slot);
    testSubjects.forEach(testSubject => {
      const testsPerWeek = testSubject.tests_per_week || 0;
      
      if (testsPerWeek > 0 && testSubject.test_level) {
        const periodDuration = school.period_duration_minutes || 45;
        const periodsNeeded = Math.ceil((testSubject.test_duration_minutes || 0) / periodDuration);
        
        // Get students in this level
        const levelStudents = students.filter(s => {
          if (testSubject.test_level === 'PYP' || testSubject.test_level === 'MYP') {
            return s.ib_programme === testSubject.test_level;
          }
          return s.year_group === testSubject.test_level;
        }).map(s => s.id);

        if (levelStudents.length > 0) {
          teaching_units.push({
            id: `test_${testSubject.id}`,
            type: 'test_slot',
            student_ids: levelStudents,
            required_sessions: testsPerWeek,
            required_capability: 'TEST_ASSESSMENT',
            allowed_room_types: ['classroom'],
            teacher_id: testSubject.supervisor_teacher_id || null,
            requires_double_periods: periodsNeeded > 1,
            test_level: testSubject.test_level
          });
        }
      }
    });

    // Version the payload
    const problem = {
      version: 'schedule_problem_v1',
      school_id,
      schedule_version_id,
      time_slots,
      blocked_slot_ids,
      rooms: solver_rooms,
      teachers: solver_teachers,
      teaching_units
    };

    return Response.json({ 
      success: true, 
      problem,
      stats: {
        time_slots: time_slots.length,
        rooms: solver_rooms.length,
        teachers: solver_teachers.length,
        teaching_units: teaching_units.length
      }
    });

  } catch (error) {
    console.error('Build scheduling problem error:', error);
    return Response.json({ 
      error: error.message || 'Failed to build scheduling problem' 
    }, { status: 500 });
  }
});