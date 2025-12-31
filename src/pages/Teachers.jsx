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
import { Plus, Search, Mail, Clock, BookOpen, MoreHorizontal, Pencil, Trash2, Upload, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import DataTable from '../components/ui-custom/DataTable';
import EmptyState from '../components/ui-custom/EmptyState';
import QualificationManager from '../components/teachers/QualificationManager';
import UploadProgressDialog from '../components/upload/UploadProgressDialog';
import DragDropUploadDialog from '../components/upload/DragDropUploadDialog';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function Teachers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    stage: 'uploading',
    progress: '',
    teachersCreated: 0,
    totalTeachers: 0,
    error: null
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    employee_id: '',
    max_hours_per_week: 25,
    max_consecutive_periods: 4,
    preferred_free_day: '',
    subjects: [],
    qualifications: [],
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.list(),
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
      return base44.entities.Teacher.create({ ...data, school_id: schoolId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Teacher.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Teacher.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      employee_id: '',
      max_hours_per_week: 25,
      max_consecutive_periods: 4,
      preferred_free_day: '',
      subjects: [],
      qualifications: [],
      is_active: true
    });
    setEditingTeacher(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      full_name: teacher.full_name || '',
      email: teacher.email || '',
      employee_id: teacher.employee_id || '',
      max_hours_per_week: teacher.max_hours_per_week || 25,
      max_consecutive_periods: teacher.max_consecutive_periods || 4,
      preferred_free_day: teacher.preferred_free_day || '',
      subjects: teacher.subjects || [],
      qualifications: teacher.qualifications || [],
      is_active: teacher.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTeacher) {
      updateMutation.mutate({ id: editingTeacher.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredTeachers = teachers.filter(t => 
    t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getSubjectNames = (subjectIds) => {
    if (!subjectIds || !Array.isArray(subjectIds)) return [];
    return subjectIds.map(id => subjects.find(s => s.id === id)?.name).filter(Boolean);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!schoolId) {
      alert('No school assigned. Please set up your school in Settings first.');
      return;
    }

    setUploadState({
      isUploading: true,
      stage: 'uploading',
      progress: 'Uploading file...',
      teachersCreated: 0,
      totalTeachers: 0,
      error: null
    });

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setUploadState(prev => ({ ...prev, stage: 'extracting', progress: 'Extracting teacher data...' }));

      const extractionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all teachers from this document. For each teacher, provide:
- full_name, email, employee_id (if available)
- max_hours_per_week (as number, default 25 if not specified)
- subjects: array of subject names they teach (e.g., ["Physics", "Chemistry"])
- ib_levels: array of IB programme levels they can teach (PYP, MYP, and/or DP)

Example: {"full_name": "John Smith", "email": "john@school.com", "subjects": ["Physics", "Chemistry"], "ib_levels": ["DP"]}`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            teachers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  full_name: { type: "string" },
                  email: { type: "string" },
                  employee_id: { type: "string" },
                  max_hours_per_week: { type: "number" },
                  subjects: {
                    type: "array",
                    items: { type: "string" }
                  },
                  ib_levels: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["full_name", "email"]
              }
            }
          }
        }
      });

      const teachersData = extractionResult?.teachers || [];

      if (teachersData.length === 0) {
        throw new Error('No teachers found in the document');
      }

      setUploadState(prev => ({ ...prev, stage: 'creating', totalTeachers: teachersData.length, progress: `Creating ${teachersData.length} teachers...` }));

      // Fetch all subjects to match names to IDs
      const allSubjects = await base44.entities.Subject.list();

      const teachersToCreate = teachersData.map(teacher => {
        // Match subject names to IDs with improved fuzzy matching
        const subjectIds = [];
        const qualifications = [];

        if (teacher.subjects && Array.isArray(teacher.subjects)) {
          teacher.subjects.forEach(subjectName => {
            const normalizedSubject = subjectName?.toLowerCase().trim();

            // Improved matching logic with specific acronym handling
            const matchedSubject = allSubjects.find(s => {
              const normalizedName = s.name?.toLowerCase().trim();
              const normalizedCode = s.code?.toLowerCase().trim();

              // Exact match
              if (normalizedName === normalizedSubject || normalizedCode === normalizedSubject) {
                return true;
              }

              // Handle common acronyms and variations
              if ((normalizedSubject === 'tok' || normalizedSubject === 'theory of knowledge') && 
                  (normalizedName.includes('tok') || normalizedName.includes('theory of knowledge'))) {
                return true;
              }
              if ((normalizedSubject === 'ee' || normalizedSubject === 'extended essay') && 
                  (normalizedName.includes('extended essay') || normalizedCode === 'ee')) {
                return true;
              }
              if (normalizedSubject === 'cas' && (normalizedName.includes('cas') || normalizedCode === 'cas')) {
                return true;
              }

              // Partial match (contains)
              return normalizedName.includes(normalizedSubject) || 
                     normalizedSubject.includes(normalizedName) ||
                     (normalizedCode && normalizedCode.includes(normalizedSubject));
            });

            if (matchedSubject) {
              subjectIds.push(matchedSubject.id);

              // Build qualifications based on extracted IB levels
              const teacherLevels = teacher.ib_levels || ['DP'];
              qualifications.push({
                subject_id: matchedSubject.id,
                ib_levels: teacherLevels
              });
            }
          });
        }

        return {
          school_id: schoolId,
          full_name: teacher.full_name,
          email: teacher.email,
          employee_id: teacher.employee_id || '',
          subjects: subjectIds,
          qualifications: qualifications,
          max_hours_per_week: teacher.max_hours_per_week || 25,
          max_consecutive_periods: 4,
          unavailable_slots: [],
          is_active: true
        };
      });

      // Batch create with error handling
      const batchSize = 10;
      let created = 0;
      
      for (let i = 0; i < teachersToCreate.length; i += batchSize) {
        const batch = teachersToCreate.slice(i, i + batchSize);
        
        try {
          await base44.entities.Teacher.bulkCreate(batch);
          created += batch.length;
          
          setUploadState(prev => ({ 
            ...prev, 
            teachersCreated: created,
            progress: `Created ${created} of ${teachersData.length} teachers...`
          }));
          
          // Small delay between batches to avoid rate limits
          if (i + batchSize < teachersToCreate.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error('Batch creation error:', error);
          // Continue with next batch even if one fails
        }
      }

      setUploadState(prev => ({ 
        ...prev, 
        stage: 'complete',
        progress: `Successfully created ${created} teachers!`
      }));

      setTimeout(() => {
        setUploadState({
          isUploading: false,
          stage: 'uploading',
          progress: '',
          teachersCreated: 0,
          totalTeachers: 0,
          error: null
        });
        queryClient.invalidateQueries({ queryKey: ['teachers'] });
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        stage: 'uploading',
        progress: '',
        teachersCreated: 0,
        totalTeachers: 0,
        error: error?.message || 'An unknown error occurred'
      });
      alert('Failed to process file: ' + (error?.message || 'Unknown error'));
    }
  };

  const columns = [
    {
      header: 'Name',
      cell: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-medium">
            {row.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="font-medium text-slate-900">{row.full_name}</p>
            <p className="text-sm text-slate-500">{row.employee_id}</p>
          </div>
        </div>
      )
    },
    {
      header: 'Email',
      cell: (row) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Mail className="w-4 h-4 text-slate-400" />
          {row.email}
        </div>
      )
    },
    {
      header: 'Subjects',
      cell: (row) => {
        const subjectNames = getSubjectNames(row.subjects);
        return (
          <div className="flex flex-wrap gap-1">
            {subjectNames.slice(0, 2).map((name, i) => (
              <Badge key={i} variant="secondary" className="bg-indigo-50 text-indigo-700 border-0">
                {name}
              </Badge>
            ))}
            {subjectNames.length > 2 && (
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0">
                +{subjectNames.length - 2}
              </Badge>
            )}
          </div>
        );
      }
    },
    {
      header: 'Workload',
      cell: (row) => (
        <div className="flex items-center gap-2 text-slate-600">
          <Clock className="w-4 h-4 text-slate-400" />
          {row.max_hours_per_week || 25}h/week
        </div>
      )
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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Teachers"
        description="Manage teaching staff and their scheduling preferences"
        actions={
          <div className="flex gap-2">
            <Button 
              type="button"
              variant="outline"
              onClick={() => setShowUploadDialog(true)}
              disabled={uploadState.isUploading}
            >
              {uploadState.isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {uploadState.progress || 'Processing...'}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Document
                </>
              )}
            </Button>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </motion.div>
          </div>
        }
      />

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          ⚠️ <strong>AI Import Notice:</strong> The AI document reader is a tool to speed up data entry but isn't perfect. Always verify all imported information for accuracy before using it in scheduling.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search teachers..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredTeachers.length === 0 && !isLoading ? (
        <EmptyState 
          icon={BookOpen}
          title="No teachers yet"
          description="Add your first teacher to start building the schedule."
          action={() => setIsDialogOpen(true)}
          actionLabel="Add Teacher"
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-52 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filteredTeachers.map((teacher, index) => (
            <motion.div
              key={teacher.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="group hover:shadow-xl transition-all duration-300 border-slate-200 overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-br from-indigo-50 to-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                        {teacher.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold text-slate-900">{teacher.full_name}</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">{teacher.employee_id}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(teacher)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-rose-600"
                          onClick={() => deleteMutation.mutate(teacher.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600 truncate">{teacher.email}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span>{teacher.max_hours_per_week || 25}h/week</span>
                    </div>
                    <Badge className={teacher.is_active !== false ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
                      {teacher.is_active !== false ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {teacher.subjects && teacher.subjects.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs font-medium text-slate-500 mb-2">Subjects</p>
                      <div className="flex flex-wrap gap-1.5">
                        {getSubjectNames(teacher.subjects).slice(0, 3).map((name, i) => (
                          <Badge key={i} variant="secondary" className="bg-indigo-50 text-indigo-700 border-0 text-xs">
                            {name}
                          </Badge>
                        ))}
                        {getSubjectNames(teacher.subjects).length > 3 && (
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs">
                            +{getSubjectNames(teacher.subjects).length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {isDialogOpen && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto" asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
          <DialogHeader>
            <DialogTitle className="text-2xl">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</DialogTitle>
            <DialogDescription>
              {editingTeacher ? 'Update teacher information and preferences.' : 'Enter the details for the new teacher.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-sm font-semibold text-slate-700">Full Name *</Label>
                  <Input 
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Smith"
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee_id" className="text-sm font-semibold text-slate-700">Employee ID</Label>
                  <Input 
                    id="employee_id"
                    value={formData.employee_id}
                    onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                    placeholder="EMP-001"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email *</Label>
                <Input 
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="teacher@school.com"
                  className="h-11"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_hours" className="text-sm font-semibold text-slate-700">Max Hours/Week</Label>
                  <Input 
                    id="max_hours"
                    type="number"
                    min="1"
                    max="40"
                    value={formData.max_hours_per_week}
                    onChange={(e) => setFormData({ ...formData, max_hours_per_week: parseInt(e.target.value) || 25 })}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferred_free_day" className="text-sm font-semibold text-slate-700">Preferred Free Day</Label>
                  <Select 
                    value={formData.preferred_free_day || ""} 
                    onValueChange={(value) => setFormData({ ...formData, preferred_free_day: value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      {DAYS.map(day => (
                        <SelectItem key={day} value={day}>{day}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <QualificationManager 
                subjects={subjects}
                qualifications={formData.qualifications}
                onChange={(quals) => setFormData({ ...formData, qualifications: quals })}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={resetForm} className="h-11">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 h-11 shadow-lg"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingTeacher ? 'Save Changes' : 'Add Teacher'
                )}
              </Button>
            </DialogFooter>
          </form>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      <UploadProgressDialog 
        open={uploadState.isUploading}
        stage={uploadState.stage}
        progress={uploadState.progress}
        current={uploadState.teachersCreated}
        total={uploadState.totalTeachers}
        entityType="Teachers"
      />

      <DragDropUploadDialog 
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={(file) => {
          setShowUploadDialog(false);
          handleFileUpload(file);
        }}
        title="Import Teachers"
        description="Upload a document or paste to extract teacher data"
      />
    </div>
  );
}