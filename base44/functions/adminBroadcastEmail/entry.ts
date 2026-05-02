import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function esc(str: string): string {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const superAdmins = (Deno.env.get('SUPER_ADMIN_EMAILS') || '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (!superAdmins.includes((user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { subject, message, target_status } = await req.json();

    if (!subject || !message) {
      return Response.json({ error: 'Subject and message are required' }, { status: 400 });
    }

    // Fetch all schools — filter by subscription status if requested
    const allSchools = await base44.asServiceRole.entities.School.list();
    const targetSchools = target_status && target_status !== 'all'
      ? allSchools.filter((s: any) => s.subscription_status === target_status)
      : allSchools.filter((s: any) => s.subscription_status === 'active');

    const targetSchoolIds = new Set(targetSchools.map((s: any) => s.id));

    // Fetch all users and keep only admins belonging to target schools
    const allUsers = await base44.asServiceRole.entities.User.list();
    const adminUsers = allUsers.filter((u: any) => {
      const schoolId = u.school_id || u.data?.school_id;
      const role = u.role || u.data?.role;
      return schoolId && targetSchoolIds.has(schoolId) && role === 'admin' && u.email;
    });

    // Deduplicate by email
    const uniqueEmails = [...new Set(adminUsers.map((u: any) => u.email as string))];

    if (uniqueEmails.length === 0) {
      return Response.json({ success: true, sent: 0, skipped: 0, total: 0 });
    }

    const htmlBody = `
      <div style="margin:0;padding:32px 16px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
          <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
            <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:10px;">Schedual</div>
            <h2 style="margin:0;font-size:24px;line-height:1.3;">${esc(subject)}</h2>
          </div>
          <div style="padding:28px;">
            <div style="font-size:15px;line-height:1.8;color:#334155;white-space:pre-wrap;">${esc(message)}</div>
          </div>
          <div style="padding:20px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;text-align:center;">
            <p style="margin:0 0 14px 0;color:#64748b;font-size:13px;">You are receiving this because you are an admin on the Schedual platform.</p>
            <img src="https://media.base44.com/images/public/69458d4b7ddbdbf0a082832e/690ba3d1f_schedual_pro_logo.png" alt="Schedual Pro" style="max-width:200px;width:100%;height:auto;display:block;margin:0 auto;" />
          </div>
        </div>
      </div>
    `;

    let sent = 0;
    let skipped = 0;

    // Send in small batches to avoid rate limits
    const BATCH = 5;
    for (let i = 0; i < uniqueEmails.length; i += BATCH) {
      const batch = uniqueEmails.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(email =>
          base44.asServiceRole.integrations.Core.SendEmail({ to: email, subject, body: htmlBody })
        )
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') sent++;
        else { skipped++; console.warn('[broadcast] Failed:', r.reason?.message); }
      });
      // Brief pause between batches
      if (i + BATCH < uniqueEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[adminBroadcastEmail] Sent ${sent}/${uniqueEmails.length}, skipped ${skipped}`);
    return Response.json({ success: true, sent, skipped, total: uniqueEmails.length });
  } catch (error) {
    console.error('[adminBroadcastEmail] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
