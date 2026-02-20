import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Get Solver Job Status (Polling Endpoint)
 * 
 * Returns current status of a solver job.
 * Frontend polls this every 2-5 seconds during execution.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.school_id) {
      return Response.json({ 
        ok: false, 
        error: 'Unauthorized' 
      }, { status: 403 });
    }
    
    const body = await req.json();
    const job_id = body?.job_id;
    
    if (!job_id) {
      return Response.json({ 
        ok: false, 
        error: 'job_id required' 
      }, { status: 400 });
    }
    
    // Fetch job
    const jobs = await base44.entities.SolverJob.filter({ 
      id: job_id,
      school_id: user.school_id 
    });
    
    const job = jobs[0];
    
    if (!job) {
      return Response.json({ 
        ok: false, 
        error: 'Job not found' 
      }, { status: 404 });
    }
    
    return Response.json({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        stage: job.stage,
        progress_percent: job.progress_percent || 0,
        result: job.result || null,
        error: job.error || null,
        request_id: job.request_id || null,
        started_at: job.started_at,
        completed_at: job.completed_at,
        duration_ms: job.duration_ms
      }
    });
    
  } catch (error) {
    console.error('[getSolverJobStatus] ❌ Error:', error);
    return Response.json({ 
      ok: false, 
      error: String(error?.message || error) 
    }, { status: 500 });
  }
});