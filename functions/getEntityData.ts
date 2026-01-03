import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entityName, filter, sort, limit } = await req.json();

    // Get super admin status
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    const isSuperAdmin = superAdminEmails.includes(user.email.toLowerCase());

    // Build filter - add school_id for non-super admins
    let finalFilter = filter || {};
    if (!isSuperAdmin && user.school_id) {
      finalFilter = { ...finalFilter, school_id: user.school_id };
    }

    // Fetch data using service role to bypass RLS
    const data = await base44.asServiceRole.entities[entityName].filter(finalFilter, sort, limit);

    return Response.json({ data });
  } catch (error) {
    console.error('Error in getEntityData:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});