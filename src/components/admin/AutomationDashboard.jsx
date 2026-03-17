import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Save, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import AutomationSummaryCard from '@/components/admin/AutomationSummaryCard';
import AutomationStepRow from '@/components/admin/AutomationStepRow';

export default function AutomationDashboard() {
  const queryClient = useQueryClient();
  const [config, setConfig] = React.useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['superAdminAutomationConfig'],
    queryFn: async () => {
      const response = await base44.functions.invoke('superAdminAutomationConfig', { action: 'get' });
      return response.data;
    },
  });

  React.useEffect(() => {
    if (data?.config) setConfig(data.config);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('superAdminAutomationConfig', { action: 'save', config });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminAutomationConfig'] });
      toast.success('Automation settings saved');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save automation settings');
    },
  });

  if (isLoading || !config) {
    return <div className="text-sm text-slate-500">Loading automation dashboard...</div>;
  }

  const recentLogs = data?.logs || [];
  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Advanced Automation</h3>
          <p className="text-sm text-slate-500">Configure automated onboarding emails for newly created schools.</p>
        </div>
        <Button onClick={() => saveMutation.mutate()} className="bg-indigo-600 hover:bg-indigo-700">
          <Save className="w-4 h-4 mr-2" />
          Save Configuration
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AutomationSummaryCard title="Onboarding Steps" value={2} subtitle={`${stats.activeSteps || 0} active`} />
        <AutomationSummaryCard title="Email Notifications" value={stats.sentEmails || 0} subtitle="emails sent" />
        <AutomationSummaryCard title="Reminder Delay" value={config.setup_reminder_delay_hours} subtitle="hours after school creation" />
        <AutomationSummaryCard title="Automation Runner" value={data?.runnerStatus || 'Active'} subtitle="hourly scheduled check" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Automated Onboarding Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AutomationStepRow
              title="Send welcome email to school admin"
              description="Sent automatically when a school exists and an admin has been assigned."
              checked={config.welcome_email_enabled}
              delayHours={config.welcome_email_delay_hours}
              onToggle={(value) => setConfig((prev) => ({ ...prev, welcome_email_enabled: value }))}
              onDelayChange={(value) => setConfig((prev) => ({ ...prev, welcome_email_delay_hours: value }))}
            />
            <AutomationStepRow
              title="Send setup reminder if onboarding is incomplete"
              description="Checks for missing setup progress like no teachers, students, subjects or schedules."
              checked={config.setup_reminder_enabled}
              delayHours={config.setup_reminder_delay_hours}
              onToggle={(value) => setConfig((prev) => ({ ...prev, setup_reminder_enabled: value }))}
              onDelayChange={(value) => setConfig((prev) => ({ ...prev, setup_reminder_delay_hours: value }))}
            />
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
              Steps with delays greater than 0 hours are calculated from the school creation time.
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="w-5 h-5 text-indigo-600" />
              Email Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-medium text-slate-900">Recipient mode</div>
              <div className="mt-2 flex items-center gap-2">
                <Badge className="bg-indigo-100 text-indigo-700 border-0">School admin</Badge>
                <span className="text-xs text-slate-500">Emails go to the first admin assigned to the school.</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-900">Recent activity</div>
              {recentLogs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                  No automation emails have been sent yet.
                </div>
              ) : (
                recentLogs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{log.automation_type === 'welcome_email' ? 'Welcome email' : 'Setup reminder'}</div>
                        <div className="text-xs text-slate-500">{log.recipient_email}</div>
                      </div>
                      <Badge className={log.status === 'sent' ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-rose-100 text-rose-700 border-0'}>
                        {log.status}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{new Date(log.sent_at || log.created_date).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}