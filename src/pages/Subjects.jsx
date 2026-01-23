import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, BookOpen, MoreHorizontal, Pencil, Trash2, FlaskConical, Palette, Calculator, Globe, Languages, FileText, Upload, Loader2, CheckCircle } from 'lucide-react';
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
  { id: 2, name: 'Language Acquisition', icon: Languages, color: 'bg-emerald-500' },
  { id: 3, name: 'Individuals & Societies', icon: Globe, color: 'bg-amber-500' },
  { id: 4, name: 'Sciences', icon: FlaskConical, color: 'bg-violet-500' },
  { id: 5, name: 'Mathematics', icon: Calculator, color: 'bg-rose-500' },
  { id: 6, name: 'The Arts', icon: Palette, color: 'bg-cyan-500' },
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
    hl_hours_per_week: 6,
    sl_hours_per_week: 4,
    pyp_myp_hours_per_week: 4,
    requires_lab: false,
    requires_special_room: '',
    is_core: false,
    combine_dp1_dp2: false,
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const userData = await base44.auth.me();
      console.log('🔍 Full user object:', userData);
      console.log('🔍 User school_id:', userData?.school_id);
      console.log('🔍 User school_id type:', typeof userData?.school_id);
      return userData;
    },
  });

  const schoolId = user?.school_id;

  const { data: schoolRecords = [] } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => base44.entities.School.filter({ id: schoolId }),
    enabled: !!schoolId,
  });
  const school = schoolRecords[0];

  const getAllowedProgrammes = (s) => {
    const tier = s?.subscription_tier;
    if (tier === 'tier1') return ['MYP'];
    if (tier === 'tier2' || tier === 'tier3') return ['PYP','MYP','DP'];
    return ['PYP','MYP','DP'];
  };
  const allowedProgrammes = getAllowedProgrammes(school);

  const { data: subjects = [], isLoading, error } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: async () => {
      console.log('Fetching subjects for school:', schoolId);
      const allSubjects = await base44.entities.Subject.list();
      // Filter out test slots (is_test_slot === true)
      const result = allSubjects.filter(s => !s.is_test_slot);
      console.log('Subjects fetched:', result);
      return result;
    },
    enabled: !!schoolId,
  });

  console.log('User school_id:', schoolId);
  console.log('Subjects data:', subjects);
  console.log('Query error:', error);

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
      hl_hours_per_week: 6,
      sl_hours_per_week: 4,
      pyp_myp_hours_per_week: 4,
      requires_lab: false,
      requires_special_room: '',
      is_core: false,
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
      hl_hours_per_week: subject.hl_hours_per_week || 6,
      sl_hours_per_week: subject.sl_hours_per_week || 4,
      pyp_myp_hours_per_week: subject.pyp_myp_hours_per_week || 4,
      requires_lab: subject.requires_lab || false,
      requires_special_room: subject.requires_special_room || '',
      is_core: subject.is_core || false,
      combine_dp1_dp2: subject.combine_dp1_dp2 || false,
      is_active: subject.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const group = IB_GROUPS.find(g => g.id === formData.ib_group);
    const data = { 
      ...formData, 
      ib_group: String(formData.ib_group),
      ib_group_name: group?.name || '' 
    };
    
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
    subjects: filteredSubjects.filter(s => String(s.ib_group) === String(group.id) && s.ib_level === 'DP')
  }));

  const coreSubjects = filteredSubjects.filter(s => s.is_core);
  const pypSubjects = filteredSubjects.filter(s => s.ib_level === 'PYP' && !s.is_core);
  const mypSubjects = filteredSubjects.filter(s => s.ib_level === 'MYP' && !s.is_core);

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
          hl_hours_per_week: 6,
          sl_hours_per_week: 4,
          pyp_myp_hours_per_week: subject.pyp_myp_hours_per_week || 4,
          requires_lab: false,
          is_core: false,
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
      <Button 
        variant="outline"
        onClick={async () => {
          try {
            const { data } = await base44.functions.invoke('debugSubjects');
            console.log('🔍 Full debug data:', data);
            
            const stepResults = data.steps.map(s => {
              if (s.action === 'create') {
                return `Step ${s.step} (${s.action}): ${s.success ? '✅' : '❌'} ID: ${s.id || 'null'} Returned: ${JSON.stringify(s.returned || {})}`;
              }
              return `Step ${s.step} (${s.action}): ${s.success ? '✅' : '❌'} ${s.count !== undefined ? `${s.count} subjects` : s.found !== undefined ? `Found ${s.found}` : s.error || ''}`;
            }).join('\n');
            
            alert(`${data.diagnosis}\n\n${stepResults}`);
          } catch (err) {
            console.error('❌ Error:', err);
            alert('Error: ' + (err.message || JSON.stringify(err)));
          }
        }}
      >
        🔍 Debug & Test Create
      </Button>

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
              <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg">
                <Plus className="w-4 h-4 mr-2" />
                Add Subject
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
            className="pl-10"
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
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <div className="h-1 w-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full" />
                PYP Programme
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pypSubjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }}
                  >
                    <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-green-500 to-emerald-600" />
                      <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{subject.name}</p>
                            <p className="text-sm text-slate-500">{subject.code}</p>
                            <Badge className="mt-2 bg-green-100 text-green-700 border-0 text-xs">
                              {subject.pyp_myp_hours_per_week || 4}h/week
                            </Badge>
                          </div>
                          </div>
                          <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
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
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <div className="h-1 w-12 bg-gradient-to-r from-orange-500 to-amber-600 rounded-full" />
                MYP Programme
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mypSubjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }}
                  >
                    <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-orange-500 to-amber-600" />
                      <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{subject.name}</p>
                            <p className="text-sm text-slate-500">{subject.code}</p>
                            <Badge className="mt-2 bg-orange-100 text-orange-700 border-0 text-xs">
                              {subject.pyp_myp_hours_per_week || 4}h/week
                            </Badge>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
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
                          </CardContent>
                          </Card>
                          </motion.div>
                          ))}
                          </div>
                          </div>
                          )}

                          {/* Core Components (DP only) */}
          {allowedProgrammes.includes('DP') && coreSubjects.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
                <div className="h-1 w-12 bg-gradient-to-r from-slate-700 to-slate-900 rounded-full" />
                Core Components
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {coreSubjects.map((subject, index) => (
                  <motion.div
                    key={subject.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.03, y: -5 }}
                  >
                    <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-slate-700 to-slate-900" />
                      <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{subject.name}</p>
                            <p className="text-sm text-slate-500">{subject.code}</p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
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
                          </CardContent>
                          </Card>
                          </motion.div>
                          ))}
                          </div>
                          </div>
                          )}

                          {/* DP Subject Groups (gated) */}
          {allowedProgrammes.includes('DP') && groupedSubjects.map(group => {
            if (group.subjects.length === 0) return null;
            const Icon = group.icon;
            
            return (
              <div key={group.id}>
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    className={`w-10 h-10 rounded-xl ${group.color} flex items-center justify-center shadow-lg`}
                    whileHover={{ rotate: 360, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </motion.div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Group {group.id}: {group.name}
                  </h3>
                  <Badge className="bg-slate-800 text-white border-0 shadow-sm">
                    {group.subjects.length} subjects
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.subjects.filter(s => !s.is_core).map((subject, index) => (
                    <motion.div
                      key={subject.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ scale: 1.03, y: -5 }}
                    >
                      <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden">
                        <div className={`h-1 bg-gradient-to-r ${group.color}`} />
                        <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold text-slate-900">{subject.name}</p>
                            <p className="text-sm text-slate-500">{subject.code}</p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
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
                        <div className="flex flex-wrap gap-2">
                          {subject.available_levels?.includes('HL') && (
                            <Badge className="bg-rose-100 text-rose-700 border-0">
                              HL {subject.hl_hours_per_week}h
                            </Badge>
                          )}
                          {subject.available_levels?.includes('SL') && (
                            <Badge className="bg-amber-100 text-amber-700 border-0">
                              SL {subject.sl_hours_per_week}h
                            </Badge>
                          )}
                          {subject.requires_lab && (
                            <Badge variant="outline" className="text-violet-600 border-violet-200">
                              <FlaskConical className="w-3 h-3 mr-1" /> Lab
                            </Badge>
                            )}
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
                  placeholder="e.g., PHY"
                  required
                />
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

            {formData.ib_level === 'DP' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hl_hours">HL Hours/Week</Label>
                  <Input 
                    id="hl_hours"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.hl_hours_per_week}
                    onChange={(e) => setFormData({ ...formData, hl_hours_per_week: parseInt(e.target.value) || 6 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sl_hours">SL Hours/Week</Label>
                  <Input 
                    id="sl_hours"
                    type="number"
                    min="1"
                    max="10"
                    value={formData.sl_hours_per_week}
                    onChange={(e) => setFormData({ ...formData, sl_hours_per_week: parseInt(e.target.value) || 4 })}
                  />
                </div>
              </div>
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
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="requires_lab"
                    checked={formData.requires_lab}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_lab: checked })}
                  />
                  <Label htmlFor="requires_lab" className="font-normal">Requires Lab</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="is_core"
                    checked={formData.is_core}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_core: checked })}
                  />
                  <Label htmlFor="is_core" className="font-normal">Core Component</Label>
                </div>
              </div>
              
              {formData.ib_level === 'DP' && !formData.is_core && (
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
                  <div>
                    <Label htmlFor="combine_dp1_dp2" className="font-semibold text-slate-900 text-sm">
                      Combine DP1 & DP2 Teaching Groups
                    </Label>
                    <p className="text-xs text-slate-600 mt-1">
                      Students from both year groups will be scheduled together
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
                disabled={createMutation.isPending || updateMutation.isPending}
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

      {/* DP Core Components Setup */}
      {allowedProgrammes.includes('DP') && (
        <Card className="border-2 border-slate-900 shadow-xl mt-8">
          <CardHeader className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <BookOpen className="w-6 h-6" />
                  DP Core Components
                </CardTitle>
                <CardDescription className="text-slate-300 mt-1">
                  Configure TOK, CAS, and Extended Essay for scheduling
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">ℹ️</div>
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">How it works:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li>Add TOK, CAS, and EE as special core subjects</li>
                      <li>These will be automatically scheduled for all DP students</li>
                      <li>Set weekly hours for each component</li>
                      <li>Core components block time for students but don't require teacher assignments</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                {/* TOK */}
                <Card className="border-2 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Theory of Knowledge</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {coreSubjects.find(s => s.code === 'TOK') ? (
                      <Badge className="bg-green-600 text-white w-full justify-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-slate-900 hover:bg-slate-800"
                        onClick={() => {
                          setFormData({
                            name: 'Theory of Knowledge',
                            code: 'TOK',
                            ib_level: 'DP',
                            ib_group: 1,
                            ib_group_name: 'Language & Literature',
                            available_levels: [],
                            hl_hours_per_week: 6,
                            sl_hours_per_week: 4,
                            pyp_myp_hours_per_week: 3,
                            requires_lab: false,
                            requires_special_room: '',
                            is_core: true,
                            combine_dp1_dp2: false,
                            is_active: true
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add TOK
                      </Button>
                    )}
                    <p className="text-xs text-slate-600">
                      Recommended: 3 hours/week
                    </p>
                  </CardContent>
                </Card>

                {/* CAS */}
                <Card className="border-2 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Creativity, Activity, Service</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {coreSubjects.find(s => s.code === 'CAS') ? (
                      <Badge className="bg-green-600 text-white w-full justify-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-slate-900 hover:bg-slate-800"
                        onClick={() => {
                          setFormData({
                            name: 'Creativity, Activity, Service',
                            code: 'CAS',
                            ib_level: 'DP',
                            ib_group: 1,
                            ib_group_name: 'Language & Literature',
                            available_levels: [],
                            hl_hours_per_week: 6,
                            sl_hours_per_week: 4,
                            pyp_myp_hours_per_week: 1,
                            requires_lab: false,
                            requires_special_room: '',
                            is_core: true,
                            combine_dp1_dp2: false,
                            is_active: true
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add CAS
                      </Button>
                    )}
                    <p className="text-xs text-slate-600">
                      Recommended: 1-2 hours/week
                    </p>
                  </CardContent>
                </Card>

                {/* EE */}
                <Card className="border-2 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Extended Essay</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {coreSubjects.find(s => s.code === 'EE') ? (
                      <Badge className="bg-green-600 text-white w-full justify-center">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full bg-slate-900 hover:bg-slate-800"
                        onClick={() => {
                          setFormData({
                            name: 'Extended Essay',
                            code: 'EE',
                            ib_level: 'DP',
                            ib_group: 1,
                            ib_group_name: 'Language & Literature',
                            available_levels: [],
                            hl_hours_per_week: 6,
                            sl_hours_per_week: 4,
                            pyp_myp_hours_per_week: 1,
                            requires_lab: false,
                            requires_special_room: '',
                            is_core: true,
                            combine_dp1_dp2: false,
                            is_active: true
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add EE
                      </Button>
                    )}
                    <p className="text-xs text-slate-600">
                      Recommended: 1 hour/week
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}