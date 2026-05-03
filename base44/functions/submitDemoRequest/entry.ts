import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function esc(str: string): string {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { name, email, school, message } = await req.json();

    if (!name || !email || !school) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (String(email).trim().toLowerCase() !== String(user.email || '').trim().toLowerCase()) {
      return Response.json({ error: 'Forbidden: invalid email' }, { status: 403 });
    }

    // Send email notification to support
    const supportInbox = (Deno.env.get('SUPER_ADMIN_EMAILS') || '').split(',').map(email => email.trim()).filter(Boolean)[0];
    if (!supportInbox) {
      return Response.json({ error: 'Support inbox not configured' }, { status: 500 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: supportInbox,
      subject: `New Demo Request from ${esc(school)}`,
      body: `
        <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
              <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:10px;">Schedual</div>
              <h2 style="margin:0;font-size:28px;line-height:1.2;">New Demo Request</h2>
              <p style="margin:10px 0 0 0;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.88);">A new demo enquiry has been submitted through the website.</p>
            </div>
            <div style="padding:28px;">
              <div style="display:grid;gap:14px;">
                <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;"><strong style="display:block;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Name</strong><div style="font-size:16px;color:#0f172a;">${esc(name)}</div></div>
                <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;"><strong style="display:block;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Email</strong><div style="font-size:16px;color:#0f172a;">${esc(email)}</div></div>
                <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;"><strong style="display:block;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">School</strong><div style="font-size:16px;color:#0f172a;">${esc(school)}</div></div>
                <div style="padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;"><strong style="display:block;color:#475569;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Message</strong><div style="font-size:15px;line-height:1.7;color:#334155;white-space:pre-wrap;">${esc(message) || 'No message provided'}</div></div>
              </div>
            </div>
            <div style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;">
              <p style="margin:0 0 14px 0;color:#64748b;font-size:13px;">Received on ${new Date().toLocaleString()}</p>
              <img src="https://media.base44.com/images/public/69458d4b7ddbdbf0a082832e/690ba3d1f_schedual_pro_logo.png" alt="Schedual Pro" style="max-width:320px;width:100%;height:auto;display:block;margin:0 auto;" />
            </div>
          </div>
        </div>
      `
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Demo request error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});