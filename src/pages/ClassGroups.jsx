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
import GenerationProgress from '../components/schedule/GenerationProgress';

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
    MYP: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    PYP: 'bg-amber-100 text-amber-800 border-amber-300'
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Class Groups"
        description="Batches of students organized by year level (max 20 students per batch)"
        actions={
          <Button
            onClick={() => setShowGenerateDialog(true)}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Create Batches
          </Button>
        }
      />

      <Card className="border-blue-200 bg-blue-50">
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
        <Card className="border-amber-200 bg-amber-50">
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
            className="pl-10"
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
                <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer">
                  <div className={`h-1 bg-gradient-to-r ${
                    group.ib_programme === 'DP' ? 'from-blue-500 to-cyan-500' :
                    group.ib_programme === 'MYP' ? 'from-emerald-500 to-teal-500' :
                    'from-amber-500 to-orange-500'
                  }`} />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedGroup(group)}
                    >
                      <CardTitle className="text-lg font-bold text-slate-900 mb-2">
                        {group.name}
                      </CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={programmeColors[group.ib_programme]}>
                          {group.ib_programme}
                        </Badge>
                        <Badge variant="outline">
                          {group.year_group}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-indigo-600">
                          {groupStudents.length}
                        </div>
                        <div className="text-xs text-slate-500">
                          / {group.max_students}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8 w-8"
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
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {homeroomTeacher && (
                      <div className="text-sm">
                        <span className="text-slate-500">Homeroom: </span>
                        <span className="font-medium text-slate-700">
                          {homeroomTeacher.full_name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600">
                        {groupStudents.length} students
                      </span>
                    </div>
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

      {/* Generation Progress Dialog */}
      <GenerationProgress
        open={isGenerating}
        progress={generationProgress}
        onClose={() => {
          setIsGenerating(false);
          setGenerationProgress({
            stage: '',
            percent: 0,
            message: '',
            currentStep: '',
            completedSteps: [],
            completed: false
          });
        }}
      />

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
                // Get student's classes (for DP students)
                const studentClasses = student.ib_programme === 'DP' 
                  ? teachingGroups.filter(tg => tg.student_ids?.includes(student.id))
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