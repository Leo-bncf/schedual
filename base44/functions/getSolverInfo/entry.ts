import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Fetch solver identity and metadata from external solver service
 * GET /solver-info endpoint
 * Returns: { engine, version, build_sha, implementation }
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const SOLVER_ENDPOINT = Deno.env.get('OR_TOOL_ENDPOINT') || Deno.env.get('SOLVER_ENDPOINT');
    
    if (!SOLVER_ENDPOINT) {
      return Response.json({ 
        error: 'Solver endpoint not configured',
        engine: 'unknown',
        available: false
      }, { status: 200 });
    }

    // Get API key
    const SOLVER_API_KEY = Deno.env.get('OR_TOOL_API_KEY') || Deno.env.get('SOLVER_API_KEY');
    
    if (!SOLVER_API_KEY) {
      return Response.json({ 
        error: 'Solver API key not configured',
        engine: 'unknown',
        available: false
      }, { status: 200 });
    }

    // Call GET /solver-info with API key
    const infoUrl = SOLVER_ENDPOINT.replace('/solve-and-push', '/solver-info');
    
    console.log('[getSolverInfo] Fetching from:', infoUrl, 'with API key');
    
    const response = await fetch(infoUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SOLVER_API_KEY
      }
    });

    if (!response.ok) {
      console.error('[getSolverInfo] Solver /solver-info returned', response.status);
      return Response.json({
        error: `Solver returned HTTP ${response.status}`,
        engine: 'unknown',
        available: false,
        endpoint: infoUrl,
        httpStatus: response.status
      }, { status: 200 });
    }

    const data = await response.json();
    
    console.log('[getSolverInfo] Solver identity:', data);

    return Response.json({
      success: true,
      ...data,
      endpoint: SOLVER_ENDPOINT,
      available: true
    });
  } catch (error) {
    console.error('[getSolverInfo] Error:', error);
    return Response.json({ 
      error: error.message,
      engine: 'unknown',
      available: false
    }, { status: 200 });
  }
});