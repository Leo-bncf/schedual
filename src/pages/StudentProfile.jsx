import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Mail, Clock, Calendar, ArrowLeft, Users, Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import TimetableGrid from '@/components/schedule/TimetableGrid';

export default function StudentProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const studentId = urlParams.get('id');

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const schoolId = user?.school_id;

  const { data: studentRecords = [], isLoading } = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => base44.entities.Student.filter({ id: studentId }),
    enabled: !!studentId,
  });
  const student = studentRecords[0];

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

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
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

  const studentSlots = scheduleSlots.filter(slot => {
    const tg = teachingGroups.find(g => g.id === slot.teaching_group_id);
    return tg?.student_ids?.includes(studentId);
  });

  if (isLoading) return <div className="p-8">Loading...</div>;
  if (!student) return <div className="p-8">Student not found.</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <Link to={createPageUrl('Students')} className="flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Students
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {student.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{student.full_name}</h1>
            <p className="text-slate-500">{student.student_id} • {student.email}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-slate-500" />
              Academic Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Programme & Year</p>
              <div className="flex gap-2 mt-1">
                <Badge className="bg-blue-100 text-blue-700 border-0">{student.ib_programme}</Badge>
                <Badge variant="outline" className="text-slate-700">{student.year_group}</Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Status</p>
              <Badge className={student.is_active !== false ? 'mt-1 bg-emerald-100 text-emerald-700 border-0' : 'mt-1 bg-slate-100 text-slate-600 border-0'}>
                {student.is_active !== false ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Academic Year</p>
              <p className="text-sm mt-1">{school?.academic_year || 'Current'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              Enrolled Subjects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {student.subject_choices && student.subject_choices.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {student.subject_choices.map((choice, idx) => {
                  const subject = subjects.find(s => s.id === choice.subject_id);
                  const color = getSubjectColor(subject?.name);
                  return (
                    <div key={idx} className={`p-3 rounded-lg border flex justify-between items-center ${color.bg} ${color.border}`}>
                      <span className={`font-medium text-sm ${color.text}`}>{subject?.name || 'Unknown'}</span>
                      {choice.level && <Badge className={`${color.badge} border-0`}>{choice.level}</Badge>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-slate-500 text-sm">No subjects selected yet.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" />
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
              slots={studentSlots}
              groups={teachingGroups}
              rooms={rooms}
              subjects={subjects}
              teachers={teachers}
              periodsPerDay={school?.periods_per_day || 10}
              dayStartTime={school?.school_start_time || school?.day_start_time || '08:00'}
              dayEndTime={school?.day_end_time || '18:00'}
              periodDurationMinutes={school?.period_duration_minutes || 60}
              scheduleSettings={school}
              globalView={false}
              exportId="student-profile-timetable"
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
      
      <Card className="shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-slate-500" />
            Performance & Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center">
          <p className="text-slate-500 text-sm">Past performance summaries will be available here.</p>
        </CardContent>
      </Card>
    </div>
  );
}