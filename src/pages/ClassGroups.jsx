import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Sparkles, Search, RefreshCw, X, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from '../components/ui-custom/PageHeader';
import EmptyState from '../components/ui-custom/EmptyState';

export default function ClassGroups() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
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

  const handleAutoGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await base44.functions.invoke('createClassGroupBatches');
      if (response.data.success) {
        queryClient.invalidateQueries({ queryKey: ['classGroups'] });
        queryClient.invalidateQueries({ queryKey: ['students'] });

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
    }
    setIsGenerating(false);
  };

  const filteredGroups = classGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const studentsWithoutClassGroup = students.filter(s => {
    if (!s.classgroup_id) return true;
    // Check if classgroup_id points to a deleted/non-existent group
    return !classGroups.find(cg => cg.id === s.classgroup_id);
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
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Create Batches
              </>
            )}
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
          {filteredGroups.map(group => {
            const groupStudents = students.filter(s => s.classgroup_id === group.id);
            const homeroomTeacher = teachers.find(t => t.id === group.homeroom_teacher_id);

            return (
              <Card 
                key={group.id} 
                className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedGroup(group)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
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
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">
                        {groupStudents.length}
                      </div>
                      <div className="text-xs text-slate-500">
                        / {group.max_students}
                      </div>
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
            );
          })}
        </div>
      )}

      {/* ClassGroup Detail Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              {selectedGroup?.ib_programme} • {selectedGroup?.year_group} • {students.filter(s => s.classgroup_id === selectedGroup?.id).length} students
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {students
              .filter(s => s.classgroup_id === selectedGroup?.id)
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

            {students.filter(s => s.classgroup_id === selectedGroup?.id).length === 0 && (
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