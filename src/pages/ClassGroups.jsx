import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Sparkles, Search, RefreshCw, X, BookOpen, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from '../components/ui-custom/PageHeader';
import EmptyState from '../components/ui-custom/EmptyState';
import GenerateInfoDialog from '../components/ui-custom/GenerateInfoDialog';

export default function ClassGroups() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    stage: '',
    percent: 0,
    message: '',
    currentStep: '',
    completedSteps: [],
    completed: false
  });
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagData, setDiagData] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: classGroups = [], isLoading } = useQuery({
    queryKey: ['classGroups', schoolId],
    queryFn: () => base44.entities.ClassGroup.filter({ school_id: schoolId }, '-year_group', 500),
    enabled: !!schoolId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }, '-created_date', 500),
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

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const deleteClassGroupMutation = useMutation({
    mutationFn: async (groupId) => {
      // Clear classgroup_id from all students in this group
      const studentsInGroup = students.filter(s => s.classgroup_id === groupId);
      await Promise.all(
        studentsInGroup.map(s => 
          base44.entities.Student.update(s.id, { classgroup_id: null })
        )
      );
      // Delete the class group
      return base44.entities.ClassGroup.delete(groupId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classGroups'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress({
      stage: 'Analyzing students',
      percent: 0,
      message: 'Analyzing students by year and programme...',
      currentStep: 'analyze',
      completedSteps: [],
      completed: false
    });
    
    try {
      setGenerationProgress(prev => ({
        ...prev,
        percent: 20,
        stage: 'Creating batches',
        message: 'Creating student batches...'
      }));
      
      const response = await base44.functions.invoke('createClassGroupBatches');
      
      setGenerationProgress(prev => ({
        ...prev,
        percent: 60,
        stage: 'Assigning students',
        message: 'Assigning students to class groups...',
        completedSteps: ['analyze', 'batches']
      }));

      if (response.data.error) {
        alert(response.data.message || response.data.error);
        return;
      }

      if (response.data.success) {
        setGenerationProgress(prev => ({
          ...prev,
          percent: 80,
          stage: 'Finalizing',
          message: 'Finalizing class group assignments...'
        }));
        
        // Wait for backend updates to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Force hard refresh - clear cache completely
        queryClient.removeQueries({ queryKey: ['classGroups'] });
        queryClient.removeQueries({ queryKey: ['students'] });
        
        // Refetch fresh data
        await Promise.all([
          queryClient.refetchQueries({ queryKey: ['classGroups'] }),
          queryClient.refetchQueries({ queryKey: ['students'] })
        ]);

        setGenerationProgress({
          stage: 'Complete',
          percent: 100,
          message: `Successfully created ${response.data.created || 0} class groups!`,
          currentStep: '',
          completedSteps: ['analyze', 'batches', 'assign', 'finalize'],
          completed: true
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        let message = response.data.message;
        if (response.data.ineligibleStudents > 0) {
          message += `\n\nWarning: ${response.data.ineligibleStudents} students are missing year_group or programme data and were not assigned to class groups. Please update their profiles.`;
          console.log('Students missing data:', response.data.missingYearGroupStudents);
        }
        alert(message);
      } else {
        alert('Failed to generate class groups');
      }
    } catch (error) {
      console.error('Error generating ClassGroups:', error);
      alert('Failed to generate ClassGroups. Check console for details.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress({
        stage: '',
        percent: 0,
        message: '',
        currentStep: '',
        completedSteps: [],
        completed: false
      });
    }
  };

  const filteredGroups = classGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const studentsWithoutClassGroup = students.filter(s => {
    // Check if student is in any ClassGroup's student_ids array
    return !classGroups.some(cg => cg.student_ids?.includes(s.id));
  });

  const programmeColors = {
    DP: 'bg-blue-100 text-blue-800 border-blue-300',
    MYP: 'bg-purple-100 text-purple-800 border-purple-300',
    PYP: 'bg-teal-100 text-teal-800 border-teal-300'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Groups"
        description="Batches of students organized by year level (max 20 students per batch)"
        actions={
          <div className="flex gap-2">
            <Button
              onClick={() => setShowGenerateDialog(true)}
              disabled={isGenerating}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Batches
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  setDiagLoading(true);
                  const res = await base44.functions.invoke('diagnoseStudents');
                  setDiagData(res.data);
                  setDiagOpen(true);
                } catch (e) {
                  alert('Diagnostics failed');
                } finally {
                  setDiagLoading(false);
                }
              }}
            >
              <Search className="w-4 h-4 mr-2" />
              {diagLoading ? 'Diagnosing…' : 'Diagnose Data'}
            </Button>
          </div>
        }
      />

      <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium mb-1">Total Students in School</p>
              <p className="text-4xl font-bold text-blue-900">{students.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-400" />
          </div>
        </CardContent>
      </Card>

      {studentsWithoutClassGroup.length > 0 && (
        <Card className="border-0 shadow-sm bg-amber-50 rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-amber-600" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">
                  {studentsWithoutClassGroup.length} students not assigned to ClassGroups
                </p>
                <p className="text-sm text-amber-700">
                  Click "Auto-Generate ClassGroups" to automatically create batches
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search ClassGroups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            queryClient.removeQueries({ queryKey: ['classGroups'] });
            queryClient.removeQueries({ queryKey: ['students'] });
            queryClient.refetchQueries({ queryKey: ['classGroups'] });
            queryClient.refetchQueries({ queryKey: ['students'] });
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading ClassGroups...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16">
            <EmptyState
              icon={Users}
              title="No ClassGroups Yet"
              description="ClassGroups will be auto-generated when you import or add students"
              action={studentsWithoutClassGroup.length > 0 ? handleAutoGenerate : null}
              actionLabel={studentsWithoutClassGroup.length > 0 ? "Generate Now" : null}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((group, index) => {
            const groupStudents = students.filter(s => group.student_ids?.includes(s.id));
            const homeroomTeacher = teachers.find(t => t.id === group.homeroom_teacher_id);

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.03, y: -5 }}
              >
                <Card 
                  className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white rounded-xl overflow-hidden flex flex-col h-full cursor-pointer"
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className={`h-1.5 w-full ${
                    group.ib_programme === 'DP' ? 'bg-blue-500' :
                    group.ib_programme === 'MYP' ? 'bg-purple-500' :
                    'bg-teal-500'
                  }`} />
                  <CardContent className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-lg ${
                          group.ib_programme === 'DP' ? 'bg-blue-500' :
                          group.ib_programme === 'MYP' ? 'bg-purple-500' :
                          'bg-teal-500'
                        } flex items-center justify-center text-white flex-shrink-0`}>
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 text-base truncate">{group.name}</h3>
                          <p className="text-xs text-slate-500 truncate">{group.year_group}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mr-2 text-slate-400 hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${group.name}? Students will be unassigned.`)) {
                            deleteClassGroupMutation.mutate(group.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {homeroomTeacher && (
                      <div className="mb-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 font-medium">
                          {homeroomTeacher.full_name}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Users className="w-4 h-4" />
                        <span className="text-sm">Capacity: {groupStudents.length} / {group.max_students}</span>
                      </div>
                      <Badge className={`${
                        group.ib_programme === 'DP' ? 'bg-blue-500' :
                        group.ib_programme === 'MYP' ? 'bg-purple-500' :
                        'bg-teal-500'
                      } text-white border-0 rounded-md px-2 py-0.5 text-xs font-medium`}>
                        {group.ib_programme}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
            </motion.div>
            );
          })}
        </div>
      )}

      {/* Generate Info Dialog */}
      <GenerateInfoDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
        onConfirm={handleAutoGenerate}
        type="classgroups"
        isGenerating={isGenerating}
      />

      {/* Diagnostics Dialog */}
      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Data Diagnostics</DialogTitle>
            <DialogDescription>
              Snapshot of students, subjects, and class groups seen by the backend.
            </DialogDescription>
          </DialogHeader>
          {diagData ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-slate-50 rounded border">
                  <div className="text-slate-500">Students</div>
                  <div className="text-lg font-semibold">{diagData?.totals?.students_total || 0}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded border">
                  <div className="text-slate-500">Subjects</div>
                  <div className="text-lg font-semibold">{diagData?.totals?.subjects_total || 0}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded border">
                  <div className="text-slate-500">ClassGroups</div>
                  <div className="text-lg font-semibold">{diagData?.totals?.classgroups_total || 0}</div>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">By Programme/Year</p>
                {diagData && Object.keys(diagData.programmeYear || {}).length > 0 ? (
                  <div className="max-h-48 overflow-auto border rounded">
                    {Object.entries(diagData.programmeYear).map(([k, v]) => (
                      <div key={k} className="flex justify-between px-3 py-2 border-b last:border-b-0">
                        <span className="font-mono text-slate-600">{k}</span>
                        <span className="font-medium">{v.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-600">No students found.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600">No diagnostics yet.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* ClassGroup Detail Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              {selectedGroup?.ib_programme} • {selectedGroup?.year_group} • {students.filter(s => selectedGroup?.student_ids?.includes(s.id)).length} students
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {students
              .filter(s => selectedGroup?.student_ids?.includes(s.id))
              .map(student => {
                // Get student's classes (for DP students) - deduplicate by subject_id and level
                const studentClasses = student.ib_programme === 'DP' 
                  ? (() => {
                      const allGroups = teachingGroups.filter(tg => tg.student_ids?.includes(student.id));
                      const uniqueClasses = [];
                      const seenKeys = new Set();
                      
                      for (const tg of allGroups) {
                        const key = `${tg.subject_id}-${tg.level}`;
                        if (!seenKeys.has(key)) {
                          seenKeys.add(key);
                          uniqueClasses.push(tg);
                        }
                      }
                      
                      return uniqueClasses;
                    })()
                  : [];

                return (
                  <Card key={student.id} className="border-slate-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{student.full_name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {student.student_id}
                            </Badge>
                            <Badge className={programmeColors[student.ib_programme]}>
                              {student.ib_programme}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {student.ib_programme === 'DP' && studentClasses.length > 0 ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <BookOpen className="w-4 h-4" />
                            <span>Classes ({studentClasses.length})</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {studentClasses.map(tg => {
                              const subject = subjects.find(s => s.id === tg.subject_id);
                              const teacher = teachers.find(t => t.id === tg.teacher_id);
                              return (
                                <div 
                                  key={tg.id}
                                  className="p-3 rounded-lg bg-slate-50 border border-slate-200"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <p className="font-medium text-sm text-slate-900">
                                        {subject?.name || 'Unknown Subject'}
                                      </p>
                                      <p className="text-xs text-slate-500 mt-1">
                                        {teacher?.full_name || 'No teacher'}
                                      </p>
                                    </div>
                                    <Badge className={
                                      tg.level === 'HL' 
                                        ? 'bg-rose-100 text-rose-700 border-0' 
                                        : 'bg-amber-100 text-amber-700 border-0'
                                    }>
                                      {tg.level}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          {student.ib_programme === 'DP' 
                            ? 'No teaching groups assigned yet' 
                            : `All ${student.ib_programme} students attend the same classes as their ClassGroup`
                          }
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

            {students.filter(s => selectedGroup?.student_ids?.includes(s.id)).length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">No students in this ClassGroup yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}