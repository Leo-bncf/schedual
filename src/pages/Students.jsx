import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, GraduationCap, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import DataTable from '../components/ui-custom/DataTable';
import EmptyState from '../components/ui-custom/EmptyState';
import SubjectSelector from '../components/students/SubjectSelector';
import DPValidator from '../components/students/DPValidator';

export default function Students() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    student_id: '',
    ib_programme: 'DP',
    year_group: 'DP1',
    subject_choices: [],
    core_components: { tok_assigned: false, cas_assigned: false, ee_assigned: false },
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: students = [], isLoading } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }, '-created_date', 500),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.list(),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.Student.create({ ...data, school_id: schoolId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Student.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Student.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      student_id: '',
      ib_programme: 'DP',
      year_group: 'DP1',
      subject_choices: [],
      core_components: { tok_assigned: false, cas_assigned: false, ee_assigned: false },
      is_active: true
    });
    setEditingStudent(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      full_name: student.full_name || '',
      email: student.email || '',
      student_id: student.student_id || '',
      ib_programme: student.ib_programme || 'DP',
      year_group: student.year_group || 'DP1',
      classgroup_id: student.classgroup_id || '',
      subject_choices: student.subject_choices || [],
      core_components: student.core_components || { tok_assigned: false, cas_assigned: false, ee_assigned: false },
      is_active: student.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // For PYP/MYP students, sync subjects across entire ClassGroup
    if (formData.ib_programme === 'PYP' || formData.ib_programme === 'MYP') {
      try {
        // Save the current student first
        let savedStudentId;
        if (editingStudent) {
          await updateMutation.mutateAsync({ id: editingStudent.id, data: formData });
          savedStudentId = editingStudent.id;
        } else {
          const newStudent = await createMutation.mutateAsync(formData);
          savedStudentId = newStudent.id;
        }

        // Ensure classgroups exist
        await base44.functions.invoke('debugAndFixClassGroups');
        
        // Sync subjects to all students in the ClassGroup
        const syncResult = await base44.functions.invoke('syncClassGroupSubjects', {
          student_id: savedStudentId,
          subject_choices: formData.subject_choices
        });

        console.log('Sync result:', syncResult.data);

        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
        queryClient.invalidateQueries({ queryKey: ['classGroups'] });
        resetForm();
      } catch (error) {
        console.error('Error updating students:', error);
      }
    } else {
      // For DP students, just save normally with manual subject selection
      if (editingStudent) {
        updateMutation.mutate({ id: editingStudent.id, data: formData });
      } else {
        createMutation.mutate(formData);
      }
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_id?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesYear = yearFilter === 'all' || s.year_group === yearFilter;
    return matchesSearch && matchesYear;
  });

  const getSubjectInfo = (choices) => {
    if (!choices || !Array.isArray(choices)) return { hl: 0, sl: 0 };
    const hl = choices.filter(c => c.level === 'HL').length;
    const sl = choices.filter(c => c.level === 'SL').length;
    return { hl, sl };
  };

  const columns = [
    {
      header: 'Student',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-medium">
            {row.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.full_name}</p>
            <p className="text-sm text-slate-500">{row.student_id}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Email',
      accessor: 'email'
    },
    {
      header: 'Year',
      cell: (row) => (
        <Badge className={row.year_group === 'DP2' ? 'bg-violet-100 text-violet-700 border-0' : 'bg-blue-100 text-blue-700 border-0'}>
          {row.year_group}
        </Badge>
      )
    },
    {
      header: 'Subjects',
      cell: (row) => {
        if (row.ib_programme === 'DP') {
          const { hl, sl } = getSubjectInfo(row.subject_choices);
          return (
            <div className="flex gap-2">
              <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-0">
                {hl} HL
              </Badge>
              <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-0">
                {sl} SL
              </Badge>
            </div>
          );
        } else {
          // PYP/MYP students don't have HL/SL
          const subjectCount = row.subject_choices?.length || 0;
          return (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-0">
              {subjectCount} subjects
            </Badge>
          );
        }
      }
    },
    {
      header: 'Status',
      cell: (row) => (
        <Badge className={row.is_active !== false ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
          {row.is_active !== false ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      header: '',
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleEdit(row)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-rose-600"
              onClick={() => deleteMutation.mutate(row.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const dp1Count = students.filter(s => s.year_group === 'DP1').length;
  const dp2Count = students.filter(s => s.year_group === 'DP2').length;
  const mypCounts = {
    MYP1: students.filter(s => s.year_group === 'MYP1').length,
    MYP2: students.filter(s => s.year_group === 'MYP2').length,
    MYP3: students.filter(s => s.year_group === 'MYP3').length,
    MYP4: students.filter(s => s.year_group === 'MYP4').length,
    MYP5: students.filter(s => s.year_group === 'MYP5').length,
  };
  const pypCounts = {
    'PYP-A': students.filter(s => s.year_group === 'PYP-A').length,
    'PYP-B': students.filter(s => s.year_group === 'PYP-B').length,
    'PYP-C': students.filter(s => s.year_group === 'PYP-C').length,
    'PYP-D': students.filter(s => s.year_group === 'PYP-D').length,
    'PYP-E': students.filter(s => s.year_group === 'PYP-E').length,
    'PYP-F': students.filter(s => s.year_group === 'PYP-F').length,
  };
  const totalMYP = Object.values(mypCounts).reduce((a, b) => a + b, 0);
  const totalPYP = Object.values(pypCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Students"
        description="Manage IB Diploma students and their subject choices"
        actions={
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const confirmed = confirm('This will normalize all PYP student year groups from formats like "PYP_Class_A" to "PYP-A". Continue?');
                  if (!confirmed) return;
                  
                  const res = await base44.functions.invoke('normalizePYPYearGroups');
                  console.log('Normalization result:', res.data);
                  
                  if (res.data.success) {
                    alert(`✅ Successfully updated ${res.data.updated} out of ${res.data.total} PYP students.\n\nCheck the console for details.`);
                    queryClient.invalidateQueries({ queryKey: ['students'] });
                  } else {
                    alert('❌ Normalization failed. Check console for details.');
                  }
                } catch (error) {
                  console.error('Error normalizing:', error);
                  alert('❌ Error: ' + error.message);
                }
              }}
            >
              Fix PYP Classes
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search students..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={yearFilter} onValueChange={setYearFilter}>
          <TabsList className="bg-slate-100">
            <TabsTrigger value="all">All ({students.length})</TabsTrigger>
            <TabsTrigger value="DP1">DP1 ({dp1Count})</TabsTrigger>
            <TabsTrigger value="DP2">DP2 ({dp2Count})</TabsTrigger>
            <TabsTrigger value="MYP1">MYP1 ({mypCounts.MYP1})</TabsTrigger>
            <TabsTrigger value="MYP2">MYP2 ({mypCounts.MYP2})</TabsTrigger>
            <TabsTrigger value="MYP3">MYP3 ({mypCounts.MYP3})</TabsTrigger>
            <TabsTrigger value="MYP4">MYP4 ({mypCounts.MYP4})</TabsTrigger>
            <TabsTrigger value="MYP5">MYP5 ({mypCounts.MYP5})</TabsTrigger>
            <TabsTrigger value="PYP-A">PYP A ({pypCounts['PYP-A']})</TabsTrigger>
            <TabsTrigger value="PYP-B">PYP B ({pypCounts['PYP-B']})</TabsTrigger>
            <TabsTrigger value="PYP-C">PYP C ({pypCounts['PYP-C']})</TabsTrigger>
            <TabsTrigger value="PYP-D">PYP D ({pypCounts['PYP-D']})</TabsTrigger>
            <TabsTrigger value="PYP-E">PYP E ({pypCounts['PYP-E']})</TabsTrigger>
            <TabsTrigger value="PYP-F">PYP F ({pypCounts['PYP-F']})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredStudents.length === 0 && !isLoading ? (
        <EmptyState 
          icon={GraduationCap}
          title="No students yet"
          description="Add students and their IB subject choices."
          action={() => setIsDialogOpen(true)}
          actionLabel="Add Student"
        />
      ) : (
        <DataTable 
          columns={columns}
          data={filteredStudents}
          isLoading={isLoading}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update student information.' : 'Enter the details for the new student.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name *</Label>
                <Input 
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="student_id">Student ID</Label>
                <Input 
                  id="student_id"
                  value={formData.student_id}
                  onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ib_programme">IB Programme *</Label>
                <Select 
                  value={formData.ib_programme} 
                  onValueChange={(value) => {
                    const defaultYearGroups = {
                      'DP': 'DP1',
                      'MYP': 'MYP1',
                      'PYP': 'PYP-A'
                    };
                    setFormData({ 
                      ...formData, 
                      ib_programme: value,
                      year_group: defaultYearGroups[value]
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PYP">PYP (Primary Years)</SelectItem>
                    <SelectItem value="MYP">MYP (Middle Years)</SelectItem>
                    <SelectItem value="DP">DP (Diploma Programme)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="year_group">Year Group *</Label>
                <Select 
                  value={formData.year_group} 
                  onValueChange={(value) => setFormData({ ...formData, year_group: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.ib_programme === 'DP' && (
                      <>
                        <SelectItem value="DP1">DP1 (Year 1)</SelectItem>
                        <SelectItem value="DP2">DP2 (Year 2)</SelectItem>
                      </>
                    )}
                    {formData.ib_programme === 'MYP' && (
                      <>
                        <SelectItem value="MYP1">MYP1</SelectItem>
                        <SelectItem value="MYP2">MYP2</SelectItem>
                        <SelectItem value="MYP3">MYP3</SelectItem>
                        <SelectItem value="MYP4">MYP4</SelectItem>
                        <SelectItem value="MYP5">MYP5</SelectItem>
                      </>
                    )}
                    {formData.ib_programme === 'PYP' && (
                      <>
                        <SelectItem value="PYP-A">PYP A</SelectItem>
                        <SelectItem value="PYP-B">PYP B</SelectItem>
                        <SelectItem value="PYP-C">PYP C</SelectItem>
                        <SelectItem value="PYP-D">PYP D</SelectItem>
                        <SelectItem value="PYP-E">PYP E</SelectItem>
                        <SelectItem value="PYP-F">PYP F</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject Choices</Label>
              {(formData.ib_programme === 'PYP' || formData.ib_programme === 'MYP') && (
                <p className="text-xs text-blue-600 bg-blue-50 p-3 rounded border border-blue-200 mb-2">
                  ℹ️ Changes will sync to all students in the same ClassGroup
                </p>
              )}
              <SubjectSelector 
                subjects={subjects}
                selectedSubjects={formData.subject_choices}
                onChange={(choices) => setFormData({ ...formData, subject_choices: choices })}
                programme={formData.ib_programme}
              />
            </div>

            {formData.ib_programme === 'DP' && (
              <DPValidator 
                subjectChoices={formData.subject_choices}
                subjects={subjects}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingStudent ? 'Save Changes' : 'Add Student'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}