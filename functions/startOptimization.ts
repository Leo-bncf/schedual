import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * START OPTIMIZATION
 * Triggers OR-Tools solver and creates OptimizationRun record
 * 
 * Input: {
 *   schedule_version_id: string,
 *   algorithm: "csp" | "mip" | "genetic" (default: "csp"),
 *   time_limit_seconds: number (default: 30)
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
    const { schedule_version_id, algorithm = 'csp', time_limit_seconds = 30 } = payload;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }

    console.log(`[StartOptimization] Version: ${schedule_version_id}, Algorithm: ${algorithm}`);

    // Verify schedule version exists
    const versions = await base44.entities.ScheduleVersion.filter({
      id: schedule_version_id,
      school_id: user.school_id
    });

    if (versions.length === 0) {
      return Response.json({ error: 'Schedule version not found' }, { status: 404 });
    }

    const version = versions[0];

    // Create OptimizationRun record
    const optimizationRun = await base44.entities.OptimizationRun.create({
      school_id: user.school_id,
      schedule_version_id,
      status: 'running',
      algorithm,
      parameters: {
        time_limit_seconds,
        start_time: new Date().toISOString()
      },
      start_time: new Date().toISOString()
    });

    console.log(`[StartOptimization] Created OptimizationRun: ${optimizationRun.id}`);

    // Call OR-Tools solver asynchronously (don't wait)
    base44.functions.invoke('orToolsScheduler', {
      scheduleVersionId: schedule_version_id,
      optimizationRunId: optimizationRun.id,
      timeLimit: time_limit_seconds
    }).catch(err => {
      console.error(`[StartOptimization] Solver error for run ${optimizationRun.id}:`, err);
    });

    return Response.json({
      optimization_run_id: optimizationRun.id,
      status: 'running',
      message: 'Optimization started. Checking back every 2 seconds for results...'
    });

  } catch (error) {
    console.error('[StartOptimization] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});