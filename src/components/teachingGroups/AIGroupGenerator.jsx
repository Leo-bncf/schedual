import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle, AlertCircle, Users } from 'lucide-react';

export default function AIGroupGenerator({ onComplete }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState(null);
  const queryClient = useQueryClient();

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => base44.entities.Teacher.list(),
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: () => base44.entities.School.list(),
  });

  const createGroupsMutation = useMutation({
    mutationFn: (groups) => base44.entities.TeachingGroup.bulkCreate(groups),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      if (onComplete) onComplete();
    },
  });

  const generateGroups = async () => {
    setIsGenerating(true);
    setResults(null);

    try {
      // Organize students by subject + level + year_group
      const groupMap = {};

      students.forEach(student => {
        if (!student.subject_choices || !student.is_active) return;

        student.subject_choices.forEach(choice => {
          const subject = subjects.find(s => s.id === choice.subject_id);
          if (!subject) return;

          const key = `${choice.subject_id}_${choice.level}_${student.year_group}`;
          
          if (!groupMap[key]) {
            groupMap[key] = {
              subject_id: choice.subject_id,
              subject_name: subject.name,
              level: choice.level,
              year_group: student.year_group,
              student_ids: [],
              ib_group: choice.ib_group,
            };
          }

          groupMap[key].student_ids.push(student.id);
        });
      });

      // Convert to array and split large groups
      const proposedGroups = [];
      const maxGroupSize = 20;
      const minGroupSize = 1;

      Object.values(groupMap).forEach(group => {
        const studentCount = group.student_ids.length;

        if (studentCount < minGroupSize) {
          // Too small - flag for review
          proposedGroups.push({
            ...group,
            status: 'warning',
            message: `Only ${studentCount} students - below minimum of ${minGroupSize}`,
          });
        } else if (studentCount <= maxGroupSize) {
          // Perfect size - create one group
          proposedGroups.push({
            ...group,
            status: 'ready',
          });
        } else {
          // Split into multiple groups
          const numGroups = Math.ceil(studentCount / maxGroupSize);
          const studentsPerGroup = Math.ceil(studentCount / numGroups);

          for (let i = 0; i < numGroups; i++) {
            const start = i * studentsPerGroup;
            const end = start + studentsPerGroup;
            proposedGroups.push({
              ...group,
              student_ids: group.student_ids.slice(start, end),
              group_suffix: String.fromCharCode(65 + i), // A, B, C...
              status: 'ready',
            });
          }
        }
      });

      // Find qualified teachers for each group
      proposedGroups.forEach(group => {
        const subject = subjects.find(s => s.id === group.subject_id);
        if (!subject) return;

        const qualifiedTeachers = teachers.filter(teacher => {
          if (!teacher.is_active || !teacher.qualifications) return false;
          
          return teacher.qualifications.some(qual => 
            qual.subject_id === group.subject_id && 
            qual.ib_levels && 
            qual.ib_levels.includes(subject.ib_level)
          );
        });

        group.qualified_teachers = qualifiedTeachers;
        group.suggested_teacher_id = qualifiedTeachers[0]?.id;
      });

      setResults({
        total: proposedGroups.length,
        ready: proposedGroups.filter(g => g.status === 'ready').length,
        warnings: proposedGroups.filter(g => g.status === 'warning').length,
        groups: proposedGroups,
      });

    } catch (error) {
      console.error('Generation error:', error);
      setResults({ error: error.message });
    }

    setIsGenerating(false);
  };

  const createAllGroups = async () => {
    if (!results || !results.groups) return;

    const schoolId = schools[0]?.id;
    if (!schoolId) {
      alert('No school found');
      return;
    }

    const readyGroups = results.groups.filter(g => g.status === 'ready');
    
    const groupsToCreate = readyGroups.map(group => {
      const subject = subjects.find(s => s.id === group.subject_id);
      const hoursPerWeek = group.level === 'HL' 
        ? (subject?.hl_hours_per_week || 6) 
        : (subject?.sl_hours_per_week || 4);

      return {
        school_id: schoolId,
        name: `${group.subject_name} ${group.level} - ${group.year_group}${group.group_suffix ? ` Group ${group.group_suffix}` : ''}`,
        subject_id: group.subject_id,
        level: group.level,
        year_group: group.year_group,
        student_ids: group.student_ids,
        teacher_id: group.suggested_teacher_id,
        hours_per_week: hoursPerWeek,
        is_active: true,
      };
    });

    await createGroupsMutation.mutateAsync(groupsToCreate);
    setResults(null);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI Teaching Group Generator
        </CardTitle>
        <CardDescription>
          Automatically create teaching groups based on student subject choices
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!results ? (
          <>
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div>
                <p className="font-medium text-slate-900">Ready to generate</p>
                <p className="text-sm text-slate-500 mt-1">
                  {students.length} students • {subjects.length} subjects • {teachers.length} teachers
                </p>
              </div>
              <Button 
                onClick={generateGroups} 
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Groups
                  </>
                )}
              </Button>
            </div>

            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription className="text-sm">
                The AI will analyze student subject choices and create optimally-sized teaching groups with qualified teachers.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <>
            {results.error ? (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{results.error}</AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-medium text-emerald-900">Ready</p>
                    </div>
                    <p className="text-2xl font-bold text-emerald-700">{results.ready}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-medium text-amber-900">Warnings</p>
                    </div>
                    <p className="text-2xl font-bold text-amber-700">{results.warnings}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <p className="text-sm font-medium text-indigo-900">Total</p>
                    </div>
                    <p className="text-2xl font-bold text-indigo-700">{results.total}</p>
                  </div>
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
                  {results.groups.map((group, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border ${
                        group.status === 'ready' 
                          ? 'bg-white border-slate-200' 
                          : 'bg-amber-50 border-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">
                            {group.subject_name} {group.level} - {group.year_group}
                            {group.group_suffix && ` (Group ${group.group_suffix})`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {group.student_ids.length} students
                            </Badge>
                            {group.qualified_teachers && group.qualified_teachers.length > 0 && (
                              <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs">
                                {group.qualified_teachers.length} qualified teachers
                              </Badge>
                            )}
                          </div>
                          {group.message && (
                            <p className="text-xs text-amber-600 mt-1">{group.message}</p>
                          )}
                        </div>
                        {group.status === 'ready' ? (
                          <CheckCircle className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={createAllGroups}
                    disabled={createGroupsMutation.isPending || results.ready === 0}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {createGroupsMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Create {results.ready} Groups
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setResults(null)}
                    disabled={createGroupsMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>

                {results.warnings > 0 && (
                  <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                      {results.warnings} groups have warnings (too few students). These won't be created automatically but you can create them manually if needed.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}