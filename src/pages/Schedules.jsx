import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';
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
import { Switch } from "@/components/ui/switch";
import { toast } from 'sonner';
import {
  Plus,
  Calendar,
  Sparkles,
  Loader2,
  CheckCircle,
  Clock,
  Users,
  Building2,
  Search,
  Trash2,
  Settings2,
  Play,
  BookPlus
} from 'lucide-react';
import TimetableGrid from '../components/schedule/TimetableGrid';
import ExportTimetableButton from '../components/schedule/ExportTimetableButton';
import SearchableEntitySelect from '../components/schedule/SearchableEntitySelect';
import StudentScheduleView from '../components/schedule/StudentScheduleView';

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [genStatus, setGenStatus] = useState('idle'); // idle | generating | success | error
  const [genMessage, setGenMessage] = useState('');
  const [genError, setGenError] = useState('');
  const [isPayloadDialogOpen, setIsPayloadDialogOpen] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState(null);
  const [isPayloadLoading, setIsPayloadLoading] = useState(false);
  const [isAddLessonDialogOpen, setIsAddLessonDialogOpen] = useState(false);
  const [manualLessonForm, setManualLessonForm] = useState({
    subject_id: '',
    teacher_id: 'unassigned',
    room_id: 'unassigned',
    classgroup_id: 'none',
    teaching_group_id: 'none',
    day: 'Monday',
    period: '1',
    notes: '',
  });
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [searchTeacher, setSearchTeacher] = useState('');
  const [overviewFilterType, setOverviewFilterType] = useState('all');
  const [isFixingSubjects, setIsFixingSubjects] = useState(false);
  const [overviewFilterId, setOverviewFilterId] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
  });
  
  const [constraints, setConstraints] = useState({
    maxSameSubjectPerDayHardEnabled: false,
    maxSameSubjectPerDayLimit: 4,
    exactWeeklyCountEnabled: false,
    allowFlexibleWeeklyCounts: true,
    relaxStudentGroupConflicts: true,
    aiPreferences: ""
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

  const canCreateVersion = () => {
    if (!school) return false;
    const tierLimits = {
      tier1: 3,
      tier2: Infinity,
      tier3: Infinity,
    };
    const maxVersions = tierLimits[school.subscription_tier] ?? 3;
    return scheduleVersions.length < maxVersions;
  };

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ['scheduleSlots', selectedVersion?.id],
    queryFn: async () => {
      if (!selectedVersion) return [];
      return await base44.entities.ScheduleSlot.filter({ schedule_version: selectedVersion.id }, '-created_date', 500);
    },
    enabled: !!selectedVersion,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }, '-created_date', 500),
    enabled: !!schoolId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }, '-created_date', 500),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }, '-created_date', 500),
    enabled: !!schoolId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }, '-created_date', 500),
    enabled: !!schoolId,
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }, '-created_date', 1000),
    enabled: !!schoolId,
  });

  const { data: classGroups = [] } = useQuery({
    queryKey: ['classGroups', schoolId],
    queryFn: () => base44.entities.ClassGroup.filter({ school_id: schoolId }, '-created_date', 500),
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

  const updateSlotMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await base44.functions.invoke('updateScheduleSlotValidated', {
        slot_id: id,
        updates: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      toast.success("Lesson updated successfully");
    },
    onError: (err) => {
      toast.error("Failed to update lesson: " + err.message);
    }
  });

  const createManualLessonMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('createManualScheduleSlot', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      setIsAddLessonDialogOpen(false);
      setManualLessonForm({
        subject_id: '',
        teacher_id: 'unassigned',
        room_id: 'unassigned',
        classgroup_id: 'none',
        teaching_group_id: 'none',
        day: 'Monday',
        period: '1',
        notes: '',
      });
      toast.success('Lesson added to timetable');
    },
    onError: (err) => {
      toast.error('Failed to add lesson: ' + err.message);
    }
  });

  const deleteVersionMutation = useMutation({
    mutationFn: async (versionId) => {
      return base44.entities.ScheduleVersion.delete(versionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      setSelectedVersion(null);
      setIsDeleteDialogOpen(false);
      toast.success("Schedule version deleted successfully");
    },
    onError: (err) => {
      toast.error("Failed to delete version: " + err.message);
    }
  });

  const handlePreviewPayload = async () => {
    if (!selectedVersion || !schoolId) return;

    setIsPayloadLoading(true);
    try {
      const response = await base44.functions.invoke('previewOptaPayload', {
        school_id: schoolId,
        schedule_version_id: selectedVersion.id,
        sample_limit: 50,
      });
      setPayloadPreview(response.data || null);
      setIsPayloadDialogOpen(true);
    } catch (error) {
      toast.error(error?.message || 'Failed to load payload preview');
    } finally {
      setIsPayloadLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!selectedVersion) return;

    setGenStatus('generating');
    setGenMessage('');
    setGenError('');

    try {
      const response = await base44.functions.invoke('generateSchedule', {
        schedule_version_id: selectedVersion.id,
      });

      const data = response?.data ?? response;

      if (data?.ok === true && data?.slotsInserted > 0) {
        const programmes = data.programmes?.map(p => `${p.programme}: ${p.slots} slots`).join(', ') || '';
        setGenMessage(`${data.slotsInserted} slots created. ${programmes}`);
        setGenStatus('success');
        
        // Refetch scheduleVersions from the database to get persisted generation_params
        const updatedVersions = await base44.entities.ScheduleVersion.filter({ school_id: schoolId }, '-created_date');
        queryClient.setQueryData(['scheduleVersions', schoolId], updatedVersions);
        
        // Update selectedVersion to the refetched one
        const refreshedVersion = updatedVersions.find(v => v.id === selectedVersion.id);
        if (refreshedVersion) {
          setSelectedVersion(refreshedVersion);
        }
        
        if (data.failed?.length > 0) {
          toast.warning(`Some programmes failed: ${data.failed.map(f => `${f.programme} (${f.error})`).join(', ')}`);
        } else {
          toast.success(`Schedule generated: ${data.slotsInserted} slots`);
        }
        
        // Refresh slots
        queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      } else {
        setGenStatus('error');
        const primaryFailure = data?.failed?.[0];
        const constraintBlocker = primaryFailure?.blocker ? ` | blocker=${primaryFailure.blocker}` : '';
        const failDetails = data?.failed?.map(f => `${f.programme}: ${f.error}`).join(' | ') || '';
        const errorMsg = data?.error || primaryFailure?.error || (primaryFailure ? `${primaryFailure.reason_code || 'SOLUTION_INFEASIBLE'}${constraintBlocker}` : failDetails) || 'Generation returned 0 slots.';
        setGenError(errorMsg);
        toast.error('Schedule generation failed', { duration: 10000 });
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenStatus('error');
      const errorMsg = error?.response?.data?.error || error?.message || 'Failed to reach the generation service';
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

  const normalizeSearch = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Student schedule view
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

  const filteredStudents = students.filter(s => {
    const query = normalizeSearch(searchStudent);
    return s.is_active && (
      normalizeSearch(s.full_name).includes(query) ||
      normalizeSearch(s.email).includes(query)
    );
  });


  const getTeacherSchedule = (teacherId) => {
    return scheduleSlots.filter(slot => slot.teacher_id === teacherId);
  };

  const filteredTeachers = teachers.filter(t => {
    const query = normalizeSearch(searchTeacher);
    return t.is_active && (
      normalizeSearch(t.full_name).includes(query) ||
      normalizeSearch(t.email).includes(query)
    );
  });

  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  const teacherSchedule = selectedTeacherId ? getTeacherSchedule(selectedTeacherId) : null;

  const filteredOverviewSlots = React.useMemo(() => {
    if (overviewFilterType === 'all' || overviewFilterId === 'all') return scheduleSlots;
    if (overviewFilterType === 'teacher') return scheduleSlots.filter(s => s.teacher_id === overviewFilterId);
    if (overviewFilterType === 'room') return scheduleSlots.filter(s => s.room_id === overviewFilterId);
    if (overviewFilterType === 'teachingGroup') return scheduleSlots.filter(s => s.teaching_group_id === overviewFilterId);
    return scheduleSlots;
  }, [scheduleSlots, overviewFilterType, overviewFilterId]);

  const publishedVersion = scheduleVersions.find(v => v.status === 'published');
  const draftVersions = scheduleVersions.filter(v => v.status === 'draft');
  const availableTimeslots = typeof selectedVersion?.generation_params === 'string'
    ? JSON.parse(selectedVersion.generation_params)?.solverTimeslots || []
    : selectedVersion?.generation_params?.solverTimeslots || [];
  const classGroupsFromStudents = React.useMemo(() => {
    const map = new Map();
    students.forEach((student) => {
      if (!student.classgroup_id) return;
      if (!map.has(student.classgroup_id)) {
        map.set(student.classgroup_id, {
          id: student.classgroup_id,
          name: student.classgroup_id,
          student_ids: [],
        });
      }
      map.get(student.classgroup_id).student_ids.push(student.id);
    });
    return Array.from(map.values());
  }, [students]);
  const allClassGroups = React.useMemo(() => {
    const merged = new Map();
    classGroups.forEach((group) => merged.set(group.id, { ...group, student_ids: group.student_ids || [] }));
    classGroupsFromStudents.forEach((group) => {
      if (!merged.has(group.id)) merged.set(group.id, group);
    });
    return Array.from(merged.values());
  }, [classGroups, classGroupsFromStudents]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-6 space-y-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedules</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and generate timetables</p>
          </div>
          <div className="flex items-center gap-2">
            {subjects.length > 0 && subjects.some(s => !s.school_id) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  const res = await base44.functions.invoke('fixSubjectSchoolIds', {});
                  alert(`Fixed ${res.data?.fixed} subjects`);
                  window.location.reload();
                }}
                className="gap-2 border-amber-200 hover:bg-amber-50"
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="text-amber-700">Fix Subject Permissions</span>
              </Button>
            )}
            <Button 
              onClick={() => {
              if (canCreateVersion()) {
                setIsDialogOpen(true);
              } else {
                alert(`Limit reached. ${school?.subscription_tier === 'tier1' ? 'Starter allows up to 3 saved schedule versions.' : 'Your current tier limit has been reached.'} Upgrade for more.`);
              }
            }} 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Version
            </Button>
            </div>
            </div>

        {/* Version Selector */}
        <Card className="border-0 shadow-lg bg-white rounded-xl">
          <CardContent className="p-6">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium text-slate-600">Active Version</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
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
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    title="Delete version"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

      {/* Stats */}
      {selectedVersion && scheduleSlots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-lg bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Students</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats.studentsScheduled}<span className="text-lg text-slate-400 font-medium">/{students.length}</span></p>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-0 mt-2">{stats.coverage}% coverage</Badge>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-md">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Teachers</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats.teachersAssigned}<span className="text-lg text-slate-400 font-medium">/{teachers.length}</span></p>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-0 mt-2">{Math.round((stats.teachersAssigned/teachers.length)*100)}% active</Badge>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Total Periods</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">{stats.totalSlots}</p>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-0 mt-2">Scheduled</Badge>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg bg-white rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Rooms Used</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1">
                    {new Set(scheduleSlots.map(s => s.room_id).filter(Boolean)).size}
                  </p>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-0 mt-2">Active spaces</Badge>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Generation Loading Overlay */}
      {genStatus === 'generating' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-10 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Generating Timetable</h3>
              <p className="text-sm text-slate-500">OptaPlanner is optimizing your schedule. This may take a moment...</p>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-blue-500 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {selectedVersion ? (
        scheduleSlots.length === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border border-slate-200 shadow-sm h-full flex flex-col justify-center items-center text-center p-12 bg-gradient-to-br from-blue-50/50 to-white">
              <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 shadow-sm">
                <Sparkles className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-3">Ready to Generate</h3>
              <p className="text-slate-500 max-w-sm mb-8">
                Configure your constraints and generate an optimized timetable using our AI engine.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviewPayload}
                  disabled={isPayloadLoading}
                  className="h-12 px-8 text-base"
                >
                  {isPayloadLoading ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Loading Payload...</>
                  ) : (
                    'Preview Payload'
                  )}
                </Button>
                <Button
                  onClick={handleGenerateSchedule}
                  disabled={genStatus === 'generating'}
                  className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-base shadow-md hover:shadow-lg transition-all"
                >
                  {genStatus === 'generating' ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                  ) : (
                    <><Play className="w-5 h-5 mr-2 fill-current" />Start Generation</>
                  )}
                </Button>
              </div>
              {genStatus === 'success' && genMessage && (
                <p className="text-sm text-emerald-600 mt-3 font-medium">{genMessage}</p>
              )}
              {genStatus === 'error' && genError && (
                <p className="text-sm text-red-500 mt-3">{genError}</p>
              )}
            </Card>
            
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-slate-500" />
                  Optimization Constraints
                </CardTitle>
                <CardDescription>Configure rules for the OptaPlanner engine</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Strict Daily Subject Limits</Label>
                    <p className="text-sm text-slate-500">Prevent students from having the same subject too many times per day</p>
                  </div>
                  <Switch 
                    checked={constraints.maxSameSubjectPerDayHardEnabled} 
                    onCheckedChange={(c) => setConstraints(prev => ({ ...prev, maxSameSubjectPerDayHardEnabled: c }))} 
                  />
                </div>
                
                {constraints.maxSameSubjectPerDayHardEnabled && (
                  <div className="pl-4 border-l-2 border-slate-100">
                    <Label className="text-sm text-slate-600 mb-2 block">Maximum periods per day for same subject</Label>
                    <Select 
                      value={constraints.maxSameSubjectPerDayLimit.toString()} 
                      onValueChange={(val) => setConstraints(prev => ({ ...prev, maxSameSubjectPerDayLimit: parseInt(val) }))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 Period</SelectItem>
                        <SelectItem value="2">2 Periods</SelectItem>
                        <SelectItem value="3">3 Periods</SelectItem>
                        <SelectItem value="4">4 Periods</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Flexible Weekly Hours</Label>
                    <p className="text-sm text-slate-500">Allow slight variations (+/- 1 period) from target weekly hours if needed</p>
                  </div>
                  <Switch 
                    checked={constraints.allowFlexibleWeeklyCounts} 
                    onCheckedChange={(c) => setConstraints(prev => ({ ...prev, allowFlexibleWeeklyCounts: c }))} 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Relax Student Conflicts</Label>
                    <p className="text-sm text-slate-500">Prioritize scheduling all lessons even if it causes minor student double-bookings</p>
                  </div>
                  <Switch 
                    checked={constraints.relaxStudentGroupConflicts} 
                    onCheckedChange={(c) => setConstraints(prev => ({ ...prev, relaxStudentGroupConflicts: c }))} 
                  />
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <Label className="text-base font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    AI Scheduling Preferences
                  </Label>
                  <p className="text-sm text-slate-500">
                    Describe any specific rules in plain English (e.g., "I don't want Danny Muller to have lessons on Friday afternoon").
                  </p>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Enter preferences here..."
                    value={constraints.aiPreferences || ''}
                    onChange={(e) => setConstraints(prev => ({ ...prev, aiPreferences: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 lg:grid-cols-4">
                <TabsTrigger 
                  value="overview" 
                  className="flex h-auto items-start justify-start rounded-xl border border-transparent px-4 py-3 text-left text-slate-600 transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900"
                >
                  <Calendar className="mt-0.5 mr-3 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-semibold">Overview</span>
                    <span className="block text-xs text-slate-500 data-[state=active]:text-blue-700">All classes</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="student" 
                  className="flex h-auto items-start justify-start rounded-xl border border-transparent px-4 py-3 text-left text-slate-600 transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900"
                >
                  <Users className="mt-0.5 mr-3 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-semibold">Student View</span>
                    <span className="block text-xs text-slate-500 data-[state=active]:text-blue-700">One student</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="teacher" 
                  className="flex h-auto items-start justify-start rounded-xl border border-transparent px-4 py-3 text-left text-slate-600 transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900"
                >
                  <Users className="mt-0.5 mr-3 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-semibold">Teacher View</span>
                    <span className="block text-xs text-slate-500 data-[state=active]:text-blue-700">One teacher</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger 
                  value="generation" 
                  className="flex h-auto items-start justify-start rounded-xl border border-transparent px-4 py-3 text-left text-slate-600 transition-all data-[state=active]:border-blue-200 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900"
                >
                  <Settings2 className="mt-0.5 mr-3 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block font-semibold">Generation</span>
                    <span className="block text-xs text-slate-500 data-[state=active]:text-blue-700">Rules & payload</span>
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Admin Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card className="border border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-semibold">School Timetable</CardTitle>
                      <CardDescription>Calendar view of generated lessons</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsAddLessonDialogOpen(true)}
                        disabled={!selectedVersion}
                        className="gap-2"
                      >
                        <BookPlus className="w-4 h-4" />
                        Add Lesson
                      </Button>
                      <Select value={overviewFilterType} onValueChange={(val) => { setOverviewFilterType(val); setOverviewFilterId('all'); }}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Filter by..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Lessons</SelectItem>
                          <SelectItem value="teacher">By Teacher</SelectItem>
                          <SelectItem value="room">By Room</SelectItem>
                          <SelectItem value="teachingGroup">By Group</SelectItem>
                        </SelectContent>
                      </Select>

                      {overviewFilterType !== 'all' && (
                        <Select value={overviewFilterId} onValueChange={setOverviewFilterId}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select specific..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Select {overviewFilterType}...</SelectItem>
                            {overviewFilterType === 'teacher' && teachers.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                            ))}
                            {overviewFilterType === 'room' && rooms.map(r => (
                              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                            ))}
                            {overviewFilterType === 'teachingGroup' && teachingGroups.filter(g => g.is_active).map(g => (
                              <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 p-0 sm:p-4">
                  <TimetableGrid 
                    slots={filteredOverviewSlots}
                    groups={teachingGroups}
                    rooms={rooms}
                    subjects={subjects}
                    teachers={teachers}
                    periodsPerDay={school?.periods_per_day || 10}
                    dayStartTime={school?.day_start_time || '08:00'}
                    dayEndTime={school?.day_end_time || '18:00'}
                    periodDurationMinutes={school?.period_duration_minutes || 60}
                    scheduleSettings={school}
                    globalView={overviewFilterType === 'all'}
                    timeslots={availableTimeslots}
                    onSlotClick={(day, uiRow, actionData) => {
                      if (actionData.action === 'move') {
                        if (confirm(`Are you sure you want to move this lesson to ${day}, Period ${uiRow}?`)) {
                          updateSlotMutation.mutate({
                            id: actionData.sourceSlotId,
                            data: { day, period: uiRow, timeslot_id: actionData.targetTimeslotId }
                          });
                        }
                      } else if (actionData.action === 'swap') {
                        if (confirm(`Are you sure you want to swap these lessons?`)) {
                          updateSlotMutation.mutate({
                            id: actionData.sourceSlotId,
                            data: { day: actionData.targetDay, period: actionData.targetPeriod, timeslot_id: actionData.targetTimeslotId }
                          });
                          updateSlotMutation.mutate({
                            id: actionData.targetSlotId,
                            data: { day: actionData.sourceDay, period: actionData.sourcePeriod, timeslot_id: actionData.sourceTimeslotId || null }
                          });
                        }
                      }
                    }}
                    onUpdateSlot={(slotId, updates) => {
                      updateSlotMutation.mutate({ id: slotId, data: updates });
                    }}
                  />
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
                  <StudentScheduleView
                    students={filteredStudents}
                    slots={scheduleSlots}
                    groups={teachingGroups}
                    subjects={subjects}
                    teachers={teachers}
                    rooms={rooms}
                    selectedStudentId={selectedStudentId}
                    onStudentChange={setSelectedStudentId}
                    exportId="student-viewer-timetable"
                    timeslots={availableTimeslots}
                    scheduleSettings={school}
                    scheduleVersionId={selectedVersion?.id}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Teacher Viewer Tab */}
            <TabsContent value="teacher" className="space-y-4 mt-4">
              <Card className="border border-slate-200">
                <CardHeader className="border-b border-slate-100 pb-4">
                  <CardTitle className="text-base font-semibold">Teacher Timetable</CardTitle>
                  <CardDescription>View individual teacher schedules</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Teacher Search & Select */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-slate-600">Select Teacher</Label>
                    <SearchableEntitySelect
                      items={filteredTeachers}
                      value={selectedTeacherId || ''}
                      onChange={setSelectedTeacherId}
                      placeholder="Search and choose a teacher..."
                      emptyText="No teachers found"
                      renderSubtitle={() => 'Teacher'}
                    />
                  </div>

                  {/* Teacher Schedule Display */}
                  {selectedTeacher && teacherSchedule && (
                    <div className="space-y-4">
                      {/* Teacher Info Card */}
                      <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                            {selectedTeacher.full_name?.charAt(0)?.toUpperCase() || 'T'}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-900">{selectedTeacher.full_name}</h3>
                            <p className="text-xs text-slate-500">{selectedTeacher.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedTeacher.max_hours_per_week && (
                              <Badge variant="outline" className="text-xs">
                                Max {selectedTeacher.max_hours_per_week}h/week
                              </Badge>
                            )}
                            <ExportTimetableButton
                              type="teacher"
                              entityId={selectedTeacher.id}
                              scheduleVersionId={selectedVersion?.id}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Timetable Grid */}
                      <div className="mt-4">
                        <TimetableGrid 
                          slots={teacherSchedule || []}
                          groups={teachingGroups}
                          rooms={rooms}
                          subjects={subjects}
                          teachers={teachers}
                          periodsPerDay={school?.periods_per_day || 10}
                          dayStartTime={school?.day_start_time || '08:00'}
                          dayEndTime={school?.day_end_time || '18:00'}
                          periodDurationMinutes={school?.period_duration_minutes || 60}
                          scheduleSettings={school}
                          globalView={false}
                          exportId="teacher-viewer-timetable"
                          timeslots={availableTimeslots}
                        />
                      </div>
                    </div>
                  )}

                  {!selectedTeacher && (
                    <div className="text-center py-12">
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
                        <Users className="w-6 h-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-slate-500">Select a teacher to view their timetable</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Generation Settings Tab */}
            <TabsContent value="generation" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border border-slate-200 shadow-sm">
                  <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings2 className="w-5 h-5 text-slate-500" />
                      Optimization Constraints
                    </CardTitle>
                    <CardDescription>Configure rules for the OptaPlanner engine</CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Strict Daily Subject Limits</Label>
                        <p className="text-sm text-slate-500">Prevent students from having the same subject too many times per day</p>
                      </div>
                      <Switch 
                        checked={constraints.maxSameSubjectPerDayHardEnabled} 
                        onCheckedChange={(c) => setConstraints(prev => ({ ...prev, maxSameSubjectPerDayHardEnabled: c }))} 
                      />
                    </div>
                    
                    {constraints.maxSameSubjectPerDayHardEnabled && (
                      <div className="pl-4 border-l-2 border-slate-100">
                        <Label className="text-sm text-slate-600 mb-2 block">Maximum periods per day for same subject</Label>
                        <Select 
                          value={constraints.maxSameSubjectPerDayLimit.toString()} 
                          onValueChange={(val) => setConstraints(prev => ({ ...prev, maxSameSubjectPerDayLimit: parseInt(val) }))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Period</SelectItem>
                            <SelectItem value="2">2 Periods</SelectItem>
                            <SelectItem value="3">3 Periods</SelectItem>
                            <SelectItem value="4">4 Periods</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Flexible Weekly Hours</Label>
                        <p className="text-sm text-slate-500">Allow slight variations (+/- 1 period) from target weekly hours if needed</p>
                      </div>
                      <Switch 
                        checked={constraints.allowFlexibleWeeklyCounts} 
                        onCheckedChange={(c) => setConstraints(prev => ({ ...prev, allowFlexibleWeeklyCounts: c }))} 
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-base font-medium">Relax Student Conflicts</Label>
                        <p className="text-sm text-slate-500">Prioritize scheduling all lessons even if it causes minor student double-bookings</p>
                      </div>
                      <Switch 
                        checked={constraints.relaxStudentGroupConflicts} 
                        onCheckedChange={(c) => setConstraints(prev => ({ ...prev, relaxStudentGroupConflicts: c }))} 
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-slate-200 shadow-sm h-full flex flex-col justify-center items-center text-center p-12 bg-gradient-to-br from-blue-50/50 to-white">
                  <div className="w-20 h-20 rounded-2xl bg-blue-100 flex items-center justify-center mb-6 shadow-sm">
                    <Sparkles className="w-10 h-10 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Re-generate Timetable</h3>
                  <p className="text-slate-500 max-w-sm mb-8">
                    Apply the configured constraints and create a new optimized schedule. This will overwrite the current version.
                  </p>
                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={genStatus === 'generating'}
                    className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-base shadow-md hover:shadow-lg transition-all"
                  >
                    {genStatus === 'generating' ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><Play className="w-5 h-5 mr-2 fill-current" />Start Generation</>
                    )}
                  </Button>
                  {genStatus === 'success' && genMessage && (
                    <p className="text-sm text-emerald-600 mt-3 font-medium">{genMessage}</p>
                  )}
                  {genStatus === 'error' && genError && (
                    <p className="text-sm text-red-500 mt-3">{genError}</p>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )
      ) : (
        <Card className="border border-slate-200 shadow-sm">
          <CardContent className="py-24 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-6">
              <Calendar className="w-8 h-8 text-slate-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Version</h3>
            <p className="text-sm text-slate-500 mb-8 max-w-sm text-center">
              Create a schedule version to get started
            </p>
            <Button
              onClick={() => setIsDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 px-6 font-medium"
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

      <Dialog open={isAddLessonDialogOpen} onOpenChange={setIsAddLessonDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add lesson to timetable</DialogTitle>
            <DialogDescription>
              Create a manual lesson and assign it to a class or teaching group, with teacher and room if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Subject</Label>
              <Select value={manualLessonForm.subject_id} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, subject_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={manualLessonForm.day} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, day: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monday">Monday</SelectItem>
                  <SelectItem value="Tuesday">Tuesday</SelectItem>
                  <SelectItem value="Wednesday">Wednesday</SelectItem>
                  <SelectItem value="Thursday">Thursday</SelectItem>
                  <SelectItem value="Friday">Friday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={manualLessonForm.period} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, period: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: school?.periods_per_day || 10 }, (_, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>Period {index + 1}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Class</Label>
              <Select value={manualLessonForm.classgroup_id} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, classgroup_id: value, teaching_group_id: 'none' }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No class selected</SelectItem>
                  {allClassGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Teaching group</Label>
              <Select value={manualLessonForm.teaching_group_id} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, teaching_group_id: value, classgroup_id: 'none' }))}>
                <SelectTrigger><SelectValue placeholder="Select teaching group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group selected</SelectItem>
                  {teachingGroups.filter((group) => group.is_active).map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Teacher</Label>
              <Select value={manualLessonForm.teacher_id} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, teacher_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Room</Label>
              <Select value={manualLessonForm.room_id} onValueChange={(value) => setManualLessonForm((prev) => ({ ...prev, room_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>{room.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Input
                placeholder="Optional note"
                value={manualLessonForm.notes}
                onChange={(e) => setManualLessonForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddLessonDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createManualLessonMutation.mutate({
                schedule_version: selectedVersion?.id,
                subject_id: manualLessonForm.subject_id,
                day: manualLessonForm.day,
                period: Number(manualLessonForm.period),
                timeslot_id: availableTimeslots.find((slot, index) => normalizeSearch(String(slot.dayOfWeek || '')) === normalizeSearch(manualLessonForm.day) && (index + 1) === Number(manualLessonForm.period))?.id || null,
                teacher_id: manualLessonForm.teacher_id === 'unassigned' ? null : manualLessonForm.teacher_id,
                room_id: manualLessonForm.room_id === 'unassigned' ? null : manualLessonForm.room_id,
                classgroup_id: manualLessonForm.classgroup_id === 'none' ? null : manualLessonForm.classgroup_id,
                teaching_group_id: manualLessonForm.teaching_group_id === 'none' ? null : manualLessonForm.teaching_group_id,
                notes: manualLessonForm.notes,
              })}
              disabled={!manualLessonForm.subject_id || (manualLessonForm.classgroup_id === 'none' && manualLessonForm.teaching_group_id === 'none') || createManualLessonMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {createManualLessonMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : 'Add Lesson'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayloadDialogOpen} onOpenChange={setIsPayloadDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Payload Preview</DialogTitle>
            <DialogDescription>
              This is the sampled payload structure that will be sent to the solver for the selected version.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-2">
            <div className="rounded-lg border p-3 bg-slate-50"><div className="text-xs text-slate-500">Teachers</div><div className="text-lg font-semibold">{payloadPreview?.summary?.teachers ?? 0}</div></div>
            <div className="rounded-lg border p-3 bg-slate-50"><div className="text-xs text-slate-500">Rooms</div><div className="text-lg font-semibold">{payloadPreview?.summary?.rooms ?? 0}</div></div>
            <div className="rounded-lg border p-3 bg-slate-50"><div className="text-xs text-slate-500">Groups</div><div className="text-lg font-semibold">{payloadPreview?.summary?.teaching_groups ?? 0}</div></div>
            <div className="rounded-lg border p-3 bg-slate-50"><div className="text-xs text-slate-500">Lessons</div><div className="text-lg font-semibold">{payloadPreview?.summary?.lessons ?? 0}</div></div>
          </div>
          <div className="flex-1 overflow-auto rounded-lg border bg-slate-950 p-4">
            <pre className="text-xs text-slate-100 whitespace-pre-wrap break-words">{payloadPreview ? JSON.stringify(payloadPreview, null, 2) : 'No payload loaded.'}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayloadDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Version Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la version</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la version "{selectedVersion?.name}" ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteVersionMutation.mutate(selectedVersion?.id)}
              disabled={deleteVersionMutation.isPending}
            >
              {deleteVersionMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      </div>
    </div>
  );
}