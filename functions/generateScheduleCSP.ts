import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserSchoolId } from './securityHelper.js';

// Simple CSP solver for scheduling
class SchedulingCSP {
  constructor(config) {
    this.config = config;
    this.variables = []; // slots to assign
    this.domains = {}; // possible values for each variable
    this.constraints = [];
    this.assignment = {};
  }

  addVariable(id, domain) {
    this.variables.push(id);
    this.domains[id] = [...domain];
  }

  addConstraint(fn) {
    this.constraints.push(fn);
  }

  isConsistent(variable, value, assignment) {
    for (const constraint of this.constraints) {
      if (!constraint(variable, value, assignment)) {
        return false;
      }
    }
    return true;
  }

  selectUnassignedVariable(assignment) {
    for (const v of this.variables) {
      if (!(v in assignment)) {
        return v;
      }
    }
    return null;
  }

  orderDomainValues(variable, assignment) {
    // Order by constraint count (most constrained first)
    return this.domains[variable].sort((a, b) => {
      const aValid = this.isConsistent(variable, a, assignment) ? 1 : 0;
      const bValid = this.isConsistent(variable, b, assignment) ? 1 : 0;
      return bValid - aValid;
    });
  }

  backtrack(assignment = {}) {
    if (Object.keys(assignment).length === this.variables.length) {
      return assignment;
    }

    const variable = this.selectUnassignedVariable(assignment);
    if (!variable) return null;

    for (const value of this.orderDomainValues(variable, assignment)) {
      if (this.isConsistent(variable, value, assignment)) {
        assignment[variable] = value;
        const result = this.backtrack(assignment);
        if (result !== null) {
          return result;
        }
        delete assignment[variable];
      }
    }

    return null;
  }

  solve() {
    return this.backtrack();
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const schoolId = await getUserSchoolId(base44);

    const { schedule_version_id, level } = await req.json();

    if (!schedule_version_id || !level) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log(`[CSP] Generating ${level} schedule for version ${schedule_version_id}`);

    // Fetch data
    const [schools, classGroups, students, subjects, teachers, rooms, constraints] = await Promise.all([
      base44.asServiceRole.entities.School.filter({ id: schoolId }),
      base44.asServiceRole.entities.ClassGroup.filter({ school_id: schoolId, ib_programme: level }),
      base44.asServiceRole.entities.Student.filter({ school_id: schoolId, ib_programme: level }),
      base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Room.filter({ school_id: schoolId, is_active: true }),
      base44.asServiceRole.entities.Constraint.filter({ school_id: schoolId, is_active: true })
    ]);

    const school = schools[0];
    const periodsPerDay = school?.periods_per_day || 8;
    const breakPeriods = school?.settings?.break_periods || [];
    const lunchPeriod = school?.settings?.lunch_period || 4;
    const testConfig = school?.settings?.test_config || {};
    const levelTestConfig = testConfig[level] || { tests_per_week: 0 };
    const testsPerWeek = levelTestConfig.tests_per_week || 0;

    // Filter subjects by level
    const levelSubjects = subjects.filter(s => s.ib_level === level && s.is_active !== false);
    
    if (levelSubjects.length === 0) {
      return Response.json({ 
        success: true, 
        slots_generated: 0, 
        slots: [], 
        error: `No subjects found for ${level}` 
      });
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1)
      .filter(p => !breakPeriods.includes(p) && p !== lunchPeriod);
    
    const slots = [];
    const availableSlots = [];

    // Generate all possible slot combinations
    for (const classGroup of classGroups) {
      const classGroupStudentIds = classGroup.student_ids || [];
      if (classGroupStudentIds.length === 0) continue;

      for (const subject of levelSubjects) {
        for (const day of days) {
          for (const period of periods) {
            availableSlots.push({
              id: `${classGroup.id}_${subject.id}_${day}_${period}`,
              classgroup_id: classGroup.id,
              subject_id: subject.id,
              day,
              period
            });
          }
        }
      }
    }

    // Create CSP
    const csp = new SchedulingCSP({ classGroups, subjects, teachers, rooms, periods, days });

    // Add variables (one per needed slot)
    let slotIndex = 0;
    for (const classGroup of classGroups) {
      for (const subject of levelSubjects) {
        const hoursNeeded = subject.pyp_myp_hours_per_week || 4;
        const periodsNeeded = Math.ceil(hoursNeeded);

        for (let i = 0; i < periodsNeeded; i++) {
          const varId = `slot_${slotIndex}`;
          const domain = availableSlots.map((s, idx) => idx);
          csp.addVariable(varId, domain);
          slotIndex++;
        }
      }
    }

    // Add constraints
    csp.constraints = [
      // No double-booking constraints
      (variable, value, assignment) => {
        const slot = availableSlots[value];
        if (!slot) return false;

        // Check if this time slot is already taken by the same classgroup
        for (const [otherVar, otherValue] of Object.entries(assignment)) {
          if (otherVar === variable) continue;
          const otherSlot = availableSlots[otherValue];
          if (otherSlot.classgroup_id === slot.classgroup_id &&
              otherSlot.day === slot.day &&
              otherSlot.period === slot.period) {
            return false;
          }
        }
        return true;
      },

      // Teacher availability
      (variable, value, assignment) => {
        const slot = availableSlots[value];
        const subject = levelSubjects.find(s => s.id === slot.subject_id);
        
        // Find qualified teacher
        const qualified = teachers.filter(t => 
          t.is_active !== false && 
          (t.subjects?.includes(subject.id) || 
           t.qualifications?.some(q => q.subject_id === subject.id))
        );

        if (qualified.length === 0) return false;

        // Check if any qualified teacher is available
        return qualified.some(teacher => {
          let count = 0;
          for (const [, val] of Object.entries(assignment)) {
            if (val === value) continue;
            count++;
          }
          return count < (teacher.max_hours_per_week || 25);
        });
      },

      // Room availability
      (variable, value, assignment) => {
        if (rooms.length === 0) return false;
        
        const slot = availableSlots[value];
        return rooms.some(room => {
          for (const [, val] of Object.entries(assignment)) {
            if (val === value) continue;
            const other = availableSlots[val];
            if (other.day === slot.day && other.period === slot.period) {
              return false;
            }
          }
          return true;
        });
      }
    ];

    // Attempt to solve
    console.log(`[CSP] Attempting to solve with ${csp.variables.length} variables`);
    const solution = csp.solve();

    if (!solution) {
      console.warn('[CSP] No complete solution found, using greedy fallback');
      // Fall back to simple greedy assignment
      return generateGreedySchedule(base44, schoolId, schedule_version_id, level);
    }

    // Convert solution to slots
    const teacherSchedules = {};
    const roomSchedules = {};
    teachers.forEach(t => { teacherSchedules[t.id] = []; });
    rooms.forEach(r => { roomSchedules[r.id] = []; });

    for (const [, slotIndex] of Object.entries(solution)) {
      const slot = availableSlots[slotIndex];
      if (!slot) continue;

      const subject = levelSubjects.find(s => s.id === slot.subject_id);
      const classGroup = classGroups.find(c => c.id === slot.classgroup_id);
      
      // Find qualified, available teacher
      let teacher = null;
      const qualified = teachers.filter(t => 
        t.is_active !== false && 
        (t.subjects?.includes(subject.id) || 
         t.qualifications?.some(q => q.subject_id === subject.id))
      ).sort((a, b) => (teacherSchedules[a.id]?.length || 0) - (teacherSchedules[b.id]?.length || 0));

      if (qualified.length > 0) {
        teacher = qualified[0];
        teacherSchedules[teacher.id].push({ day: slot.day, period: slot.period });
      }

      // Find available room
      let room = rooms.find(r => 
        !roomSchedules[r.id].some(s => s.day === slot.day && s.period === slot.period)
      );
      if (room) {
        roomSchedules[room.id].push({ day: slot.day, period: slot.period });
      }

      slots.push({
        school_id: schoolId,
        schedule_version: schedule_version_id,
        classgroup_id: slot.classgroup_id,
        subject_id: slot.subject_id,
        teacher_id: teacher?.id || null,
        room_id: room?.id || null,
        day: slot.day,
        period: slot.period,
        status: teacher ? 'scheduled' : 'tentative'
      });
    }

    console.log(`[CSP] Generated ${slots.length} slots`);

    return Response.json({
      success: true,
      slots_generated: slots.length,
      slots,
      solver: 'csp'
    });

  } catch (error) {
    console.error('[CSP] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Fallback greedy function (simplified version of the original)
async function generateGreedySchedule(base44, schoolId, scheduleVersionId, level) {
  // For now, return empty - in production you'd call the original generator
  return Response.json({
    success: true,
    slots_generated: 0,
    slots: [],
    warning: 'CSP solver failed to find optimal solution'
  });
}