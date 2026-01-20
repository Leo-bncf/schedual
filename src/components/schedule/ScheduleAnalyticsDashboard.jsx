import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6'];

export default function ScheduleAnalyticsDashboard({ scheduleVersionId }) {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAnalytics();
  }, [scheduleVersionId]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const response = await base44.functions.invoke('generateScheduleAnalytics', {
        schedule_version_id: scheduleVersionId
      });
      setAnalytics(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>Error loading analytics: {error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) return null;

  const { summary, utilization, conflicts, load_analysis, quality_score } = analytics;

  return (
    <div className="space-y-6">
      {/* Quality Score Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-200">Overall Schedule Quality</p>
            <p className="text-4xl font-bold mt-2">{quality_score}%</p>
          </div>
          {quality_score >= 80 ? (
            <CheckCircle2 className="w-16 h-16 text-green-300" />
          ) : (
            <AlertTriangle className="w-16 h-16 text-yellow-300" />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Total Slots</p>
            <p className="text-3xl font-bold">{summary.total_slots}</p>
            <p className="text-xs text-slate-500 mt-1">{summary.total_hours}h scheduled</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Room Utilization</p>
            <p className="text-3xl font-bold">{utilization.avg_room_utilization}%</p>
            <p className="text-xs text-slate-500 mt-1">{utilization.rooms_count} rooms</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Conflicts</p>
            <p className={`text-3xl font-bold ${conflicts.total > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {conflicts.total}
            </p>
            <p className="text-xs text-slate-500 mt-1">{conflicts.unresolved} unresolved</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Coverage</p>
            <p className="text-3xl font-bold">{((summary.total_slots / (summary.max_slots || 1)) * 100).toFixed(0)}%</p>
            <p className="text-xs text-slate-500 mt-1">of capacity</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs defaultValue="utilization" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="utilization">Utilization</TabsTrigger>
          <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
        </TabsList>

        {/* Utilization Tab */}
        <TabsContent value="utilization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Room Utilization by Day</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={utilization.by_day}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="utilization" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Avg Utilization</p>
                <p className="text-2xl font-bold">{utilization.avg_room_utilization}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Peak Period</p>
                <p className="text-2xl font-bold">{utilization.peak_period}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Conflicts Tab */}
        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conflicts by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={conflicts.by_type}
                    dataKey="count"
                    nameKey="type"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                  >
                    {conflicts.by_type.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <Badge className="mb-2">Critical</Badge>
                <p className="text-2xl font-bold text-red-600">{conflicts.by_severity?.critical || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Badge className="mb-2 bg-yellow-600">Medium</Badge>
                <p className="text-2xl font-bold text-yellow-600">{conflicts.by_severity?.medium || 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <Badge className="mb-2 bg-green-600">Info</Badge>
                <p className="text-2xl font-bold text-green-600">{conflicts.by_severity?.low || 0}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Workload Tab */}
        <TabsContent value="workload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Teacher Workload Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={load_analysis.teacher_hours}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Avg Hours/Teacher</p>
                <p className="text-2xl font-bold">{load_analysis.avg_hours_per_teacher}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Max Load</p>
                <p className="text-2xl font-bold">{load_analysis.max_hours}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600">Imbalance</p>
                <p className={`text-2xl font-bold ${load_analysis.imbalance_score > 0.3 ? 'text-red-600' : 'text-green-600'}`}>
                  {(load_analysis.imbalance_score * 100).toFixed(0)}%
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Slots by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={utilization.by_day}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="slots" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}