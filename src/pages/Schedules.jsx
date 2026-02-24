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
        setGenMessage(`✅ ${inserted} slots created successfully! Score: ${data.result?.score || 'N/A'}`);
        await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
        await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      } else {
        console.error('Generation failed:', data);
        setGenStatus('error');

        let errorMsg = data.error || 'Generation failed';

        if (data.details) {
          console.log('OptaPlanner details:', data.details);

          // Check for validation errors array
          if (data.details.validationErrors && Array.isArray(data.details.validationErrors)) {
            const validationErrors = data.details.validationErrors;
            console.log('Validation errors:', validationErrors);
            errorMsg = `Validation failed:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more errors` : ''}`;
          } else if (typeof data.details === 'object' && data.details.message) {
            errorMsg = data.details.message;
          } else if (typeof data.details === 'string') {
            try {
              const parsed = JSON.parse(data.details);
              if (parsed.validationErrors && Array.isArray(parsed.validationErrors)) {
                const validationErrors = parsed.validationErrors;
                errorMsg = `Validation failed:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more errors` : ''}`;
              } else if (parsed.message) {
                errorMsg = parsed.message;
              }
            } catch (e) {
              // Keep original error
            }
          }
        }

        setGenError(errorMsg);
        toast.error(errorMsg, { duration: 10000 });
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenStatus('error');
      
      const responseData = error.response?.data;
      let errorMsg = error.message || 'Failed to generate schedule';
      
      if (responseData) {
        console.log('Error response:', responseData);
        errorMsg = responseData.error || errorMsg;
        
        if (responseData.details) {
          console.log('Error details:', responseData.details);
          if (typeof responseData.details === 'string') {
            try {
              const parsed = JSON.parse(responseData.details);
              if (parsed.message) errorMsg = parsed.message;
            } catch (e) {
              // Keep original error
            }
          } else if (responseData.details.message) {
            errorMsg = responseData.details.message;
          }
        }
      }
      
      setGenError(errorMsg);
      toast.error(errorMsg, { duration: 10000 });
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
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedules</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and generate timetables</p>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)} 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Version
          </Button>
        </div>

        {/* Version Selector & Generate */}
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs font-medium text-slate-600 mb-2 block">Active Version</Label>
                <Select value={selectedVersion?.id || ''} onValueChange={(id) => setSelectedVersion(scheduleVersions.find(v => v.id === id))}>
                  <SelectTrigger className="h-10 border-slate-200">
                    <SelectValue placeholder="Select version" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleVersions.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500">No versions yet</div>
                    ) : (
                      <>
                        {publishedVersion && (
                          <SelectItem value={publishedVersion.id}>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span className="font-medium">{publishedVersion.name}</span>
                              <Badge className="ml-2 bg-emerald-500 text-white text-xs">Live</Badge>
                            </div>
                          </SelectItem>
                        )}
                        {draftVersions.map(version => (
                          <SelectItem key={version.id} value={version.id}>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span>{version.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">Draft</Badge>
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
                  className="bg-blue-600 hover:bg-blue-700 lg:mt-5"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Schedule
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

      {/* Stats */}
      {selectedVersion && scheduleSlots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Students</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.studentsScheduled}/{students.length}</p>
                  <p className="text-xs text-emerald-600 font-medium mt-1">{stats.coverage}% coverage</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Teachers</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.teachersAssigned}/{teachers.length}</p>
                  <p className="text-xs text-slate-600 font-medium mt-1">{Math.round((stats.teachersAssigned/teachers.length)*100)}% active</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Total Periods</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalSlots}</p>
                  <p className="text-xs text-slate-600 font-medium mt-1">Scheduled</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">Rooms Used</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {new Set(scheduleSlots.map(s => s.room_id).filter(Boolean)).size}
                  </p>
                  <p className="text-xs text-slate-600 font-medium mt-1">Active spaces</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      {selectedVersion ? (
        scheduleSlots.length === 0 ? (
          <Card className="border border-slate-200">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to Generate</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
                Click Generate Schedule to create an optimized timetable
              </p>
              <Button
                onClick={handleGenerateSchedule}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Schedule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-white border border-slate-200 p-1">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="student" 
                className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
              >
                <Users className="w-4 h-4 mr-2" />
                Student View
              </TabsTrigger>
            </TabsList>

            {/* Admin Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card className="border border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base font-semibold">Teaching Groups</CardTitle>
                  <CardDescription>Overview of scheduled classes</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
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
                            className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                                  {group.name}
                                </h4>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">
                                    {subject?.code || 'N/A'}
                                  </span>
                                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                                    {teacher?.full_name || 'Unassigned'}
                                  </span>
                                  {room && (
                                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                                      {room.name}
                                    </span>
                                  )}
                                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-600">
                                    {group.student_ids?.length || 0} students
                                  </span>
                                </div>
                              </div>
                              <Badge className={groupSlots.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}>
                                {groupSlots.length} periods
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Student Viewer Tab */}
            <TabsContent value="student" className="space-y-4 mt-4">
              <Card className="border border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base font-semibold">Student Timetable</CardTitle>
                  <CardDescription>View individual student schedules</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Student Search & Select */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Select Student</Label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Search by name..."
                          value={searchStudent}
                          onChange={(e) => setSearchStudent(e.target.value)}
                          className="pl-9 h-10 border-slate-200"
                        />
                      </div>
                      <Select value={selectedStudentId || ''} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="sm:w-[280px] h-10 border-slate-200">
                          <SelectValue placeholder="Choose student" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStudents.map(student => (
                            <SelectItem key={student.id} value={student.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-semibold">
                                  {student.full_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <span className="text-sm">{student.full_name}</span>
                                <span className="text-xs text-slate-500">({student.year_group})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Student Schedule Display */}
                  {selectedStudent && studentSchedule && (
                    <div className="space-y-4">
                      {/* Student Info Card */}
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                            {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'S'}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-900">{selectedStudent.full_name}</h3>
                            <p className="text-xs text-slate-500">{selectedStudent.year_group} • {selectedStudent.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{selectedStudent.ib_programme || 'IB'}</Badge>
                        </div>
                      </div>

                      {/* Timetable Grid */}
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-50">
                              <th className="sticky left-0 z-10 p-3 text-left text-xs font-semibold text-slate-700 bg-slate-50 border-b border-slate-200">
                                Period
                              </th>
                              {Object.keys(studentSchedule).map(day => (
                                <th key={day} className="p-3 text-center text-xs font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                                  {day.charAt(0) + day.slice(1).toLowerCase()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: 10 }, (_, i) => i + 1).map(period => (
                              <tr key={period} className="hover:bg-slate-50 transition-colors">
                                <td className="sticky left-0 z-10 p-3 text-xs font-semibold text-slate-600 bg-white border-b border-slate-100">
                                  {period}
                                </td>
                                {Object.entries(studentSchedule).map(([day, periods]) => {
                                  const slot = periods[period - 1];
                                  return (
                                    <td key={day} className="p-2 border-b border-slate-100">
                                      {slot ? (
                                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 hover:border-blue-200 transition-colors">
                                          <div className="font-semibold text-xs text-slate-900 mb-1">{slot.subject}</div>
                                          <div className="space-y-0.5 text-xs text-slate-600">
                                            <div className="flex items-center gap-1">
                                              <Users className="w-3 h-3" />
                                              <span>{slot.teacher}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Building2 className="w-3 h-3" />
                                              <span>{slot.room}</span>
                                            </div>
                                          </div>
                                          {slot.level && (
                                            <Badge className="mt-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0.5">
                                              {slot.level}
                                            </Badge>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="h-20 flex items-center justify-center">
                                          <span className="text-slate-300">—</span>
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
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500">Select a student to view their timetable</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )
      ) : (
        <Card className="border border-slate-200">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">No Schedule Version</h3>
            <p className="text-sm text-slate-500 mb-6">
              Create a schedule version to get started
            </p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Version
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