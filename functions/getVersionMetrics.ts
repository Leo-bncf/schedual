import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GET VERSION METRICS
 * Retrieves comprehensive metrics for a schedule version
 * 
 * Input: {
 *   schedule_version_id: string
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
    const { schedule_version_id } = payload;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    // Load version + related data
    const [versions, slots, conflicts, optRuns, school] = await Promise.all([
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id, school_id: user.school_id }),
      base44.entities.ScheduleSlot.filter({ schedule_version: schedule_version_id }),
      base44.entities.ConflictReport.filter({ schedule_version_id }),
      base44.entities.OptimizationRun.filter({ schedule_version_id }),
      base44.entities.School.list({ query: { id: user.school_id } })
    ]);

    if (versions.length === 0) {
      return Response.json({ error: 'Schedule version not found' }, { status: 404 });
    }

    const version = versions[0];
    const schoolData = school[0];
    const latestRun = optRuns.sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];

    // Analyze slots
    const slotsPerDay = {};
    const slotsPerTeacher = {};
    const slotsPerRoom = {};
    const slotsPerGroup = {};

    for (const slot of slots) {
      slotsPerDay[slot.day] = (slotsPerDay[slot.day] || 0) + 1;
      slotsPerTeacher[slot.teacher_id] = (slotsPerTeacher[slot.teacher_id] || 0) + 1;
      slotsPerRoom[slot.room_id] = (slotsPerRoom[slot.room_id] || 0) + 1;
      slotsPerGroup[slot.teaching_group_id] = (slotsPerGroup[slot.teaching_group_id] || 0) + 1;
    }

    const slotValues = Object.values(slotsPerDay);
    const avgSlotsPerDay = slotValues.length > 0 ? (slotValues.reduce((a, b) => a + b, 0) / slotValues.length).toFixed(2) : 0;

    // Analyze conflicts
    const conflictsByType = {};
    const conflictsBySeverity = {};
    for (const conflict of conflicts) {
      conflictsByType[conflict.conflict_type] = (conflictsByType[conflict.conflict_type] || 0) + 1;
      conflictsBySeverity[conflict.severity] = (conflictsBySeverity[conflict.severity] || 0) + 1;
    }

    const metrics = {
      version: {
        id: version.id,
        name: version.name,
        status: version.status,
        academic_year: version.academic_year,
        term: version.term,
        generated_at: version.generated_at,
        published_at: version.published_at
      },

      schedule_stats: {
        total_slots: slots.length,
        total_hours: ((slots.length * schoolData.period_duration_minutes) / 60).toFixed(1),
        slots_per_day: slotsPerDay,
        avg_slots_per_day: avgSlotsPerDay,
        unique_teachers: Object.keys(slotsPerTeacher).length,
        unique_rooms: Object.keys(slotsPerRoom).length,
        unique_groups: Object.keys(slotsPerGroup).length,
        room_utilization: ((slots.length / (Object.keys(slotsPerRoom).length * schoolData.periods_per_day * schoolData.days_per_week)) * 100).toFixed(1) + '%'
      },

      conflict_stats: {
        total_conflicts: conflicts.length,
        by_type: conflictsByType,
        by_severity: conflictsBySeverity,
        unresolved: conflicts.filter(c => c.status === 'unresolved').length,
        resolved: conflicts.filter(c => c.status === 'resolved').length
      },

      optimization_history: latestRun ? {
        algorithm: latestRun.algorithm,
        runtime_seconds: latestRun.duration_seconds || 'unknown',
        objective_score: latestRun.objective_score,
        hard_constraints_satisfied: latestRun.hard_constraints_satisfied,
        soft_constraint_score: latestRun.soft_constraint_score
      } : null,

      quality_indicators: {
        is_feasible: conflicts.filter(c => c.severity === 'critical').length === 0,
        can_publish: conflicts.filter(c => c.status === 'unresolved').length === 0,
        recommendation: conflicts.filter(c => c.status === 'unresolved').length === 0 
          ? 'Ready to publish' 
          : `${conflicts.filter(c => c.status === 'unresolved').length} conflicts need resolution`
      }
    };

    return Response.json(metrics);

  } catch (error) {
    console.error('[GetVersionMetrics] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});