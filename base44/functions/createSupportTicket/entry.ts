import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject, description, priority } = await req.json();

    if (!subject || !description) {
      return Response.json({ error: 'Subject and description are required' }, { status: 400 });
    }

    // Create ticket using service role
    const ticket = await base44.asServiceRole.entities.SupportTicket.create({
      school_id: user.school_id,
      user_email: user.email,
      user_name: user.full_name,
      subject,
      description,
      priority: priority || 'medium',
      status: 'open'
    });

    // Send email notification to super admins asynchronously (don't block response)
    try {
      const superAdminEmailsRaw = Deno.env.get('SUPER_ADMIN_EMAILS') || '';
      const adminEmails = superAdminEmailsRaw.split(',').map(e => e.trim()).filter(Boolean);

      const priorityColors = {
        low: '#64748b',
        medium: '#3b82f6',
        high: '#f97316',
        urgent: '#ef4444'
      };

      if (adminEmails.length > 0) {
        // Fire and forget - don't await
        Promise.all(adminEmails.map(adminEmail =>
          base44.asServiceRole.integrations.Core.SendEmail({
            to: adminEmail,
            subject: `[${priority.toUpperCase()}] New Support Ticket: ${subject}`,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e3a8a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                  <h2 style="margin: 0;">New Support Ticket</h2>
                </div>
                <div style="background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0;">
                  <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
                    <h3 style="color: #1e293b; margin-top: 0;">${subject}</h3>
                    <span style="background: ${priorityColors[priority]}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                      ${priority}
                    </span>
                    <div style="color: #475569; font-size: 14px; line-height: 1.6; margin-top: 16px; white-space: pre-wrap;">
                      ${description}
                    </div>
                  </div>
                  <div style="background: white; padding: 16px; border-radius: 8px;">
                    <table style="width: 100%; font-size: 14px;">
                      <tr>
                        <td style="color: #64748b; padding: 4px 0;"><strong>From:</strong></td>
                        <td style="color: #1e293b; padding: 4px 0;">${user.full_name} (${user.email})</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 4px 0;"><strong>School ID:</strong></td>
                        <td style="color: #1e293b; padding: 4px 0;">${user.school_id || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748b; padding: 4px 0;"><strong>Ticket ID:</strong></td>
                        <td style="color: #1e293b; padding: 4px 0;">${ticket.id}</td>
                      </tr>
                    </table>
                  </div>
                </div>
              </div>
            `
          })
        )).catch(err => console.error('Email notification error:', err));
      }
    } catch (emailError) {
      console.error('Error sending admin notification:', emailError);
      // Continue - don't fail the ticket creation
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