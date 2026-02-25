import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Mail, Clock, Calendar, ArrowLeft, Users, Building2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TimetableGrid from '@/components/schedule/TimetableGrid';

export default function TeacherProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const teacherId = urlParams.get('id');

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const schoolId = user?.school_id;

  const { data: teacherRecords = [], isLoading } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => base44.entities.Teacher.filter({ id: teacherId }),
    enabled: !!teacherId,
  });
  const teacher = teacherRecords[0];

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => base44.entities.School.filter({ id: schoolId }),
    enabled: !!schoolId,
    select: (data) => data[0]
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: scheduleVersions = [] } = useQuery({
    queryKey: ['scheduleVersions', schoolId],
    queryFn: () => base44.entities.ScheduleVersion.filter({ school_id: schoolId }, '-created_date'),
    enabled: !!schoolId,
  });

  const activeVersion = scheduleVersions.find(v => v.status === 'published') || scheduleVersions[0];

  const getProcessedSettings = React.useMemo(() => {
    if (!school) return null;
    let breaks = school.breaks || [];
    const lunchBreaks = activeVersion?.generation_params?.lunchBreaks;
    if (lunchBreaks && Array.isArray(lunchBreaks)) {
      const uniqueBreaks = [];
      const seen = new Set();
      lunchBreaks.forEach(b => {
        if (!b.startTime || !b.endTime) return;
        const key = `${b.startTime}-${b.endTime}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueBreaks.push({ start: b.startTime, end: b.endTime });
        }
      });
      if (uniqueBreaks.length > 0) {
        breaks = uniqueBreaks;
      }
    }
    return { ...school, breaks };
  }, [school, activeVersion]);

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ['scheduleSlots', activeVersion?.id],
    queryFn: async () => {
      if (!activeVersion) return [];
      return await base44.entities.ScheduleSlot.filter({ schedule_version: activeVersion.id });
    },
    enabled: !!activeVersion,
  });

  const getSubjectColor = (subjectName) => {
    if (!subjectName) return { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-900', badge: 'bg-slate-100 text-slate-700' };
    const colors = [
      { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-700' },
      { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-700' },
      { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-900', badge: 'bg-violet-100 text-violet-700' },
      { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-700' },
      { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-900', badge: 'bg-fuchsia-100 text-fuchsia-700' },
      { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-900', badge: 'bg-pink-100 text-pink-700' },
      { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-700' },
      { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-700' },
      { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-700' },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700' },
      { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-900', badge: 'bg-teal-100 text-teal-700' },
      { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-900', badge: 'bg-cyan-100 text-cyan-700' },
      { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-900', badge: 'bg-sky-100 text-sky-700' },
    ];
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const teacherSlots = scheduleSlots.filter(slot => slot.teacher_id === teacherId);

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!teacher) return <div className="p-8">Teacher not found.</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <Link to={createPageUrl('Teachers')} className="flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Teachers
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {teacher.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{teacher.full_name}</h1>
            <p className="text-slate-500 flex items-center gap-2 mt-1">
              <Mail className="w-4 h-4" /> {teacher.email}
              {teacher.employee_id && <span>• {teacher.employee_id}</span>}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-500" />
              Employment Info
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Max Hours / Week</p>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="font-medium">{teacher.max_hours_per_week || 25}h</span>
              </div>
            </div>
            {teacher.preferred_free_day && (
              <div>
                <p className="text-sm font-medium text-slate-500">Preferred Free Day</p>
                <Badge variant="outline" className="mt-1">{teacher.preferred_free_day}</Badge>
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-slate-500">Status</p>
              <Badge className={teacher.is_active !== false ? 'mt-1 bg-emerald-100 text-emerald-700 border-0' : 'mt-1 bg-slate-100 text-slate-600 border-0'}>
                {teacher.is_active !== false ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-slate-500" />
              Qualified Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {teacher.subjects && teacher.subjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {teacher.subjects.map((subjId, idx) => {
                  const subject = subjects.find(s => s.id === subjId);
                  const color = getSubjectColor(subject?.name);
                  return (
                    <Badge key={idx} className={`px-3 py-1.5 text-sm ${color.bg} ${color.text} ${color.border}`}>
                      {subject?.name || 'Unknown'}
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">No subjects assigned yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            Current Timetable
          </CardTitle>
          {activeVersion && (
            <Badge variant="outline" className="font-normal text-xs text-slate-500">
              Using: {activeVersion.name}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {scheduleSlots.length > 0 ? (
            <TimetableGrid 
              slots={teacherSlots}
              groups={teachingGroups}
              rooms={rooms}
              subjects={subjects}
              teachers={teachers}
              periodsPerDay={school?.periods_per_day || 10}
              dayStartTime={school?.day_start_time || '08:00'}
              dayEndTime={school?.day_end_time || '18:00'}
              periodDurationMinutes={school?.period_duration_minutes || 60}
              scheduleSettings={getProcessedSettings}
              globalView={false}
              exportId="teacher-profile-timetable"
            />
          ) : (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">No active schedule found</p>
              <p className="text-xs text-slate-500 mt-1">Generate a schedule version to view it here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}