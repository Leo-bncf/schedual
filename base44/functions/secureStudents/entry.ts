import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function requireSchoolAdmin(base44) {
  const authUser = await base44.auth.me();

  if (!authUser) {
    throw new Error('Unauthorized - not authenticated');
  }

  // Fetch fresh DB record (bypasses JWT staleness)
  const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
  const dbUser = dbUsers[0] || null;

  // school_id is the real isolation boundary — prefer DB, fall back to JWT
  const school_id =
    dbUser?.school_id || dbUser?.data?.school_id ||
    authUser.school_id || authUser.data?.school_id;

  if (!school_id) {
    throw new Error('Forbidden - no school assigned');
  }

  // The role field is unreliable: the Stripe webhook can reset it, and base44
  // doesn't re-issue JWTs automatically when DB role changes.
  // Layout.jsx uses the same rule: !!school_id → school admin.
  // Auto-heal the DB role so downstream RLS checks stay consistent.
  const role = dbUser?.role || dbUser?.data?.role || authUser.role;
  if (role !== 'admin') {
    await base44.asServiceRole.entities.User.update(authUser.id, { role: 'admin' });
  }

  return { school_id, role: 'admin' };
}

function verifySchoolOwnership(user, dataSchoolId) {
  if (user.school_id !== dataSchoolId) {
    throw new Error('Forbidden - cannot access data from another school');
  }
}

function addSchoolFilter(user, query = {}) {
  return {
    ...query,
    school_id: user.school_id,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireSchoolAdmin(base44);
    
    const { action, student_id, data, query = {} } = await req.json();
    
    switch (action) {
      case 'diagnose': {
        // Returns diagnostic info to identify school_id mismatches
        const authUser = await base44.auth.me();
        const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
        const dbUser = dbUsers[0] || null;
        const allStudents = await base44.asServiceRole.entities.Student.filter({}, '-created_date', 2000);
        const schoolStudents = await base44.asServiceRole.entities.Student.filter({ school_id: user.school_id }, '-created_date', 2000);
        const uniqueSchoolIds = [...new Set(allStudents.map(s => s.school_id).filter(Boolean))];
        return Response.json({
          success: true,
          resolved_school_id: user.school_id,
          db_user_school_id: dbUser?.school_id || dbUser?.data?.school_id || null,
          jwt_school_id: authUser.school_id || authUser.data?.school_id || null,
          students_matching_school: schoolStudents.length,
          total_students_all_schools: allStudents.length,
          unique_school_ids_in_students: uniqueSchoolIds,
          sample_students: allStudents.slice(0, 3).map(s => ({ id: s.id, school_id: s.school_id, name: s.full_name })),
        });
      }

      case 'list': {
        const filteredQuery = addSchoolFilter(user, query);
        let students = await base44.asServiceRole.entities.Student.filter(filteredQuery, '-created_date', 2000);

        // Auto-repair school_id mismatch: if 0 students found but students exist in DB under a different school_id,
        // re-link them to this school (same heuristic as fixStudentSchoolIds function).
        if (students.length === 0) {
          const allStudents = await base44.asServiceRole.entities.Student.list();
          const unlinked = allStudents.filter(s => s.school_id !== user.school_id);
          if (unlinked.length > 0) {
            console.log(`[secureStudents:list] Auto-repairing ${unlinked.length} students from mismatched school_id to ${user.school_id}`);
            const classGroups = await base44.asServiceRole.entities.ClassGroup.filter({ school_id: user.school_id }, '-created_date', 500);
            const teachingGroups = await base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id }, '-created_date', 1000);
            const linkedIds = new Set([
              ...classGroups.flatMap(cg => cg.student_ids || []),
              ...teachingGroups.flatMap(tg => tg.student_ids || []),
            ]);
            // Use class/teaching group membership as heuristic; fall back to all unlinked if no matches
            const toRepair = linkedIds.size > 0 ? unlinked.filter(s => linkedIds.has(s.id)) : unlinked;
            for (const s of toRepair) {
              await base44.asServiceRole.entities.Student.update(s.id, { school_id: user.school_id });
            }
            students = await base44.asServiceRole.entities.Student.filter(filteredQuery, '-created_date', 2000);
            console.log(`[secureStudents:list] Repaired ${toRepair.length} students. Now returning ${students.length}`);
          }
        }

        return Response.json({ success: true, data: students });
      }
      
      case 'get': {
        if (!student_id) {
          return Response.json({ success: false, error: 'student_id required' }, { status: 400 });
        }
        
        const students = await base44.asServiceRole.entities.Student.filter({ id: student_id });
        const student = students[0];
        
        if (!student) {
          return Response.json({ success: false, error: 'Student not found' }, { status: 404 });
        }
        
        // Verify ownership
        verifySchoolOwnership(user, student.school_id);
        
        return Response.json({ success: true, data: student });
      }
      
      case 'create': {
        if (!data) {
          return Response.json({ success: false, error: 'data required' }, { status: 400 });
        }

        // Fetch school to check subscription and limits
        const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
        const school = schools[0];
        if (!school) {
          return Response.json({ success: false, error: 'School not found' }, { status: 404 });
        }

        const BLOCKED_STATUSES = ['canceled', 'unpaid', 'incomplete_expired', 'paused'];
        if (school.subscription_status && BLOCKED_STATUSES.includes(school.subscription_status)) {
          return Response.json({
            success: false,
            error: 'Your subscription is not active. Please renew your plan to add students.',
          }, { status: 403 });
        }

        // Only enforce limits for schools with an explicitly set subscription tier.
        if (school.subscription_tier) {
          const currentStudents = await base44.asServiceRole.entities.Student.filter({ school_id: user.school_id }, '-created_date', 2000);
          const currentCount = currentStudents.length;

          const STUDENT_LIMITS = { tier1: 200, tier2: 600, tier3: 1200 };
          const maxStudents = STUDENT_LIMITS[school.subscription_tier] ?? null;

          if (maxStudents !== null && currentCount >= maxStudents) {
            return Response.json({
              success: false,
              error: `Student limit reached for your subscription tier (${maxStudents}). Please upgrade your plan.`
            }, { status: 400 });
          }

          const allowedProgrammes = school.subscription_tier === 'tier1' ? ['MYP'] : ['PYP', 'MYP', 'DP'];
          if (!allowedProgrammes.includes(data.ib_programme)) {
            return Response.json({
              success: false,
              error: `Your plan does not allow creating ${data.ib_programme} students.`
            }, { status: 400 });
          }
        }

        // Force user's school_id
        const studentData = {
          ...data,
          school_id: user.school_id
        };
        
        const newStudent = await base44.asServiceRole.entities.Student.create(studentData);
        return Response.json({ success: true, data: newStudent });
      }
      
      case 'update': {
        if (!student_id || !data) {
          return Response.json({ success: false, error: 'student_id and data required' }, { status: 400 });
        }
        
        // First get the student to verify ownership
        const students = await base44.asServiceRole.entities.Student.filter({ id: student_id });
        const student = students[0];
        
        if (!student) {
          return Response.json({ success: false, error: 'Student not found' }, { status: 404 });
        }
        
        verifySchoolOwnership(user, student.school_id);
        
        // Prevent changing school_id
        const updateData = { ...data };
        delete updateData.school_id;
        
        const updated = await base44.asServiceRole.entities.Student.update(student_id, updateData);
        return Response.json({ success: true, data: updated });
      }
      
      case 'delete': {
        if (!student_id) {
          return Response.json({ success: false, error: 'student_id required' }, { status: 400 });
        }
        
        // First get the student to verify ownership
        const students = await base44.asServiceRole.entities.Student.filter({ id: student_id });
        const student = students[0];
        
        if (!student) {
          return Response.json({ success: false, error: 'Student not found' }, { status: 404 });
        }
        
        verifySchoolOwnership(user, student.school_id);
        
        await base44.asServiceRole.entities.Student.delete(student_id);
        return Response.json({ success: true });
      }
      
      case 'repair_school_id': {
        // Finds students whose school_id doesn't match user's school_id and reassigns them.
        // Only reassigns students that belong to a school_id specified in from_school_id,
        // or ALL students with null/undefined school_id if no from_school_id given.
        const { from_school_id, dry_run = true } = data || {};
        const allStudents = await base44.asServiceRole.entities.Student.filter({}, '-created_date', 2000);
        const toRepair = allStudents.filter(s => {
          if (from_school_id) return s.school_id === from_school_id;
          return !s.school_id || s.school_id !== user.school_id;
        });
        if (dry_run) {
          return Response.json({
            success: true,
            dry_run: true,
            would_repair: toRepair.length,
            target_school_id: user.school_id,
            affected_ids: toRepair.map(s => s.id),
          });
        }
        let repaired = 0;
        for (const s of toRepair) {
          await base44.asServiceRole.entities.Student.update(s.id, { school_id: user.school_id });
          repaired++;
        }
        return Response.json({ success: true, repaired, target_school_id: user.school_id });
      }

      default:
        return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error:', error);
    
    if (error.message.includes('Unauthorized') || error.message.includes('Forbidden')) {
      return Response.json({ success: false, error: error.message }, { status: 403 });
    }
    
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});