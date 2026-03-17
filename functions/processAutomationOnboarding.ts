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

async function ensureConfig(base44) {
  const existing = await base44.asServiceRole.entities.AutomationConfig.filter({ key: 'default' });
  if (existing.length > 0) return existing[0];
  return await base44.asServiceRole.entities.AutomationConfig.create(DEFAULT_CONFIG);
}

function hoursSince(dateString) {
  const created = new Date(dateString).getTime();
  const now = Date.now();
  return (now - created) / (1000 * 60 * 60);
}

async function sendEmail(base44, to, subject, body) {
  return await base44.asServiceRole.integrations.Core.SendEmail({
    to,
    subject,
    body,
    from_name: 'Schedual',
  });
}

async function createLog(base44, payload) {
  return await base44.asServiceRole.entities.AutomationNotificationLog.create({
    ...payload,
    sent_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const config = await ensureConfig(base44);

    if (!config.is_active) {
      return Response.json({ ok: true, processed: 0, sent: 0, skipped: 'inactive' });
    }

    const [schools, users, subjects, teachers, students, schedules, logs] = await Promise.all([
      base44.asServiceRole.entities.School.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Subject.list(),
      base44.asServiceRole.entities.Teacher.list(),
      base44.asServiceRole.entities.Student.list(),
      base44.asServiceRole.entities.ScheduleVersion.list(),
      base44.asServiceRole.entities.AutomationNotificationLog.list('-created_date', 200),
    ]);

    let sent = 0;

    for (const school of schools) {
      const schoolId = school.id;
      const adminUser = users.find((user) => user.school_id === schoolId && user.role === 'admin');
      if (!adminUser?.email) continue;

      const schoolAgeHours = hoursSince(school.created_date);
      const schoolSubjects = subjects.filter((subject) => subject.school_id === schoolId);
      const schoolTeachers = teachers.filter((teacher) => teacher.school_id === schoolId);
      const schoolStudents = students.filter((student) => student.school_id === schoolId);
      const schoolSchedules = schedules.filter((schedule) => schedule.school_id === schoolId);
      const onboardingIncomplete = schoolSubjects.length === 0 || schoolTeachers.length === 0 || schoolStudents.length === 0 || schoolSchedules.length === 0;

      const welcomeAlreadySent = logs.some((log) => log.school_id === schoolId && log.automation_type === 'welcome_email' && log.status === 'sent');
      if (config.welcome_email_enabled && !welcomeAlreadySent && schoolAgeHours >= Number(config.welcome_email_delay_hours || 0)) {
        try {
          await sendEmail(
            base44,
            adminUser.email,
            `Welcome to Schedual, ${school.name}`,
            `Hi ${adminUser.full_name || 'there'},<br/><br/>Welcome to Schedual. Your school <strong>${school.name}</strong> is ready to set up.<br/><br/>Next steps:<br/>1. Add teachers<br/>2. Add students<br/>3. Add subjects<br/>4. Generate your first timetable`
          );
          await createLog(base44, {
            school_id: schoolId,
            automation_type: 'welcome_email',
            recipient_email: adminUser.email,
            status: 'sent',
            message: 'Welcome email sent',
          });
          sent += 1;
        } catch (error) {
          console.error('[processAutomationOnboarding] welcome email failed', error);
          await createLog(base44, {
            school_id: schoolId,
            automation_type: 'welcome_email',
            recipient_email: adminUser.email,
            status: 'failed',
            message: error.message,
          });
        }
      }

      const reminderAlreadySent = logs.some((log) => log.school_id === schoolId && log.automation_type === 'setup_reminder' && log.status === 'sent');
      if (config.setup_reminder_enabled && onboardingIncomplete && !reminderAlreadySent && schoolAgeHours >= Number(config.setup_reminder_delay_hours || 48)) {
        try {
          await sendEmail(
            base44,
            adminUser.email,
            `Setup reminder for ${school.name}`,
            `Hi ${adminUser.full_name || 'there'},<br/><br/>Your school <strong>${school.name}</strong> still has onboarding steps pending.<br/><br/>Current progress:<br/>• Subjects: ${schoolSubjects.length}<br/>• Teachers: ${schoolTeachers.length}<br/>• Students: ${schoolStudents.length}<br/>• Schedule versions: ${schoolSchedules.length}<br/><br/>Finish setup to start generating timetables.`
          );
          await createLog(base44, {
            school_id: schoolId,
            automation_type: 'setup_reminder',
            recipient_email: adminUser.email,
            status: 'sent',
            message: 'Setup reminder sent',
          });
          sent += 1;
        } catch (error) {
          console.error('[processAutomationOnboarding] reminder email failed', error);
          await createLog(base44, {
            school_id: schoolId,
            automation_type: 'setup_reminder',
            recipient_email: adminUser.email,
            status: 'failed',
            message: error.message,
          });
        }
      }
    }

    return Response.json({ ok: true, processed: schools.length, sent });
  } catch (error) {
    console.error('[processAutomationOnboarding] ERROR', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});