import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Upload, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import PageHeader from '../components/ui-custom/PageHeader';
import EmptyState from '../components/ui-custom/EmptyState';
import QualificationManager from '../components/teachers/QualificationManager';
import TeachersToolbar from '@/components/teachers/TeachersToolbar';
import TeacherCardGrid from '@/components/teachers/TeacherCardGrid';
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

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('secureSchool', { action: 'get' });
      if (data?.success === false) throw new Error(data.error || 'Failed to load school');
      return data?.data ? [data.data] : [];
    },
  });

  const schoolId = schools[0]?.id || user?.school_id || user?.data?.school_id;

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.Teacher.create({ ...data, school_id: schoolId });
    },
    onSuccess: (created) => {
      toast.success(`${created?.full_name || 'Teacher'} added successfully`);
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
      resetForm();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to save teacher');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Teacher.update(id, data),
    onSuccess: () => {
      toast.success('Teacher updated successfully');
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
      resetForm();
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to update teacher');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Teacher.delete(id),
    onSuccess: () => {
      toast.success('Teacher deleted');
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
    },
    onError: (error) => {
      toast.error(error?.message || 'Failed to delete teacher');
    }
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
      toast.error('No school assigned. Please configure your school in Settings first.');
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

      // Fetch training data to improve extraction
      const trainingData = await base44.entities.AITrainingData.filter({
        agent_name: 'teacher_importer',
        overall_status: 'approved'
      }).catch(() => []);

      const trainingFeedback = trainingData.slice(0, 3).map(t => {
        const corrections = Object.entries(t.field_feedback || {})
          .filter(([_, f]) => !f.correct && f.notes)
          .map(([field, f]) => `- ${field}: ${f.notes}`)
          .join('\n');
        return corrections;
      }).filter(Boolean).join('\n\n');

      const extractionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all teachers from this document. For each teacher, provide:
- full_name, email, employee_id (if available)
- max_hours_per_week (as number, default 25 if not specified)
- subjects: array of subject names they teach (e.g., ["Physics", "Chemistry"])
- ib_levels: array of IB programme levels they can teach (PYP, MYP, and/or DP)

IMPORTANT SUBJECT RULES:
- In MYP, there are NO separate Geography or History classes. If a teacher's description mentions Geography or History, they teach "Individuals & Societies"
- In MYP, there are NO separate Chemistry, Biology, or Physics classes. If a teacher's description mentions Chemistry, Biology, or Physics for MYP, they teach "Sciences"
- In MYP Design subjects: If the document specifically mentions "Digital Design", use "Digital Design". If it specifically mentions "Product Design", use "Product Design". If it just says "Design" without specifying, use "Design" (which can cover both digital and product design). Schools can offer Digital Design only, Product Design only, both as separate classes, or one unified Design class.
- In PYP and MYP, there are NO Math levels (no HL/SL). There is only one type of Math for all PYP and MYP year levels
- Only DP (Diploma Programme) has subject levels like HL/SL
- If a teacher is described as a homeroom teacher, class teacher, or form teacher for PYP, add "Homeroom" to their subjects

${trainingFeedback ? `LESSONS FROM ADMIN FEEDBACK:\n${trainingFeedback}\n\n` : ''}

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
      const allSubjects = await base44.entities.Subject.filter({ school_id: schoolId });

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
      toast.error(error?.message || 'Failed to process file');
    }
  };


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
              <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 h-10 font-medium transition-all shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Teacher
              </Button>
            </motion.div>
          </div>
        }
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>AI Import Notice:</strong> The AI document reader is a tool to speed up data entry but isn't perfect. Always verify all imported information for accuracy before using it in scheduling.
        </p>
      </div>

      <TeachersToolbar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

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
        <TeacherCardGrid
          teachers={filteredTeachers}
          getSubjectNames={getSubjectNames}
          onEdit={handleEdit}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    onValueChange={(value) => setFormData({ ...formData, preferred_free_day: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
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
                onChange={(quals) => {
                  // Update qualifications
                  setFormData({ ...formData, qualifications: quals });
                  
                  // Sync subjects array with qualifications
                  const subjectIds = quals.map(q => q.subject_id);
                  setFormData(prev => ({ ...prev, subjects: subjectIds, qualifications: quals }));
                }}
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
        </DialogContent>
      </Dialog>

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