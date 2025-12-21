import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  CreditCard, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  Clock,
  Copy,
  DollarSign,
  Building2,
  Calendar
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import DataTable from '../components/ui-custom/DataTable';
import { format } from 'date-fns';

export default function SubscriptionsOverview() {
  const [copied, setCopied] = useState(false);

  // Access control - only super admin
  const SUPER_ADMIN_EMAIL = 'Leo.bancroft34@icloud.com';
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  if (currentUser && currentUser.email !== SUPER_ADMIN_EMAIL) {
    window.location.href = createPageUrl('Dashboard');
    return null;
  }

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['allSchools'],
    queryFn: () => base44.entities.School.list(),
  });

  const webhookUrl = `${window.location.origin.replace(/^https?:\/\//, 'https://')}/api/stripeWebhook`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate stats
  const activeSubscriptions = schools.filter(s => s.subscription_status === 'active').length;
  const totalRevenue = schools
    .filter(s => s.subscription_status === 'active')
    .reduce((sum, school) => {
      const base = 1999 + 240;
      const additional = (school.max_additional_users || 0) * 200;
      return sum + base + additional;
    }, 0);
  const pastDueCount = schools.filter(s => s.subscription_status === 'past_due').length;
  const inactiveCount = schools.filter(s => s.subscription_status === 'inactive' || !s.subscription_status).length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-700 border-0"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-100 text-amber-700 border-0"><AlertTriangle className="w-3 h-3 mr-1" />Past Due</Badge>;
      case 'cancelled':
        return <Badge className="bg-rose-100 text-rose-700 border-0"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      case 'trial':
        return <Badge className="bg-blue-100 text-blue-700 border-0"><Clock className="w-3 h-3 mr-1" />Trial</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-600">Inactive</Badge>;
    }
  };

  const columns = [
    {
      header: 'School Name',
      accessor: 'name',
      cell: (row) => (
        <div>
          <p className="font-semibold text-slate-900">{row.name}</p>
          <p className="text-xs text-slate-500">{row.code}</p>
        </div>
      )
    },
    {
      header: 'Status',
      accessor: 'subscription_status',
      cell: (row) => getStatusBadge(row.subscription_status)
    },
    {
      header: 'Plan',
      accessor: 'subscription_plan',
      cell: (row) => (
        <div className="text-sm">
          <p className="font-medium text-slate-900">{row.subscription_plan === 'yearly' ? 'Yearly' : 'N/A'}</p>
          <p className="text-xs text-slate-500">{row.max_additional_users || 0} extra users</p>
        </div>
      )
    },
    {
      header: 'Annual Revenue',
      accessor: 'revenue',
      cell: (row) => {
        if (row.subscription_status !== 'active') return <span className="text-slate-400">€0</span>;
        const base = 1999 + 240;
        const additional = (row.max_additional_users || 0) * 200;
        return <span className="font-semibold text-slate-900">€{base + additional}</span>;
      }
    },
    {
      header: 'Next Billing',
      accessor: 'subscription_end_date',
      cell: (row) => {
        if (!row.subscription_end_date) return <span className="text-slate-400">N/A</span>;
        return (
          <div className="text-sm">
            <p className="text-slate-900">{format(new Date(row.subscription_end_date), 'MMM d, yyyy')}</p>
          </div>
        );
      }
    },
    {
      header: 'Stripe',
      accessor: 'stripe_customer_id',
      cell: (row) => {
        if (!row.stripe_customer_id) return <span className="text-slate-400">-</span>;
        return (
          <a 
            href={`https://dashboard.stripe.com/customers/${row.stripe_customer_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:text-indigo-700 text-sm underline"
          >
            View
          </a>
        );
      }
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Subscriptions & Revenue"
        description="Manage all client subscriptions and monitor revenue"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Active Subscriptions</p>
                <p className="text-3xl font-bold text-slate-900">{activeSubscriptions}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Annual Revenue</p>
                <p className="text-3xl font-bold text-slate-900">€{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Past Due</p>
                <p className="text-3xl font-bold text-slate-900">{pastDueCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">Inactive</p>
                <p className="text-3xl font-bold text-slate-900">{inactiveCount}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Webhook Setup */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Stripe Webhook Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
            <Label className="text-blue-900 font-semibold mb-2 block">Webhook Endpoint URL:</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-slate-900 text-xs break-all">
                {webhookUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={copyToClipboard}
                className="flex-shrink-0"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-2">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <strong>Stripe Dashboard → Developers → Webhooks</strong></li>
              <li>Click <strong>"Add endpoint"</strong> and paste the URL above</li>
              <li>Select these events: <code className="bg-blue-100 px-1 rounded">checkout.session.completed</code>, <code className="bg-blue-100 px-1 rounded">customer.subscription.updated</code>, <code className="bg-blue-100 px-1 rounded">customer.subscription.deleted</code>, <code className="bg-blue-100 px-1 rounded">invoice.payment_failed</code></li>
              <li>Copy the <strong>signing secret</strong> and add it to your Base44 app secrets as <code className="bg-blue-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code></li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">All Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={schools}
            isLoading={isLoading}
            emptyMessage="No schools found"
          />
        </CardContent>
      </Card>
    </div>
  );
}