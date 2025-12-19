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
  Sparkles,
  TrendingUp,
  Settings
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import StatCard from '../components/ui-custom/StatCard';
import PageHeader from '../components/ui-custom/PageHeader';

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  // Check if super admin (admin with no school_id)
  const isSuperAdmin = user?.role === 'admin' && !user?.school_id;

  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers', user?.school_id],
    queryFn: () => base44.entities.Teacher.filter({ school_id: user?.school_id }),
    enabled: !isSuperAdmin && !!user?.school_id,
  });

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', user?.school_id],
    queryFn: () => base44.entities.Student.filter({ school_id: user?.school_id }),
    enabled: !isSuperAdmin && !!user?.school_id,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects', user?.school_id],
    queryFn: () => base44.entities.Subject.filter({ school_id: user?.school_id }),
    enabled: !isSuperAdmin && !!user?.school_id,
  });

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms', user?.school_id],
    queryFn: () => base44.entities.Room.filter({ school_id: user?.school_id }),
    enabled: !isSuperAdmin && !!user?.school_id,
  });

  const { data: scheduleVersions = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['scheduleVersions', user?.school_id],
    queryFn: () => base44.entities.ScheduleVersion.filter({ school_id: user?.school_id }, '-created_date', 5),
    enabled: !isSuperAdmin && !!user?.school_id,
  });

  const { data: aiLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['aiLogs', user?.school_id],
    queryFn: () => base44.entities.AIAdvisorLog.filter({ school_id: user?.school_id, status: 'pending' }, '-created_date', 5),
    enabled: !isSuperAdmin && !!user?.school_id,
  });

  // Super Admin Dashboard
  if (isSuperAdmin) {
    return (
      <div className="space-y-8">
        <PageHeader 
          title="Super Admin Dashboard"
          description="Platform administration and testing tools"
        />

        {/* Admin Sections */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Super Admin Section */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-violet-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">Super Admin</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to={createPageUrl('SuperAdmin')}>
                <Button variant="outline" className="w-full justify-start text-left h-auto py-4">
                  <Settings className="w-5 h-5 mr-3" />
                  <div>
                    <div className="font-semibold">School Management</div>
                    <div className="text-xs text-slate-500">Manage schools and platform settings</div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* User Management Section */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">User Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to={createPageUrl('UserManagement')}>
                <Button variant="outline" className="w-full justify-start text-left h-auto py-4">
                  <Users className="w-5 h-5 mr-3" />
                  <div>
                    <div className="font-semibold">User Administration</div>
                    <div className="text-xs text-slate-500">Manage user accounts and permissions</div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Testing Tools Section */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <CardTitle className="text-xl">Testing & Development</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to={createPageUrl('Schedule')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <Calendar className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Schedule</span>
                </div>
              </Link>
              <Link to={createPageUrl('TeachingGroups')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <Users className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Teaching Groups</span>
                </div>
              </Link>
              <Link to={createPageUrl('Teachers')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <Users className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Teachers</span>
                </div>
              </Link>
              <Link to={createPageUrl('Students')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <GraduationCap className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Students</span>
                </div>
              </Link>
              <Link to={createPageUrl('Subjects')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <BookOpen className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Subjects</span>
                </div>
              </Link>
              <Link to={createPageUrl('Rooms')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <Building2 className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Rooms</span>
                </div>
              </Link>
              <Link to={createPageUrl('Constraints')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <Settings className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">Constraints</span>
                </div>
              </Link>
              <Link to={createPageUrl('AIAdvisor')}>
                <div className="p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-center group">
                  <Sparkles className="w-8 h-8 text-indigo-600 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-slate-700">AI Advisor</span>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Platform Overview */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              Platform Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-slate-500 py-8">
              Platform statistics and overview coming soon
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular user dashboard
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
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Calendar className="w-4 h-4 mr-2" />
              View Schedule
            </Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Teachers"
          value={activeTeachers}
          subtitle={`${teachers.length} total`}
          icon={Users}
        />
        <StatCard
          title="Students"
          value={activeStudents}
          subtitle={`${students.filter(s => s.year_group === 'DP2').length} DP2, ${students.filter(s => s.year_group === 'DP1').length} DP1`}
          icon={GraduationCap}
        />
        <StatCard
          title="Subjects"
          value={activeSubjects}
          subtitle={`${subjects.filter(s => s.is_core).length} core components`}
          icon={BookOpen}
        />
        <StatCard
          title="Rooms"
          value={activeRooms}
          subtitle={`${rooms.filter(r => r.room_type === 'lab').length} labs`}
          icon={Building2}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Schedule Status */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900">Schedule Status</CardTitle>
              <Link to={createPageUrl('Schedule')}>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
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
                  <Button className="mt-4 bg-indigo-600 hover:bg-indigo-700">
                    Create First Schedule
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Advisor Suggestions */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-500" />
                AI Insights
              </CardTitle>
              <Link to={createPageUrl('AIAdvisor')}>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {aiLogs.length > 0 ? (
              <div className="space-y-3">
                {aiLogs.slice(0, 4).map(log => (
                  <div key={log.id} className="p-3 rounded-lg bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs border-0 ${
                        log.severity === 'warning' ? 'bg-amber-100 text-amber-700' :
                        log.severity === 'error' ? 'bg-rose-100 text-rose-700' :
                        'bg-blue-100 text-blue-700'
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
                <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No pending suggestions</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-slate-900">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link to={createPageUrl('Teachers')} className="block">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-center">
                <Users className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <span className="text-sm font-medium text-slate-700">Add Teacher</span>
              </div>
            </Link>
            <Link to={createPageUrl('Students')} className="block">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-center">
                <GraduationCap className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <span className="text-sm font-medium text-slate-700">Add Student</span>
              </div>
            </Link>
            <Link to={createPageUrl('Subjects')} className="block">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-center">
                <BookOpen className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <span className="text-sm font-medium text-slate-700">Add Subject</span>
              </div>
            </Link>
            <Link to={createPageUrl('Schedule')} className="block">
              <div className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-center">
                <Calendar className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <span className="text-sm font-medium text-slate-700">Generate Schedule</span>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}