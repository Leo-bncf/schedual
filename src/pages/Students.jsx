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
import { Plus, Search, GraduationCap, MoreHorizontal, Pencil, Trash2, Upload, Loader2, CheckCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
import UploadProgressDialog from '../components/upload/UploadProgressDialog';
import DragDropUploadDialog from '../components/upload/DragDropUploadDialog';

export default function Students() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    stage: 'uploading',
    progress: '',
    studentsCreated: 0,
    totalStudents: 0,
    error: null
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
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

  const { data: rawStudents = [], isLoading } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }, '-created_date', 500),
    enabled: !!schoolId,
  });

  // Auto-normalize PYP year groups on display
  const students = rawStudents.map(student => {
    if (student.ib_programme === 'PYP' && student.year_group) {
      const lowerYearGroup = student.year_group.toLowerCase();
      const patterns = [
        /class[_\s-]*([a-f])/i,
        /pyp[_\s-]+class[_\s-]*([a-f])/i,
        /pyp[_\s-]+([a-f])/i,
        /[_-]([a-f])$/i,
        /\b([a-f])\b/i
      ];
      
      for (const pattern of patterns) {
        const match = lowerYearGroup.match(pattern);
        if (match) {
          const classLetter = match[match.length - 1];
          return { ...student, year_group: `PYP-${classLetter.toUpperCase()}` };
        }
      }
    }
    return student;
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
    
    // Normalize year group for comparison (ignore batch, case-insensitive)
    const normalizeYearGroup = (yg) => {
      if (!yg) return '';
      // Extract core year group: DP1, DP2, MYP1-5, PYP-A through PYP-F
      const lower = yg.toLowerCase().trim();
      
      // Match DP1 or DP2
      if (lower.includes('dp1')) return 'dp1';
      if (lower.includes('dp2')) return 'dp2';
      
      // Match MYP1-5
      for (let i = 1; i <= 5; i++) {
        if (lower.includes(`myp${i}`)) return `myp${i}`;
      }
      
      // Match PYP-A through PYP-F
      for (const letter of ['a', 'b', 'c', 'd', 'e', 'f']) {
        if (lower.includes(letter)) return `pyp-${letter}`;
      }
      
      return lower;
    };
    
    const matchesYear = yearFilter === 'all' || 
      normalizeYearGroup(s.year_group) === normalizeYearGroup(yearFilter);
    
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
      studentsCreated: 0,
      totalStudents: 0,
      error: null
    });

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setUploadState(prev => ({ ...prev, stage: 'extracting', progress: 'Analyzing document structure...' }));

      // First pass: Count total students
      const countResult = await base44.integrations.Core.InvokeLLM({
        prompt: `Count the TOTAL NUMBER of students in this entire document. Scan from start to finish and provide the exact count.
        
Return format: {"total_students": <number>, "document_type": "spreadsheet/list/table/etc"}`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            total_students: { type: "number" },
            document_type: { type: "string" }
          }
        }
      });

      const expectedCount = countResult?.total_students || 0;
      console.log(`Expected ${expectedCount} students in document`);

      setUploadState(prev => ({ 
        ...prev, 
        progress: `Found ${expectedCount} students. Extracting in chunks...` 
      }));

      // Extract students in chunks to handle large documents
      const chunkSize = 50;
      const totalChunks = Math.ceil(expectedCount / chunkSize);
      let allStudents = [];

      for (let chunk = 0; chunk < totalChunks; chunk++) {
        const startIndex = chunk * chunkSize + 1;
        const endIndex = Math.min((chunk + 1) * chunkSize, expectedCount);
        
        setUploadState(prev => ({ 
          ...prev, 
          progress: `Extracting students ${startIndex}-${endIndex} of ${expectedCount}...` 
        }));

        const chunkResult = await base44.integrations.Core.InvokeLLM({
          prompt: `EXTRACT STUDENTS ${startIndex} through ${endIndex} from this document.

CRITICAL INSTRUCTIONS:
- Total students in document: ${expectedCount}
- Extract ONLY students numbered ${startIndex} to ${endIndex}
- Skip students 1-${startIndex - 1} (already processed)
- Stop after student ${endIndex}
- Return exactly ${endIndex - startIndex + 1} students

For each student you find, provide:
- full_name, email (if available), student_id (if available)
- ib_programme (one of: DP, MYP, PYP)
- year_group (e.g., DP1, DP2, MYP1-5, PYP-A through PYP-F)
- subjects: array of ALL subject choices

CRITICAL FOR DP STUDENTS - READ CAREFULLY:
Every DP student MUST take EXACTLY 6 SUBJECTS - one from each of the 6 IB subject groups:
1. Group 1: Language & Literature (e.g., English A, Spanish A)
2. Group 2: Language Acquisition (e.g., Spanish B, French B, English B)
3. Group 3: Individuals & Societies (e.g., History, Geography, Economics, Psychology)
4. Group 4: Sciences (e.g., Physics, Chemistry, Biology, Environmental Systems)
5. Group 5: Mathematics (e.g., Mathematics AA, Mathematics AI)
6. Group 6: The Arts OR another subject from Groups 1-5 (e.g., Visual Arts, Music, Theatre, or additional Science/Humanities)

Each subject must specify its level: HL (Higher Level) or SL (Standard Level).
Typically students take 3-4 subjects at HL and the remaining at SL.

DO NOT skip any subjects. If a student appears to have fewer than 6 subjects, look more carefully at the document for ALL their subject choices.

Example DP student with ALL 6 subjects:
subjects: [
  {"name": "English A: Literature", "level": "HL"},
  {"name": "Spanish B", "level": "SL"},
  {"name": "History", "level": "HL"},
  {"name": "Physics", "level": "HL"},
  {"name": "Mathematics AA", "level": "HL"},
  {"name": "Visual Arts", "level": "SL"}
]

For MYP/PYP students, extract all subjects listed (no level needed).

Example for MYP/PYP: subjects: [{"name": "Mathematics"}, {"name": "Science"}, {"name": "English"}, {"name": "History"}]`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              students: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    full_name: { type: "string" },
                    email: { type: "string" },
                    student_id: { type: "string" },
                    ib_programme: { type: "string" },
                    year_group: { type: "string" },
                    subjects: {
                      type: "array",
                      minItems: 1,
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          level: { type: "string" }
                        },
                        required: ["name"]
                      }
                    }
                  },
                  required: ["full_name", "ib_programme", "year_group"]
                }
              }
            }
          }
        });

        const chunkStudents = chunkResult?.students || [];
        allStudents = [...allStudents, ...chunkStudents];
        
        console.log(`Chunk ${chunk + 1}/${totalChunks}: Extracted ${chunkStudents.length} students (Total so far: ${allStudents.length})`);
      }

      const studentsData = allStudents;

      if (studentsData.length === 0) {
        throw new Error('No students found in the document');
      }

      // Check if extraction is incomplete
      const extractedCount = studentsData.length;
      const missingCount = expectedCount - extractedCount;
      
      if (missingCount > 0) {
        const msg = `⚠️ INCOMPLETE EXTRACTION\n\nExpected: ${expectedCount} students\nExtracted: ${extractedCount} students\nMissing: ${missingCount} students\n\nThis usually happens with large documents. The AI may have stopped early due to response limits.\n\nOptions:\n1. Split your document into smaller files (recommended)\n2. Continue with ${extractedCount} students and add the rest manually\n3. Cancel and try again`;
        
        if (!confirm(msg + '\n\nContinue with partial import?')) {
          throw new Error('Upload cancelled - incomplete extraction');
        }
      }

      console.log(`Extracted ${extractedCount} of ${expectedCount} students`);

      // Validate DP students have 6 subjects
      const dpValidationWarnings = [];
      studentsData.forEach((student, idx) => {
        if (student.ib_programme === 'DP') {
          const subjectCount = student.subjects?.length || 0;
          if (subjectCount !== 6) {
            dpValidationWarnings.push(`${student.full_name}: has ${subjectCount} subjects (expected 6)`);
          }
        }
      });

      if (dpValidationWarnings.length > 0) {
        const warningMsg = `Warning: ${dpValidationWarnings.length} DP students don't have exactly 6 subjects:\n${dpValidationWarnings.slice(0, 5).join('\n')}${dpValidationWarnings.length > 5 ? `\n...and ${dpValidationWarnings.length - 5} more` : ''}`;
        console.warn(warningMsg);
        if (!confirm(`${warningMsg}\n\nDo you want to continue anyway? These students will need manual correction.`)) {
          throw new Error('Upload cancelled due to validation warnings');
        }
      }

      setUploadState(prev => ({ ...prev, stage: 'creating', totalStudents: studentsData.length, progress: `Creating ${studentsData.length} students...` }));

      // Fetch subjects to match names to IDs
      const allSubjects = await base44.entities.Subject.list();
      
      const studentsToCreate = studentsData.map(student => {
        let subjectChoices = [];
        
        // Process extracted subjects
        if (student.subjects && Array.isArray(student.subjects)) {
          subjectChoices = student.subjects.map(subj => {
            // Find matching subject by name (case-insensitive)
            const matchedSubject = allSubjects.find(s => 
              s.name?.toLowerCase().includes(subj.name?.toLowerCase()) ||
              subj.name?.toLowerCase().includes(s.name?.toLowerCase())
            );
            
            if (matchedSubject) {
              return {
                subject_id: matchedSubject.id,
                level: subj.level || 'SL', // Default to SL if not specified
                ib_group: matchedSubject.ib_group
              };
            }
            return null;
          }).filter(Boolean);
        }
        
        return {
          school_id: schoolId,
          full_name: student.full_name,
          email: student.email || '',
          student_id: student.student_id || '',
          ib_programme: student.ib_programme,
          year_group: student.year_group,
          subject_choices: subjectChoices,
          core_components: { tok_assigned: false, cas_assigned: false, ee_assigned: false },
          is_active: true
        };
      });

      // Batch create with rate limit handling
      const batchSize = 10;
      let created = 0;
      
      for (let i = 0; i < studentsToCreate.length; i += batchSize) {
        const batch = studentsToCreate.slice(i, i + batchSize);
        
        try {
          await base44.entities.Student.bulkCreate(batch);
          created += batch.length;
          
          setUploadState(prev => ({ 
            ...prev, 
            studentsCreated: created,
            progress: `Created ${created} of ${studentsData.length} students...`
          }));
          
          // Small delay between batches to avoid rate limits
          if (i + batchSize < studentsToCreate.length) {
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
        progress: `Successfully created ${created} students!`
      }));

      setTimeout(() => {
        setUploadState({
          isUploading: false,
          stage: 'uploading',
          progress: '',
          studentsCreated: 0,
          totalStudents: 0,
          error: null
        });
        queryClient.invalidateQueries({ queryKey: ['students'] });
      }, 2000);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        stage: 'uploading',
        progress: '',
        studentsCreated: 0,
        totalStudents: 0,
        error: error?.message || 'An unknown error occurred'
      });
      alert('Failed to process file: ' + (error?.message || 'Unknown error'));
      }
      };



  return (
    <div className="space-y-6">
      <PageHeader 
        title="Students"
        description="Manage IB Diploma students and their subject choices"
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
                Add Student
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
          <TabsList className="bg-slate-100 overflow-x-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-violet-500 data-[state=active]:text-white transition-all">All ({students.length})</TabsTrigger>
            <TabsTrigger value="DP1" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all">DP1 ({dp1Count})</TabsTrigger>
            <TabsTrigger value="DP2" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all">DP2 ({dp2Count})</TabsTrigger>
            <TabsTrigger value="MYP1" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP1 ({mypCounts.MYP1})</TabsTrigger>
            <TabsTrigger value="MYP2" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP2 ({mypCounts.MYP2})</TabsTrigger>
            <TabsTrigger value="MYP3" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP3 ({mypCounts.MYP3})</TabsTrigger>
            <TabsTrigger value="MYP4" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP4 ({mypCounts.MYP4})</TabsTrigger>
            <TabsTrigger value="MYP5" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP5 ({mypCounts.MYP5})</TabsTrigger>
            <TabsTrigger value="PYP-A" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP A ({pypCounts['PYP-A']})</TabsTrigger>
            <TabsTrigger value="PYP-B" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP B ({pypCounts['PYP-B']})</TabsTrigger>
            <TabsTrigger value="PYP-C" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP C ({pypCounts['PYP-C']})</TabsTrigger>
            <TabsTrigger value="PYP-D" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP D ({pypCounts['PYP-D']})</TabsTrigger>
            <TabsTrigger value="PYP-E" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP E ({pypCounts['PYP-E']})</TabsTrigger>
            <TabsTrigger value="PYP-F" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP F ({pypCounts['PYP-F']})</TabsTrigger>
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

      <UploadProgressDialog 
        open={uploadState.isUploading}
        stage={uploadState.stage}
        progress={uploadState.progress}
        current={uploadState.studentsCreated}
        total={uploadState.totalStudents}
        entityType="Students"
      />

      <DragDropUploadDialog 
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onUpload={(file) => {
          setShowUploadDialog(false);
          handleFileUpload(file);
        }}
        title="Import Students"
        description="Upload a document or paste to extract student data"
      />
      </div>
      );
      }