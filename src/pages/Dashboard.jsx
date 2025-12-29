import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Building2, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import StatCard from '../components/ui-custom/StatCard';
import PageHeader from '../components/ui-custom/PageHeader';
import SupportTicketForm from '../components/support/SupportTicketForm';

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers', user?.school_id],
    queryFn: () => base44.entities.Teacher.list(),
    enabled: !!user?.school_id,
  });

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', user?.school_id],
    queryFn: () => base44.entities.Student.list(),
    enabled: !!user?.school_id,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects', user?.school_id],
    queryFn: () => base44.entities.Subject.list(),
    enabled: !!user?.school_id,
  });

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms', user?.school_id],
    queryFn: () => base44.entities.Room.list(),
    enabled: !!user?.school_id,
  });

  const { data: scheduleVersions = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['scheduleVersions', user?.school_id],
    queryFn: () => base44.entities.ScheduleVersion.list('-created_date', 5),
    enabled: !!user?.school_id,
  });

  const { data: aiLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['aiLogs', user?.school_id],
    queryFn: async () => {
      const logs = await base44.entities.AIAdvisorLog.list('-created_date', 50);
      return logs.filter(log => log.status === 'pending').slice(0, 5);
    },
    enabled: !!user?.school_id,
  });

  // School dashboard stats
  const activeTeachers = teachers.filter(t => t.is_active !== false).length;
  const activeStudents = students.filter(s => s.is_active !== false).length;
  const activeSubjects = subjects.filter(s => s.is_active !== false).length;
  const activeRooms = rooms.filter(r => r.is_active !== false).length;

  const publishedSchedule = scheduleVersions.find(s => s.status === 'published');
  const draftSchedules = scheduleVersions.filter(s => s.status === 'draft');

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Dashboard"
        description="Overview of your scheduling system"
        actions={
          <Link to={createPageUrl('Schedule')}>
            <Button className="bg-blue-900 hover:bg-blue-800">
              <Calendar className="w-4 h-4 mr-2" />
              View Schedule
            </Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-white/90" />
                <div className="text-right">
                  <div className="text-3xl font-bold">{activeTeachers}</div>
                </div>
              </div>
              <div className="text-sm font-medium text-blue-100">Teachers</div>
              <div className="text-xs text-blue-200 mt-1">{teachers.length} total</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <GraduationCap className="w-8 h-8 text-white/90" />
                <div className="text-right">
                  <div className="text-3xl font-bold">{activeStudents}</div>
                </div>
              </div>
              <div className="text-sm font-medium text-emerald-100">Students</div>
              <div className="text-xs text-emerald-200 mt-1">
                {students.filter(s => s.year_group === 'DP2').length} DP2, {students.filter(s => s.year_group === 'DP1').length} DP1
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500 to-violet-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <BookOpen className="w-8 h-8 text-white/90" />
                <div className="text-right">
                  <div className="text-3xl font-bold">{activeSubjects}</div>
                </div>
              </div>
              <div className="text-sm font-medium text-violet-100">Subjects</div>
              <div className="text-xs text-violet-200 mt-1">{subjects.filter(s => s.is_core).length} core components</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-500 to-amber-600 text-white overflow-hidden relative">
          <CardContent className="p-6">
            <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-8 h-8 text-white/90" />
                <div className="text-right">
                  <div className="text-3xl font-bold">{activeRooms}</div>
                </div>
              </div>
              <div className="text-sm font-medium text-amber-100">Rooms</div>
              <div className="text-xs text-amber-200 mt-1">{rooms.filter(r => r.room_type === 'lab').length} labs</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Schedule Status */}
        <Card className="lg:col-span-2 border-0 shadow-lg bg-white">
          <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Schedule Status
              </CardTitle>
              <Link to={createPageUrl('Schedule')}>
                <Button variant="ghost" size="sm" className="text-blue-900 hover:text-blue-800">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {publishedSchedule ? (
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-semibold text-emerald-900">Published Schedule</span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-0">{publishedSchedule.name}</Badge>
                </div>
                <p className="text-sm text-emerald-700">
                  Academic Year: {publishedSchedule.academic_year || 'Not set'} • 
                  Score: {publishedSchedule.score || 'N/A'}
                </p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold text-amber-900">No Published Schedule</span>
                </div>
                <p className="text-sm text-amber-700">
                  Create and publish a schedule to get started.
                </p>
              </div>
            )}

            {draftSchedules.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-600">Draft Schedules</h4>
                {draftSchedules.slice(0, 3).map(schedule => (
                  <div key={schedule.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{schedule.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {schedule.conflicts_count > 0 && (
                        <Badge variant="outline" className="text-rose-600 border-rose-200">
                          {schedule.conflicts_count} conflicts
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-slate-600">
                        Draft
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {scheduleVersions.length === 0 && !loadingSchedules && (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No schedules created yet</p>
                <Link to={createPageUrl('Schedule')}>
                  <Button className="mt-4 bg-blue-900 hover:bg-blue-800">
                    Create First Schedule
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Advisor Suggestions */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600" />
                AI Insights
              </CardTitle>
              <Link to={createPageUrl('AIAdvisor')}>
                <Button variant="ghost" size="sm" className="text-purple-700 hover:text-purple-900">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {aiLogs.length > 0 ? (
              <div className="space-y-3">
                {aiLogs.slice(0, 4).map(log => (
                  <div key={log.id} className="p-3 rounded-lg bg-white border-l-4 shadow-sm hover:shadow-md transition-shadow ${
                    log.severity === 'warning' ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-white' :
                    log.severity === 'error' ? 'border-rose-400 bg-gradient-to-r from-rose-50 to-white' :
                    'border-purple-400 bg-gradient-to-r from-purple-50 to-white'
                  }">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs border-0 ${
                        log.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                        log.severity === 'error' ? 'bg-rose-100 text-rose-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {log.severity}
                      </Badge>
                      <span className="text-xs text-slate-500 capitalize">{log.agent_type?.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-700 line-clamp-2">
                      {log.output?.message || 'New insight available'}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Sparkles className="w-12 h-12 text-purple-300 mx-auto mb-3" />
                <p className="text-slate-500">No pending suggestions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-blue-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link to={createPageUrl('Teachers')} className="block group">
              <div className="p-5 rounded-xl bg-white border-2 border-blue-200 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 transition-all text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-800">Add Teacher</span>
              </div>
            </Link>
            <Link to={createPageUrl('Students')} className="block group">
              <div className="p-5 rounded-xl bg-white border-2 border-emerald-200 hover:border-emerald-500 hover:shadow-lg hover:-translate-y-1 transition-all text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-800">Add Student</span>
              </div>
            </Link>
            <Link to={createPageUrl('Subjects')} className="block group">
              <div className="p-5 rounded-xl bg-white border-2 border-violet-200 hover:border-violet-500 hover:shadow-lg hover:-translate-y-1 transition-all text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-800">Add Subject</span>
              </div>
            </Link>
            <Link to={createPageUrl('Schedule')} className="block group">
              <div className="p-5 rounded-xl bg-white border-2 border-amber-200 hover:border-amber-500 hover:shadow-lg hover:-translate-y-1 transition-all text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-semibold text-slate-800">Generate Schedule</span>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Support Ticket Form */}
      <SupportTicketForm />
    </div>
  );
}