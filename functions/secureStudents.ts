import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireSchoolAdmin, verifySchoolOwnership, addSchoolFilter } from './authHelpers.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireSchoolAdmin(base44);
    
    const { action, student_id, data, query = {} } = await req.json();
    
    switch (action) {
      case 'list': {
        // Only list students from user's school
        const filteredQuery = addSchoolFilter(user, query);
        const students = await base44.asServiceRole.entities.Student.filter(filteredQuery);
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

        // Fetch school to check limits
        const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
        const school = schools[0];
        if (!school) {
          return Response.json({ success: false, error: 'School not found' }, { status: 404 });
        }

        // Get current student count
        const currentStudents = await base44.asServiceRole.entities.Student.filter({ school_id: user.school_id });
        const currentCount = currentStudents.length;

        let maxStudents = 300; // Tier 1
        if (school.subscription_tier === 'tier2') maxStudents = 800;
        if (school.subscription_tier === 'tier3') maxStudents = 999999;

        if (currentCount >= maxStudents) {
          return Response.json({ 
            success: false, 
            error: `Student limit reached for your subscription tier (${maxStudents}). Please upgrade your plan.` 
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