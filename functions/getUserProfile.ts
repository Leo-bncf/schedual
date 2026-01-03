import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    const isSuperAdmin = superAdminEmails.includes(user.email.toLowerCase());

    let school = null;
    if (user.school_id) {
      const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
      school = schools[0] || null;
    }

    return Response.json({
      user,
      school,
      isSuperAdmin
    });
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});