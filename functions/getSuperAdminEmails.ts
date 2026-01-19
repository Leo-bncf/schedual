import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify authentication
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get SuperAdmin emails + hard-allow override
    const superAdminEmailsStr = Deno.env.get("SUPER_ADMIN_EMAILS") || '';
    const superAdminEmails = superAdminEmailsStr
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);
    const hardAllowed = ["leo.bancroft34@icloud.com"];

    // Check if current user is SuperAdmin
    const isSuperAdmin = hardAllowed.includes((user.email || '').toLowerCase()) || superAdminEmails.includes((user.email || '').toLowerCase());

    return Response.json({ 
      isSuperAdmin,
      superAdminEmails: isSuperAdmin ? [...new Set([...superAdminEmails, ...hardAllowed])] : []
    });
  } catch (error) {
    console.error('Error in getSuperAdminEmails:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});