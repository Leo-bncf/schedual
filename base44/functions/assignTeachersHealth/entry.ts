import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Health check endpoint for assignTeachers function
 * Tests: auth, DB connectivity, basic SDK operations
 * Returns: {ok: true} if healthy, error details otherwise
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({
        ok: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
        elapsedMs: Date.now() - startTime
      }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Admin access required',
        elapsedMs: Date.now() - startTime
      }, { status: 403 });
    }

    const [teachingGroups, teachers] = await Promise.all([
      base44.asServiceRole.entities.TeachingGroup.list(),
      base44.asServiceRole.entities.Teacher.list()
    ]);
    
    const canUseServiceRole = !!base44.asServiceRole;
    
    return Response.json({
      ok: true,
      message: 'assignTeachers runtime is healthy',
      checks: {
        authenticated_user: true,
        admin_access: true,
        db_read: true,
        service_role: canUseServiceRole
      },
      data: {
        teaching_groups_count: teachingGroups.length,
        teachers_count: teachers.length
      },
      elapsedMs: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('[assignTeachersHealth] ❌ Health check failed:', error);
    
    return Response.json({
      ok: false,
      error: 'HEALTH_CHECK_FAILED',
      message: error?.message || 'Unknown error',
      errorStack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      elapsedMs: Date.now() - startTime
    }, { status: 500 });
  }
});