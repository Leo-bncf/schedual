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
import { Plus, Search, GraduationCap, MoreHorizontal, Pencil, Trash2, Upload, Loader2, CheckCircle, Mail } from 'lucide-react';
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

  const { data: trainingData = [] } = useQuery({
    queryKey: ['aiTraining', 'student_importer'],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('aiTrainingUpload', { 
        action: 'list', 
        agent_name: 'student_importer' 
      });
      return data?.data || [];
    }
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
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
    
    // For PYP/MYP: Auto-assign ALL programme subjects
    let finalFormData = { ...formData };
    
    if (formData.ib_programme === 'PYP' || formData.ib_programme === 'MYP') {
      const programmeSubjects = subjects
        .filter(s => s.ib_level === formData.ib_programme && s.is_active !== false)
        .map(s => ({
          subject_id: s.id,
          ib_group: s.ib_group
        }));
      
      finalFormData.subject_choices = programmeSubjects;
      console.log(`Auto-assigned ${programmeSubjects.length} ${formData.ib_programme} subjects`);
    }
    
    // Save student
    if (editingStudent) {
      updateMutation.mutate({ id: editingStudent.id, data: finalFormData });
    } else {
      createMutation.mutate(finalFormData);
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

      setUploadState(prev => ({ ...prev, stage: 'extracting', progress: 'Finding all student names...' }));

      // Helper function to call LLM with retry on errors
      const callLLMWithRetry = async (params, maxRetries = 3) => {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            return await base44.integrations.Core.InvokeLLM(params);
          } catch (error) {
            const shouldRetry = 
              error?.message?.includes('502') || 
              error?.message?.includes('aborted') ||
              error?.message?.includes('timeout') ||
              error?.response?.status === 502;
            
            if (shouldRetry && attempt < maxRetries) {
              console.log(`⚠️ Retry ${attempt}/${maxRetries} after error: ${error?.message}...`);
              await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // Longer exponential backoff
              continue;
            }
            throw error;
          }
        }
      };

      // Phase 1: Detect document type and get all student names
      const documentAnalysis = await callLLMWithRetry({
        prompt: `Analyze this document to determine what IB programme these students belong to.

      Look for indicators:
      - DP/Diploma Programme students: taking 6 subjects with HL/SL levels, Groups 1-6, TOK/EE/CAS mentioned
      - MYP students: Middle Years Programme, years 1-5, interdisciplinary subjects
      - PYP students: Primary Years Programme, young children, classes A-F

      CRITICAL: If you see HL/SL levels, 6 subjects per student, or IB groups → this is DP

      Then list ALL student names in the document.

      ⚠️ CRITICAL RULES:
      1. Preserve ALL special characters, accents, and diacritics EXACTLY (é, ñ, ü, ö, ç, ø, å, etc.)
      2. Include middle names if present
      3. ONLY extract names that are ACTUALLY VISIBLE in the document
      4. Do NOT invent, generate, or make up ANY names
      5. Do NOT add placeholder/example names
      6. If you can't read a name clearly, skip it rather than guessing

      Return the programme type and complete list of ALL REAL student names.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            detected_programme: { 
              type: "string",
              enum: ["DP", "MYP", "PYP"],
              description: "The IB programme detected from the document"
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"]
            },
            indicators: {
              type: "array",
              items: { type: "string" },
              description: "What indicators led to this conclusion"
            },
            total_count: { type: "number" },
            student_names: {
              type: "array",
              items: { type: "string" }
            }
          }
        }
      });

      const detectedProgramme = documentAnalysis?.detected_programme || 'DP';
      const allNames = documentAnalysis?.student_names || [];

      console.log(`📋 Document Analysis: ${detectedProgramme} programme detected (${documentAnalysis?.confidence} confidence)`);
      console.log(`📋 Indicators: ${documentAnalysis?.indicators?.join(', ')}`);

      if (documentAnalysis?.confidence === 'low') {
        const confirmProgramme = confirm(
          `⚠️ Low confidence detection: System thinks this is ${detectedProgramme} programme.\n\n` +
          `Indicators: ${documentAnalysis?.indicators?.join(', ')}\n\n` +
          `Is this correct? Click OK if yes, Cancel to stop import.`
        );
        if (!confirmProgramme) {
          throw new Error('Import cancelled - please verify document programme type');
        }
      }
      console.log(`First pass found ${allNames.length} students`);
      
      // STOP HERE - don't ask for more, it causes hallucinations
      
      if (allNames.length === 0) {
        throw new Error('No student names found in the document');
      }

      console.log(`Total found: ${allNames.length} student names`);
      
      setUploadState(prev => ({ 
        ...prev, 
        progress: `Found ${allNames.length} students. Extracting details...` 
      }));

      // Phase 2: Extract full details in manageable batches
      const extractBatchSize = 10; // Further reduced to prevent timeouts
      const totalBatches = Math.ceil(allNames.length / extractBatchSize);
      const allStudents = [];

      for (let batch = 0; batch < totalBatches; batch++) {
        const batchNames = allNames.slice(batch * extractBatchSize, (batch + 1) * extractBatchSize);
        
        setUploadState(prev => ({ 
          ...prev, 
          progress: `Extracting batch ${batch + 1}/${totalBatches} (${batchNames.length} students)...` 
        }));

        // Include training feedback for this batch - ONLY use approved training data
        const approvedTraining = trainingData.filter(t => t.overall_status === 'approved');
        const batchTrainingExamples = approvedTraining.slice(0, 3).map(t => {
          const corrections = Object.entries(t.field_feedback || {})
            .filter(([_, f]) => f.was_correct === false && f.notes)
            .map(([field, f]) => `- When extracting ${field}: ${f.notes}. Original was "${f.original}", correct value is "${f.corrected}"`)
            .join('\n');
          return corrections;
        }).filter(Boolean).join('\n\n');

        const batchResult = await callLLMWithRetry({
          prompt: `Extract ONLY these specific students from the document: ${batchNames.join(', ')}

        DOCUMENT PROGRAMME TYPE: ${detectedProgramme}

        ${batchTrainingExamples ? `LESSONS FROM ADMIN FEEDBACK:\n${batchTrainingExamples}\n\n` : ''}

        CRITICAL: Copy names EXACTLY as provided above with ALL accents and special characters preserved (é, ñ, ü, ö, ç, etc.).

        For each of these ${batchNames.length} students, provide:
- full_name (must match exactly one of the names above)
- email, student_id (if available)
- ib_programme: **MUST BE "${detectedProgramme}"** for ALL students in this document
- year_group: **EXTREMELY IMPORTANT - READ THIS CAREFULLY**
  ${detectedProgramme === 'DP' ? `
  * This is a DP document - ALL students are DP students
  * Look at the SECTION/HEADING where each student appears
  * Students in "DP1" / "Year 1" / "Grade 11" / "First Year" section → use "DP1"
  * Students in "DP2" / "Year 2" / "Grade 12" / "Second Year" section → use "DP2"
  * If document has TWO distinct groups/sections of students → one is DP1, the other is DP2
  * Pay attention to which list/section each student appears in
  * DO NOT assign all students to the same year group
  * Each student's year group depends on WHERE in the document they appear
  ` : detectedProgramme === 'MYP' ? `
  * Use "MYP1", "MYP2", "MYP3", "MYP4", or "MYP5" based on what's written
  ` : `
  * Use "PYP-A", "PYP-B", "PYP-C", "PYP-D", "PYP-E", or "PYP-F" based on class letter
  `}
- subjects: ALL their subject choices - DO NOT skip any subjects

${detectedProgramme === 'DP' ? `
**ABSOLUTELY CRITICAL FOR DP STUDENTS:**
- EVERY DP student MUST have EXACTLY 6 subjects (no exceptions)
- You MUST extract ALL 6 subjects for EACH DP student
- Each subject MUST have a level: "HL" or "SL"
- If you only find 5 subjects for a student, SEARCH HARDER - there must be a 6th
- Extract subjects EXACTLY as written: "English HL" → {"name": "English", "level": "HL"}
- DO NOT add extra words (keep it short like in document)
- Groups needed: 1-Language, 2-Language, 3-Societies, 4-Science, 5-Math, 6-Arts/Extra
- Example: [{"name": "English", "level": "HL"}, {"name": "Spanish", "level": "SL"}, {"name": "History", "level": "HL"}, {"name": "Biology", "level": "SL"}, {"name": "Math", "level": "HL"}, {"name": "Economics", "level": "SL"}]

⚠️ VALIDATION: Before returning, COUNT subjects for each student. If count ≠ 6, search document again for missing subjects.
` : `
For MYP/PYP: extract all subjects (no level needed).
`}

⚠️ CRITICAL VALIDATIONS:
1. ib_programme MUST be "${detectedProgramme}" for ALL students
2. Each student needs correct year_group based on document section
3. ${detectedProgramme === 'DP' ? 'EVERY DP student needs EXACTLY 6 subjects with HL/SL' : 'Extract all subjects found'}

Return EXACTLY ${batchNames.length} students with COMPLETE data.`,
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

        const batchStudents = batchResult?.students || [];
        allStudents.push(...batchStudents);
        
        console.log(`Batch ${batch + 1}/${totalBatches}: Extracted ${batchStudents.length}/${batchNames.length} students`);
        
        // Longer delay to avoid rate limits and timeouts
        if (batch < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // STRICT VALIDATION for DP students
      if (detectedProgramme === 'DP') {
        const dpValidation = {
          wrongProgramme: allStudents.filter(s => s.ib_programme !== 'DP'),
          missingSubjects: allStudents.filter(s => !s.subjects || s.subjects.length < 6),
          wrongYearGroup: allStudents.filter(s => !['DP1', 'DP2'].includes(s.year_group))
        };

        // Log validation issues
        if (dpValidation.wrongProgramme.length > 0) {
          console.error(`❌ ${dpValidation.wrongProgramme.length} students incorrectly labeled as non-DP:`, 
            dpValidation.wrongProgramme.map(s => `${s.full_name} (${s.ib_programme})`));
        }

        if (dpValidation.missingSubjects.length > 0) {
          console.warn(`⚠️ ${dpValidation.missingSubjects.length} DP students missing subjects:`, 
            dpValidation.missingSubjects.map(s => `${s.full_name} (${s.subjects?.length || 0}/6)`));

          // Try to complete missing subjects
          for (const student of dpValidation.missingSubjects) {
            setUploadState(prev => ({ 
              ...prev, 
              progress: `Completing subjects for ${student.full_name}...` 
            }));

            try {
              const completeResult = await callLLMWithRetry({
                prompt: `URGENT: Find ALL 6 subjects for DP student "${student.full_name}".

      Current subjects: ${student.subjects?.map(s => `${s.name} ${s.level}`).join(', ') || 'none'}
      Missing: ${6 - (student.subjects?.length || 0)} subjects

      This DP student MUST have EXACTLY 6 subjects. Search the ENTIRE document for "${student.full_name}" and find ALL their subjects.

      Extract EXACTLY as written:
      - "English HL" → {"name": "English", "level": "HL"}
      - "Math SL" → {"name": "Math", "level": "SL"}

      Return complete list of ALL 6 subjects.`,
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
                          level: { type: "string" }
                        }
                      }
                    }
                  }
                }
              });

              if (completeResult?.subjects && completeResult.subjects.length === 6) {
                student.subjects = completeResult.subjects;
                console.log(`✅ Completed subjects for ${student.full_name}`);
              }

              await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`Failed to complete subjects for ${student.full_name}:`, error);
            }
          }
        }

        if (dpValidation.wrongYearGroup.length > 0) {
          console.error(`❌ ${dpValidation.wrongYearGroup.length} students with invalid year group:`, 
            dpValidation.wrongYearGroup.map(s => `${s.full_name} (${s.year_group})`));
        }

        // Final validation check
        const stillInvalid = {
          wrongProgramme: allStudents.filter(s => s.ib_programme !== 'DP').length,
          incomplete: allStudents.filter(s => !s.subjects || s.subjects.length < 6).length,
          wrongYear: allStudents.filter(s => !['DP1', 'DP2'].includes(s.year_group)).length
        };

        if (stillInvalid.wrongProgramme > 0 || stillInvalid.incomplete > 0 || stillInvalid.wrongYear > 0) {
          const errorMsg = `⚠️ VALIDATION ERRORS:\n` +
            (stillInvalid.wrongProgramme > 0 ? `- ${stillInvalid.wrongProgramme} students not labeled as DP\n` : '') +
            (stillInvalid.incomplete > 0 ? `- ${stillInvalid.incomplete} students missing subjects (need 6)\n` : '') +
            (stillInvalid.wrongYear > 0 ? `- ${stillInvalid.wrongYear} students without DP1/DP2 year group\n` : '') +
            `\nDo you want to continue anyway? These will need manual correction.`;

          if (!confirm(errorMsg)) {
            throw new Error('Import cancelled due to validation errors');
          }
        }
      }

      // Don't check for "missing" students - causes hallucinations
      console.log(`Proceeding with ${allStudents.length} extracted students`);

      const rawStudents = allStudents;
      
      // Smart deduplication - only remove TRUE duplicates (exact same person extracted twice)
      const studentsData = [];
      const duplicateLog = [];
      
      for (let i = 0; i < rawStudents.length; i++) {
        const student = rawStudents[i];
        
        // Check if this exact student already exists
        const isDuplicate = studentsData.some(existing => {
          const sameName = existing.full_name?.toLowerCase().trim() === student.full_name?.toLowerCase().trim();
          const sameEmail = existing.email && student.email && 
            existing.email.toLowerCase().trim() === student.email.toLowerCase().trim();
          const sameId = existing.student_id && student.student_id && 
            existing.student_id.toLowerCase().trim() === student.student_id.toLowerCase().trim();
          
          // Only mark as duplicate if name matches AND (email OR student_id also match)
          // This preserves students with same name but different email/id (legitimate duplicates in document)
          return sameName && (sameEmail || sameId);
        });
        
        if (!isDuplicate) {
          studentsData.push(student);
        } else {
          duplicateLog.push(student.full_name);
          console.log(`Removed duplicate: ${student.full_name} (matched email/ID)`);
        }
      }
      
      if (duplicateLog.length > 0) {
        console.log(`Removed ${duplicateLog.length} duplicate extractions (same name + email/ID)`);
      }

      if (studentsData.length === 0) {
        throw new Error('No students found in the document');
      }

      const duplicatesRemoved = rawStudents.length - studentsData.length;
      if (duplicatesRemoved > 0) {
        console.log(`Removed ${duplicatesRemoved} duplicate entries`);
      }

      console.log(`Extracted ${studentsData.length} unique students`);

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
      const subjectsList = await base44.entities.Subject.list();

      // Get ALL subjects for auto-assignment
      const programmeSubjects = await base44.entities.Subject.filter({ school_id: schoolId });

      const pypSubjects = programmeSubjects
        .filter(s => s.ib_level === 'PYP' && s.is_active !== false)
        .map(s => ({ subject_id: s.id, ib_group: s.ib_group }));

      const mypSubjects = programmeSubjects
        .filter(s => s.ib_level === 'MYP' && s.is_active !== false)
        .map(s => ({ subject_id: s.id, ib_group: s.ib_group }));

      const studentsToCreate = studentsData.map(student => {
        let subjectChoices = [];

        // For PYP/MYP: Auto-assign ALL programme subjects
        if (student.ib_programme === 'PYP') {
          subjectChoices = pypSubjects;
          console.log(`Auto-assigned ${pypSubjects.length} PYP subjects to ${student.full_name}`);
        } else if (student.ib_programme === 'MYP') {
          subjectChoices = mypSubjects;
          console.log(`Auto-assigned ${mypSubjects.length} MYP subjects to ${student.full_name}`);
        } else if (student.subjects && Array.isArray(student.subjects)) {
          // For DP: Process extracted subjects with intelligent matching
          subjectChoices = student.subjects.map(subj => {
            const normalizedExtracted = subj.name?.toLowerCase().trim().replace(/\s+/g, ' ');

            // Try multiple matching strategies
            const matchedSubject = subjectsList.find(s => {
              const normalizedDB = s.name?.toLowerCase().trim().replace(/\s+/g, ' ');
              const codeDB = s.code?.toLowerCase().trim();

              // 1. Exact match
              if (normalizedDB === normalizedExtracted || codeDB === normalizedExtracted) {
                return true;
              }

              // 2. Common abbreviations and variations
              const variations = {
                'english': ['english a', 'english language and literature', 'english lang lit', 'language and literature'],
                'spanish': ['spanish a', 'spanish b', 'spanish language', 'spanish ab initio'],
                'french': ['french a', 'french b', 'french language', 'french ab initio'],
                'german': ['german a', 'german b', 'german language', 'german ab initio'],
                'chinese': ['chinese a', 'chinese b', 'chinese language', 'chinese ab initio'],
                'math': ['mathematics', 'maths', 'math aa', 'math ai', 'mathematics aa', 'mathematics ai'],
                'physics': ['physics'],
                'chemistry': ['chemistry', 'chem'],
                'biology': ['biology', 'bio'],
                'history': ['history'],
                'geography': ['geography', 'geo'],
                'economics': ['economics', 'econ'],
                'business': ['business management', 'business studies', 'business'],
                'psychology': ['psychology', 'psych'],
                'visual arts': ['visual arts', 'art', 'arts'],
                'music': ['music'],
                'theatre': ['theatre', 'theater'],
                'film': ['film'],
                'dance': ['dance'],
                'computer science': ['computer science', 'comp sci', 'cs'],
                'design technology': ['design technology', 'design tech', 'dt'],
                'tok': ['theory of knowledge', 'tok'],
                'ee': ['extended essay', 'ee'],
                'cas': ['creativity activity service', 'cas']
              };

              // Check if extracted subject matches any variation
              for (const [key, varList] of Object.entries(variations)) {
                const extractedMatchesKey = varList.some(v => normalizedExtracted.includes(v) || v.includes(normalizedExtracted));
                const dbMatchesKey = varList.some(v => normalizedDB.includes(v) || v.includes(normalizedDB));

                if (extractedMatchesKey && dbMatchesKey) {
                  return true;
                }
              }

              // 3. Partial match (one contains the other)
              if (normalizedDB.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedDB)) {
                return true;
              }

              // 4. Code match
              if (codeDB && (normalizedExtracted.includes(codeDB) || codeDB.includes(normalizedExtracted))) {
                return true;
              }

              return false;
            });

            if (matchedSubject) {
              console.log(`✓ Matched "${subj.name}" → "${matchedSubject.name}" (${subj.level})`);
              return {
                subject_id: matchedSubject.id,
                level: subj.level || 'SL',
                ib_group: matchedSubject.ib_group
              };
            } else {
              console.warn(`✗ Could not match subject: "${subj.name}" (${subj.level})`);
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
        queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['classGroups'] });
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
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {filteredStudents.map((student, index) => {
            const normalizeYearGroup = (yg, prog) => {
              if (!yg) return yg;
              if (prog === 'PYP' && yg.toLowerCase().includes('pyp')) return yg;
              return yg;
            };

            const programmeColors = {
              DP: {
                border: 'border-l-4 border-l-blue-500',
                avatar: 'from-blue-500 to-cyan-500',
                badge: 'bg-blue-100 text-blue-700',
                header: 'from-blue-50 to-cyan-50'
              },
              MYP: {
                border: 'border-l-4 border-l-emerald-500',
                avatar: 'from-emerald-500 to-teal-600',
                badge: 'bg-emerald-100 text-emerald-700',
                header: 'from-emerald-50 to-teal-50'
              },
              PYP: {
                border: 'border-l-4 border-l-amber-500',
                avatar: 'from-amber-500 to-orange-500',
                badge: 'bg-amber-100 text-amber-700',
                header: 'from-amber-50 to-orange-50'
              }
            };

            const colors = programmeColors[student.ib_programme] || programmeColors.DP;

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ scale: 1.05, y: -8, transition: { duration: 0.2 } }}
              >
                <Card className={`group hover:shadow-2xl transition-all duration-300 border-slate-200 overflow-hidden ${colors.border}`}>
                  <CardHeader className={`pb-3 bg-gradient-to-br ${colors.header}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors.avatar} flex items-center justify-center text-white font-semibold text-lg shadow-lg`}>
                          {student.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold text-slate-900">{student.full_name}</CardTitle>
                          <p className="text-xs text-slate-500 mt-0.5">{student.student_id}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(student)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-rose-600"
                            onClick={() => deleteMutation.mutate(student.id)}
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
                      <GraduationCap className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-600 truncate">{student.email}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={`${colors.badge} border-0`}>
                        {student.ib_programme}
                      </Badge>
                      <Badge variant="outline" className="text-slate-600">
                        {normalizeYearGroup(student.year_group, student.ib_programme)}
                      </Badge>
                    </div>

                    {student.subject_choices && student.subject_choices.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs font-medium text-slate-500 mb-2">
                          {student.ib_programme === 'DP' ? 'Subjects' : `${student.subject_choices.length} Subjects`}
                        </p>
                        {student.ib_programme === 'DP' ? (
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-0">
                              {getSubjectInfo(student.subject_choices).hl} HL
                            </Badge>
                            <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-0">
                              {getSubjectInfo(student.subject_choices).sl} SL
                            </Badge>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {student.subject_choices.slice(0, 3).map((choice, i) => {
                              const subject = subjects.find(s => s.id === choice.subject_id);
                              return subject ? (
                                <Badge key={i} variant="secondary" className="bg-indigo-50 text-indigo-700 border-0 text-xs">
                                  {subject.name}
                                </Badge>
                              ) : null;
                            })}
                            {student.subject_choices.length > 3 && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0 text-xs">
                                +{student.subject_choices.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence>
        {isDialogOpen && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0" asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-2xl">{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update student information.' : 'Enter the details for the new student.'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
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
                    <Label htmlFor="student_id" className="text-sm font-semibold text-slate-700">Student ID</Label>
                    <Input 
                      id="student_id"
                      value={formData.student_id}
                      onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
                      placeholder="STU-001"
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Email</Label>
                  <Input 
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="student@school.com"
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ib_programme" className="text-sm font-semibold text-slate-700">IB Programme *</Label>
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
                      <SelectTrigger className="h-11">
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
                    <Label htmlFor="year_group" className="text-sm font-semibold text-slate-700">Year Group *</Label>
                    <Select 
                      value={formData.year_group} 
                      onValueChange={(value) => setFormData({ ...formData, year_group: value })}
                    >
                      <SelectTrigger className="h-11">
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
              </div>

              <div className="border-t border-slate-200 pt-6 space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Subject Choices</Label>
                {(formData.ib_programme === 'PYP' || formData.ib_programme === 'MYP') && (
                  <p className="text-xs text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
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
                <div className="border-t border-slate-200 pt-6">
                  <DPValidator 
                    subjectChoices={formData.subject_choices}
                    subjects={subjects}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50 gap-2">
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
                  editingStudent ? 'Save Changes' : 'Add Student'
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