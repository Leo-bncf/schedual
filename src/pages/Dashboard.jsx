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



  // School dashboard stats
  const activeTeachers = teachers.filter(t => t.is_active !== false).length;
  const activeStudents = students.filter(s => s.is_active !== false).length;
  const activeSubjects = subjects.filter(s => s.is_active !== false).length;
  const activeRooms = rooms.filter(r => r.is_active !== false).length;

  const publishedSchedule = scheduleVersions.find(s => s.status === 'published');
  const draftSchedules = scheduleVersions.filter(s => s.status === 'draft');

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview of your scheduling system</p>
        </div>
        <Link to={createPageUrl('Schedules')}>
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg">
            <Calendar className="w-5 h-5 mr-2" />
            Go to Scheduling
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Stats Grid - Quick Access Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to={createPageUrl('Teachers')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-lg bg-white hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-5xl font-bold text-slate-900">{activeTeachers}</div>
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Teachers</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-medium">{teachers.length} total</div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Students')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-lg bg-white hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-600"></div>
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <GraduationCap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-5xl font-bold text-slate-900">{activeStudents}</div>
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Students</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-medium">
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
            whileHover={{ scale: 1.02, y: -4 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-lg bg-white hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-violet-600"></div>
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-5xl font-bold text-slate-900">{activeSubjects}</div>
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Subjects</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-medium">{subjects.filter(s => s.is_core).length} core</div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>

        <Link to={createPageUrl('Rooms')}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="cursor-pointer"
          >
          <Card className="border-0 shadow-lg bg-white hover:shadow-2xl transition-all duration-300 overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-orange-600"></div>
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="text-5xl font-bold text-slate-900">{activeRooms}</div>
                  <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Rooms</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 font-medium">{rooms.filter(r => r.room_type === 'lab').length} labs</div>
            </CardContent>
          </Card>
          </motion.div>
        </Link>
      </div>

      {/* Schedule Status - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
      <Card className="border-0 shadow-lg bg-white rounded-3xl">
        <CardHeader className="pb-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-slate-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              Schedule Status
            </CardTitle>
            <Link to={createPageUrl('Schedules')}>
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {publishedSchedule ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border-2 border-emerald-200 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <span className="font-semibold text-lg text-emerald-900">Published Schedule</span>
                <Badge className="bg-emerald-100 text-emerald-700 border-0">{publishedSchedule.name}</Badge>
              </div>
              <p className="text-sm text-emerald-700">
                Academic Year: {publishedSchedule.academic_year || 'Not set'} • 
                Score: {publishedSchedule.score || 'N/A'}
              </p>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-200 mb-4">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                <span className="font-semibold text-lg text-amber-900">No Published Schedule</span>
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
                  className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.5 + index * 0.1 }}
                  whileHover={{ scale: 1.01, x: 5 }}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-400" />
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
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 mb-4">No schedules created yet</p>
              <Link to={createPageUrl('Schedules')}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                  <Sparkles className="w-5 h-5 mr-2" />
                  Create First Schedule
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      </motion.div>



      {/* Need Help Section */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
      >
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl overflow-hidden">
        <CardContent className="p-8">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Need Help?</h3>
              <p className="text-slate-600 mb-6">
                Our support team is here to assist you with any questions about scheduling, setup, or platform features.
              </p>
              <Link to={createPageUrl('Support')}>
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                  Contact Support
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </div>
  );
}