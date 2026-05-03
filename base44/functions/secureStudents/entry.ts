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
      case 'list': {
        // Only list students from user's school
        const filteredQuery = addSchoolFilter(user, query);
        const students = await base44.asServiceRole.entities.Student.filter(filteredQuery, '-created_date', 2000);
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

        const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'];
        if (!ACTIVE_STATUSES.includes(school.subscription_status)) {
          return Response.json({
            success: false,
            error: 'Your subscription is not active. Please renew your plan to add students.',
          }, { status: 403 });
        }

        // Get current student count
        const currentStudents = await base44.asServiceRole.entities.Student.filter({ school_id: user.school_id });
        const currentCount = currentStudents.length;

        const STUDENT_LIMITS = { tier1: 200, tier2: 600, tier3: 1200 };
        let maxStudents = STUDENT_LIMITS[school.subscription_tier] ?? 200;

        if (currentCount >= maxStudents) {
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