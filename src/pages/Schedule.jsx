import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { 
  Plus, 
  Calendar, 
  Play, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Sparkles,
  Download,
  Eye,
  Archive,
  Loader2,
  Trash2
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import TimetableGrid from '../components/schedule/TimetableGrid';
import HoursSummary from '../components/schedule/HoursSummary';
import StudentScheduleView from '../components/schedule/StudentScheduleView';
import TeacherScheduleView from '../components/schedule/TeacherScheduleView';
import ScheduleExporter from '../components/schedule/ScheduleExporter';
import ConflictAlert from '../components/schedule/ConflictAlert';
import ConflictViewer from '../components/schedule/ConflictViewer';
import EmptyState from '../components/ui-custom/EmptyState';

export default function Schedule() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('DP'); // DP, MYP, or PYP
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
    status: 'draft'
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: scheduleVersions = [], isLoading: loadingVersions } = useQuery({
    queryKey: ['scheduleVersions', schoolId],
    queryFn: () => base44.entities.ScheduleVersion.filter({ school_id: schoolId }, '-created_date'),
    enabled: !!schoolId,
  });

  const { data: scheduleSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['scheduleSlots', selectedVersion?.id],
    queryFn: () => selectedVersion ? base44.entities.ScheduleSlot.filter({ schedule_version: selectedVersion.id }) : [],
    enabled: !!selectedVersion,
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

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const createVersionMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.ScheduleVersion.create({ ...data, school_id: schoolId });
    },
    onSuccess: (newVersion) => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      setIsDialogOpen(false);
      setSelectedVersion(newVersion);
      setFormData({ name: '', academic_year: '2024-2025', term: 'Fall', status: 'draft' });
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleVersion.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleVersion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      setSelectedVersion(null);
    },
  });

  const handlePublish = async (version) => {
    // First unpublish any currently published version
    const currentPublished = scheduleVersions.find(v => v.status === 'published');
    if (currentPublished) {
      await updateVersionMutation.mutateAsync({ 
        id: currentPublished.id, 
        data: { status: 'archived' } 
      });
    }
    // Then publish the selected version
    await updateVersionMutation.mutateAsync({ 
      id: version.id, 
      data: { status: 'published', published_at: new Date().toISOString() } 
    });
  };

  const handleGenerateSchedule = async () => {
    if (!selectedVersion) return;
    
    setIsGenerating(true);
    
    try {
      console.log('=== SCHEDULE GENERATION START ===');
      console.log('School ID:', schoolId);
      console.log('Selected Version:', selectedVersion);
      console.log('Teaching Groups:', teachingGroups.length);
      console.log('Teachers:', teachers.length);
      console.log('Students:', students.length);
      console.log('Rooms:', rooms.length);
      
      // Delete existing slots for this version (batch to avoid rate limits)
      const existingSlots = await base44.entities.ScheduleSlot.list();
      const slotsToDelete = existingSlots.filter(s => s.schedule_version === selectedVersion.id);
      
      console.log('Existing slots to delete:', slotsToDelete.length);
      
      if (slotsToDelete.length > 0) {
        // Delete in small batches with delays to avoid rate limits
        const batchSize = 5;
        for (let i = 0; i < slotsToDelete.length; i += batchSize) {
          const batch = slotsToDelete.slice(i, i + batchSize);
          await Promise.all(batch.map(slot => base44.entities.ScheduleSlot.delete(slot.id)));
          // Delay between batches to avoid rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('All slots deleted, waiting before creating new ones...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Comprehensive scheduling algorithm for all students, teachers, and rooms
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const periods = Array.from({ length: 12 }, (_, i) => i + 1);
      const newSlots = [];

      // Track availability for students, teachers, and rooms
      const studentSchedules = {};
      const teacherSchedules = {};
      const roomSchedules = {};

      // Initialize availability tracking
      students.forEach(s => { studentSchedules[s.id] = []; });
      teachers.forEach(t => { teacherSchedules[t.id] = []; });
      rooms.forEach(r => { roomSchedules[r.id] = []; });

      // Debug: Check why groups are being filtered out
      console.log('All teaching groups:', teachingGroups.length);
      teachingGroups.forEach((g, i) => {
        if (i < 3) { // Log first 3 groups
          console.log(`Group ${i}:`, {
            name: g.name,
            is_active: g.is_active,
            hours_per_week: g.hours_per_week,
            teacher_id: g.teacher_id,
            student_ids_count: g.student_ids?.length || 0
          });
        }
      });

      // Helper to determine IB level from year_group
      const getIBLevel = (year_group) => {
        if (!year_group) return null;
        if (year_group.startsWith('DP')) return 'DP';
        if (year_group.startsWith('MYP')) return 'MYP';
        if (year_group.startsWith('PYP')) return 'PYP';
        return null;
      };

      // Separate groups by IB level
      const groupsByLevel = {
        DP: [],
        MYP: [],
        PYP: []
      };

      teachingGroups.forEach(g => {
        if (g.is_active === false) return;
        if (!g.hours_per_week || g.hours_per_week <= 0) return;
        
        const level = getIBLevel(g.year_group);
        if (level) {
          groupsByLevel[level].push(g);
        }
      });

      console.log('Groups by IB Level:', {
        DP: groupsByLevel.DP.length,
        MYP: groupsByLevel.MYP.length,
        PYP: groupsByLevel.PYP.length
      });

      // Schedule each IB level separately but track teachers globally
      const scheduleLevels = ['DP', 'MYP', 'PYP'];
      
      for (const level of scheduleLevels) {
        const levelGroups = groupsByLevel[level]
          .sort((a, b) => (a.student_ids?.length || 0) - (b.student_ids?.length || 0));
        
        console.log(`\n=== Scheduling ${level} (${levelGroups.length} groups) ===`);

        for (const group of levelGroups) {
        const periodsNeeded = Math.ceil(group.hours_per_week);
        let periodsScheduled = 0;
        let studentIds = group.student_ids || [];
        const teacherId = group.teacher_id;

        // If no students assigned, try to find matching students
        if (studentIds.length === 0 && group.subject_id && group.year_group) {
          const matchingStudents = students.filter(s => {
            // Match by year_group
            if (s.year_group !== group.year_group) return false;

            // For DP students, check subject choices
            if (s.ib_programme === 'DP' && s.subject_choices) {
              return s.subject_choices.some(choice => choice.subject_id === group.subject_id);
            }

            // For MYP/PYP, just match by year group
            return true;
          });

          studentIds = matchingStudents.map(s => s.id);
          console.log(`Auto-assigned ${studentIds.length} students to "${group.name}"`);
        }

        // Find suitable room
        const subject = subjects.find(s => s.id === group.subject_id);
        let preferredRooms = rooms.filter(r => r.is_active);
        
        if (subject?.requires_special_room) {
          preferredRooms = preferredRooms.filter(r => r.room_type === subject.requires_special_room);
        }
        if (group.preferred_room_id) {
          const preferred = rooms.find(r => r.id === group.preferred_room_id);
          if (preferred) preferredRooms = [preferred, ...preferredRooms.filter(r => r.id !== preferred.id)];
        }

        // Try to schedule periods for this group
        for (const day of days) {
          if (periodsScheduled >= periodsNeeded) break;

          for (const period of periods) {
            if (periodsScheduled >= periodsNeeded) break;

            // Check if all students are available (or no students assigned yet)
            const studentsFree = studentIds.length === 0 || studentIds.every(studentId => {
              const schedule = studentSchedules[studentId] || [];
              return !schedule.some(s => s.day === day && s.period === period);
            });

            // Check if teacher is available (if assigned)
            let teacherFree = true;
            let teacherAvailable = true;

            if (teacherId) {
              teacherFree = !teacherSchedules[teacherId]?.some(s => s.day === day && s.period === period);
              const teacher = teachers.find(t => t.id === teacherId);
              teacherAvailable = !teacher?.unavailable_slots?.some(u => u.day === day && u.period === period);
            }

            if (studentsFree && teacherFree && teacherAvailable) {
              // Find available room
              let assignedRoom = null;
              for (const room of preferredRooms) {
                const roomFree = !roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
                const hasCapacity = !room.capacity || (studentIds.length <= room.capacity);
                
                if (roomFree && hasCapacity) {
                  assignedRoom = room;
                  break;
                }
              }

              if (assignedRoom) {
                const slot = {
                  school_id: schoolId,
                  schedule_version: selectedVersion.id,
                  teaching_group_id: group.id,
                  room_id: assignedRoom.id,
                  day,
                  period,
                  status: 'scheduled'
                };

                newSlots.push(slot);

                // Mark as busy
                if (studentIds.length > 0) {
                  studentIds.forEach(studentId => {
                    studentSchedules[studentId].push({ day, period });
                  });
                }
                if (teacherId && teacherSchedules[teacherId]) {
                  teacherSchedules[teacherId].push({ day, period });
                }
                roomSchedules[assignedRoom.id].push({ day, period });

                periodsScheduled++;
              }
            }
          }
        }

          // Debug: Log if group wasn't fully scheduled
          if (periodsScheduled < periodsNeeded) {
            console.log(`⚠️ Group "${group.name}" only scheduled ${periodsScheduled}/${periodsNeeded} periods`);
          }
        }
      }

      // Create all slots in batches to avoid rate limits
      console.log('Total slots to create:', newSlots.length);
      console.log('Sample slot:', newSlots[0]);

      if (newSlots.length > 0) {
        const batchSize = 20;
        let totalCreated = 0;

        for (let i = 0; i < newSlots.length; i += batchSize) {
          const batch = newSlots.slice(i, i + batchSize);
          console.log(`Creating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newSlots.length/batchSize)}...`);
          const created = await base44.entities.ScheduleSlot.bulkCreate(batch);
          totalCreated += created.length;

          // Delay between batches
          if (i + batchSize < newSlots.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        console.log('Created slots:', totalCreated);
      } else {
        console.warn('No slots were generated!');
      }

      // Calculate actual stats
      const scheduledStudents = new Set();
      const scheduledTeachers = new Set();
      const scheduledGroups = new Set();

      newSlots.forEach(slot => {
        const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
        if (group) {
          scheduledGroups.add(group.id);
          group.student_ids?.forEach(sid => scheduledStudents.add(sid));
          if (group.teacher_id) scheduledTeachers.add(group.teacher_id);
        }
      });

      // Count all unique teachers from all groups
      const allTeachersInGroups = new Set();
      Object.values(groupsByLevel).flat().forEach(g => {
        if (g.teacher_id) allTeachersInGroups.add(g.teacher_id);
      });

      const totalGroups = Object.values(groupsByLevel).flat().length;

      // Update version with stats
      await updateVersionMutation.mutateAsync({
        id: selectedVersion.id,
        data: { 
          generated_at: new Date().toISOString(),
          score: Math.floor((newSlots.length / (totalGroups * 6)) * 100),
          conflicts_count: 0,
          warnings_count: totalGroups - scheduledGroups.size,
          notes: `DP: ${groupsByLevel.DP.length} groups, MYP: ${groupsByLevel.MYP.length} groups, PYP: ${groupsByLevel.PYP.length} groups | Scheduled ${scheduledStudents.size}/${students.length} students, ${scheduledGroups.size}/${totalGroups} groups (${allTeachersInGroups.size} teachers) across ${newSlots.length} periods.`
        }
      });

      // Refresh slots
      queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      console.log('=== SCHEDULE GENERATION COMPLETE ===');
    } catch (error) {
      console.error('=== GENERATION ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      alert('Schedule generation failed. Check browser console for details.');
    }
    
    setIsGenerating(false);
  };

  const publishedVersion = scheduleVersions.find(v => v.status === 'published');
  const draftVersions = scheduleVersions.filter(v => v.status === 'draft');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Schedule"
        description="Create and manage IB Diploma Programme timetables"
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Version
          </Button>
        }
      />

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Version Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Schedule Versions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {publishedVersion && (
                <div 
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedVersion?.id === publishedVersion.id 
                      ? 'bg-emerald-50 border-2 border-emerald-200' 
                      : 'bg-emerald-50/50 border border-emerald-100 hover:border-emerald-200'
                  }`}
                  onClick={() => setSelectedVersion(publishedVersion)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-emerald-900">{publishedVersion.name}</span>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Published</Badge>
                </div>
              )}

              {draftVersions.map(version => (
                <div 
                  key={version.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedVersion?.id === version.id 
                      ? 'bg-slate-100 border-2 border-slate-300' 
                      : 'bg-slate-50 border border-slate-100 hover:border-slate-200'
                  }`}
                  onClick={() => setSelectedVersion(version)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-700">{version.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">Draft</Badge>
                    {version.conflicts_count > 0 && (
                      <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">
                        {version.conflicts_count} conflicts
                      </Badge>
                    )}
                  </div>
                </div>
              ))}

              {scheduleVersions.length === 0 && !loadingVersions && (
                <div className="text-center py-6">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No versions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {selectedVersion ? (
            <>
              {/* Version Header */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-semibold text-slate-900">{selectedVersion.name}</h2>
                        <Badge className={
                          selectedVersion.status === 'published' 
                            ? 'bg-emerald-100 text-emerald-700 border-0' 
                            : 'bg-slate-100 text-slate-600 border-0'
                        }>
                          {selectedVersion.status}
                        </Badge>
                      </div>
                      <p className="text-slate-500 text-sm">
                        {selectedVersion.academic_year} • {selectedVersion.term || 'Full Year'}
                      </p>
                      {selectedVersion.notes && (
                        <p className="text-xs text-slate-400 mt-1">{selectedVersion.notes}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={handleGenerateSchedule}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Generate
                          </>
                        )}
                      </Button>
                      {selectedVersion.status === 'draft' && (
                        <>
                          <Button 
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => handlePublish(selectedVersion)}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Publish
                          </Button>
                          <Button 
                            variant="outline"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => deleteVersionMutation.mutate(selectedVersion.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Conflicts/Warnings */}
              {selectedVersion && (selectedVersion.conflicts_count > 0 || selectedVersion.warnings_count > 0) && (
                <div className="space-y-3">
                  {selectedVersion.conflicts_count > 0 && (
                    <ConflictAlert 
                      severity="error"
                      title={`${selectedVersion.conflicts_count} Scheduling Conflicts`}
                      description="There are unresolved conflicts that need attention before publishing."
                    />
                  )}
                  {selectedVersion.warnings_count > 0 && (
                    <ConflictAlert 
                      severity="warning"
                      title={`${selectedVersion.warnings_count} Warnings`}
                      description="Review these soft constraint violations for optimal scheduling."
                    />
                  )}
                  {selectedVersion.id && <ConflictViewer scheduleVersionId={selectedVersion.id} />}
                </div>
              )}

              {/* Timetable */}
              <Tabs defaultValue="grid">
                <div className="flex items-center justify-between mb-4">
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="grid">Master Schedule</TabsTrigger>
                    <TabsTrigger value="student">Student View</TabsTrigger>
                    <TabsTrigger value="teacher">Teacher View</TabsTrigger>
                    <TabsTrigger value="list">List View</TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">IB Level:</span>
                    <TabsList className="bg-slate-100">
                      <TabsTrigger 
                        value={selectedLevel} 
                        onClick={() => setSelectedLevel('DP')}
                        className={selectedLevel === 'DP' ? 'bg-white' : ''}
                      >
                        DP
                      </TabsTrigger>
                      <TabsTrigger 
                        value={selectedLevel}
                        onClick={() => setSelectedLevel('MYP')}
                        className={selectedLevel === 'MYP' ? 'bg-white' : ''}
                      >
                        MYP
                      </TabsTrigger>
                      <TabsTrigger 
                        value={selectedLevel}
                        onClick={() => setSelectedLevel('PYP')}
                        className={selectedLevel === 'PYP' ? 'bg-white' : ''}
                      >
                        PYP
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>
                
                <TabsContent value="grid">
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <ScheduleExporter 
                        elementId="master-schedule-grid"
                        filename={`master-schedule-${selectedVersion?.name || 'schedule'}`}
                        label="Export Master Schedule"
                      />
                    </div>
                    <div className="grid lg:grid-cols-[1fr_320px] gap-4" id="master-schedule-grid">
                      <TimetableGrid 
                        slots={scheduleSlots.filter(slot => {
                          const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
                          if (!group?.year_group) return false;
                          return group.year_group.startsWith(selectedLevel);
                        })}
                        groups={teachingGroups.filter(g => g.year_group?.startsWith(selectedLevel))}
                        rooms={rooms}
                        subjects={subjects}
                        teachers={teachers}
                        onSlotClick={(day, period, slot) => {
                          console.log('Clicked:', day, period, slot);
                        }}
                        exportId="master-timetable"
                      />
                      <HoursSummary 
                        slots={scheduleSlots.filter(slot => {
                          const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
                          return group?.year_group?.startsWith(selectedLevel);
                        })}
                        groups={teachingGroups.filter(g => g.year_group?.startsWith(selectedLevel))}
                        subjects={subjects}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="student">
                  <div className="space-y-4">
                    {selectedStudentId && (
                      <div className="flex justify-end">
                        <ScheduleExporter 
                          elementId="student-schedule"
                          filename={`student-schedule-${students.find(s => s.id === selectedStudentId)?.full_name || 'student'}`}
                          label="Export Student Schedule"
                        />
                      </div>
                    )}
                    <StudentScheduleView
                      students={students.filter(s => s.is_active)}
                      slots={scheduleSlots}
                      groups={teachingGroups}
                      subjects={subjects}
                      teachers={teachers}
                      rooms={rooms}
                      selectedStudentId={selectedStudentId}
                      onStudentChange={setSelectedStudentId}
                      exportId="student-schedule"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="teacher">
                  <div className="space-y-4">
                    {selectedTeacherId && (
                      <div className="flex justify-end">
                        <ScheduleExporter 
                          elementId="teacher-schedule"
                          filename={`teacher-schedule-${teachers.find(t => t.id === selectedTeacherId)?.full_name || 'teacher'}`}
                          label="Export Teacher Schedule"
                        />
                      </div>
                    )}
                    <TeacherScheduleView
                      teachers={teachers.filter(t => t.is_active)}
                      slots={scheduleSlots}
                      groups={teachingGroups}
                      subjects={subjects}
                      rooms={rooms}
                      selectedTeacherId={selectedTeacherId}
                      onTeacherChange={setSelectedTeacherId}
                      exportId="teacher-schedule"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="list">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      {scheduleSlots.length === 0 ? (
                        <div className="text-center py-12">
                          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">No schedule slots yet. Click "Generate" to create a schedule.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {scheduleSlots.map(slot => {
                            const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
                            const room = rooms.find(r => r.id === slot.room_id);
                            return (
                              <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                <div>
                                  <p className="font-medium text-slate-900">{group?.name || 'Unknown Group'}</p>
                                  <p className="text-sm text-slate-500">
                                    {slot.day} Period {slot.period} • {room?.name || 'No room'}
                                  </p>
                                </div>
                                <Badge variant="outline">{group?.level}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16">
                <EmptyState 
                  icon={Calendar}
                  title="Select a Schedule Version"
                  description="Choose a version from the sidebar or create a new one to start editing."
                  action={() => setIsDialogOpen(true)}
                  actionLabel="Create New Version"
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Version Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Master Schedule</DialogTitle>
            <DialogDescription>
              This will create a master schedule that includes all students (PYP, MYP, DP), all teachers, and all rooms. Each student and teacher will have their own synchronized schedule.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createVersionMutation.mutate(formData); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Version Name *</Label>
              <Input 
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fall 2024 Draft v1"
                required
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createVersionMutation.isPending}>
                Create Master Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}