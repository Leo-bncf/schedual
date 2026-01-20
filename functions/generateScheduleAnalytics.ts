import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * GENERATE SCHEDULE ANALYTICS
 * Comprehensive analytics and metrics for a schedule version
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

    // Load all relevant data
    const [slots, conflicts, teachers, rooms, groups, school] = await Promise.all([
      base44.entities.ScheduleSlot.filter({ schedule_version: schedule_version_id }),
      base44.entities.ConflictReport.filter({ schedule_version_id }),
      base44.entities.Teacher.list(),
      base44.entities.Room.list(),
      base44.entities.TeachingGroup.list(),
      base44.entities.School.filter({ id: user.school_id })
    ]);

    const schoolData = school[0] || { period_duration_minutes: 45, periods_per_day: 8, days_per_week: 5 };
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const PERIODS = schoolData.periods_per_day || 8;

    // =====================================================================
    // SUMMARY STATISTICS
    // =====================================================================
    const totalSlots = slots.length;
    const totalHours = ((totalSlots * schoolData.period_duration_minutes) / 60).toFixed(1);
    const maxSlots = PERIODS * DAYS.length * rooms.length;

    // =====================================================================
    // UTILIZATION ANALYSIS
    // =====================================================================
    const utilizationByDay = {};
    const slotsByDay = {};
    const slotsByPeriod = {};

    DAYS.forEach(day => {
      utilizationByDay[day] = 0;
      slotsByDay[day] = 0;
    });

    Array.from({ length: PERIODS }, (_, i) => i + 1).forEach(p => {
      slotsByPeriod[p] = 0;
    });

    for (const slot of slots) {
      slotsByDay[slot.day] = (slotsByDay[slot.day] || 0) + 1;
      slotsByPeriod[slot.period] = (slotsByPeriod[slot.period] || 0) + 1;
    }

    const avgRoomUtilization = ((totalSlots / (rooms.length * PERIODS * DAYS.length)) * 100).toFixed(1);
    
    const utilizationByDayData = DAYS.map(day => ({
      day,
      utilization: ((slotsByDay[day] / (rooms.length * PERIODS)) * 100).toFixed(0),
      slots: slotsByDay[day]
    }));

    const peakPeriod = Object.entries(slotsByPeriod).sort((a, b) => b[1] - a[1])[0];

    // =====================================================================
    // CONFLICT ANALYSIS
    // =====================================================================
    const conflictsByType = {};
    const conflictsBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const unresolved = conflicts.filter(c => c.status === 'unresolved').length;
    const resolved = conflicts.filter(c => c.status === 'resolved').length;

    for (const conflict of conflicts) {
      conflictsByType[conflict.conflict_type] = (conflictsByType[conflict.conflict_type] || 0) + 1;
      conflictsBySeverity[conflict.severity] = (conflictsBySeverity[conflict.severity] || 0) + 1;
    }

    const conflictByTypeData = Object.entries(conflictsByType).map(([type, count]) => ({
      type: type.replace(/_/g, ' '),
      count
    }));

    // =====================================================================
    // WORKLOAD ANALYSIS
    // =====================================================================
    const teacherHours = {};
    const consecutivePeriods = {};

    for (const slot of slots) {
      if (slot.teacher_id) {
        teacherHours[slot.teacher_id] = (teacherHours[slot.teacher_id] || 0) + 1;
      }
    }

    const teacherHoursData = Object.entries(teacherHours)
      .map(([teacherId, hours]) => {
        const teacher = teachers.find(t => t.id === teacherId);
        return {
          id: teacherId,
          name: teacher?.full_name || 'Unknown',
          hours: (hours * schoolData.period_duration_minutes / 60).toFixed(1)
        };
      })
      .sort((a, b) => parseFloat(b.hours) - parseFloat(a.hours))
      .slice(0, 10); // Top 10

    const hoursArray = teacherHoursData.map(t => parseFloat(t.hours));
    const avgHoursPerTeacher = (hoursArray.reduce((a, b) => a + b, 0) / hoursArray.length).toFixed(1);
    const maxHours = Math.max(...hoursArray).toFixed(1);
    const minHours = Math.min(...hoursArray).toFixed(1);

    // Calculate imbalance (standard deviation / mean)
    const mean = parseFloat(avgHoursPerTeacher);
    const variance = hoursArray.reduce((sum, h) => sum + Math.pow(h - mean, 2), 0) / hoursArray.length;
    const stdDev = Math.sqrt(variance);
    const imbalanceScore = (stdDev / mean).toFixed(2);

    // =====================================================================
    // QUALITY SCORE CALCULATION
    // =====================================================================
    let qualityScore = 100;

    // Deduct for conflicts
    qualityScore -= Math.min(conflicts.length * 5, 40); // Up to -40 points

    // Deduct for utilization (target: 60-80%)
    const utilization = parseFloat(avgRoomUtilization);
    if (utilization < 50 || utilization > 90) {
      qualityScore -= 10;
    }

    // Deduct for workload imbalance (target: < 0.3)
    if (parseFloat(imbalanceScore) > 0.3) {
      qualityScore -= 15;
    }

    // Deduct for consecutive period violations
    const consecutiveViolations = conflicts.filter(c => c.conflict_type === 'consecutive_periods_exceeded').length;
    qualityScore -= Math.min(consecutiveViolations * 3, 10);

    qualityScore = Math.max(0, Math.min(100, qualityScore));

    // =====================================================================
    // BUILD RESPONSE
    // =====================================================================
    const analytics = {
      summary: {
        total_slots: totalSlots,
        total_hours: totalHours,
        max_slots: maxSlots,
        coverage_percent: ((totalSlots / maxSlots) * 100).toFixed(1)
      },

      utilization: {
        avg_room_utilization: avgRoomUtilization,
        rooms_count: rooms.length,
        by_day: utilizationByDayData,
        peak_period: `Period ${peakPeriod[0]} (${peakPeriod[1]} slots)`
      },

      conflicts: {
        total: conflicts.length,
        unresolved,
        resolved,
        by_type: conflictByTypeData,
        by_severity: conflictsBySeverity
      },

      load_analysis: {
        teacher_hours: teacherHoursData,
        avg_hours_per_teacher: avgHoursPerTeacher,
        max_hours: maxHours,
        min_hours: minHours,
        imbalance_score: parseFloat(imbalanceScore)
      },

      quality_score: qualityScore,
      recommendations: buildRecommendations(qualityScore, parseFloat(imbalanceScore), parseFloat(avgRoomUtilization), conflicts.length)
    };

    console.log(`[GenerateAnalytics] Quality: ${qualityScore}%, Conflicts: ${conflicts.length}, Utilization: ${avgRoomUtilization}%`);

    return Response.json(analytics);

  } catch (error) {
    console.error('[GenerateAnalytics] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function buildRecommendations(qualityScore, imbalance, utilization, conflictCount) {
  const recommendations = [];

  if (conflictCount > 5) {
    recommendations.push('High conflict count detected. Consider running optimization again.');
  }

  if (imbalance > 0.3) {
    recommendations.push('Workload is imbalanced across teachers. Rebalance assignments.');
  }

  if (utilization < 50) {
    recommendations.push('Room utilization is low. Consider consolidating groups.');
  }

  if (utilization > 85) {
    recommendations.push('Room utilization is very high. Risk of scheduling conflicts.');
  }

  if (qualityScore < 70) {
    recommendations.push('Overall schedule quality is poor. Regenerate with adjusted constraints.');
  }

  return recommendations.length > 0 ? recommendations : ['Schedule is well-optimized'];
}