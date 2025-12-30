import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
    requires_lab: false,
    requires_special_room: '',
    is_core: false,
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

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
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Subject.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Subject.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
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
      requires_lab: false,
      requires_special_room: '',
      is_core: false,
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
      requires_lab: subject.requires_lab || false,
      requires_special_room: subject.requires_special_room || '',
      is_core: subject.is_core || false,
      is_active: subject.is_active !== false
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const group = IB_GROUPS.find(g => g.id === formData.ib_group);
    const data = { ...formData, ib_group_name: group?.name || '' };
    
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

      const extractionResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all subjects/classes from this document. For each subject, provide: name, code, ib_level (one of: DP, MYP, PYP), and for DP subjects also include ib_group (string: "1", "2", "3", "4", "5", or "6") and available_levels (array of HL and/or SL).`,
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
                  available_levels: { type: "array", items: { type: "string" } }
                },
                required: ["name", "code", "ib_level"]
              }
            }
          }
        }
      });

      const subjectsData = extractionResult?.subjects || [];

      if (subjectsData.length === 0) {
        throw new Error('No subjects found in the document');
      }

      setUploadState(prev => ({ ...prev, stage: 'creating', totalSubjects: subjectsData.length, progress: `Creating ${subjectsData.length} subjects...` }));

      let created = 0;
      for (const subject of subjectsData) {
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
          requires_lab: false,
          is_core: false,
          is_active: true
        });

        created++;
        setUploadState(prev => ({ 
          ...prev, 
          subjectsCreated: created,
          progress: `Created ${created} of ${subjectsData.length} subjects...`
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
        queryClient.invalidateQueries({ queryKey: ['subjects'] });
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
        description="Manage IB Diploma Programme subjects across all groups"
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
          {/* PYP Subjects */}
          {pypSubjects.length > 0 && (
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

                        {/* MYP Subjects */}
          {mypSubjects.length > 0 && (
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

                          {/* Core Components */}
          {coreSubjects.length > 0 && (
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

                          {/* DP Subject Groups */}
          {groupedSubjects.map(group => {
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
                  <SelectItem value="PYP">PYP (Primary Years Programme)</SelectItem>
                  <SelectItem value="MYP">MYP (Middle Years Programme)</SelectItem>
                  <SelectItem value="DP">DP (Diploma Programme)</SelectItem>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hl_hours">HL Hours/Week</Label>
                <Input 
                  id="hl_hours"
                  type="number"
                  value={formData.hl_hours_per_week}
                  onChange={(e) => setFormData({ ...formData, hl_hours_per_week: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sl_hours">SL Hours/Week</Label>
                <Input 
                  id="sl_hours"
                  type="number"
                  value={formData.sl_hours_per_week}
                  onChange={(e) => setFormData({ ...formData, sl_hours_per_week: parseInt(e.target.value) })}
                />
              </div>
            </div>

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
    </div>
  );
}