import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SIMULATE WHAT-IF SCENARIO
 * Tests impact of constraint changes without modifying actual schedule
 * 
 * Input: {
 *   schedule_version_id: string,
 *   scenario_type: "remove_teacher" | "reduce_room" | "add_hours" | "add_constraint" | "move_period",
 *   teacher_id?: string,
 *   group_id?: string
 * }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { schedule_version_id, scenario_type, teacher_id, group_id } = payload;

    if (!schedule_version_id || !scenario_type) {
      return Response.json({ 
        error: 'schedule_version_id and scenario_type required' 
      }, { status: 400 });
    }

    console.log(`[SimulateWhatIf] Scenario: ${scenario_type}`);

    // Load current schedule data
    const [slots, conflicts, teachingGroups, teachers] = await Promise.all([
      base44.entities.ScheduleSlot.filter({ schedule_version: schedule_version_id }),
      base44.entities.ConflictReport.filter({ schedule_version_id }),
      base44.entities.TeachingGroup.list(),
      base44.entities.Teacher.list()
    ]);

    const beforeMetrics = {
      total_slots: slots.length,
      conflicts: conflicts.length,
      unresolved: conflicts.filter(c => c.status === 'unresolved').length
    };

    let changes = [];
    let afterMetrics = { ...beforeMetrics };
    let isFeasible = true;

    // =====================================================================
    // SCENARIO: Remove Teacher
    // =====================================================================
    if (scenario_type === 'remove_teacher' && teacher_id) {
      const teacherSlots = slots.filter(s => s.teacher_id === teacher_id);
      changes.push(`Remove ${teacherSlots.length} slots taught by ${teacher_id}`);
      changes.push('All students in those groups need reassignment');
      
      // Estimate impact: removed slots + potential new conflicts
      afterMetrics.total_slots = slots.length - teacherSlots.length;
      afterMetrics.conflicts = conflicts.length + Math.ceil(teacherSlots.length * 0.3); // Estimate new conflicts
      isFeasible = teacherSlots.length <= slots.length * 0.2; // Feasible if < 20% of slots affected

      if (!isFeasible) {
        changes.push('⚠️ Removing this teacher would create CRITICAL gaps');
      }
    }

    // =====================================================================
    // SCENARIO: Reduce Room Capacity
    // =====================================================================
    else if (scenario_type === 'reduce_room') {
      changes.push('Capacity constraints become stricter');
      changes.push('Require reassignment of large groups to bigger rooms');
      afterMetrics.conflicts = conflicts.length + 2; // Estimate 2 new conflicts
      isFeasible = true; // Usually feasible with more rooms available
    }

    // =====================================================================
    // SCENARIO: Increase Required Hours
    // =====================================================================
    else if (scenario_type === 'add_hours' && group_id) {
      const group = teachingGroups.find(g => g.id === group_id);
      const currentHours = group?.hours_per_week || 4;
      const addedHours = 2; // Add 2 hours
      
      changes.push(`Increase ${group?.name} from ${currentHours}h to ${currentHours + addedHours}h per week`);
      changes.push('Requires 2 additional periods per week');
      
      // Check if feasible
      const availableSlots = 8 * 5 - slots.length; // Total periods - used periods
      isFeasible = availableSlots >= 2;
      
      if (isFeasible) {
        afterMetrics.total_slots = slots.length + 2;
      } else {
        changes.push('❌ Not enough available periods to fit additional hours');
      }
    }

    // =====================================================================
    // SCENARIO: Add Availability Constraint
    // =====================================================================
    else if (scenario_type === 'add_constraint') {
      const affectedSlots = Math.floor(slots.length * 0.1); // Assume 10% affected
      changes.push(`Block ${affectedSlots} existing slots due to new constraint`);
      changes.push('May trigger cascade of rescheduling');
      
      afterMetrics.total_slots = slots.length - affectedSlots;
      afterMetrics.conflicts = conflicts.length + Math.ceil(affectedSlots * 0.5);
      isFeasible = affectedSlots <= slots.length * 0.15; // Feasible if < 15% affected
    }

    // =====================================================================
    // SCENARIO: Move Period
    // =====================================================================
    else if (scenario_type === 'move_period' && group_id) {
      const groupSlots = slots.filter(s => s.teaching_group_id === group_id);
      changes.push(`Reschedule ${groupSlots.length} slots to different periods`);
      changes.push('Check for new double-booking conflicts');
      
      // Estimate: ~30% chance of new conflicts per moved slot
      const newConflicts = Math.floor(groupSlots.length * 0.3);
      afterMetrics.conflicts = conflicts.length + newConflicts;
      isFeasible = newConflicts <= 2; // Feasible if < 2 new conflicts expected
    }

    // Build recommendations
    let recommendations = '';
    if (!isFeasible) {
      recommendations = `⚠️ This scenario is likely INFEASIBLE. Recommendation: Modify constraints or add resources before proceeding.`;
    } else if (afterMetrics.conflicts > beforeMetrics.conflicts) {
      recommendations = `ℹ️ Scenario is feasible but may increase conflicts by ${afterMetrics.conflicts - beforeMetrics.conflicts}. Review conflict details before applying.`;
    } else if (afterMetrics.conflicts < beforeMetrics.conflicts) {
      recommendations = `✅ This scenario REDUCES conflicts! Proceeding is recommended.`;
    } else {
      recommendations = `✅ Scenario maintains current conflict level. Safe to proceed.`;
    }

    console.log(`[SimulateWhatIf] Result: Feasible=${isFeasible}, Conflicts: ${beforeMetrics.conflicts} → ${afterMetrics.conflicts}`);

    return Response.json({
      scenario_type,
      before_metrics: beforeMetrics,
      after_metrics: afterMetrics,
      changes,
      is_feasible: isFeasible,
      recommendations
    });

  } catch (error) {
    console.error('[SimulateWhatIf] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});