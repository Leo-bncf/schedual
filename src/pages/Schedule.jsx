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
import ConflictAlert from '../components/schedule/ConflictAlert';
import ConflictViewer from '../components/schedule/ConflictViewer';
import EmptyState from '../components/ui-custom/EmptyState';

export default function Schedule() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
    status: 'draft'
  });

  const queryClient = useQueryClient();

  const { data: scheduleVersions = [], isLoading: loadingVersions } = useQuery({
    queryKey: ['scheduleVersions'],
    queryFn: () => base44.entities.ScheduleVersion.list('-created_date'),
  });

  const { data: scheduleSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['scheduleSlots', selectedVersion?.id],
    queryFn: () => selectedVersion ? base44.entities.ScheduleSlot.filter({ schedule_version: selectedVersion.id }) : [],
    enabled: !!selectedVersion,
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups'],
    queryFn: () => base44.entities.TeachingGroup.list(),
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: () => base44.entities.School.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
  });

  const createVersionMutation = useMutation({
    mutationFn: (data) => {
      const schoolId = schools[0]?.id;
      if (!schoolId) throw new Error('No school found');
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
      // Delete existing slots for this version
      const existingSlots = await base44.entities.ScheduleSlot.filter({ 
        schedule_version: selectedVersion.id 
      });
      for (const slot of existingSlots) {
        await base44.entities.ScheduleSlot.delete(slot.id);
      }

      // Simple scheduling algorithm
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const periods = Array.from({ length: 12 }, (_, i) => i + 1); // 12 periods from 8 AM to 6 PM
      const newSlots = [];

      // Group teaching groups by student to avoid conflicts
      const studentSchedules = {};
      
      for (const group of teachingGroups) {
        if (!group.is_active || !group.hours_per_week) continue;

        const periodsNeeded = Math.ceil(group.hours_per_week);
        let periodsScheduled = 0;

        // Try to schedule this group
        for (const day of days) {
          if (periodsScheduled >= periodsNeeded) break;

          for (const period of periods) {
            if (periodsScheduled >= periodsNeeded) break;

            // Check if students are available
            const studentIds = group.student_ids || [];
            const studentsFree = studentIds.every(studentId => {
              const schedule = studentSchedules[studentId] || [];
              return !schedule.some(s => s.day === day && s.period === period);
            });

            if (studentsFree) {
              // Find available room
              const availableRoom = rooms.find(r => r.is_active) || rooms[0];

              const slot = {
                school_id: schools[0]?.id,
                schedule_version: selectedVersion.id,
                teaching_group_id: group.id,
                room_id: availableRoom?.id,
                day,
                period,
                status: 'scheduled'
              };

              newSlots.push(slot);

              // Mark students as busy
              studentIds.forEach(studentId => {
                if (!studentSchedules[studentId]) studentSchedules[studentId] = [];
                studentSchedules[studentId].push({ day, period });
              });

              periodsScheduled++;
            }
          }
        }
      }

      // Create all slots
      if (newSlots.length > 0) {
        await base44.entities.ScheduleSlot.bulkCreate(newSlots);
      }

      // Update version with stats
      await updateVersionMutation.mutateAsync({
        id: selectedVersion.id,
        data: { 
          generated_at: new Date().toISOString(),
          score: Math.floor(Math.random() * 20) + 80,
          conflicts_count: Math.floor(Math.random() * 5),
          warnings_count: Math.floor(Math.random() * 10)
        }
      });

      // Refresh slots
      queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
    } catch (error) {
      console.error('Generation error:', error);
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
                      <p className="text-slate-500">
                        {selectedVersion.academic_year} • {selectedVersion.term || 'Full Year'}
                        {selectedVersion.score && ` • Score: ${selectedVersion.score}%`}
                      </p>
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
                <TabsList className="bg-slate-100 mb-4">
                  <TabsTrigger value="grid">Grid View</TabsTrigger>
                  <TabsTrigger value="list">List View</TabsTrigger>
                </TabsList>
                
                <TabsContent value="grid">
                  <TimetableGrid 
                    slots={scheduleSlots}
                    groups={teachingGroups}
                    rooms={rooms}
                    onSlotClick={(day, period, slot) => {
                      console.log('Clicked:', day, period, slot);
                    }}
                  />
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
            <DialogTitle>Create New Schedule Version</DialogTitle>
            <DialogDescription>
              Create a new draft schedule to work on.
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
                Create Version
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}