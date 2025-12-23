import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject, description, category, priority, school_id } = await req.json();

    if (!subject || !description) {
      return Response.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    // Create the support ticket
    const ticket = await base44.asServiceRole.entities.SupportTicket.create({
      user_email: user.email,
      user_name: user.full_name,
      school_id: school_id || user.school_id,
      subject,
      description,
      category: category || 'general',
      priority: priority || 'medium',
      status: 'open',
      messages: [{
        sender: user.full_name,
        message: description,
        timestamp: new Date().toISOString(),
        is_admin: false
      }]
    });

    // Get super admin emails
    const { data: adminData } = await base44.asServiceRole.functions.invoke('getSuperAdminEmails');
    const adminEmails = adminData?.emails || [];

    // Send email notification to all admins
    if (adminEmails.length > 0) {
      const priorityColors = {
        low: '#64748b',
        medium: '#3b82f6',
        high: '#f97316',
        urgent: '#ef4444'
      };

      const emailPromises = adminEmails.map(adminEmail =>
        base44.asServiceRole.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `[${priority.toUpperCase()}] New Support Ticket: ${subject}`,
          body: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h2 style="margin: 0;">New Support Ticket</h2>
              </div>
              <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none;">
                <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                  <h3 style="color: #1e293b; margin-top: 0;">${subject}</h3>
                  <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                    <span style="background: ${priorityColors[priority]}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                      ${priority}
                    </span>
                    <span style="background: #e2e8f0; color: #475569; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: capitalize;">
                      ${category}
                    </span>
                  </div>
                  <div style="color: #475569; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
                    ${description}
                  </div>
                </div>
                <div style="background: white; padding: 16px; border-radius: 8px;">
                  <table style="width: 100%; font-size: 14px;">
                    <tr>
                      <td style="color: #64748b; padding: 4px 0;"><strong>From:</strong></td>
                      <td style="color: #1e293b; padding: 4px 0;">${user.full_name} (${user.email})</td>
                    </tr>
                    ${school_id || user.school_id ? `
                    <tr>
                      <td style="color: #64748b; padding: 4px 0;"><strong>School ID:</strong></td>
                      <td style="color: #1e293b; padding: 4px 0;">${school_id || user.school_id}</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="color: #64748b; padding: 4px 0;"><strong>Ticket ID:</strong></td>
                      <td style="color: #1e293b; padding: 4px 0;">${ticket.id}</td>
                    </tr>
                    <tr>
                      <td style="color: #64748b; padding: 4px 0;"><strong>Created:</strong></td>
                      <td style="color: #1e293b; padding: 4px 0;">${new Date().toLocaleString()}</td>
                    </tr>
                  </table>
                </div>
              </div>
              <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
                <p style="margin: 0;">Schedual - Intelligent IB Scheduling</p>
              </div>
            </div>
          `
        })
      );

      await Promise.all(emailPromises);
    }

    return Response.json({ 
      success: true,
      ticket
    });

  } catch (error) {
    console.error('Create support ticket error:', error);
    return Response.json({ 
      error: error.message || 'Failed to create support ticket' 
    }, { status: 500 });
  }
});