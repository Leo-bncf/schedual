import React from 'react';
import PageHeader from '@/components/ui-custom/PageHeader';
import AutomationDashboard from '@/components/admin/AutomationDashboard';

export default function AutomationAdmin() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Welcome onboarding and notification workflows"
      />
      <AutomationDashboard />
    </div>
  );
}