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
          <Card className="border-blue-200">
            <CardContent className="py-20 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Generated</h3>
              <p className="text-slate-500 mb-6">Click "Generate Schedule" to create timetables with OptaPlanner</p>
              <Button
                onClick={handleGenerateSchedule}
                className="bg-blue-900 hover:bg-blue-800"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Schedule Now
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-white border border-blue-200">
              <TabsTrigger value="overview" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
                <Calendar className="w-4 h-4 mr-2" />
                Admin Overview
              </TabsTrigger>
              <TabsTrigger value="student" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                Student Viewer
              </TabsTrigger>
            </TabsList>

            {/* Admin Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-900" />
                    All Active Classes
                  </CardTitle>
                  <CardDescription>Overview of all scheduled teaching groups</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-3">
                    {teachingGroups
                      .filter(g => g.is_active)
                      .map(group => {
                        const groupSlots = scheduleSlots.filter(s => s.teaching_group_id === group.id);
                        const subject = subjects.find(s => s.id === group.subject_id);
                        const teacher = teachers.find(t => t.id === group.teacher_id);
                        const room = rooms.find(r => r.id === groupSlots[0]?.room_id);

                        return (
                          <div key={group.id} className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 transition-all">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-900 mb-1">{group.name}</h4>
                                <div className="flex flex-wrap gap-2 text-sm text-slate-600">
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-4 h-4" />
                                    {subject?.code || 'N/A'}
                                  </span>
                                  <span>•</span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {teacher?.full_name || 'Unassigned'}
                                  </span>
                                  {room && (
                                    <>
                                      <span>•</span>
                                      <span className="flex items-center gap-1">
                                        <Building2 className="w-4 h-4" />
                                        {room.name}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge className={`${
                                  groupSlots.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {groupSlots.length} periods
                                </Badge>
                                <p className="text-xs text-slate-500 mt-1">
                                  {group.student_ids?.length || 0} students
                                </p>
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
            <TabsContent value="student" className="space-y-6">
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-900" />
                    Student Timetable Viewer
                  </CardTitle>
                  <CardDescription>View individual student schedules</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Student Search & Select */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Select Student</Label>
                    <div className="flex gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Search by name or email..."
                          value={searchStudent}
                          onChange={(e) => setSearchStudent(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={selectedStudentId || ''} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="w-[300px]">
                          <SelectValue placeholder="Choose student" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStudents.map(student => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.full_name} ({student.year_group})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Student Schedule Display */}
                  {selectedStudent && studentSchedule && (
                    <div className="space-y-4">
                      {/* Student Info Banner */}
                      <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center text-white font-bold text-xl">
                            {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900">{selectedStudent.full_name}</h3>
                            <p className="text-sm text-slate-600">{selectedStudent.year_group} • {selectedStudent.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Timetable Grid */}
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="p-3 text-left text-sm font-semibold text-slate-700 border border-slate-200">Period</th>
                              {Object.keys(studentSchedule).map(day => (
                                <th key={day} className="p-3 text-center text-sm font-semibold text-slate-700 border border-slate-200">
                                  {day.charAt(0) + day.slice(1).toLowerCase()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(period => (
                              <tr key={period} className="hover:bg-slate-50">
                                <td className="p-3 text-sm font-medium text-slate-600 border border-slate-200 bg-slate-50">
                                  P{period}
                                </td>
                                {Object.entries(studentSchedule).map(([day, periods]) => {
                                  const slot = periods[period - 1];
                                  return (
                                    <td key={day} className="p-2 border border-slate-200">
                                      {slot ? (
                                        <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs">
                                          <div className="font-bold mb-1">{slot.subject}</div>
                                          <div className="opacity-90 flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {slot.teacher}
                                          </div>
                                          <div className="opacity-90 flex items-center gap-1">
                                            <Building2 className="w-3 h-3" />
                                            {slot.room}
                                          </div>
                                          {slot.level && (
                                            <Badge className="mt-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5">
                                              {slot.level}
                                            </Badge>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="h-full flex items-center justify-center text-slate-300">-</div>
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
                    <div className="text-center py-12 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p className="font-medium">Select a student to view their timetable</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )
      ) : (
        <Card className="border-blue-200">
          <CardContent className="py-20 text-center">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Version Selected</h3>
            <p className="text-slate-500 mb-6">Create a new version to get started</p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-blue-900 hover:bg-blue-800"
            >
              <Plus className="w-4 h-4 mr-2" />
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
  );
}