import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
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
    <div className="space-y-10 max-w-7xl">
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

      {/* Stats Grid - Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to={createPageUrl('Teachers')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0 }}
            whileHover={{ scale: 1.05, y: -8 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-slate-900">{activeTeachers}</div>
                  <div className="text-sm font-medium text-slate-500">Teachers</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">{teachers.length} total</div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Students')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            whileHover={{ scale: 1.05, y: -8 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center">
                  <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-slate-900">{activeStudents}</div>
                  <div className="text-sm font-medium text-slate-500">Students</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                {students.filter(s => s.year_group === 'DP2').length} DP2, {students.filter(s => s.year_group === 'DP1').length} DP1
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Subjects')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            whileHover={{ scale: 1.05, y: -8 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-violet-500 flex items-center justify-center">
                  <BookOpen className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-slate-900">{activeSubjects}</div>
                  <div className="text-sm font-medium text-slate-500">Subjects</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">{subjects.filter(s => s.is_core).length} core</div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Rooms')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            whileHover={{ scale: 1.05, y: -8 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-sm bg-white hover:shadow-xl transition-all duration-300 overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="text-4xl font-bold text-slate-900">{activeRooms}</div>
                  <div className="text-sm font-medium text-slate-500">Rooms</div>
                </div>
              </div>
              <div className="text-xs text-slate-400">{rooms.filter(r => r.room_type === 'lab').length} labs</div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Schedule Status */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2"
        >
        <Card className="border-0 shadow-sm bg-white rounded-3xl">
          <CardHeader className="pb-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                Schedule Status
              </CardTitle>
              <Link to={createPageUrl('Schedule')}>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {publishedSchedule ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 mb-4">
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
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
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
                {draftSchedules.slice(0, 3).map((schedule, index) => (
                  <motion.div 
                    key={schedule.id} 
                    className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                    whileHover={{ scale: 1.02, x: 5 }}
                  >
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
                  </motion.div>
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
        </motion.div>

        {/* AI Advisor Suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
        <Card className="border-0 shadow-sm bg-white rounded-3xl">
          <CardHeader className="pb-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-semibold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                </div>
                AI Insights
              </CardTitle>
              <Link to={createPageUrl('AIAdvisor')}>
                <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {aiLogs.length > 0 ? (
              <div className="space-y-3">
                {aiLogs.slice(0, 4).map((log, index) => (
                  <motion.div 
                    key={log.id} 
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={
                        log.severity === 'warning' ? 'bg-amber-100 text-amber-600 text-xs border-0' :
                        log.severity === 'error' ? 'bg-rose-100 text-rose-600 text-xs border-0' :
                        'bg-purple-100 text-purple-600 text-xs border-0'
                      }>
                        {log.severity}
                      </Badge>
                      <span className="text-xs text-slate-400 capitalize">{log.agent_type?.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {log.output?.message || 'New insight available'}
                    </p>
                  </motion.div>
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
        </motion.div>
      </div>



      {/* Support Ticket Form */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
      <SupportTicketForm />
      </motion.div>
    </div>
  );
}