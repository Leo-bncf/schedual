/**
 * SCHEDULING PROBLEM DEFINITION
 * Mathematical model for IB School Timetable Generation
 * 
 * This document defines the constraint satisfaction problem (CSP) / Integer Linear Program (ILP)
 * for generating school schedules. It serves as the specification for OR-Tools solver implementation.
 */

/**
 * DECISION VARIABLES
 * ==================
 * x[g][d][p][r] = 1 if teaching group g is scheduled on day d, period p, in room r; 0 otherwise
 * 
 * Where:
 * - g = teaching group ID
 * - d = day of week (0-4: Monday-Friday)
 * - p = period number (1-8)
 * - r = room ID
 */

/**
 * HARD CONSTRAINTS (Must not be violated)
 * ========================================
 */
const HARD_CONSTRAINTS = {
  
  H1: {
    name: "No Teacher Double-Booking",
    description: "A teacher cannot teach 2 groups simultaneously",
    formula: "For each teacher t, at most 1 group taught by t can be scheduled at (d, p)",
    violation: "Teacher has 2+ groups in same period",
    impact: "CRITICAL - Schedule invalid"
  },

  H2: {
    name: "No Student Double-Booking",
    description: "A student cannot be in 2 groups simultaneously",
    formula: "For each student s, at most 1 group containing s can be scheduled at (d, p)",
    violation: "Student appears in 2+ groups in same period",
    impact: "CRITICAL - Schedule invalid"
  },

  H3: {
    name: "No Room Double-Booking",
    description: "A room cannot host 2 groups simultaneously",
    formula: "For each room r, at most 1 group can be scheduled in room r at (d, p)",
    violation: "Room booked for 2+ groups in same period",
    impact: "CRITICAL - Schedule invalid"
  },

  H4: {
    name: "Required Hours Met",
    description: "Each teaching group must achieve its required hours per week",
    formula: "sum(sessions per group) * period_duration >= required_hours_per_week",
    tolerance: "Within 5% (e.g., if 6 hours required, 5.7-6.3 acceptable)",
    violation: "Group scheduled for less than required hours",
    impact: "CRITICAL - IB requirements not met"
  },

  H5: {
    name: "Teacher Availability",
    description: "Teacher cannot be scheduled during unavailable slots",
    formula: "If teacher t has unavailable_slots = [{day, period}], t cannot teach at those times",
    violation: "Teacher scheduled during unavailable time",
    impact: "CRITICAL - Schedule conflicts with teacher commitments"
  },

  H6: {
    name: "Student Availability",
    description: "Student cannot be scheduled during unavailable slots (part-time, support sessions)",
    formula: "If student s has unavailable_slots = [{day, period}], s cannot attend at those times",
    violation: "Student scheduled during unavailable time",
    impact: "CRITICAL - Schedule conflicts with student needs"
  },

  H7: {
    name: "Room Capacity",
    description: "Group size cannot exceed room capacity",
    formula: "For group g in room r: |students in g| <= room r capacity",
    violation: "Group with 25 students in room with capacity 20",
    impact: "CRITICAL - Physical impossibility"
  },

  H8: {
    name: "Teacher Qualifications",
    description: "Teacher can only teach subjects they're qualified for",
    formula: "Teacher t can only teach group g if subject(g) in qualifications(t)",
    violation: "PE teacher assigned to teach Physics HL",
    impact: "CRITICAL - IB compliance issue"
  },

  H9: {
    name: "Subject Room Requirements",
    description: "Subject must be in appropriate room type (labs for sciences, etc.)",
    formula: "If subject requires special room, group must be in that room type",
    violation: "Chemistry HL scheduled in regular classroom (not lab)",
    impact: "HIGH - Pedagogical issue"
  },

  H10: {
    name: "DP HL Hours >= SL Hours",
    description: "HL subjects require more teaching hours than SL in DP",
    formula: "For subject s: hours(HL) >= 1.5 * hours(SL)",
    violation: "HL Physics has 4 hours, SL Physics has 5 hours",
    impact: "CRITICAL - IB DP requirement"
  },

  H11: {
    name: "Double Period Integrity",
    description: "Double periods must be consecutive and same day",
    formula: "If group requires double periods, they must be scheduled as (p, p+1) consecutive",
    violation: "Double period split across Monday p5 and Tuesday p1",
    impact: "HIGH - Pedagogical issue"
  }

};

/**
 * SOFT CONSTRAINTS (Optimize for satisfaction)
 * ============================================
 */
const SOFT_CONSTRAINTS = {
  
  S1: {
    name: "Teacher Preferred Free Day",
    description: "Teachers prefer one full free day per week",
    weight: 10,
    formula: "Teacher t should have day d completely free if preferred_free_day = d",
    impact: "Low penalty if violated"
  },

  S2: {
    name: "Teacher Max Consecutive Periods",
    description: "Teacher shouldn't teach more than max_consecutive_periods without break",
    weight: 15,
    formula: "max(consecutive teaching periods for t) <= teacher t max_consecutive_periods",
    example: "Teacher prefers max 4 consecutive, schedule 3+3 with lunch break"
  },

  S3: {
    name: "Teacher Workload Balance",
    description: "Distribute teacher hours evenly across the week",
    weight: 8,
    formula: "stddev(hours per day for teacher t) should be minimized",
    impact: "Reduce fatigue from unbalanced days"
  },

  S4: {
    name: "Subject Time Preferences",
    description: "Schedule subjects at preferred times (languages early, lab sciences mid-day, etc.)",
    weight: 5,
    formula: "If subject has preferred_time = morning, schedule before 11:00 AM",
    examples: ["Languages: 8-10am preferred", "Lab sciences: mid-day preferred", "Humanities: flexible"]
  },

  S5: {
    name: "Room Utilization",
    description: "Maximize use of specialized rooms (minimize idle time)",
    weight: 7,
    formula: "Minimize gaps between lab/specialist room bookings",
    impact: "Better facility efficiency"
  },

  S6: {
    name: "No Isolated Periods",
    description: "Minimize single-period classes surrounded by free periods (reduce context-switching)",
    weight: 12,
    formula: "If group has period p scheduled, adjacent periods should also have groups for same teacher",
    impact: "Better teacher/student experience"
  },

  S7: {
    name: "Minimize Gaps in Student Schedule",
    description: "Group student classes together to reduce travel time / free periods",
    weight: 9,
    formula: "For each student, sum(consecutive periods without gaps) should be maximized",
    impact: "Reduces fatigue, allows focused work blocks"
  },

  S8: {
    name: "Balanced Class Distribution",
    description: "Distribute teaching groups evenly across week (don't front-load Monday)",
    weight: 6,
    formula: "stddev(number of groups per day) should be minimized",
    impact: "Smoother week, better facility usage"
  },

  S9: {
    name: "Lunch & Break Integrity",
    description: "Respect designated lunch/break periods - minimize conflicts",
    weight: 20,
    formula: "Teaching groups should avoid lunch blocks, but if necessary minimize clashes",
    impact: "Student/teacher wellbeing"
  },

  S10: {
    name: "Group Cohesion (PYP/MYP)",
    description: "In PYP/MYP, all students in class group should have same schedule",
    weight: 25,
    formula: "All students in ClassGroup should have identical timetables",
    impact: "CRITICAL for coherent block scheduling"
  }

};

/**
 * OBJECTIVE FUNCTION
 * ==================
 * Minimize: 
 *   SUM(hard_constraint_violations * 10000) +  [Heavily penalize hard violations]
 *   SUM(soft_constraint_violations * weight)     [Minimize soft violations weighted by importance]
 */

/**
 * INPUT DATA STRUCTURE
 * ====================
 */
const INPUT_DATA = {
  school: {
    periods_per_day: 8,
    period_duration_minutes: 45,
    days_per_week: 5,
    school_start_time: "08:00",
    lunch_periods: [5], // Period 5 is lunch
    break_periods: [3]  // Period 3 is break
  },

  teaching_groups: [
    {
      id: "tg_001",
      name: "Physics HL - Group A",
      subject_id: "s_physics",
      level: "HL", // DP only
      year_group: "DP2",
      teacher_id: "t_smith",
      student_ids: ["st_001", "st_002", "st_003"],
      required_hours_per_week: 6,
      preferred_room_id: "r_lab_1",
      requires_double_periods: false,
      max_students: 15,
      min_students: 8
    }
    // ... more groups
  ],

  teachers: [
    {
      id: "t_smith",
      name: "John Smith",
      qualifications: [
        { subject_id: "s_physics", ib_levels: ["PYP", "MYP", "DP"] }
      ],
      max_hours_per_week: 25,
      max_consecutive_periods: 4,
      preferred_free_day: "Wednesday",
      unavailable_slots: [
        { day: 1, period: 7 } // Tuesday period 7
      ]
    }
    // ... more teachers
  ],

  students: [
    {
      id: "st_001",
      name: "Alice",
      assigned_groups: ["tg_001", "tg_002"],
      unavailable_slots: [
        { day: 2, period: 1 } // Wednesday period 1 (support session)
      ]
    }
    // ... more students
  ],

  rooms: [
    {
      id: "r_lab_1",
      name: "Physics Lab",
      capacity: 20,
      room_type: "lab",
      equipment: ["bunsen_burner", "voltmeter"]
    },
    {
      id: "r_class_1",
      name: "Classroom 101",
      capacity: 30,
      room_type: "classroom"
    }
    // ... more rooms
  ],

  subjects: [
    {
      id: "s_physics",
      name: "Physics",
      ib_level: "DP",
      ib_group: "4",
      hl_hours_per_week: 6,
      sl_hours_per_week: 4,
      requires_lab: true,
      preferred_time: "mid_day" // morning, afternoon, mid_day, any
    }
    // ... more subjects
  ]
};

/**
 * OUTPUT DATA STRUCTURE
 * =====================
 */
const OUTPUT_SCHEDULE = {
  schedule_version_id: "sv_001",
  status: "valid" | "infeasible",
  
  slots: [
    {
      id: "slot_001",
      teaching_group_id: "tg_001",
      day: 0, // Monday
      period: 1,
      room_id: "r_lab_1",
      teacher_id: "t_smith",
      student_count: 3,
      is_double_period: false,
      status: "scheduled"
    }
    // ... 40+ slots for weekly schedule
  ],

  metrics: {
    total_hours_scheduled: 245,
    total_hours_required: 250,
    coverage_percentage: 98.0,
    hard_constraints_satisfied: true,
    soft_constraints_satisfaction: 87.5, // 0-100%
    conflicts_found: 0,
    warnings_found: 3,
    solver_runtime_seconds: 12.5
  },

  quality_report: {
    teacher_workload_balance: "Good", // avg stddev
    student_gap_distribution: "Acceptable",
    room_utilization: 85.2, // %
    constraints_satisfied: {
      H1_no_teacher_double_booking: true,
      H2_no_student_double_booking: true,
      S1_teacher_free_days: 0.8, // 80% satisfied
      S6_no_isolated_periods: 0.65
    }
  },

  infeasibility_report: {
    // If status = infeasible, explain why
    hard_constraints_violated: ["H4_required_hours"], // e.g., can't fit all required hours
    suggested_actions: [
      "Remove 1 HL group to reduce demand",
      "Extend school day to 9 periods",
      "Add 2 more classrooms"
    ]
  }
};

/**
 * ALGORITHM APPROACH
 * ==================
 * 
 * Use OR-Tools (Google's Constraint Programming solver)
 * 
 * 1. Decision Variables: x[g][d][p][r] ∈ {0, 1}
 * 2. Hard Constraints: Enforce all H1-H11
 * 3. Soft Constraints: Weighted penalties in objective function
 * 4. Solver Strategy:
 *    - Use DefaultRoutingIndexManager for capacity constraints
 *    - Use FirstSolutionStrategy.PATH_CHEAPEST_ARC for initial solution
 *    - Use LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH for optimization
 *    - Time limit: 30 seconds
 * 5. Output: Schedule with metrics or infeasibility report
 */

export const PROBLEM_DEFINITION = {
  HARD_CONSTRAINTS,
  SOFT_CONSTRAINTS,
  INPUT_DATA,
  OUTPUT_SCHEDULE
};