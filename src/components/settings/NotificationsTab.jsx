import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const NOTIFICATIONS = [
  {
    title: 'Schedule Conflict Alerts',
    description: 'Get notified when scheduling conflicts are detected',
    enabled: true,
  },
  {
    title: 'AI Recommendations',
    description: 'Receive AI advisor suggestions and insights',
    enabled: true,
  },
  {
    title: 'Schedule Published',
    description: 'Notify when a new schedule is published',
    enabled: true,
  },
  {
    title: 'Weekly Summary',
    description: 'Receive weekly scheduling summary reports',
    enabled: false,
  },
];

export default function NotificationsTab() {
  return (
    <Card className="border-0 shadow-sm bg-white rounded-xl">
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Configure how you receive updates and alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {NOTIFICATIONS.map((item) => (
            <div key={item.title} className="flex items-center justify-between p-4 rounded-lg bg-slate-50">
              <div>
                <p className="font-medium text-slate-700">{item.title}</p>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
              <Switch defaultChecked={item.enabled} className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-500" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}