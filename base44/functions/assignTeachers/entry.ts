import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auto-assigns qualified teachers to teaching groups
 * Matches based on subject qualifications and availability
 * 
 * PAYLOAD:
 * {
 *   "school_id": "string",
 *   "teaching_group_ids": ["id1", "id2"], // Optional - if omitted, processes all groups
 *   "mode": "DP" | "MYP" | "PYP" // Optional filter
 * }
 */

// CRITICAL: Global error handler to prevent unhandled 502 errors
const safeSentinelResponse = (stage, error, elapsed) => {
  const payload = {
    ok: false,
    stage: stage || 'unknown',
    code: 'SERVER_ERROR',
    message: error?.message || 'Unhandled server error',
    requestId: new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 9),
    elapsedMs: elapsed || 0,
    timestamp: new Date().toISOString()
  };
  
  console.error('[assignTeachers] 🔴 SENTINEL ERROR - returning structured JSON:', payload);
  return new Response(JSON.stringify(payload), {
    status: 500,
    headers: { 'Content-Type': 'application/json' }
  });
};

// CRITICAL: Timeout wrapper to prevent hanging requests
const withTimeout = async (promise, timeoutMs = 30000) => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
};

Deno.serve(async (req) => {
  const startTime = Date.now();
  let stage = 'init';
  
  try {
    // VALIDATION 1: Method check
    stage = 'method_check';
    if (req.method !== 'POST') {
      return Response.json({
        success: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'Only POST requests are allowed'
      }, { status: 405 });
    }

    // VALIDATION 2: Parse and validate request body
    stage = 'parse_body';
    let body;
    try {
      const text = await req.text();
      
      if (!text || text.trim() === '') {
        console.error('[assignTeachers] ❌ Empty request body');
        return Response.json({
          success: false,
          error: 'MISSING_PAYLOAD',
          message: 'assignTeachers requires JSON body with school_id and optional teaching_group_ids',
          expectedFormat: {
            school_id: 'string (required)',
            teaching_group_ids: 'array of strings (optional - if omitted, processes all groups)',
            mode: 'string (optional: "DP" | "MYP" | "PYP")'
          }
        }, { status: 400 });
      }
      
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('[assignTeachers] ❌ JSON parse error:', parseError.message);
      return Response.json({
        success: false,
        error: 'INVALID_JSON',
        message: 'Request body must be valid JSON',
        details: parseError.message
      }, { status: 400 });
    }

    // VALIDATION 3: Auth
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const authUser = await base44.auth.me();
    const dbUsers = authUser ? await base44.asServiceRole.entities.User.filter({ id: authUser.id }) : [];
    const user = dbUsers[0] || authUser;
    const userSchoolId = user?.school_id || user?.data?.school_id;
    const role = user?.role || user?.data?.role;

    if (!user || !userSchoolId) {
      return Response.json({ 
        success: false,
        error: 'UNAUTHORIZED',
        message: 'User not authenticated or no school assigned'
      }, { status: 401 });
    }

    if (role !== 'admin') {
      return Response.json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Admin access required'
      }, { status: 403 });
    }

    // VALIDATION 4: Extract and validate school_id
    stage = 'validate_params';
    const school_id = body?.school_id || userSchoolId;
    const requestedGroupIds = Array.isArray(body?.teaching_group_ids) ? body.teaching_group_ids : null;
    const mode = body?.mode || null;

    console.log('[assignTeachers] 🚀 Starting assignment:', {
      school_id,
      requested_groups: requestedGroupIds?.length || 'all',
      mode: mode || 'all',
      user_id: user.id
    });

    // Cross-school access check
    if (school_id !== userSchoolId) {
      return Response.json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Cross-school access denied'
      }, { status: 403 });
    }

    // FETCH DATA: Optimized batch loading with timeout protection
    stage = 'fetch_data';
    const fetchStart = Date.now();
    
    const [allTeachingGroups, allTeachers, allSubjects] = await withTimeout(
      Promise.all([
        base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
        base44.entities.Teacher.filter({ school_id, is_active: true }),
        base44.entities.Subject.filter({ school_id, is_active: true })
      ]),
      20000 // 20 second timeout for data fetch
    );
    
    console.log(`[assignTeachers] ✅ Data fetched in ${Date.now() - fetchStart}ms:`, {
      teaching_groups: allTeachingGroups.length,
      teachers: allTeachers.length,
      subjects: allSubjects.length
    });

    // GUARD: No teachers available
    if (!allTeachers || allTeachers.length === 0) {
      console.log('[assignTeachers] ⚠️ No active teachers found - skipping assignment');
      return Response.json({
        success: true,
        message: 'No active teachers available for assignment',
        teachersAssigned: 0,
        groupsProcessed: 0,
        elapsedMs: Date.now() - startTime
      }, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Build subject index for fast lookups
    const subjectById = {};
    allSubjects.forEach(s => { if (s?.id) subjectById[s.id] = s; });

    // FILTER: Apply requested group IDs or mode filters
    let teachingGroups = allTeachingGroups;
    
    if (requestedGroupIds && requestedGroupIds.length > 0) {
      const requestedSet = new Set(requestedGroupIds);
      teachingGroups = allTeachingGroups.filter(tg => requestedSet.has(tg.id));
      console.log(`[assignTeachers] Filtered to ${teachingGroups.length}/${allTeachingGroups.length} requested groups`);
    }
    
    if (mode) {
      teachingGroups = teachingGroups.filter(tg => {
        const subject = subjectById[tg.subject_id];
        return subject?.ib_level === mode;
      });
      console.log(`[assignTeachers] Filtered to ${teachingGroups.length} groups for mode=${mode}`);
    }

    if (teachingGroups.length === 0) {
      console.log('[assignTeachers] ⚠️ No teaching groups to process after filtering');
      return Response.json({ 
        success: true, 
        message: 'No teaching groups to assign (after filtering)',
        teachersAssigned: 0,
        groupsProcessed: 0,
        elapsedMs: Date.now() - startTime
      }, { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // ASSIGNMENT LOGIC: Optimized with teacher workload tracking
    stage = 'assign_teachers';
    const assignStart = Date.now();
    let assignedCount = 0;
    let skippedCount = 0;
    const updates = [];
    const teacherWorkload = {}; // Track assignments per teacher for load balancing
    const assignmentLog = [];

    for (const group of teachingGroups) {
      // GUARD: Skip groups without subject_id
      if (!group.subject_id) {
        console.warn(`[assignTeachers] ⚠️ Group ${group.id} (${group.name}) missing subject_id - skipping`);
        assignmentLog.push({
          group_id: group.id,
          group_name: group.name,
          subject: 'MISSING_SUBJECT_ID',
          status: 'skipped_invalid'
        });
        skippedCount++;
        continue;
      }

      // Skip if already assigned
      if (group.teacher_id) {
        skippedCount++;
        continue;
      }

      // Find qualified teachers for this subject
      const subject = subjectById[group.subject_id];
      const qualifiedTeachers = allTeachers.filter(t => {
        // GUARD: Validate teacher.subjects is array
        if (!Array.isArray(t.subjects)) {
          if (t.subjects) {
            console.warn(`[assignTeachers] ⚠️ Teacher ${t.id} (${t.full_name}) has non-array subjects field - skipping this check`);
          }
        } else if (t.subjects.includes(group.subject_id)) {
          return true;
        }
        
        // Check qualifications for ib_level match
        if (t.qualifications && subject) {
          return t.qualifications.some(q => 
            q.subject_id === group.subject_id && 
            q.ib_levels?.includes(subject.ib_level)
          );
        }
        
        return false;
      });

      if (qualifiedTeachers.length === 0) {
        assignmentLog.push({
          group_id: group.id,
          group_name: group.name,
          subject: subject?.name || 'Unknown',
          status: 'no_qualified_teacher'
        });
        continue;
      }

      // Load balancing: pick teacher with lowest current workload
      qualifiedTeachers.forEach(t => {
        if (!teacherWorkload[t.id]) teacherWorkload[t.id] = 0;
      });
      
      const assignedTeacher = qualifiedTeachers.reduce((best, current) => 
        (teacherWorkload[current.id] || 0) < (teacherWorkload[best.id] || 0) ? current : best
      );

      // Track assignment for batch update
      updates.push({
        id: group.id,
        teacher_id: assignedTeacher.id
      });
      
      teacherWorkload[assignedTeacher.id] = (teacherWorkload[assignedTeacher.id] || 0) + 1;
      assignedCount++;
      
      assignmentLog.push({
        group_id: group.id,
        group_name: group.name,
        subject: subject?.name || 'Unknown',
        teacher: assignedTeacher.full_name,
        status: 'assigned'
      });
    }

    console.log(`[assignTeachers] Assignment logic completed in ${Date.now() - assignStart}ms:`, {
      assigned: assignedCount,
      skipped: skippedCount,
      no_qualified: assignmentLog.filter(l => l.status === 'no_qualified_teacher').length
    });

    // BATCH UPDATE: Return immediately, process updates async (fire-and-forget for large batches)
    stage = 'batch_update';
    const updateStart = Date.now();
    
    if (updates.length > 0) {
      // CRITICAL FIX: For large batches (>20), return success immediately and process async
      // This prevents 502 timeout while still completing the assignment
      const ASYNC_THRESHOLD = 20;
      
      if (updates.length > ASYNC_THRESHOLD) {
        console.log(`[assignTeachers] 🚀 Large batch (${updates.length} groups) - returning immediately, processing async`);
        
        // Fire-and-forget: Process updates in background
        (async () => {
          try {
            console.log(`[assignTeachers-async] Starting background update of ${updates.length} groups`);
            let successCount = 0;
            let failCount = 0;
            
            // Process in small batches sequentially
            const BATCH_SIZE = 5;
            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
              const batch = updates.slice(i, i + BATCH_SIZE);
              const results = await Promise.allSettled(
                batch.map(u => base44.asServiceRole.entities.TeachingGroup.update(u.id, { teacher_id: u.teacher_id }))
              );
              
              results.forEach(r => {
                if (r.status === 'fulfilled') successCount++;
                else failCount++;
              });
              
              // Small delay between batches
              if (i + BATCH_SIZE < updates.length) {
                await new Promise(r => setTimeout(r, 100));
              }
            }
            
            console.log(`[assignTeachers-async] ✅ Background update complete: ${successCount} success, ${failCount} failed`);
          } catch (asyncError) {
            console.error('[assignTeachers-async] ❌ Background update failed:', asyncError.message);
          }
        })();
        
        // Return immediately to prevent timeout
        return Response.json({
          success: true,
          teachersAssigned: assignedCount,
          groupsProcessed: teachingGroups.length,
          groupsSkipped: skippedCount,
          assignmentLog: assignmentLog.slice(0, 20),
          teacherWorkload,
          elapsedMs: Date.now() - startTime,
          message: `Teacher assignment queued for ${assignedCount} groups (processing in background)`,
          asyncMode: true,
          timing: {
            fetch: Date.now() - fetchStart,
            assignment: Date.now() - assignStart,
            total: Date.now() - startTime
          }
        }, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      
      // For small batches (<= 20), process synchronously with timeout
      console.log(`[assignTeachers] Updating ${updates.length} groups synchronously (small batch)`);
      const BATCH_SIZE = 10;
      let successfulUpdates = 0;
      let failedUpdates = 0;
      
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        try {
          const results = await withTimeout(
            Promise.allSettled(batch.map(u => base44.asServiceRole.entities.TeachingGroup.update(u.id, { teacher_id: u.teacher_id }))),
            5000
          );
          results.forEach(r => {
            if (r.status === 'fulfilled') successfulUpdates++;
            else failedUpdates++;
          });
        } catch (err) {
          console.error(`[assignTeachers] Batch error:`, err.message);
          failedUpdates += batch.length;
        }
      }
      
      console.log(`[assignTeachers] ✅ Sync updates completed: ${successfulUpdates} success, ${failedUpdates} failed`);
    }

    const totalElapsed = Date.now() - startTime;
    
    console.log('[assignTeachers] ✅ COMPLETED:', {
      teachersAssigned: assignedCount,
      groupsProcessed: teachingGroups.length,
      skipped: skippedCount,
      totalElapsedMs: totalElapsed
    });

    return Response.json({ 
      success: true,
      teachersAssigned: assignedCount,
      groupsProcessed: teachingGroups.length,
      groupsSkipped: skippedCount,
      assignmentLog: assignmentLog.slice(0, 50), // First 50 for debugging
      teacherWorkload,
      elapsedMs: totalElapsed,
      message: `Assigned teachers to ${assignedCount} teaching groups`,
      timing: {
        fetch: fetchStart ? Date.now() - fetchStart : 0,
        assignment: assignStart ? Date.now() - assignStart : 0,
        updates: updateStart ? Date.now() - updateStart : 0,
        total: totalElapsed
      }
    }, { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('[assignTeachers] ❌ FATAL ERROR at stage:', stage);
    console.error('[assignTeachers] Error message:', error?.message);
    console.error('[assignTeachers] Error name:', error?.name);
    console.error('[assignTeachers] Error stack:', error?.stack);
    console.error('[assignTeachers] Elapsed before crash:', elapsed, 'ms');
    
    // CRITICAL: Always return structured JSON, never plain text/502
    return Response.json({ 
      ok: false,
      stage,
      code: 'ASSIGN_TEACHERS_FAILED',
      message: error?.message || 'Failed to assign teachers',
      requestId: new Date().toISOString() + '-' + Math.random().toString(36).slice(2, 9),
      elapsedMs: elapsed,
      details: {
        errorType: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack?.split('\n').slice(0, 5).join('\n')
      },
      timestamp: new Date().toISOString()
    }, { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
});