import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_CONFIG = {
  key: 'default',
  welcome_email_enabled: true,
  welcome_email_delay_hours: 0,
  setup_reminder_enabled: true,
  setup_reminder_delay_hours: 48,
  recipient_mode: 'school_admin',
  is_active: true,
};

function getAllowedEmails() {
  return String(Deno.env.get('SUPER_ADMIN_EMAILS') || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function ensureConfig(base44) {
  const existing = await base44.asServiceRole.entities.AutomationConfig.filter({ key: 'default' });
  if (existing.length > 0) return existing[0];
  return await base44.asServiceRole.entities.AutomationConfig.create(DEFAULT_CONFIG);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!getAllowedEmails().includes(String(user.email || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get';
    const currentConfig = await ensureConfig(base44);

    if (action === 'save') {
      const nextConfig = {
        welcome_email_enabled: !!body.config?.welcome_email_enabled,
        welcome_email_delay_hours: Number(body.config?.welcome_email_delay_hours || 0),
        setup_reminder_enabled: !!body.config?.setup_reminder_enabled,
        setup_reminder_delay_hours: Number(body.config?.setup_reminder_delay_hours || 48),
        recipient_mode: 'school_admin',
        is_active: true,
      };

      const updated = await base44.asServiceRole.entities.AutomationConfig.update(currentConfig.id, nextConfig);
      return Response.json({ ok: true, config: updated });
    }

    const logs = await base44.asServiceRole.entities.AutomationNotificationLog.list('-created_date', 20);
    const sentLogs = logs.filter((log) => log.status === 'sent');

    return Response.json({
      ok: true,
      config: currentConfig,
      runnerStatus: 'Active',
      stats: {
        activeSteps: [currentConfig.welcome_email_enabled, currentConfig.setup_reminder_enabled].filter(Boolean).length,
        sentEmails: sentLogs.length,
      },
      logs,
    });
  } catch (error) {
    console.error('[superAdminAutomationConfig] ERROR', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});