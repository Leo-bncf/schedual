import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { validateCSRF } from './csrfHelper.js';
import { getUserSchoolId } from './securityHelper.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Validate CSRF
    await validateCSRF(req, base44);
    
    const schoolId = await getUserSchoolId(base44);
    const user = await base44.auth.me();

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Get current school and check seats
    const schools = await base44.entities.School.filter({ id: schoolId });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Get current admins directly
    const currentAdmins = await base44.asServiceRole.entities.User.filter({ 
      school_id: schoolId 
    });
    const maxSeats = (school.max_additional_users || 0) + 1;

    if (currentAdmins.length >= maxSeats) {
      return Response.json({ 
        error: `Maximum admin seats reached (${currentAdmins.length}/${maxSeats}). Purchase more seats to invite additional admins.` 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    
    if (existingUsers.length === 0) {
      // User doesn't exist - require them to create account first
      return Response.json({ 
        error: 'This user must create an account first before they can be added as an administrator. Please ask them to register at https://schedual-pro.com first.' 
      }, { status: 400 });
    }

    const existingUser = existingUsers[0];
    
    // If already assigned to this school
    if (existingUser.school_id === schoolId) {
      return Response.json({ 
        error: 'This user is already an administrator of your school' 
      }, { status: 400 });
    }
    
    // If assigned to another school
    if (existingUser.school_id) {
      return Response.json({ 
        error: 'This user is already assigned to another school' 
      }, { status: 400 });
    }
    
    // User exists but not assigned - assign them
    await base44.asServiceRole.entities.User.update(existingUser.id, {
      school_id: schoolId
    });
    
    // Send notification email
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: 'You have been added as a school administrator',
      body: `Hello,\n\nYou have been added as an administrator for ${school.name}.\n\nYou can now log in to Schedual and access the school management features.\n\nLogin at: https://schedual-pro.com\n\nBest regards,\nThe Schedual Team`
    });
    
    return Response.json({ 
      success: true, 
      message: 'User added as administrator successfully'
    });
  } catch (error) {
    console.error('Invitation error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      error: error.message || 'Failed to send invitation',
      details: error.stack 
    }, { status: 500 });
  }
});