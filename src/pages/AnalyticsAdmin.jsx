import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui-custom/PageHeader';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';

export default function AnalyticsAdmin() {
  const { data: schools = [] } = useQuery({
    queryKey: ['allSchools'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminManageSchool', { action: 'list' });
      return data.schools || [];
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminManageUser', { action: 'list' });
      return data.users || [];
    },
  });

  const { data: loginSessions = [] } = useQuery({
    queryKey: ['loginSessions'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('adminGetAllData', { entityType: 'LoginSession' });
      return data.records || [];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Growth, revenue, adoption, and activity reporting"
      />
      <AnalyticsDashboard schools={schools} users={users} loginSessions={loginSessions} />
    </div>
  );
}