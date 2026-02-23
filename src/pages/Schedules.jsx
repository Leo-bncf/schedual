import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import {
  Plus,
  Calendar,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  BookOpen,
  Building2,
  Eye,
  Download,
  Search
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import ScheduleGenerationDialog from '../components/schedule/ScheduleGenerationDialog';

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genStatus, setGenStatus] = useState('idle'); // idle | generating | success | error
  const [genMessage, setGenMessage] = useState('');
  const [genError, setGenError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => base44.entities.School.filter({ id: schoolId }),
    enabled: !!schoolId,
    select: (data) => data[0]
  });

  const { data: scheduleVersions = [] } = useQuery({
    queryKey: ['scheduleVersions', schoolId],
    queryFn: () => base44.entities.ScheduleVersion.filter({ school_id: schoolId }, '-created_date'),
    enabled: !!schoolId,
  });

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ['scheduleSlots', selectedVersion?.id],
    queryFn: async () => {
      if (!selectedVersion) return [];
      return await base44.entities.ScheduleSlot.filter({ schedule_version: selectedVersion.id });
    },
    enabled: !!selectedVersion,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const createVersionMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.ScheduleVersion.create({ ...data, school_id: schoolId, status: 'draft' });
    },
    onSuccess: (newVersion) => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      setIsDialogOpen(false);
      setSelectedVersion(newVersion);
      setFormData({ name: '', academic_year: '2024-2025', term: 'Fall' });
    },
  });

  const handleGenerateSchedule = async () => {
    if (!selectedVersion) return;

    setGenDialogOpen(true);
    setGenStatus('generating');
    setGenMessage('');
    setGenError('');

    try {
      const { data } = await base44.functions.invoke('optaPlannerPipeline', {
        schedule_version_id: selectedVersion.id
      });

      if (data.ok === true) {
        setGenStatus('success');
        const inserted = data.result?.slotsInserted || 0;
        setGenMessage(`✅ ${inserted} slots créés avec succès! Score: ${data.result?.score || 'N/A'}`);
        await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
        await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      } else {
        setGenStatus('error');
        setGenError(data.message || data.error || 'Unknown error');
        toast.error(data.message || data.error || 'Generation failed', { duration: 8000 });
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenStatus('error');
      const apiError = error.response?.data?.error || error.message || 'Failed to generate schedule';
      const details = error.response?.data?.details || '';
      const fullError = details ? `${apiError}\n\nDetails: ${details}` : apiError;
      setGenError(fullError);
      toast.error(apiError, { duration: 10000 });
    }
  };

  // Auto-select latest version
  React.useEffect(() => {
    if (scheduleVersions.length > 0 && !selectedVersion) {
      const published = scheduleVersions.find(v => v.status === 'published');
      const latest = published || scheduleVersions[0];
      setSelectedVersion(latest);
    }
  }, [scheduleVersions, selectedVersion]);

  // Calculate stats
  const stats = React.useMemo(() => {
    if (!selectedVersion || scheduleSlots.length === 0) {
      return { studentsScheduled: 0, teachersAssigned: 0, totalSlots: 0, coverage: 0 };
    }

    const scheduledStudents = new Set();
    const scheduledTeachers = new Set();

    scheduleSlots.forEach(slot => {
      if (slot.teacher_id) scheduledTeachers.add(slot.teacher_id);
      const tg = teachingGroups.find(g => g.id === slot.teaching_group_id);
      tg?.student_ids?.forEach(sid => scheduledStudents.add(sid));
    });

    const coverage = students.length > 0 ? Math.round((scheduledStudents.size / students.length) * 100) : 0;

    return {
      studentsScheduled: scheduledStudents.size,
      teachersAssigned: scheduledTeachers.size,
      totalSlots: scheduleSlots.length,
      coverage
    };
  }, [selectedVersion, scheduleSlots, students, teachingGroups]);

  // Student schedule view
  const getStudentSchedule = (studentId) => {
    const studentSlots = scheduleSlots.filter(slot => {
      const tg = teachingGroups.find(g => g.id === slot.teaching_group_id);
      return tg?.student_ids?.includes(studentId);
    });

    const days = school?.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const periodsPerDay = 10; // Default

    const schedule = {};
    days.forEach(day => {
      schedule[day] = Array(periodsPerDay).fill(null);
    });

    studentSlots.forEach(slot => {
      const dayKey = slot.day.toUpperCase();
      if (schedule[dayKey] && slot.period >= 1 && slot.period <= periodsPerDay) {
        const tg = teachingGroups.find(g => g.id === slot.teaching_group_id);
        const subject = subjects.find(s => s.id === tg?.subject_id);
        const teacher = teachers.find(t => t.id === slot.teacher_id);
        const room = rooms.find(r => r.id === slot.room_id);

        schedule[dayKey][slot.period - 1] = {
          subject: subject?.name || subject?.code || 'Unknown',
          teacher: teacher?.full_name || 'TBD',
          room: room?.name || 'TBD',
          level: tg?.level || ''
        };
      }
    });

    return schedule;
  };

  const filteredStudents = students.filter(s => 
    s.is_active && 
    (s.full_name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
     s.email?.toLowerCase().includes(searchStudent.toLowerCase()))
  );

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentSchedule = selectedStudentId ? getStudentSchedule(selectedStudentId) : null;

  const publishedVersion = scheduleVersions.find(v => v.status === 'published');
  const draftVersions = scheduleVersions.filter(v => v.status === 'draft');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 shadow-2xl">
          <div className="absolute inset-0 bg-grid-white/5"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Schedule Management</h1>
              <p className="text-blue-100 text-lg">AI-powered timetable generation and optimization</p>
            </div>
            <Button 
              onClick={() => setIsDialogOpen(true)} 
              className="bg-white text-blue-900 hover:bg-blue-50 shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Version
            </Button>
          </div>
        </div>

        {/* Version Selector Card */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-all bg-white/90 backdrop-blur">
          <CardContent className="p-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1 space-y-3">
                <Label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Active Schedule Version</Label>
                <Select value={selectedVersion?.id || ''} onValueChange={(id) => setSelectedVersion(scheduleVersions.find(v => v.id === id))}>
                  <SelectTrigger className="h-12 text-base border-2 hover:border-blue-300 transition-colors">
                    <SelectValue placeholder="Select a schedule version" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleVersions.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No versions yet. Create one to start.</div>
                    ) : (
                      <>
                        {publishedVersion && (
                          <SelectItem value={publishedVersion.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="w-5 h-5 text-emerald-600" />
                              <div>
                                <div className="font-semibold">{publishedVersion.name}</div>
                                <div className="text-xs text-slate-500">{publishedVersion.academic_year}</div>
                              </div>
                              <Badge className="ml-auto bg-emerald-500 text-white">Live</Badge>
                            </div>
                          </SelectItem>
                        )}
                        {draftVersions.map(version => (
                          <SelectItem key={version.id} value={version.id} className="py-3">
                            <div className="flex items-center gap-3">
                              <Clock className="w-5 h-5 text-amber-500" />
                              <div>
                                <div className="font-medium">{version.name}</div>
                                <div className="text-xs text-slate-500">{version.academic_year}</div>
                              </div>
                              <Badge variant="outline" className="ml-auto">Draft</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedVersion && (
                <Button
                  onClick={handleGenerateSchedule}
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Schedule
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Analytics Dashboard */}
      {selectedVersion && scheduleSlots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">{stats.coverage}%</div>
                  <div className="text-sm text-blue-100">Coverage</div>
                </div>
              </div>
              <div className="text-white">
                <div className="text-2xl font-bold mb-1">{stats.studentsScheduled}</div>
                <div className="text-sm text-blue-100">of {students.length} students scheduled</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-white">{Math.round((stats.teachersAssigned/teachers.length)*100)}%</div>
                  <div className="text-sm text-emerald-100">Active</div>
                </div>
              </div>
              <div className="text-white">
                <div className="text-2xl font-bold mb-1">{stats.teachersAssigned}</div>
                <div className="text-sm text-emerald-100">of {teachers.length} teachers assigned</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-white">
                <div className="text-3xl font-bold mb-1">{stats.totalSlots}</div>
                <div className="text-sm text-amber-100">Total periods scheduled</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-600 opacity-90 group-hover:opacity-100 transition-opacity"></div>
            <CardContent className="relative p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="text-white">
                <div className="text-3xl font-bold mb-1">
                  {new Set(scheduleSlots.map(s => s.room_id).filter(Boolean)).size}
                </div>
                <div className="text-sm text-purple-100">Rooms in use</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {selectedVersion ? (
        scheduleSlots.length === 0 ? (
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5"></div>
            <CardContent className="relative py-24 text-center">
              <div className="inline-flex p-8 rounded-3xl bg-gradient-to-br from-blue-100 via-indigo-100 to-purple-100 mb-6 animate-pulse">
                <Sparkles className="w-20 h-20 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Ready to Generate</h3>
              <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
                Use AI-powered OptaPlanner to automatically create optimized timetables for your school
              </p>
              <Button
                onClick={handleGenerateSchedule}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate Schedule Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-white/80 backdrop-blur border-0 shadow-md p-1.5 rounded-xl">
              <TabsTrigger 
                value="overview" 
                className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all px-6"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Admin Overview
              </TabsTrigger>
              <TabsTrigger 
                value="student" 
                className="rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all px-6"
              >
                <Users className="w-4 h-4 mr-2" />
                Student Viewer
              </TabsTrigger>
            </TabsList>

            {/* Admin Overview Tab */}
            <TabsContent value="overview" className="space-y-6 mt-6">
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-blue-600">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    Active Teaching Groups
                  </CardTitle>
                  <CardDescription className="text-base">Complete overview of scheduled classes</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-4">
                    {teachingGroups
                      .filter(g => g.is_active)
                      .map(group => {
                        const groupSlots = scheduleSlots.filter(s => s.teaching_group_id === group.id);
                        const subject = subjects.find(s => s.id === group.subject_id);
                        const teacher = teachers.find(t => t.id === group.teacher_id);
                        const room = rooms.find(r => r.id === groupSlots[0]?.room_id);

                        return (
                          <div 
                            key={group.id} 
                            className="group p-6 rounded-xl border-2 border-slate-100 hover:border-blue-300 hover:shadow-lg transition-all bg-white"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-lg font-bold text-slate-900 mb-3 group-hover:text-blue-900 transition-colors">
                                  {group.name}
                                </h4>
                                <div className="flex flex-wrap gap-4 text-sm">
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700">
                                    <BookOpen className="w-4 h-4" />
                                    <span className="font-medium">{subject?.code || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                                    <Users className="w-4 h-4" />
                                    <span className="font-medium">{teacher?.full_name || 'Unassigned'}</span>
                                  </div>
                                  {room && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700">
                                      <Building2 className="w-4 h-4" />
                                      <span className="font-medium">{room.name}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <Badge className={`px-4 py-2 text-sm font-semibold ${
                                  groupSlots.length > 0 
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white' 
                                    : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white'
                                }`}>
                                  {groupSlots.length} periods
                                </Badge>
                                <div className="text-sm text-slate-500 font-medium">
                                  {group.student_ids?.length || 0} students
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Student Viewer Tab */}
            <TabsContent value="student" className="space-y-6 mt-6">
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-lg bg-indigo-600">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    Student Timetable Viewer
                  </CardTitle>
                  <CardDescription className="text-base">View personalized schedules for each student</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Student Search & Select */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Find Student</Label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <Input
                          placeholder="Search by name or email..."
                          value={searchStudent}
                          onChange={(e) => setSearchStudent(e.target.value)}
                          className="pl-12 h-12 text-base border-2 hover:border-blue-300 transition-colors"
                        />
                      </div>
                      <Select value={selectedStudentId || ''} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="sm:w-[320px] h-12 text-base border-2 hover:border-blue-300 transition-colors">
                          <SelectValue placeholder="Choose student" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStudents.map(student => (
                            <SelectItem key={student.id} value={student.id} className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                  {student.full_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium">{student.full_name}</div>
                                  <div className="text-xs text-slate-500">{student.year_group}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Student Schedule Display */}
                  {selectedStudent && studentSchedule && (
                    <div className="space-y-6">
                      {/* Student Info Card */}
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-6 shadow-xl">
                        <div className="absolute inset-0 bg-grid-white/10"></div>
                        <div className="relative flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                            {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-2xl font-bold text-white mb-1">{selectedStudent.full_name}</h3>
                            <div className="flex items-center gap-3 text-blue-100">
                              <span className="font-medium">{selectedStudent.year_group}</span>
                              <span>•</span>
                              <span>{selectedStudent.email}</span>
                            </div>
                          </div>
                          <div className="px-4 py-2 rounded-xl bg-white/20 backdrop-blur border border-white/30">
                            <div className="text-xs text-blue-100">Programme</div>
                            <div className="text-lg font-bold text-white">{selectedStudent.ib_programme || 'IB'}</div>
                          </div>
                        </div>
                      </div>

                      {/* Timetable Grid */}
                      <div className="overflow-x-auto rounded-xl border-2 border-slate-200 shadow-lg">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-slate-100 to-slate-50">
                              <th className="sticky left-0 z-10 p-4 text-left text-sm font-bold text-slate-800 bg-slate-100 border-b-2 border-slate-300">
                                Period
                              </th>
                              {Object.keys(studentSchedule).map(day => (
                                <th key={day} className="p-4 text-center text-sm font-bold text-slate-800 border-b-2 border-slate-300 min-w-[160px]">
                                  {day.charAt(0) + day.slice(1).toLowerCase()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(period => (
                              <tr key={period} className="hover:bg-slate-50/50 transition-colors">
                                <td className="sticky left-0 z-10 p-4 text-sm font-bold text-slate-700 bg-slate-50 border-b border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                      {period}
                                    </div>
                                  </div>
                                </td>
                                {Object.entries(studentSchedule).map(([day, periods]) => {
                                  const slot = periods[period - 1];
                                  return (
                                    <td key={day} className="p-2 border-b border-slate-200">
                                      {slot ? (
                                        <div className="group p-4 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 text-white shadow-md hover:shadow-xl transition-all cursor-pointer">
                                          <div className="font-bold text-sm mb-2">{slot.subject}</div>
                                          <div className="space-y-1.5 text-xs">
                                            <div className="flex items-center gap-1.5 opacity-90">
                                              <Users className="w-3.5 h-3.5" />
                                              <span>{slot.teacher}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-90">
                                              <Building2 className="w-3.5 h-3.5" />
                                              <span>{slot.room}</span>
                                            </div>
                                          </div>
                                          {slot.level && (
                                            <Badge className="mt-2 bg-white/25 hover:bg-white/35 text-white text-[10px] px-2 py-0.5 border-0">
                                              {slot.level}
                                            </Badge>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="h-28 flex items-center justify-center">
                                          <div className="text-2xl text-slate-200">·</div>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!selectedStudent && (
                    <div className="text-center py-20">
                      <div className="inline-flex p-6 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 mb-6">
                        <Users className="w-16 h-16 text-slate-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">No Student Selected</h3>
                      <p className="text-slate-500">Choose a student from the dropdown to view their personalized timetable</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )
      ) : (
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur">
          <CardContent className="py-24 text-center">
            <div className="inline-flex p-8 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 mb-6">
              <Calendar className="w-20 h-20 text-blue-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-3">No Active Schedule</h3>
            <p className="text-lg text-slate-500 mb-8 max-w-md mx-auto">
              Create your first schedule version to start organizing your timetable
            </p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create First Version
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Version Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Schedule Version</DialogTitle>
            <DialogDescription>
              Create a new draft version to start generating timetables
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Version Name</Label>
              <Input
                id="name"
                placeholder="e.g., Fall 2024 Draft v1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="academic_year">Academic Year</Label>
                <Select
                  value={formData.academic_year}
                  onValueChange={(value) => setFormData({ ...formData, academic_year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                    <SelectItem value="2026-2027">2026-2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term</Label>
                <Select
                  value={formData.term}
                  onValueChange={(value) => setFormData({ ...formData, term: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Full Year">Full Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createVersionMutation.mutate(formData)}
              disabled={!formData.name || createVersionMutation.isPending}
              className="bg-blue-900 hover:bg-blue-800"
            >
              {createVersionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Version'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generation Dialog */}
      <ScheduleGenerationDialog
        open={genDialogOpen}
        onClose={() => setGenDialogOpen(false)}
        status={genStatus}
        message={genMessage}
        error={genError}
      />
      </div>
    </div>
  );
}