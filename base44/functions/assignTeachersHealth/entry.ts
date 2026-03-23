import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Health check endpoint for assignTeachers function
 * Tests: auth, DB connectivity, basic SDK operations
 * Returns: {ok: true} if healthy, error details otherwise
 */
Deno.serve(async (req) => {
  const startTime = Date.now();
  
  try {
    // Test 1: Auth
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({
        ok: false,
        error: 'AUTH_FAILED',
        message: 'Authentication check failed - no user',
        elapsedMs: Date.now() - startTime
      });
    }
    
    // Test 2: DB read
    const school_id = user.school_id;
    if (!school_id) {
      return Response.json({
        ok: false,
        error: 'NO_SCHOOL',
        message: 'User has no school_id assigned',
        user: { id: user.id, email: user.email },
        elapsedMs: Date.now() - startTime
      });
    }
    
    // Test 3: Entity queries
    const [teachingGroups, teachers] = await Promise.all([
      base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
      base44.entities.Teacher.filter({ school_id, is_active: true })
    ]);
    
    // Test 4: Service role check
    const canUseServiceRole = !!base44.asServiceRole;
    
    return Response.json({
      ok: true,
      message: 'assignTeachers runtime is healthy',
      checks: {
        auth: true,
        school_id: true,
        db_read: true,
        service_role: canUseServiceRole
      },
      data: {
        user_id: user.id,
        school_id,
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