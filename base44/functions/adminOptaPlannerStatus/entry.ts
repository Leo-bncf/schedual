import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getBaseUrl(): string {
  const raw = Deno.env.get('OPTAPLANNER_ENDPOINT') || '';
  return raw.replace(/\/$/, '').replace(/\/base44\/ingest$/, '');
}

async function fetchEndpoint(url: string, apiKey: string | undefined) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const start = Date.now();
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    const ms = Date.now() - start;
    if (!res.ok) return { ok: false, status: res.status, ms, error: `HTTP ${res.status}` };
    const json = await res.json().catch(() => null);
    return { ok: true, status: res.status, ms, data: json };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: e.message ?? 'Unreachable' };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const superAdmins = (Deno.env.get('SUPER_ADMIN_EMAILS') || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!superAdmins.includes((user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const base = getBaseUrl();
    const apiKey = Deno.env.get('OPTAPLANNER_API_KEY');

    if (!base) {
      return Response.json({ error: 'OPTAPLANNER_ENDPOINT is not configured' }, { status: 500 });
    }

    // Derive metrics server URL — same host as OptaPlanner, port 8081
    const metricsBase = base.replace(/:(\d+)$/, ':8081');

    // Call all endpoints in parallel
    const [health, version, solverInfo, sysMetrics] = await Promise.all([
      fetchEndpoint(`${base}/health`, apiKey),
      fetchEndpoint(`${base}/version`, apiKey),
      fetchEndpoint(`${base}/solver-info`, apiKey),
      fetchEndpoint(`${metricsBase}/metrics`, apiKey),
    ]);

    // Pull recent solve history from ScheduleVersion records
    const recentVersions = await base44.asServiceRole.entities.ScheduleVersion
      .filter({}, '-generated_at', 20)
      .catch(() => []);

    const solveHistory = recentVersions
      .filter((v: any) => v.generated_at)
      .map((v: any) => ({
        id: v.id,
        school_id: v.school_id,
        generated_at: v.generated_at,
        notes: v.notes || null,
        programmes: v.generation_params?.programmes ?? [],
        solver_timeslots: Array.isArray(v.generation_params?.solverTimeslots)
          ? v.generation_params.solverTimeslots.length
          : null,
      }));

    return Response.json({
      success: true,
      base_url: base,
      checked_at: new Date().toISOString(),
      health,
      version,
      solver_info: solverInfo,
      sys_metrics: sysMetrics,
      solve_history: solveHistory,
    });
  } catch (error) {
    console.error('[adminOptaPlannerStatus] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
