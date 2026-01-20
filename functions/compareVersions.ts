import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * COMPARE SCHEDULE VERSIONS
 * Compares two schedule versions side-by-side
 * 
 * Input: {
 *   version_1_id: string,
 *   version_2_id: string
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
    const { version_1_id, version_2_id } = payload;

    if (!version_1_id || !version_2_id) {
      return Response.json({ error: 'Both version IDs required' }, { status: 400 });
    }

    // Load both versions
    const [v1, v2] = await Promise.all([
      base44.entities.ScheduleVersion.filter({ id: version_1_id, school_id: user.school_id }),
      base44.entities.ScheduleVersion.filter({ id: version_2_id, school_id: user.school_id })
    ]);

    if (v1.length === 0 || v2.length === 0) {
      return Response.json({ error: 'One or both versions not found' }, { status: 404 });
    }

    const version1 = v1[0];
    const version2 = v2[0];

    // Load slots for both versions
    const [slots1, slots2, conflicts1, conflicts2] = await Promise.all([
      base44.entities.ScheduleSlot.filter({ schedule_version: version_1_id }),
      base44.entities.ScheduleSlot.filter({ schedule_version: version_2_id }),
      base44.entities.ConflictReport.filter({ schedule_version_id: version_1_id, status: 'unresolved' }),
      base44.entities.ConflictReport.filter({ schedule_version_id: version_2_id, status: 'unresolved' })
    ]);

    // Calculate metrics for each version
    const calculateMetrics = (slots, conflicts) => {
      const uniqueGroups = new Set(slots.map(s => s.teaching_group_id));
      const uniqueTeachers = new Set(slots.map(s => s.teacher_id));
      const uniqueRooms = new Set(slots.map(s => s.room_id));

      return {
        total_slots: slots.length,
        unique_groups: uniqueGroups.size,
        unique_teachers: uniqueTeachers.size,
        unique_rooms: uniqueRooms.size,
        unresolved_conflicts: conflicts.length,
        conflict_breakdown: {
          critical: conflicts.filter(c => c.severity === 'critical').length,
          high: conflicts.filter(c => c.severity === 'high').length,
          medium: conflicts.filter(c => c.severity === 'medium').length,
          low: conflicts.filter(c => c.severity === 'low').length
        }
      };
    };

    const metrics1 = calculateMetrics(slots1, conflicts1);
    const metrics2 = calculateMetrics(slots2, conflicts2);

    // Compare
    const comparison = {
      version_1: {
        id: version1.id,
        name: version1.name,
        status: version1.status,
        generated_at: version1.generated_at,
        score: version1.score || 0,
        metrics: metrics1
      },
      version_2: {
        id: version2.id,
        name: version2.name,
        status: version2.status,
        generated_at: version2.generated_at,
        score: version2.score || 0,
        metrics: metrics2
      },
      differences: {
        score_delta: (metrics2.unresolved_conflicts - metrics1.unresolved_conflicts) * -1,
        conflict_improvement: metrics1.unresolved_conflicts - metrics2.unresolved_conflicts,
        slots_added: metrics2.total_slots - metrics1.total_slots,
        winner: metrics2.unresolved_conflicts < metrics1.unresolved_conflicts ? 'version_2' : metrics1.unresolved_conflicts < metrics2.unresolved_conflicts ? 'version_1' : 'tie'
      }
    };

    return Response.json(comparison);

  } catch (error) {
    console.error('[CompareVersions] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});