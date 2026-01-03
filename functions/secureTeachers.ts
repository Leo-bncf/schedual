import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireSchoolAdmin, verifySchoolOwnership, addSchoolFilter } from './authHelpers.js';

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