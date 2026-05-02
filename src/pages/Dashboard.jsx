import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
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
import ScholrIntegrationCard from '@/components/settings/ScholrIntegrationCard';


export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: teachers = [], isLoading: loadingTeachers } = useQuery({
    queryKey: ['teachers', user?.school_id],
    queryFn: () => base44.entities.Teacher.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['students', user?.school_id],
    queryFn: () => base44.entities.Student.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: subjects = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ['subjects', user?.school_id],
    queryFn: () => base44.entities.Subject.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    queryKey: ['rooms', user?.school_id],
    queryFn: () => base44.entities.Room.filter({ school_id: user?.school_id }),
    enabled: !!user?.school_id,
  });

  const { data: scheduleVersions = [], isLoading: loadingSchedules } = useQuery({
    queryKey: ['scheduleVersions', user?.school_id],
    queryFn: () => base44.entities.ScheduleVersion.filter({ school_id: user?.school_id }, '-created_date', 5),
    enabled: !!user?.school_id,
  });



  // School dashboard stats
  const activeTeachers = teachers.filter(t => t.is_active !== false).length;
  const activeStudents = students.filter(s => s.is_active !== false).length;
  const activeSubjects = subjects.filter(s => s.is_active !== false).length;
  const activeRooms = rooms.filter(r => r.is_active !== false).length;

  const publishedSchedule = scheduleVersions.find(s => s.status === 'published');
  const draftSchedules = scheduleVersions.filter(s => s.status === 'draft');

  const programmeData = [
    { name: 'DP', value: students.filter(s => s.ib_programme === 'DP').length, color: '#1e40af' },
    { name: 'MYP', value: students.filter(s => s.ib_programme === 'MYP').length, color: '#3b82f6' },
    { name: 'PYP', value: students.filter(s => s.ib_programme === 'PYP').length, color: '#93c5fd' },
  ].filter(d => d.value > 0);

  const teacherLoadData = [
    { name: 'Full-time (>20h)', value: teachers.filter(t => (t.max_hours_per_week || 0) > 20).length, color: '#1e40af' },
    { name: 'Part-time (≤20h)', value: teachers.filter(t => (t.max_hours_per_week || 0) <= 20).length, color: '#93c5fd' },
  ].filter(d => d.value > 0);

  const hasTeacherLoadData = teacherLoadData.reduce((sum, d) => sum + d.value, 0) > 0;

  return (
    <div className="flex flex-col gap-8 w-full min-h-[calc(100vh-8rem)] lg:min-h-[calc(100vh-11rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm font-medium text-slate-500 mt-1 uppercase tracking-wider">System Overview</p>
        </div>
        <Link to={createPageUrl('Schedules')}>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 h-10 font-medium transition-all shadow-sm">
            <Calendar className="w-4 h-4 mr-2" />
            Scheduling Engine
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 lg:grid-rows-[1fr_1fr] gap-6 flex-1">
        {/* Students Bento */}
        <Card className="md:col-span-12 lg:col-span-5 rounded-3xl shadow-sm border-slate-200 hover:shadow-md transition-all duration-300">
          <CardContent className="p-6 h-full flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-widest">Students</h3>
                <div className="text-4xl font-light text-slate-900 mt-2">{activeStudents}</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex-1 mt-6 min-h-[180px]">
              {programmeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={programmeData} innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {programmeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#1e40af', fontSize: '14px', fontWeight: 500 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                 <div className="flex items-center justify-center h-full text-sm text-slate-400">No student data</div>
              )}
            </div>
            <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
              {programmeData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-sm font-medium text-slate-700">{d.name} <span className="text-slate-400 font-normal">({d.value})</span></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Teachers Bento */}
        <Card className="md:col-span-6 lg:col-span-4 rounded-3xl shadow-sm border-slate-200 hover:shadow-md transition-all duration-300">
          <CardContent className="p-6 h-full flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-widest">Teachers</h3>
                <div className="text-4xl font-light text-slate-900 mt-2">{activeTeachers}</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                <Users className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-8 flex-1 flex flex-col justify-center">
              {hasTeacherLoadData ? (
                <div className="space-y-6">
                  {teacherLoadData.map(d => (
                    <div key={d.name}>
                      <div className="flex justify-between text-sm mb-2.5">
                        <span className="font-medium text-slate-700">{d.name}</span>
                        <span className="text-slate-500 font-medium">{d.value}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${(d.value / Math.max(1, activeTeachers)) * 100}%`, backgroundColor: d.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 text-center">Teacher load data unavailable</div>
              )}
            </div>
            <div className="mt-8 pt-4 border-t border-slate-100">
              <Link to={createPageUrl('Teachers')} className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 group">
                View Directory <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Subjects & Rooms Stack */}
        <div className="md:col-span-6 lg:col-span-3 flex flex-col gap-6">
          <Link to={createPageUrl('Subjects')} className="flex-1 block">
            <Card className="h-full rounded-3xl shadow-sm border-slate-200 hover:shadow-md transition-all duration-300">
              <CardContent className="p-6 h-full flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 transition-transform group-hover:scale-110 duration-500">
                  <BookOpen className="w-32 h-32 text-slate-900" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-widest">Subjects</h3>
                    <div className="text-3xl font-light text-slate-900 mt-1">{activeSubjects}</div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
                    <BookOpen className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          
          <Link to={createPageUrl('Rooms')} className="flex-1 block">
            <Card className="h-full rounded-3xl shadow-sm border-slate-200 hover:shadow-md transition-all duration-300">
              <CardContent className="p-6 h-full flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute -right-4 -bottom-4 opacity-5 transition-transform group-hover:scale-110 duration-500">
                  <Building2 className="w-32 h-32 text-slate-900" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-slate-500 font-semibold text-xs uppercase tracking-widest">Rooms</h3>
                    <div className="text-3xl font-light text-slate-900 mt-1">{activeRooms}</div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-md transition-transform group-hover:scale-105">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Schedule Status */}
        <Card className="md:col-span-12 lg:col-span-7 rounded-3xl shadow-sm border-slate-200 hover:shadow-md transition-all duration-300">
          <CardContent className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-slate-900 font-medium text-lg tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-slate-500" />
                Schedule Status
              </h3>
              <Link to={createPageUrl('Schedules')}>
                <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  View All
                </Button>
              </Link>
            </div>

            <div className="flex-1 flex flex-col gap-4">
              {publishedSchedule ? (
                <div className="p-6 rounded-2xl bg-blue-900 text-white flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Active</span>
                    </div>
                    <h4 className="text-xl font-light">{publishedSchedule.name}</h4>
                    <p className="text-blue-200 text-sm mt-1">AY {publishedSchedule.academic_year || 'Not set'}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl font-light">{publishedSchedule.score || 'N/A'}</div>
                    <div className="text-blue-200 text-xs mt-1 uppercase tracking-widest">Optimization</div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center">
                       <AlertTriangle className="w-5 h-5 text-slate-400" />
                     </div>
                     <div>
                       <h4 className="font-medium text-slate-900">No Published Schedule</h4>
                       <p className="text-sm text-slate-500 mt-0.5">Generate or publish a schedule</p>
                     </div>
                   </div>
                </div>
              )}

              {draftSchedules.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest pl-2 mb-3">Recent Drafts</p>
                  {draftSchedules.slice(0, 2).map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-3 px-4 rounded-2xl hover:bg-slate-50 transition-colors group cursor-pointer border border-transparent hover:border-slate-100">
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                        <span className="font-medium text-sm text-slate-700">{schedule.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {schedule.conflicts_count > 0 ? (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">{schedule.conflicts_count} conflicts</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">Valid</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-12 lg:col-span-5">
          <ScholrIntegrationCard compact />
        </div>

        {/* Need Help */}
        <Card className="md:col-span-12 lg:col-span-5 rounded-3xl shadow-sm border-0 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden relative group hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 right-0 p-8 opacity-5 transition-transform group-hover:scale-110 duration-700">
            <Sparkles className="w-32 h-32 text-blue-900" />
          </div>
          <CardContent className="p-8 h-full flex flex-col relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md flex items-center justify-center mb-6">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-medium text-slate-900 mb-2">System Support</h3>
            <p className="text-slate-600 text-sm leading-relaxed max-w-[280px] mb-8">
              Need assistance with configuration or have questions about the scheduling engine?
            </p>
            <div className="mt-auto">
              <Link to={createPageUrl('Support')}>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 h-10 font-medium shadow-sm transition-all">
                  Contact Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}