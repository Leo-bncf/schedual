import React, { useState, useEffect, useMemo } from 'react';
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
  Play
} from 'lucide-react';
import TimetableGrid from '../components/schedule/TimetableGrid';

export default function Schedules() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [genStatus, setGenStatus] = useState('idle'); // idle | generating | success | error
  const [genMessage, setGenMessage] = useState('');
  const [genError, setGenError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [searchTeacher, setSearchTeacher] = useState('');
  const [overviewFilterType, setOverviewFilterType] = useState('all');
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
    const tier = school.subscription_tier;
    const hasAddon = school.active_add_ons?.includes('multiple_timetable_scenarios');
    
    if (tier === 'tier3' || hasAddon) return true;
    
    const count = scheduleVersions.length;
    if (tier === 'tier2') return count < 5; // Tier 2 gets history (up to 5 versions)
    return count < 1; // Tier 1 gets 1 version
  };

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

  const updateSlotMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      return base44.entities.ScheduleSlot.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      toast.success("Lesson updated successfully");
    },
    onError: (err) => {
      toast.error("Failed to update lesson: " + err.message);
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

  const handleGenerateSchedule = async () => {
    if (!selectedVersion) return;

    setGenStatus('generating');
    setGenMessage('');
    setGenError('');

    try {
      const { data } = await base44.functions.invoke('generateSchedule', {
        schedule_version_id: selectedVersion.id,
      });

      if (data.ok === true) {
        setGenStatus('success');
        const programmes = data.programmes?.map(p => `${p.programme}: ${p.slots} slots`).join(', ') || '';
        setGenMessage(`✅ ${data.slotsInserted} slots created. ${programmes}`);
        if (data.failed?.length > 0) {
          toast.warning(`Some programmes failed: ${data.failed.map(f => f.programme).join(', ')}`);
        } else {
          toast.success(`Schedule generated: ${data.slotsInserted} slots`);
        }
        await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
        await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      } else {
        setGenStatus('error');
        const errorMsg = data.error || 'Generation failed';
        setGenError(errorMsg);
        toast.error(errorMsg, { duration: 10000 });
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenStatus('error');
      const errorMsg = error.response?.data?.error || error.message || 'Failed to generate schedule';
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

  const getStudentSchedule = (studentId) => {
    return scheduleSlots.filter(slot => {
      // Direct student match (e.g. for Lunch Breaks)
      if (slot.student_id === studentId) return true;
      
      // Teaching Group match
      const tg = teachingGroups.find(g => g.id === slot.teaching_group_id);
      return tg?.student_ids?.includes(studentId);
    });
  };

  const filteredStudents = students.filter(s => 
    s.is_active && 
    (s.full_name?.toLowerCase().includes(searchStudent.toLowerCase()) ||
     s.email?.toLowerCase().includes(searchStudent.toLowerCase()))
  );

  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const studentSchedule = selectedStudentId ? getStudentSchedule(selectedStudentId) : null;

  const getTeacherSchedule = (teacherId) => {
    return scheduleSlots.filter(slot => slot.teacher_id === teacherId);
  };

  const filteredTeachers = teachers.filter(t => 
    t.is_active && 
    (t.full_name?.toLowerCase().includes(searchTeacher.toLowerCase()) ||
     t.email?.toLowerCase().includes(searchTeacher.toLowerCase()))
  );

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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full px-6 space-y-6">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedules</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and generate timetables</p>
          </div>
          <Button 
            onClick={() => {
              if (canCreateVersion()) {
                setIsDialogOpen(true);
              } else {
                alert(`Limit reached. ${school?.subscription_tier === 'tier1' ? 'Tier 1 allows only 1 schedule version.' : 'Tier 2 allows up to 5 versions history.'} Upgrade for more.`);
              }
            }} 
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Version
          </Button>
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
              <Button
                onClick={handleGenerateSchedule}
                className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-base shadow-md hover:shadow-lg transition-all"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Start Generation
              </Button>
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
              <TabsTrigger 
                value="teacher" 
                className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
              >
                <Users className="w-4 h-4 mr-2" />
                Teacher View
              </TabsTrigger>
              <TabsTrigger 
                value="generation" 
                className="data-[state=active]:bg-slate-100 data-[state=active]:text-slate-900"
              >
                <Settings2 className="w-4 h-4 mr-2" />
                Generation Settings
              </TabsTrigger>
            </TabsList>

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
                    onSlotClick={(day, uiRow, actionData) => {
                      if (actionData.action === 'move') {
                        if (confirm(`Are you sure you want to move this lesson to ${day}, Period ${uiRow}?`)) {
                          updateSlotMutation.mutate({
                            id: actionData.sourceSlotId,
                            data: { day, period: uiRow }
                          });
                        }
                      } else if (actionData.action === 'swap') {
                        if (confirm(`Are you sure you want to swap these lessons?`)) {
                          updateSlotMutation.mutate({
                            id: actionData.sourceSlotId,
                            data: { day: actionData.targetDay, period: actionData.targetPeriod }
                          });
                          updateSlotMutation.mutate({
                            id: actionData.targetSlotId,
                            data: { day: actionData.sourceDay, period: actionData.sourcePeriod }
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
                      <div className="mt-4">
                        <TimetableGrid 
                          slots={studentSchedule || []}
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
                          exportId="student-viewer-timetable"
                        />
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
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Search by name..."
                          value={searchTeacher}
                          onChange={(e) => setSearchTeacher(e.target.value)}
                          className="pl-9 h-10 border-slate-200"
                        />
                      </div>
                      <Select value={selectedTeacherId || ''} onValueChange={setSelectedTeacherId}>
                        <SelectTrigger className="sm:w-[280px] h-10 border-slate-200">
                          <SelectValue placeholder="Choose teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredTeachers.map(teacher => (
                            <SelectItem key={teacher.id} value={teacher.id}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-semibold">
                                  {teacher.full_name?.charAt(0)?.toUpperCase()}
                                </div>
                                <span className="text-sm">{teacher.full_name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                          {selectedTeacher.max_hours_per_week && (
                            <Badge variant="outline" className="text-xs">
                              Max {selectedTeacher.max_hours_per_week}h/week
                            </Badge>
                          )}
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
                    className="bg-blue-600 hover:bg-blue-700 h-12 px-8 text-base shadow-md hover:shadow-lg transition-all"
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    Start Generation
                  </Button>
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