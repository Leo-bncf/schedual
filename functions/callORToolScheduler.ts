import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Calls OR-Tool scheduling service and processes results
 * 
 * Sends clean schedule_problem_v1 payload
 * Receives schedule_solution_v1 response
 * Maps assignments back to Base44 entities (ScheduleSlot)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { schedule_version_id } = await req.json();

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    // Step 1: Build scheduling problem
    const buildResponse = await base44.functions.invoke('buildSchedulingProblem', {
      schedule_version_id
    });

    if (!buildResponse.data.success) {
      return Response.json({ 
        error: 'Failed to build scheduling problem',
        details: buildResponse.data 
      }, { status: 500 });
    }

    const problem = buildResponse.data.problem;

    // Step 2: Call OR-Tool service
    const OR_TOOL_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT');
    const OR_TOOL_API_KEY = Deno.env.get('OR_TOOL_API_KEY');

    if (!OR_TOOL_ENDPOINT || !OR_TOOL_API_KEY) {
      return Response.json({ 
        error: 'OR-Tool service not configured. Set OR_TOOL_ENDPOINT and OR_TOOL_API_KEY.'
      }, { status: 503 });
    }

    console.log(`Calling OR-Tool at ${OR_TOOL_ENDPOINT}...`);

    const solverResponse = await fetch(OR_TOOL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OR_TOOL_API_KEY}`
      },
      body: JSON.stringify(problem)
    });

    if (!solverResponse.ok) {
      const errorText = await solverResponse.text();
      console.error('OR-Tool error:', errorText);
      return Response.json({ 
        error: 'OR-Tool scheduling failed',
        details: errorText 
      }, { status: 500 });
    }

    const solution = await solverResponse.json();

    // Step 3: Validate solution format
    if (!solution.assignments || !Array.isArray(solution.assignments)) {
      return Response.json({ 
        error: 'Invalid solution format from OR-Tool',
        solution 
      }, { status: 500 });
    }

    // Step 4: Map assignments back to Base44 ScheduleSlot entities
    const slots = [];
    for (const assignment of solution.assignments) {
      const time_slot = problem.time_slots.find(ts => ts.id === assignment.time_slot_id);
      if (!time_slot) continue;

      slots.push({
        school_id: user.school_id,
        schedule_version: schedule_version_id,
        teaching_group_id: assignment.teaching_unit_id,
        teacher_id: assignment.teacher_id,
        room_id: assignment.room_id,
        day: time_slot.day,
        period: time_slot.period,
        is_double_period: false,
        status: 'scheduled'
      });
    }

    // Step 5: Delete existing slots for this version
    const existingSlots = await base44.asServiceRole.entities.ScheduleSlot.filter({
      school_id: user.school_id,
      schedule_version: schedule_version_id
    });

    for (const slot of existingSlots) {
      await base44.asServiceRole.entities.ScheduleSlot.delete(slot.id);
    }

    // Step 6: Create new slots
    if (slots.length > 0) {
      await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(slots);
    }

    // Step 7: Update schedule version metadata
    await base44.asServiceRole.entities.ScheduleVersion.update(schedule_version_id, {
      generated_at: new Date().toISOString(),
      score: solution.stats?.teacher_utilization || 0,
      conflicts_count: solution.unassigned_units?.length || 0
    });

    return Response.json({
      success: true,
      message: 'Schedule generated successfully',
      stats: {
        slots_created: slots.length,
        unassigned_units: solution.unassigned_units?.length || 0,
        teacher_utilization: solution.stats?.teacher_utilization || 0,
        room_utilization: solution.stats?.room_utilization || 0
      }
    });

  } catch (error) {
    console.error('OR-Tool scheduler error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate schedule' 
    }, { status: 500 });
  }
});