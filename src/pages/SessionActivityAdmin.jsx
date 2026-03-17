import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import PageHeader from '@/components/ui-custom/PageHeader';
import DataTable from '@/components/ui-custom/DataTable';

export default function SessionActivityAdmin() {
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
        title="Login Sessions"
        description="Access activity across the platform"
      />
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <DataTable
            columns={[
              {
                header: 'User',
                cell: (row) => (
                  <div>
                    <p className="font-medium text-slate-900">{row.user_email}</p>
                    <p className="text-xs text-slate-500">{new Date(row.created_date).toLocaleString()}</p>
                  </div>
                ),
              },
              {
                header: 'IP Address',
                cell: (row) => <span className="font-mono text-sm text-slate-700">{row.ip_address || 'unknown'}</span>,
              },
              {
                header: 'Status',
                cell: (row) => (
                  <Badge className={row.verified ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-amber-100 text-amber-700 border-0'}>
                    {row.verified ? 'Verified' : 'Pending'}
                  </Badge>
                ),
              },
              {
                header: 'Browser',
                cell: (row) => {
                  const ua = row.user_agent || '';
                  let browser = 'Unknown';
                  if (ua.includes('Chrome')) browser = 'Chrome';
                  else if (ua.includes('Firefox')) browser = 'Firefox';
                  else if (ua.includes('Safari')) browser = 'Safari';
                  else if (ua.includes('Edge')) browser = 'Edge';
                  return <span className="text-sm text-slate-600">{browser}</span>;
                },
              },
              {
                header: 'Expires',
                cell: (row) => {
                  const isExpired = new Date(row.expires_at) < new Date();
                  return <span className={`text-xs ${isExpired ? 'text-rose-600' : 'text-slate-600'}`}>{isExpired ? 'Expired' : new Date(row.expires_at).toLocaleDateString()}</span>;
                },
              },
            ]}
            data={loginSessions.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))}
          />
        </CardContent>
      </Card>
    </div>
  );
}