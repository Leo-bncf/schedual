import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Start Async Solver Job
 * 
 * Creates a SolverJob record and triggers async execution.
 * Returns job_id immediately for frontend polling.
 * 
 * Flow:
 * 1. Create job record (status=pending)
 * 2. Trigger runSolverAsync in background (no await)
 * 3. Return job_id immediately
 */

Deno.serve(async (req) => {
  console.log('[startSolverJob] 🚀 Request received');
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.school_id) {
      return Response.json({ 
        ok: false, 
        error: 'Unauthorized or no school assigned' 
      }, { status: 403 });
    }
    
    const body = await req.json();
    const schedule_version_id = body?.schedule_version_id;
    const audit = body?.audit || false;
    
    if (!schedule_version_id) {
      return Response.json({ 
        ok: false, 
        error: 'schedule_version_id required' 
      }, { status: 400 });
    }
    
    // Create job record
    const job = await base44.entities.SolverJob.create({
      school_id: user.school_id,
      schedule_version_id,
      status: 'pending',
      stage: 'queued',
      progress_percent: 0,
      started_at: new Date().toISOString()
    });
    
    console.log(`[startSolverJob] ✅ Job created: ${job.id}`);
    
    // Trigger async execution (fire-and-forget)
    // NOTE: We don't await this - let it run in background
    base44.functions.invoke('runSolverAsync', {
      job_id: job.id,
      schedule_version_id,
      school_id: user.school_id,
      audit
    }).catch(err => {
      console.error(`[startSolverJob] ❌ Failed to trigger runSolverAsync:`, err);
    });
    
    console.log(`[startSolverJob] 🔄 Async execution triggered for job ${job.id}`);
    
    return Response.json({
      ok: true,
      job_id: job.id,
      status: 'pending',
      message: 'Job started - poll getSolverJobStatus for updates'
    });
    
  } catch (error) {
    console.error('[startSolverJob] ❌ Error:', error);
    return Response.json({ 
      ok: false, 
      error: String(error?.message || error) 
    }, { status: 500 });
  }
});