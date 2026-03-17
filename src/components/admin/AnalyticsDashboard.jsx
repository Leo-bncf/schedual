import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Download } from 'lucide-react';

const MONTHLY_TIER_PRICES = {
  tier1: 110,
  tier2: 220,
  tier3: 495,
};

const MONTHLY_ADDON_PRICES = {
  additional_campus: 66,
  multiple_timetable_scenarios: 88,
  priority_support: 55,
  unlimited_campuses: 165,
  unlimited_admin_users: 83,
  extra_admin_user: 28,
};

const CHART_COLORS = ['#4f46e5', '#7c3aed', '#06b6d4', '#f59e0b', '#10b981'];

function formatMonthLabel(date) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function isWithinRange(dateValue, range) {
  const date = new Date(dateValue);
  const now = new Date();
  const days = range === '30d' ? 30 : range === '90d' ? 90 : 180;
  const threshold = new Date(now);
  threshold.setDate(now.getDate() - days);
  return date >= threshold;
}

function estimateSchoolMrr(school) {
  const tierAmount = MONTHLY_TIER_PRICES[school.subscription_tier] || 0;
  const addOnAmount = (school.active_add_ons || []).reduce((sum, addOn) => sum + (MONTHLY_ADDON_PRICES[addOn] || 0), 0);
  return tierAmount + addOnAmount;
}

function exportSchoolsCsv(rows) {
  const header = ['School', 'Plan', 'Status', 'Billing Status', 'Address', 'Created Date'];
  const lines = rows.map((row) => [
    row.name || '',
    row.subscription_tier || '',
    row.subscription_status === 'active' ? 'active' : 'inactive',
    row.subscription_status || '',
    row.address || '',
    row.created_date || '',
  ]);
  const csv = [header, ...lines]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'super-admin-analytics.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AnalyticsDashboard({ schools = [], users = [], loginSessions = [] }) {
  const [range, setRange] = React.useState('180d');
  const filteredSchools = React.useMemo(() => schools.filter((school) => isWithinRange(school.created_date, range)), [schools, range]);
  const filteredUsers = React.useMemo(() => users.filter((user) => isWithinRange(user.created_date, range)), [users, range]);
  const filteredSessions = React.useMemo(() => loginSessions.filter((session) => isWithinRange(session.created_date, range)), [loginSessions, range]);

  const currentMrr = React.useMemo(
    () => schools
      .filter((school) => ['active', 'trialing'].includes(school.subscription_status))
      .reduce((sum, school) => sum + estimateSchoolMrr(school), 0),
    [schools]
  );

  const growthData = React.useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: formatMonthLabel(d), newSchools: 0, newUsers: 0 });
    }

    filteredSchools.forEach((school) => {
      const d = new Date(school.created_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const month = months.find((item) => item.key === key);
      if (month) month.newSchools += 1;
    });

    filteredUsers.forEach((user) => {
      const d = new Date(user.created_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const month = months.find((item) => item.key === key);
      if (month) month.newUsers += 1;
    });

    return months;
  }, [filteredSchools, filteredUsers]);

  const featureAdoptionData = React.useMemo(() => {
    const featureMap = new Map();
    schools.forEach((school) => {
      (school.active_add_ons || []).forEach((feature) => {
        featureMap.set(feature, (featureMap.get(feature) || 0) + 1);
      });
    });

    return Array.from(featureMap.entries())
      .map(([name, value]) => ({ name: name.replaceAll('_', ' '), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [schools]);

  const billingMixData = React.useMemo(() => {
    const counts = schools.reduce((acc, school) => {
      const key = school.subscription_status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [schools]);

  const forecastData = React.useMemo(() => {
    const schoolCount = schools.length;
    const baseMrr = currentMrr;
    return [0, 1, 2, 3].map((month) => ({
      name: month === 0 ? 'Current' : `+${month} mo`,
      projectedSchools: Number((schoolCount + month * Math.max(1, filteredSchools.length || 1) * 0.4).toFixed(1)),
      projectedMrr: Math.round(baseMrr + month * Math.max(50, baseMrr * 0.12 || 50)),
    }));
  }, [schools.length, currentMrr, filteredSchools.length]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Advanced Analytics & Reporting</h3>
          <p className="text-sm text-slate-500">Deep dive dashboards, custom reports, and lightweight forecasting.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="180d">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportSchoolsCsv(schools)}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="text-xs text-slate-500">SCHOOLS ADDED</div><div className="mt-2 text-3xl font-bold text-slate-900">{filteredSchools.length}</div><div className="text-xs text-slate-500">Created in selected period</div></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="text-xs text-slate-500">NEW USERS</div><div className="mt-2 text-3xl font-bold text-slate-900">{filteredUsers.length}</div><div className="text-xs text-slate-500">Memberships created in selected period</div></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="text-xs text-slate-500">ACTIVITY EVENTS</div><div className="mt-2 text-3xl font-bold text-slate-900">{filteredSessions.length}</div><div className="text-xs text-slate-500">Login sessions in selected period</div></CardContent></Card>
        <Card className="border-slate-200 shadow-sm"><CardContent className="p-5"><div className="text-xs text-slate-500">CURRENT MRR</div><div className="mt-2 text-3xl font-bold text-slate-900">${currentMrr}</div><div className="text-xs text-slate-500">Estimated recurring revenue</div></CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Platform Growth</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="newSchools" stroke="#4f46e5" strokeWidth={3} />
                <Line type="monotone" dataKey="newUsers" stroke="#0f766e" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Feature Adoption</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureAdoptionData} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Billing Mix</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={billingMixData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {billingMixData.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle className="text-base">Forecasting</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="projectedSchools" stroke="#4f46e5" strokeWidth={3} />
                <Line yAxisId="right" type="monotone" dataKey="projectedMrr" stroke="#f97316" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader><CardTitle className="text-base">Custom Reports</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-3 pr-4">School</th>
                <th className="py-3 pr-4">Plan</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Billing Status</th>
                <th className="py-3 pr-4">Address</th>
                <th className="py-3 pr-0">Created Date</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-b last:border-b-0">
                  <td className="py-3 pr-4 font-medium text-slate-900">{school.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{school.subscription_tier || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600">{school.subscription_status === 'active' ? 'active' : 'inactive'}</td>
                  <td className="py-3 pr-4 text-slate-600">{school.subscription_status || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600">{school.address || '-'}</td>
                  <td className="py-3 pr-0 text-slate-600">{new Date(school.created_date).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}