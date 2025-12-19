import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Users, MoreHorizontal, Pencil, Trash2, User, BookOpen } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import GroupBuilder from '../components/teachingGroups/GroupBuilder';
import EmptyState from '../components/ui-custom/EmptyState';

export default function TeachingGroups() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const queryClient = useQueryClient();

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['teachingGroups'],
    queryFn: () => base44.entities.TeachingGroup.list(),
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

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => base44.entities.Room.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TeachingGroup.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      setIsDialogOpen(false);
      setEditingGroup(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TeachingGroup.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      setIsDialogOpen(false);
      setEditingGroup(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TeachingGroup.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachingGroups'] }),
  });

  const handleEdit = (group) => {
    setEditingGroup(group);
    setIsDialogOpen(true);
  };

  const handleSubmit = (data) => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || g.level === levelFilter;
    const matchesYear = yearFilter === 'all' || g.year_group === yearFilter;
    return matchesSearch && matchesLevel && matchesYear;
  });

  const getSubjectInfo = (subjectId) => subjects.find(s => s.id === subjectId);
  const getTeacherInfo = (teacherId) => teachers.find(t => t.id === teacherId);

  const hlGroups = filteredGroups.filter(g => g.level === 'HL');
  const slGroups = filteredGroups.filter(g => g.level === 'SL');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Teaching Groups"
        description="Organize students into class sections by subject and level"
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            Create Group
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search groups..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={levelFilter} onValueChange={setLevelFilter}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all">All ({groups.length})</TabsTrigger>
            <TabsTrigger value="HL">HL ({hlGroups.length})</TabsTrigger>
            <TabsTrigger value="SL">SL ({slGroups.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={yearFilter} onValueChange={setYearFilter}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all">All Years</TabsTrigger>
            <TabsTrigger value="DP1">DP1</TabsTrigger>
            <TabsTrigger value="DP2">DP2</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredGroups.length === 0 && !isLoading ? (
        <EmptyState 
          icon={Users}
          title="No teaching groups yet"
          description="Create teaching groups to organize students by subject and level."
          action={() => setIsDialogOpen(true)}
          actionLabel="Create Group"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.map(group => {
            const subject = getSubjectInfo(group.subject_id);
            const teacher = getTeacherInfo(group.teacher_id);
            const studentCount = group.student_ids?.length || 0;

            return (
              <Card key={group.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-900">{group.name}</h3>
                        <Badge className={
                          group.level === 'HL' 
                            ? 'bg-rose-100 text-rose-700 border-0' 
                            : 'bg-amber-100 text-amber-700 border-0'
                        }>
                          {group.level}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <BookOpen className="w-4 h-4" />
                        <span>{subject?.name || 'Unknown Subject'}</span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(group)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-rose-600"
                          onClick={() => deleteMutation.mutate(group.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <User className="w-4 h-4 text-slate-400" />
                      <span>{teacher?.full_name || 'No teacher assigned'}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>
                        {studentCount} / {group.max_students} students
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-100">
                      <Badge variant="outline" className="text-slate-600">
                        {group.year_group}
                      </Badge>
                      <span className="text-sm text-slate-500">
                        {group.hours_per_week}h/week
                      </span>
                    </div>

                    {studentCount < group.min_students && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200">
                        <p className="text-xs text-amber-700">
                          ⚠️ Below minimum ({group.min_students} students needed)
                        </p>
                      </div>
                    )}

                    {studentCount > group.max_students && (
                      <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200">
                        <p className="text-xs text-rose-700">
                          ⚠️ Over capacity
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDialogOpen(false);
          setEditingGroup(null);
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? 'Edit Teaching Group' : 'Create New Teaching Group'}
            </DialogTitle>
            <DialogDescription>
              {editingGroup 
                ? 'Update the teaching group details and student assignments.' 
                : 'Set up a new teaching group for a specific subject and level.'
              }
            </DialogDescription>
          </DialogHeader>
          <GroupBuilder 
            subjects={subjects}
            teachers={teachers}
            students={students}
            rooms={rooms}
            initialData={editingGroup}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}