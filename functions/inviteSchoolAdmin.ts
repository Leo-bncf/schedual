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

    // Get current admins directly
    const currentAdmins = await base44.asServiceRole.entities.User.filter({ 
      school_id: user.school_id 
    });
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
        body: `Hello,\n\nYou have been added as an administrator for ${school.name}.\n\nYou can now log in to Schedual and access the school management features.\n\nLogin at: https://schedual-pro.com\n\nBest regards,\nThe Schedual Team`
      });
      
      return Response.json({ 
        success: true, 
        message: 'User added as administrator successfully',
        action: 'assigned_existing_user'
      });
    }

    // User doesn't exist - create pending invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry
    
    await base44.asServiceRole.entities.PendingInvitation.create({
      email,
      school_id: user.school_id,
      invited_by: user.email,
      expires_at: expiresAt.toISOString()
    });
    
    // Send invite via base44's built-in system
    await base44.users.inviteUser(email, "admin");

    return Response.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      action: 'invited_new_user'
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