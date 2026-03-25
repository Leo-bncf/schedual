import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Search, BookOpen, MoreHorizontal, Pencil, Trash2, FlaskConical, Palette, Calculator, Globe, Languages, FileText, Upload, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PageHeader from '../components/ui-custom/PageHeader';
import EmptyState from '../components/ui-custom/EmptyState';
import UploadProgressDialog from '../components/upload/UploadProgressDialog';
import DragDropUploadDialog from '../components/upload/DragDropUploadDialog';

const IB_GROUPS = [
  { id: 1, name: 'Language & Literature', icon: FileText, color: 'bg-blue-500' },
  { id: 2, name: 'Language Acquisition', icon: Languages, color: 'bg-teal-500' },
  { id: 3, name: 'Individuals & Societies', icon: Globe, color: 'bg-purple-500' },
  { id: 4, name: 'Sciences', icon: FlaskConical, color: 'bg-violet-500' },
  { id: 5, name: 'Mathematics', icon: Calculator, color: 'bg-rose-500' },
  { id: 6, name: 'The Arts', icon: Palette, color: 'bg-pink-500' },
];

export default function Subjects() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    stage: 'uploading',
    progress: '',
    subjectsCreated: 0,
    totalSubjects: 0,
    error: null
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    ib_level: 'DP',
    ib_group: 1,
    ib_group_name: 'Language & Literature',
    available_levels: ['HL', 'SL'],
    hoursPerWeekHL: 6,
    hoursPerWeekSL: 4,
    standard_hours_per_week: 2,
    sessions_per_week: 0,
    hours_per_session: 0,
    supervisor_teacher_id: 'none',
    pyp_myp_hours_per_week: 3,
    requires_lab: false,
    requires_special_room: '',
    is_core: false,
    combine_dp1_dp2: false,
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: schoolRecords = [] } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => base44.entities.School.filter({ id: schoolId }),
    enabled: !!schoolId,
  });
  const school = schoolRecords[0];

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const specialDpCodes = new Set(['TOK', 'EE', 'TEST']);
  const getSubjectCode = (value = '') => String(value).trim().toUpperCase();
  const isSpecialDpSubject = (subjectOrCode) => {
    const code = typeof subjectOrCode === 'string' ? subjectOrCode : subjectOrCode?.code;
    return specialDpCodes.has(getSubjectCode(code));
  };

  const getAllowedProgrammes = (s) => {
    const tier = s?.subscription_tier;
    if (tier === 'tier1') return ['MYP'];
    if (tier === 'tier2' || tier === 'tier3') return ['PYP','MYP','DP'];
    return ['PYP','MYP','DP'];
  };
  const allowedProgrammes = getAllowedProgrammes(school);
  const normalizedFormCode = getSubjectCode(formData.code);
  const isCurrentSpecialDp = formData.ib_level === 'DP' && isSpecialDpSubject(normalizedFormCode);
  const canCombineDpYears = formData.ib_level === 'DP' && (!isCurrentSpecialDp || normalizedFormCode === 'TEST');

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.list(),
    enabled: !!schoolId,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.Subject.create({ ...data, school_id: schoolId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] });
      resetForm();
    },
    onError: (error) => {
      console.error('Create subject error:', error);
      alert('Failed to create subject: ' + (error.message || 'Unknown error'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] });
      resetForm();
    },
    onError: (error) => {
      console.error('Update subject error:', error);
      alert('Failed to update subject: ' + (error.message || 'Unknown error'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] }),
    onError: (error) => {
      console.error('Delete subject error:', error);
      alert('Failed to delete subject: ' + (error.message || 'Unknown error'));
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      ib_level: 'DP',
      ib_group: 1,
      ib_group_name: 'Language & Literature',
      available_levels: ['HL', 'SL'],
      hoursPerWeekHL: 6,
      hoursPerWeekSL: 4,
      standard_hours_per_week: 2,
      sessions_per_week: 0,
      hours_per_session: 0,
      supervisor_teacher_id: 'none',
      pyp_myp_hours_per_week: 3,
      requires_lab: false,
      requires_special_room: '',
      combine_dp1_dp2: false,
      is_active: true
    });
    setEditingSubject(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      ib_level: subject.ib_level || 'DP',
      ib_group: subject.ib_group || 1,
      ib_group_name: subject.ib_group_name || 'Language & Literature',
      available_levels: subject.available_levels || ['HL', 'SL'],
      hoursPerWeekHL: subject.hoursPerWeekHL || (subject.hl_minutes_per_week_default ? Math.round(subject.hl_minutes_per_week_default / 60) : 6),
      hoursPerWeekSL: subject.hoursPerWeekSL || (subject.sl_minutes_per_week_default ? Math.round(subject.sl_minutes_per_week_default / 60) : 4),
      standard_hours_per_week: subject.standard_hours_per_week || ((subject.sessions_per_week && subject.hours_per_session) ? subject.sessions_per_week * subject.hours_per_session : 2),
      sessions_per_week: subject.sessions_per_week || 0,
      hours_per_session: subject.hours_per_session || 0,
      supervisor_teacher_id: subject.supervisor_teacher_id || 'none',
      pyp_myp_hours_per_week: subject.pyp_myp_minutes_per_week_default ? Math.round(subject.pyp_myp_minutes_per_week_default / 60) : 3,
      requires_lab: subject.requires_lab || false,
      requires_special_room: subject.requires_special_room || '',
      combine_dp1_dp2: subject.combine_dp1_dp2 || false,
      is_core: subject.is_core || isSpecialDpSubject(subject),
      is_active: subject.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const normalizedCode = getSubjectCode(formData.code);
    const isSpecialDp = formData.ib_level === 'DP' && isSpecialDpSubject(normalizedCode);

    if (formData.ib_level === 'DP' && !isSpecialDp) {
      const hlHours = parseFloat(formData.hoursPerWeekHL) || 0;
      const slHours = parseFloat(formData.hoursPerWeekSL) || 0;

      if (hlHours <= 0 || slHours <= 0) {
        alert('DP subjects require both HL and SL hours to be greater than 0 for schedule generation.');
        return;
      }
    }

    const hasSpecialWeeklyHours = Number(formData.standard_hours_per_week || 0) > 0;
    const hasSpecialSessionPattern = Number(formData.sessions_per_week || 0) > 0 && Number(formData.hours_per_session || 0) > 0;

    if (isSpecialDp && !hasSpecialWeeklyHours && !hasSpecialSessionPattern) {
      alert('Special DP subjects need either hours per week or a sessions-per-week pattern.');
      return;
    }

    const group = IB_GROUPS.find(g => g.id === formData.ib_group);
    const data = {
      ...formData,
      code: normalizedCode,
      supervisor_teacher_id: formData.supervisor_teacher_id === 'none' ? '' : formData.supervisor_teacher_id,
      pyp_myp_minutes_per_week_default: formData.pyp_myp_hours_per_week * 60
    };

    if (isSpecialDp) {
      data.is_core = true;
      data.available_levels = [];
      data.ib_group = undefined;
      data.ib_group_name = undefined;
      data.hoursPerWeekHL = 0;
      data.hoursPerWeekSL = 0;
      data.hl_minutes_per_week_default = 0;
      data.sl_minutes_per_week_default = 0;
      data.standard_hours_per_week = hasSpecialWeeklyHours
        ? Number(formData.standard_hours_per_week || 0)
        : Number(formData.sessions_per_week || 0) * Number(formData.hours_per_session || 0);
      data.combine_dp1_dp2 = normalizedCode === 'TEST' ? !!formData.combine_dp1_dp2 : false;
    } else if (formData.ib_level === 'DP') {
      data.is_core = false;
      data.ib_group = String(formData.ib_group);
      data.ib_group_name = group?.name || '';
      data.hoursPerWeekHL = formData.hoursPerWeekHL;
      data.hoursPerWeekSL = formData.hoursPerWeekSL;
      data.hl_minutes_per_week_default = formData.hoursPerWeekHL * 60;
      data.sl_minutes_per_week_default = formData.hoursPerWeekSL * 60;
      data.standard_hours_per_week = 0;
      data.sessions_per_week = 0;
      data.hours_per_session = 0;
    } else {
      data.is_core = false;
      data.available_levels = [];
      data.hoursPerWeekHL = 0;
      data.hoursPerWeekSL = 0;
      data.hl_minutes_per_week_default = 0;
      data.sl_minutes_per_week_default = 0;
      data.standard_hours_per_week = 0;
      data.sessions_per_week = 0;
      data.hours_per_session = 0;
      data.supervisor_teacher_id = '';
    }

    delete data.pyp_myp_hours_per_week;

    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredSubjects = subjects.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedSubjects = IB_GROUPS.map(group => ({
    ...group,
    subjects: filteredSubjects.filter(s => String(s.ib_group) === String(group.id) && s.ib_level === 'DP' && !isSpecialDpSubject(s))
  }));

  const specialDpSubjects = filteredSubjects.filter((s) => s.ib_level === 'DP' && isSpecialDpSubject(s));
  const pypSubjects = filteredSubjects.filter(s => s.ib_level === 'PYP');
  const mypSubjects = filteredSubjects.filter(s => s.ib_level === 'MYP');

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
      subjectsCreated: 0,
      totalSubjects: 0,
      error: null
    });

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setUploadState(prev => ({ ...prev, stage: 'extracting', progress: 'Extracting subject data...' }));

      // Fetch training data to improve extraction
      const trainingData = await base44.entities.AITrainingData.filter({
        agent_name: 'subject_importer',
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
        prompt: `Extract all subjects/classes from this document. For each subject, provide:
- name, code, ib_level (one of: DP, MYP, PYP)
- For DP subjects: ib_group (string: "1", "2", "3", "4", "5", or "6") and available_levels (array of HL and/or SL)
- For PYP/MYP subjects: pyp_myp_hours_per_week (number, default 4 if not specified)
  Look for phrases like "4 periods per week", "5 hours weekly", "3h/week" to extract teaching hours

${trainingFeedback ? `LESSONS FROM ADMIN FEEDBACK:\n${trainingFeedback}\n\n` : ''}`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            subjects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  code: { type: "string" },
                  ib_level: { type: "string" },
                  ib_group: { type: "string" },
                  available_levels: { type: "array", items: { type: "string" } },
                  pyp_myp_hours_per_week: { type: "number" }
                },
                required: ["name", "code", "ib_level"]
              }
            }
          }
        }
      });

      const subjectsData = extractionResult?.subjects || [];
      const filteredSubjectsData = subjectsData.filter(s => allowedProgrammes.includes(s.ib_level));

      if (subjectsData.length === 0) {
        throw new Error('No subjects found in the document');
      }

      setUploadState(prev => ({ ...prev, stage: 'creating', totalSubjects: filteredSubjectsData.length, progress: `Creating ${filteredSubjectsData.length} subjects...` }));

      let created = 0;
      for (const subject of filteredSubjectsData) {
        const ibGroupStr = subject.ib_group || "1";
        const group = IB_GROUPS.find(g => g.id === parseInt(ibGroupStr));
        
        await base44.entities.Subject.create({
        school_id: schoolId,
        name: subject.name,
        code: subject.code,
        ib_level: subject.ib_level,
        ib_group: ibGroupStr,
        ib_group_name: group?.name || 'Language & Literature',
        available_levels: subject.available_levels || ['HL', 'SL'],
        hl_minutes_per_week_default: 300,
        sl_minutes_per_week_default: 180,
        pyp_myp_minutes_per_week_default: (subject.pyp_myp_hours_per_week || 3) * 60,
        requires_lab: false,
        is_active: true
        });

        created++;
        setUploadState(prev => ({ 
          ...prev, 
          subjectsCreated: created,
          progress: `Created ${created} of ${filteredSubjectsData.length} subjects...`
        }));
      }

      setUploadState(prev => ({ 
        ...prev, 
        stage: 'complete',
        progress: `Successfully created ${created} subjects!`
      }));

      setTimeout(() => {
        setUploadState({
          isUploading: false,
          stage: 'uploading',
          progress: '',
          subjectsCreated: 0,
          totalSubjects: 0,
          error: null
        });
        queryClient.invalidateQueries({ queryKey: ['subjects', schoolId] });
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        stage: 'uploading',
        progress: '',
        subjectsCreated: 0,
        totalSubjects: 0,
        error: error?.message || 'An unknown error occurred'
      });
      alert('Failed to process file: ' + (error?.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Subjects"
        description="Manage IB Programme subjects; features shown depend on your plan"
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
                Add Subject
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

      {school && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6">
          <p className="text-sm text-slate-700">
            Your plan: <strong>{(school.subscription_tier || 'unknown').toUpperCase()}</strong>. Enabled programmes: {allowedProgrammes.join(', ')}.
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search subjects..." 
            className="pl-10 h-11 bg-white border-slate-200 shadow-sm rounded-xl"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>



      {subjects.length === 0 && !isLoading ? (
        <EmptyState 
          icon={BookOpen}
          title="No subjects yet"
          description="Add IB subjects to start creating teaching groups."
          action={() => setIsDialogOpen(true)}
          actionLabel="Add Subject"
        />
      ) : (
        <div className="space-y-8">
          {/* PYP Subjects (gated) */}
          {allowedProgrammes.includes('PYP') && pypSubjects.length > 0 && (
            <div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 mb-6"
              >
                <div className="flex items-center gap-3 flex-1">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-xl"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <BookOpen className="w-7 h-7 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                      PYP Programme
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Primary Years subjects</p>
                  </div>
                </div>
                <Badge className="bg-teal-500 text-white border-0 shadow-md text-base px-4 py-1">
                  {pypSubjects.length} subjects
                </Badge>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {pypSubjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  >
                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden h-full flex flex-col">
                      <div className="h-1 w-full bg-teal-500" />
                      <CardContent className="p-5 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-900 text-base truncate">{subject.name}</p>
                              <p className="text-xs text-slate-500 truncate">{subject.code}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                                <MoreHorizontal className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(subject)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-rose-600" onClick={() => deleteMutation.mutate(subject.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div className="flex items-center gap-2 text-slate-500">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-sm">{subject.pyp_myp_hours_per_week || 4}h/week</span>
                          </div>
                          <Badge className="bg-teal-500 text-white border-0 font-medium">
                            PYP
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* MYP Subjects (always for tier1+) */}
          {allowedProgrammes.includes('MYP') && mypSubjects.length > 0 && (
            <div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 mb-6"
              >
                <div className="flex items-center gap-3 flex-1">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-xl"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <BookOpen className="w-7 h-7 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                      MYP Programme
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Middle Years subjects</p>
                  </div>
                </div>
                <Badge className="bg-purple-500 text-white border-0 shadow-md text-base px-4 py-1">
                  {mypSubjects.length} subjects
                </Badge>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {mypSubjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  >
                    <Card className="border border-slate-200 shadow-sm bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden h-full flex flex-col">
                      <div className="h-1 w-full bg-purple-500" />
                      <CardContent className="p-5 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-900 text-base truncate">{subject.name}</p>
                              <p className="text-xs text-slate-500 truncate">{subject.code}</p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                                <MoreHorizontal className="w-4 h-4 text-slate-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(subject)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-rose-600" onClick={() => deleteMutation.mutate(subject.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div className="flex items-center gap-2 text-slate-500">
                            <BookOpen className="w-4 h-4" />
                            <span className="text-sm">{subject.pyp_myp_hours_per_week || 4}h/week</span>
                          </div>
                          <Badge className="bg-purple-500 text-white border-0 font-medium">
                            MYP
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}



          {/* DP Special Subjects */}
          {allowedProgrammes.includes('DP') && specialDpSubjects.length > 0 && (
            <div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-4 mb-6"
              >
                <div className="flex items-center gap-3 flex-1">
                  <motion.div 
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shadow-xl"
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <Sparkles className="w-7 h-7 text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">Core & Assessment</h3>
                    <p className="text-sm text-slate-500 mt-1">TOK, EE, and Exam Time</p>
                  </div>
                </div>
                <Badge className="bg-slate-800 text-white border-0 shadow-md text-base px-4 py-1">
                  {specialDpSubjects.length} subjects
                </Badge>
              </motion.div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {specialDpSubjects.map((subject, index) => {
                  const assignedTeacher = teachers.find((teacher) => teacher.id === subject.supervisor_teacher_id);
                  return (
                    <motion.div
                      key={subject.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    >
                      <Card className="border border-slate-200 shadow-sm bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden h-full flex flex-col">
                        <div className="h-1 w-full bg-slate-800" />
                        <CardContent className="p-5 flex-1 flex flex-col">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 text-base truncate">{subject.name}</p>
                                <p className="text-xs text-slate-500 truncate">{subject.code}</p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(subject)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-rose-600" onClick={() => deleteMutation.mutate(subject.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-4">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">
                              {subject.standard_hours_per_week || (Number(subject.sessions_per_week || 0) * Number(subject.hours_per_session || 0)) || 0}h/week
                            </Badge>
                            {Number(subject.sessions_per_week || 0) > 0 && Number(subject.hours_per_session || 0) > 0 && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">
                                {subject.sessions_per_week}× {subject.hours_per_session}h
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-2">
                            <div className="flex items-center gap-2 text-slate-500 min-w-0">
                              <BookOpen className="w-4 h-4" />
                              <span className="text-sm truncate">{assignedTeacher?.full_name || 'No teacher set'}</span>
                            </div>
                            <Badge className="bg-slate-800 text-white border-0 font-medium">DP</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DP Subject Groups (gated) */}
          {allowedProgrammes.includes('DP') && groupedSubjects.map(group => {
            if (group.subjects.length === 0) return null;
            const Icon = group.icon;
            
            return (
              <div key={group.id} className="mb-10">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-4 mb-6"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <motion.div 
                      className={`w-14 h-14 rounded-2xl ${group.color} flex items-center justify-center shadow-xl`}
                      whileHover={{ rotate: 360, scale: 1.1 }}
                      transition={{ duration: 0.6 }}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">
                        Group {group.id}: {group.name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">IB Diploma Programme</p>
                    </div>
                  </div>
                  <Badge className={`${group.color} text-white border-0 shadow-md text-base px-4 py-1`}>
                    {group.subjects.length} subjects
                  </Badge>
                </motion.div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {group.subjects.map((subject, index) => (
                    <motion.div
                      key={subject.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -8, transition: { duration: 0.2 } }}
                    >
                      <Card className="border border-slate-200 shadow-sm bg-white rounded-xl hover:shadow-md transition-all duration-200 overflow-hidden h-full flex flex-col">
                        <div className={`h-1 w-full ${group.color}`} />
                        <CardContent className="p-5 flex-1 flex flex-col">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-10 h-10 rounded-lg ${group.color} flex items-center justify-center flex-shrink-0`}>
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 text-base truncate">{subject.name}</p>
                                <p className="text-xs text-slate-500 truncate">{subject.code}</p>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2">
                                  <MoreHorizontal className="w-4 h-4 text-slate-400" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(subject)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-rose-600" onClick={() => deleteMutation.mutate(subject.id)}>
                                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {subject.available_levels?.includes('HL') && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">
                                HL {subject.hoursPerWeekHL || Math.round((subject.hl_minutes_per_week_default || 360) / 60)}h
                              </Badge>
                            )}
                            {subject.available_levels?.includes('SL') && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-0 text-xs font-medium">
                                SL {subject.hoursPerWeekSL || Math.round((subject.sl_minutes_per_week_default || 240) / 60)}h
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-2">
                            <div className="flex items-center gap-2 text-slate-500">
                              {subject.requires_lab ? (
                                <>
                                  <FlaskConical className="w-4 h-4" />
                                  <span className="text-sm">Requires Lab</span>
                                </>
                              ) : (
                                <>
                                  <BookOpen className="w-4 h-4" />
                                  <span className="text-sm">Standard</span>
                                </>
                              )}
                            </div>
                            <Badge className={`${group.color} text-white border-0 font-medium`}>
                              DP
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}



<Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
            <DialogDescription>
              {editingSubject ? 'Update subject details.' : 'Enter the details for the new subject.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name *</Label>
                <Input 
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Physics"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code *</Label>
                <Input 
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder={formData.ib_level === 'DP' && isCurrentSpecialDp ? 'Auto-set from subject type' : 'e.g., PHY or TEST'}
                  readOnly={formData.ib_level === 'DP' && isCurrentSpecialDp}
                  required
                />
                <p className="text-xs text-slate-500">Use the DP Subject Type selector for TOK, EE, and Exam Time.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ib_level">IB Programme *</Label>
              <Select 
                value={formData.ib_level} 
                onValueChange={(value) => setFormData({ ...formData, ib_level: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedProgrammes.includes('PYP') && (
                    <SelectItem value="PYP">PYP (Primary Years Programme)</SelectItem>
                  )}
                  {allowedProgrammes.includes('MYP') && (
                    <SelectItem value="MYP">MYP (Middle Years Programme)</SelectItem>
                  )}
                  {allowedProgrammes.includes('DP') && (
                    <SelectItem value="DP">DP (Diploma Programme)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {formData.ib_level === 'DP' && (
              <div className="space-y-2">
                <Label htmlFor="dp_subject_type">DP Subject Type</Label>
                <Select
                  value={isCurrentSpecialDp ? normalizedFormCode : 'academic'}
                  onValueChange={(value) => {
                    if (value === 'academic') {
                      setFormData({ ...formData, code: '' });
                      return;
                    }

                    setFormData({
                      ...formData,
                      code: value,
                      name: formData.name || (value === 'TOK' ? 'Theory of Knowledge' : value === 'EE' ? 'Extended Essay' : 'Exam Time'),
                      combine_dp1_dp2: value === 'TEST' ? formData.combine_dp1_dp2 : false
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">Academic Subject</SelectItem>
                    <SelectItem value="TOK">TOK</SelectItem>
                    <SelectItem value="EE">EE</SelectItem>
                    <SelectItem value="TEST">Exam Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!(formData.ib_level === 'DP' && isCurrentSpecialDp) && (
              <div className="space-y-2">
                <Label htmlFor="ib_group">IB Group</Label>
                <Select 
                  value={String(formData.ib_group)} 
                  onValueChange={(value) => setFormData({ ...formData, ib_group: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IB_GROUPS.map(group => (
                      <SelectItem key={group.id} value={String(group.id)}>
                        Group {group.id}: {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.ib_level === 'DP' ? (
              isCurrentSpecialDp ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="standard_hours">Hours/Week *</Label>
                      <Input 
                        id="standard_hours"
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="12"
                        value={formData.standard_hours_per_week}
                        onChange={(e) => setFormData({ ...formData, standard_hours_per_week: parseFloat(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="special_teacher">Assigned Teacher</Label>
                      <Select 
                        value={formData.supervisor_teacher_id}
                        onValueChange={(value) => setFormData({ ...formData, supervisor_teacher_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No teacher assigned</SelectItem>
                          {teachers.map((teacher) => (
                            <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sessions_per_week">Sessions Per Week</Label>
                      <Input 
                        id="sessions_per_week"
                        type="number"
                        min="0"
                        max="10"
                        value={formData.sessions_per_week}
                        onChange={(e) => setFormData({ ...formData, sessions_per_week: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hours_per_session">Hours Per Session</Label>
                      <Input 
                        id="hours_per_session"
                        type="number"
                        step="0.5"
                        min="0"
                        max="6"
                        value={formData.hours_per_session}
                        onChange={(e) => setFormData({ ...formData, hours_per_session: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Use code TEST for Exam Time. When sessions and hours per session are filled, the solver payload uses sessions × hours × 60 as the source of truth.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hl_hours">HL Hours/Week *</Label>
                      <Input 
                        id="hl_hours"
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="12"
                        value={formData.hoursPerWeekHL}
                        onChange={(e) => setFormData({ ...formData, hoursPerWeekHL: parseFloat(e.target.value) || 0 })}
                        required
                      />
                      <p className="text-xs text-slate-500">
                        IB standard: 6 hours/week (360 min)
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sl_hours">SL Hours/Week *</Label>
                      <Input 
                        id="sl_hours"
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="10"
                        value={formData.hoursPerWeekSL}
                        onChange={(e) => setFormData({ ...formData, hoursPerWeekSL: parseFloat(e.target.value) || 0 })}
                        required
                      />
                      <p className="text-xs text-slate-500">
                        IB standard: 4 hours/week (240 min)
                      </p>
                    </div>
                  </div>
                </>
              )
            ) : (
              <div className="space-y-2">
                <Label htmlFor="pyp_myp_hours">Teaching Hours Per Week *</Label>
                <Input 
                  id="pyp_myp_hours"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.pyp_myp_hours_per_week}
                  onChange={(e) => setFormData({ ...formData, pyp_myp_hours_per_week: parseInt(e.target.value) || 4 })}
                  placeholder="e.g., 4"
                />
                <p className="text-xs text-slate-500">
                  Allocated teaching hours per week for this {formData.ib_level} subject
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="requires_lab"
                  checked={formData.requires_lab}
                  onCheckedChange={(checked) => setFormData({ ...formData, requires_lab: checked })}
                />
                <Label htmlFor="requires_lab" className="font-normal">Requires Lab</Label>
              </div>

              {canCombineDpYears && (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                  <div>
                    <Label htmlFor="combine_dp1_dp2" className="font-semibold text-slate-900 text-sm">
                      Combine DP1 & DP2 Teaching Groups
                    </Label>
                    <p className="text-xs text-slate-600 mt-1">
                      {normalizedFormCode === 'TEST'
                        ? 'Exam Time can be shared across both year groups in one scheduling scope'
                        : 'Students from both year groups will be scheduled together'}
                    </p>
                  </div>
                  <Switch 
                    id="combine_dp1_dp2"
                    checked={formData.combine_dp1_dp2}
                    onCheckedChange={(checked) => setFormData({ ...formData, combine_dp1_dp2: checked })}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700"
                disabled={
                  createMutation.isPending || 
                  updateMutation.isPending ||
                  (formData.ib_level === 'DP' && !isCurrentSpecialDp &&
                   (parseFloat(formData.hoursPerWeekHL) <= 0 || parseFloat(formData.hoursPerWeekSL) <= 0)) ||
                  (formData.ib_level === 'DP' && isCurrentSpecialDp &&
                   parseFloat(formData.standard_hours_per_week) <= 0 &&
                   !(parseFloat(formData.sessions_per_week) > 0 && parseFloat(formData.hours_per_session) > 0))
                }
              >
                {editingSubject ? 'Save Changes' : 'Add Subject'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <UploadProgressDialog 
        open={uploadState.isUploading}
        stage={uploadState.stage}
        progress={uploadState.progress}
        current={uploadState.subjectsCreated}
        total={uploadState.totalSubjects}
        entityType="Subjects"
      />

      <DragDropUploadDialog 
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={(file) => {
          setShowUploadDialog(false);
          handleFileUpload(file);
        }}
        title="Import Subjects"
        description="Upload a document or paste to extract subject data"
      />
    </div>
  );
}