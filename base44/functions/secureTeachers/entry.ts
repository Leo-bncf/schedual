import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function requireSchoolAdmin(base44) {
  const authUser = await base44.auth.me();

  if (!authUser) {
    throw new Error('Unauthorized - not authenticated');
  }

  const dbUsers = await base44.asServiceRole.entities.User.filter({ id: authUser.id });
  const dbUser = dbUsers[0] || null;

  const school_id =
    dbUser?.school_id || dbUser?.data?.school_id ||
    authUser.school_id || authUser.data?.school_id;

  const role =
    dbUser?.role || dbUser?.data?.role ||
    authUser.role || authUser.data?.role;

  if (!school_id) {
    throw new Error('Forbidden - no school assigned');
  }
  if (role !== 'admin') {
    throw new Error(`Forbidden - admin access required (current role: ${role ?? 'none'})`);
  }

  return { school_id, role };
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
    
    const { action, teacher_id, data, query = {} } = await req.json();
    
    switch (action) {
      case 'list': {
        const filteredQuery = addSchoolFilter(user, query);
        const teachers = await base44.asServiceRole.entities.Teacher.filter(filteredQuery);
        return Response.json({ success: true, data: teachers });
      }
      
      case 'get': {
        if (!teacher_id) {
          return Response.json({ success: false, error: 'teacher_id required' }, { status: 400 });
        }
        
        const teachers = await base44.asServiceRole.entities.Teacher.filter({ id: teacher_id });
        const teacher = teachers[0];
        
        if (!teacher) {
          return Response.json({ success: false, error: 'Teacher not found' }, { status: 404 });
        }
        
        verifySchoolOwnership(user, teacher.school_id);
        
        return Response.json({ success: true, data: teacher });
      }
      
      case 'create': {
        if (!data) {
          return Response.json({ success: false, error: 'data required' }, { status: 400 });
        }
        
        const teacherData = {
          ...data,
          school_id: user.school_id
        };
        
        const newTeacher = await base44.asServiceRole.entities.Teacher.create(teacherData);
        return Response.json({ success: true, data: newTeacher });
      }
      
      case 'update': {
        if (!teacher_id || !data) {
          return Response.json({ success: false, error: 'teacher_id and data required' }, { status: 400 });
        }
        
        const teachers = await base44.asServiceRole.entities.Teacher.filter({ id: teacher_id });
        const teacher = teachers[0];
        
        if (!teacher) {
          return Response.json({ success: false, error: 'Teacher not found' }, { status: 404 });
        }
        
        verifySchoolOwnership(user, teacher.school_id);
        
        const updateData = { ...data };
        delete updateData.school_id;
        
        const updated = await base44.asServiceRole.entities.Teacher.update(teacher_id, updateData);
        return Response.json({ success: true, data: updated });
      }
      
      case 'delete': {
        if (!teacher_id) {
          return Response.json({ success: false, error: 'teacher_id required' }, { status: 400 });
        }
        
        const teachers = await base44.asServiceRole.entities.Teacher.filter({ id: teacher_id });
        const teacher = teachers[0];
        
        if (!teacher) {
          return Response.json({ success: false, error: 'Teacher not found' }, { status: 404 });
        }
        
        verifySchoolOwnership(user, teacher.school_id);
        
        await base44.asServiceRole.entities.Teacher.delete(teacher_id);
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