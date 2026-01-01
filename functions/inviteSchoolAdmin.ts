import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized or no school assigned' }, { status: 401 });
    }

    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Get current school and check seats
    const schools = await base44.entities.School.filter({ id: user.school_id });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Get current admins
    const { data: adminData } = await base44.functions.invoke('getSchoolAdmins');
    const currentAdmins = adminData?.admins || [];
    const maxSeats = (school.max_additional_users || 0) + 1;

    if (currentAdmins.length >= maxSeats) {
      return Response.json({ 
        error: `Maximum admin seats reached (${currentAdmins.length}/${maxSeats}). Purchase more seats to invite additional admins.` 
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    
    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      
      // If already assigned to this school
      if (existingUser.school_id === user.school_id) {
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
        school_id: user.school_id
      });
      
      // Send notification email
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: 'You have been added as a school administrator',
        body: `Hello,\n\nYou have been added as an administrator for ${school.name}.\n\nYou can now log in to Schedual and access the school management features.\n\nLogin at: ${Deno.env.get('BASE44_APP_URL') || 'https://schedual-pro.com'}\n\nBest regards,\nThe Schedual Team`
      });
      
      return Response.json({ 
        success: true, 
        message: 'User added as administrator successfully',
        action: 'assigned_existing_user'
      });
    }

    // User doesn't exist - send invitation via Base44
    await base44.users.inviteUser(email, 'admin');
    
    // Also send a custom email with school details
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: `Invitation to join ${school.name} on Schedual`,
      body: `Hello,\n\nYou have been invited to join ${school.name} as a school administrator on Schedual.\n\nSchedulal is an IB school scheduling platform that helps manage teachers, students, subjects, and timetables.\n\nTo accept this invitation:\n1. Visit: ${Deno.env.get('BASE44_APP_URL') || 'https://app.schedual-pro.com'}\n2. Sign up or log in with this email address: ${email}\n3. You will automatically be assigned as an administrator for ${school.name}\n\nIf you have any questions, please contact support@schedual-pro.com\n\nBest regards,\nThe Schedual Team`
    });
    
    // Create a placeholder user record that will be linked when they sign up
    await base44.asServiceRole.entities.User.create({
      email,
      full_name: email.split('@')[0],
      school_id: user.school_id,
      role: 'admin'
    });

    return Response.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      action: 'invited_new_user'
    });
  } catch (error) {
    console.error('Invitation error:', error);
    return Response.json({ error: error.message || 'Failed to send invitation' }, { status: 500 });
  }
});