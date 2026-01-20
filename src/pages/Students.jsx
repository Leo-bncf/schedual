import React, { useState, useEffect } from 'react';
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
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

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

  useEffect(() => {
    if (!school) return;
    if (!allowedProgrammes.includes(formData.ib_programme)) {
      const next = allowedProgrammes[0] || 'MYP';
      setFormData(prev => ({
        ...prev,
        ib_programme: next,
        year_group: next === 'MYP' ? 'MYP1' : next === 'PYP' ? 'PYP-A' : 'DP1'
      }));
    }
  }, [school]);

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

    if (!allowedProgrammes.includes(formData.ib_programme)) {
      alert(`Your plan does not allow creating ${formData.ib_programme} students.`);
      return;
    }
    
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

    const handleServiceVerify = async () => {
      const { data } = await base44.functions.invoke('diagnoseStudents', { school_id: schoolId });
      const totals = data?.totals || {};
      const cross = data?.crossSchool || {};
      const bySchool = cross.studentsBySchool ? Object.entries(cross.studentsBySchool).slice(0,5).map(([k,v])=>`${k}: ${v}`).join(', ') : 'n/a';
      alert(`School ${totals.schoolId || schoolId}\nStudents: ${totals.students_total || 0}\nClassGroups: ${totals.classgroups_total || 0}\nSubjects: ${totals.subjects_total || 0}\nAll schools (sample): ${bySchool}`);
    };

    const handleAttachVisible = async () => {
    const ids = filteredStudents.map(s => s.id).filter(Boolean);
    if (ids.length === 0) { alert('No students in current view.'); return; }
    if (!confirm(`Re-tag ${ids.length} students to your school?`)) return;
    const { data } = await base44.functions.invoke('retagStudentsToSchool', { studentIds: ids });
    alert(`Re-tagged ${data?.updated || 0} students. Confirmed now in school ${data?.targetSchoolId}: ${data?.confirmedToTarget || 0}\nBy school: ${JSON.stringify(data?.countsBySchool || {})}`);
    queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
    queryClient.invalidateQueries({ queryKey: ['students'] });
    queryClient.invalidateQueries({ queryKey: ['classGroups'] });
    };

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

      setUploadState(prev => ({ ...prev, stage: 'extracting', progress: 'Learning from past corrections...' }));

      // Fetch training data to learn from past errors (limit to recent 10)
      let learningContext = '';
      try {
        const { data: trainingResponse } = await base44.functions.invoke('aiTrainingUpload', { 
          action: 'list', 
          agent_name: 'student_importer' 
        });
        const trainingList = (trainingResponse?.data || []).slice(-10); // Only last 10

        if (trainingList.length > 0) {
          const corrections = [];

          trainingList.forEach(training => {
            if (training?.field_feedback) {
              Object.entries(training.field_feedback).forEach(([field, feedback]) => {
                if (!feedback.was_correct && feedback.corrected !== undefined) {
                  corrections.push({
                    field,
                    original: feedback.original,
                    corrected: feedback.corrected
                  });
                }
              });
            }
          });

          if (corrections.length > 0) {
            learningContext = '\n\nLEARNINGS:\n';
            corrections.slice(-10).forEach(c => {
              learningContext += `- ${c.field}: "${c.original}" → "${c.corrected}"\n`;
            });
          }
        }
      } catch (error) {
        console.warn('Training data unavailable');
      }

      setUploadState(prev => ({ ...prev, progress: 'AI analyzing document with learned patterns...' }));

      // Extract using LLM with training context (deterministic extraction)
      const llmResponse = await base44.integrations.Core.InvokeLLM({
        temperature: 0.0,
        prompt: `You are extracting student data from an IB school document.

      CRITICAL - READ THIS FIRST:
      The document may show:
      1. "Available subjects" (subjects offered by the school) - IGNORE THESE
      2. "Selected subjects" or "Current subjects" (subjects the student is taking) - EXTRACT THESE ONLY

      Look for visual indicators of SELECTED subjects:
      - Checkmarks, highlights, or bold text
      - Sections labeled "Current Subjects", "Selected", "Student's Choices"
      - Lists under a student's name showing their enrolled subjects

      DO NOT extract from sections showing:
      - "Available subjects", "Subject options", "Choose from"
      - Grid/tables showing all possible subject-level combinations

      ${learningContext}

      CRITICAL INSTRUCTIONS - MANDATORY VALIDATION BEFORE RETURNING:
1. PROGRAMME DETECTION: Look for HL/SL (DP), year numbers (MYP), or class letters (PYP)

2. YEAR GROUP ASSIGNMENT - STRICT FORMAT REQUIRED:
   - DP Programme: MUST be "DP1" or "DP2" exactly (check which year based on document structure/headings)
   - MYP Programme: MUST be "MYP1", "MYP2", "MYP3", "MYP4", or "MYP5" exactly
   - PYP Programme: MUST be "PYP-A", "PYP-B", "PYP-C", "PYP-D", "PYP-E", or "PYP-F" exactly (match the class letter)
   
   NEVER output generic "DP", "MYP", or "PYP" - ALWAYS include the specific year/class level.

3. DP STUDENTS: MUST have EXACTLY 6 UNIQUE subjects with HL/SL levels
   - CRITICAL: NO DUPLICATE SUBJECTS - Each subject name should appear ONLY ONCE per student
   - A subject CANNOT be taken at both HL and SL - choose ONE level only
   - If you see the same subject at multiple levels (e.g., "Math AI HL" in one place, "Math AI SL" in another):
     * This means the document is showing AVAILABLE OPTIONS, not selected subjects
     * Look for visual indicators (checkmark, bold, highlight) to identify which ONE the student selected
     * If no indicator, take the FIRST occurrence and ignore others
   - BEFORE RETURNING: Count each student's UNIQUE subject names - if not exactly 6, OUTPUT EXACTLY WHAT YOU SEE
   - CRITICAL: If a student has fewer than 6 subjects visible, return ONLY those visible subjects
   - DO NOT INVENT, GUESS, OR ADD subjects to reach 6
   - DO NOT randomly choose from available options lists
   - ONLY extract subjects that are EXPLICITLY marked as selected/current for that student
   
   EXAMPLE - CORRECT EXTRACTION:
   Document shows: "Current Subjects: English A HL, Math AI HL, History HL, Biology SL, Spanish B SL"
   Extract: These 5 subjects exactly as shown (student needs 1 more)
   
   EXAMPLE - WRONG EXTRACTION (DON'T DO THIS):
   Document shows grid: "Math AI" available at "HL" and "SL"
   Wrong: Extract both "Math AI HL" and "Math AI SL"
   Correct: This is an options grid - look elsewhere for what the student actually selected

4. SELF-VALIDATION REQUIRED:
         For each DP student BEFORE adding to output:
         a) Count unique subject NAMES (ignore levels)
         b) Verify NO subject appears twice at different levels (e.g., "Math AI HL" AND "Math AI SL")
         c) Verify NO student has both Math AI AND Math AA
         d) If the document shows fewer than 6 subjects for a student, OUTPUT ONLY THOSE SUBJECTS
         e) DO NOT add random subjects to meet the 6-subject requirement
         f) DO NOT select from "available options" lists to fill gaps

         EXTRACT ONLY WHAT IS EXPLICITLY MARKED AS THE STUDENT'S SELECTED SUBJECTS.

5. CRITICAL - MATHEMATICS MUTUAL EXCLUSIVITY:
   - Math AI and Math AA are MUTUALLY EXCLUSIVE - a student can take ONLY ONE
   - If document shows both "Math AI" and "Math AA" for the same student, choose the FIRST one mentioned and IGNORE the other
   - NEVER output both Math AI and Math AA for the same student

6. CRITICAL - MATH FOR PYP/MYP STUDENTS:
   - For PYP and MYP students, there is NO "Math AI" or "Math AA" distinction
   - ALL math for PYP students should be reported as "Mathematics" (no AI/AA suffix)
   - ALL math for MYP students should be reported as "Mathematics" (no AI/AA suffix)
   - ONLY DP students can have "Math AI" or "Math AA"
   - If you see "Math AI" or "Math AA" for a PYP/MYP student, output just "Mathematics"

7. CRITICAL - SUBJECT NAME FORMATTING:
   Output subject names EXACTLY as they appear in the document with these guidelines:
   - Keep full official names: "Mathematics: Applications & Interpretation", "English A: Language & Literature", etc.
   - DO NOT abbreviate or shorten subject names
   - DO NOT add extra words or descriptions
   - Match capitalization and punctuation from the document
   - If document uses abbreviations like "Math AI", "Math AA", "Eng A", "Span B" - keep them as-is
   - Common formats to preserve:
     * "Mathematics: Applications & Interpretation (AI)"
     * "Mathematics: Analysis & Approaches (AA)"
     * "English A: Language & Literature"
     * "Spanish B"
     * "Business Management"
     * "Environmental Systems & Societies"

8. Subject matching: Use learned corrections above for common variations

9. Preserve all accents in names (é, ñ, ü, ö, etc.)

FINAL CHECK BEFORE RETURNING:
- Did you validate EVERY DP student has exactly 6 unique SUBJECT NAMES?
- Did you validate NO subject appears at multiple levels (e.g., same subject as both HL and SL)?
- Did you validate NO student has duplicate subjects?
- Did you validate NO student has both Math AI and Math AA?
- Did you validate HL/SL counts are correct (3-4 HL, 2-3 SL)?

Return ONLY students array, no other text.`,
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
                  ib_programme: { type: "string", enum: ["DP", "MYP", "PYP"] },
                  year_group: { type: "string" },
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
                },
                required: ["full_name", "ib_programme", "year_group"]
              }
            }
          }
        }
      });

      let extractedStudents = llmResponse?.students || [];
      
      if (extractedStudents.length === 0) {
        throw new Error('No students found in document');
      }

      // STRICT validation: Reject extraction if DP students are incomplete or have duplicate subjects at different levels
      const validationErrors = [];
      const validationWarnings = [];
      
      for (const student of extractedStudents) {
        if (student.ib_programme === 'DP' && student.subjects) {
          // Check for duplicate subject names (same subject at different levels)
          const subjectNames = student.subjects.map(s => s.name?.toLowerCase().trim());
          const uniqueSubjects = new Set(subjectNames);
          const uniqueCount = uniqueSubjects.size;
          
          // CRITICAL: Subject count must match unique count (no duplicates at different levels)
          if (subjectNames.length !== uniqueCount) {
            validationErrors.push(`${student.full_name}: Same subject appears at multiple levels (${subjectNames.length} entries, ${uniqueCount} unique)`);
          }
          
          // CRITICAL: DP students MUST have exactly 6 unique subjects
          if (uniqueCount !== 6) {
            validationErrors.push(`${student.full_name}: Has ${uniqueCount} unique subjects instead of 6`);
          }
          
          const hlCount = student.subjects.filter(s => s.level === 'HL').length;
          const slCount = student.subjects.filter(s => s.level === 'SL').length;
          
          // Validate HL/SL distribution
          if (hlCount < 3 || hlCount > 4) {
            validationErrors.push(`${student.full_name}: Invalid HL count (${hlCount}) - must be 3 or 4`);
          }
          if (slCount < 2 || slCount > 3) {
            validationErrors.push(`${student.full_name}: Invalid SL count (${slCount}) - must be 2 or 3`);
          }
        }
      }
      
      // REJECT extraction if critical errors found
      if (validationErrors.length > 0) {
        console.error('❌ EXTRACTION REJECTED - CRITICAL VALIDATION ERRORS:\n' + validationErrors.join('\n'));
        toast.error(`Extraction rejected: ${validationErrors.length} students have incomplete data. Please check the document format and try again.`);
        setUploadProgress({ stage: 'idle', progress: 0 });
        return;
      }
      
      if (validationWarnings.length > 0) {
        console.warn('⚠️ VALIDATION WARNINGS:\n' + validationWarnings.join('\n'));
      }

      // Clean duplicates - SAME SUBJECT NAME CANNOT APPEAR AT DIFFERENT LEVELS
      extractedStudents = extractedStudents.map(student => {
        if (!student.subjects || !Array.isArray(student.subjects)) return student;

        const uniqueSubjects = [];
        const seenSubjectNames = new Set(); // Track by NAME only, not name+level
        let hasMathAI = false;
        let hasMathAA = false;

        for (const subject of student.subjects) {
          const normalizedName = subject.name?.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
          const level = subject.level?.toUpperCase();
          
          // Check for Math AI/AA mutual exclusivity
          const isMathAI = normalizedName?.includes('interpretation') || normalizedName?.includes('ai');
          const isMathAA = normalizedName?.includes('approaches') || normalizedName?.includes('aa');
          const isMath = normalizedName?.includes('math');

          if (isMath && isMathAI && hasMathAA) {
            console.log(`❌ Skipping Math AI for ${student.full_name} - already has Math AA`);
            continue;
          }
          if (isMath && isMathAA && hasMathAI) {
            console.log(`❌ Skipping Math AA for ${student.full_name} - already has Math AI`);
            continue;
          }

          // CRITICAL: Prevent same subject at multiple levels (e.g., Math AI HL + Math AI SL)
          if (seenSubjectNames.has(normalizedName)) {
            console.log(`❌ Removed duplicate subject at different level: ${subject.name} (${level}) for ${student.full_name}`);
            continue;
          }

          seenSubjectNames.add(normalizedName);
          uniqueSubjects.push(subject);

          if (isMath && isMathAI) hasMathAI = true;
          if (isMath && isMathAA) hasMathAA = true;
        }

        if (uniqueSubjects.length !== student.subjects.length) {
          console.log(`✅ Cleaned ${student.full_name}: ${student.subjects.length} → ${uniqueSubjects.length} subjects`);
        }

        return { ...student, subjects: uniqueSubjects };
      });

      console.log(`✅ Extracted ${extractedStudents.length} students with training-enhanced AI (duplicates removed)`);

      // Validate LLM output structure
      const invalidStudents = extractedStudents.filter(s => 
        !s.full_name || !s.ib_programme || !s.year_group
      );

      if (invalidStudents.length > 0) {
        console.error('❌ Invalid student data:', invalidStudents);
        throw new Error(`AI returned incomplete data for ${invalidStudents.length} students. Please try again.`);
      }

      const allStudents = extractedStudents;
      console.log(`Total extracted: ${allStudents.length} students from AI`);

      // Validation logging
      const dpStudents = allStudents.filter(s => s.ib_programme === 'DP');
      if (dpStudents.length > 0) {
        const issues = dpStudents.filter(s => s.subjects?.length !== 6 || !s.subjects.every(subj => subj.level));
        if (issues.length > 0) {
          console.warn(`⚠️ ${issues.length} DP students with incomplete subjects:`, 
            issues.map(s => `${s.full_name}: ${s.subjects?.length || 0} subjects`));
        }
      }

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

      const studentsToCreate = studentsData.filter(s => allowedProgrammes.includes(s.ib_programme)).map(student => {
        let subjectChoices = [];

        // For PYP/MYP: Auto-assign ALL programme subjects
        if (student.ib_programme === 'PYP') {
          subjectChoices = pypSubjects;
          console.log(`Auto-assigned ${pypSubjects.length} PYP subjects to ${student.full_name}`);
        } else if (student.ib_programme === 'MYP') {
          subjectChoices = mypSubjects;
          console.log(`Auto-assigned ${mypSubjects.length} MYP subjects to ${student.full_name}`);
        } else if (student.subjects && Array.isArray(student.subjects)) {
          // For DP: Process extracted subjects with enhanced matching
          subjectChoices = student.subjects.map(subj => {
            console.log(`🔍 Matching subject: "${subj.name}" (${subj.level || 'no level'})`);
            
            const normalizedExtracted = subj.name?.toLowerCase().trim()
              .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            // Try multiple matching strategies
            const matchedSubject = subjectsList.find(s => {
              const normalizedDB = s.name?.toLowerCase().trim()
                .replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              const codeDB = s.code?.toLowerCase().trim();

              // 1. Exact match (most reliable)
              if (normalizedDB === normalizedExtracted || codeDB === normalizedExtracted) {
                console.log(`  ✅ EXACT match: "${s.name}"`);
                return true;
              }
              
              // 1b. Near-exact match (ignore special chars)
              const extractedNoSpecial = normalizedExtracted.replace(/[^a-z0-9]/g, '');
              const dbNoSpecial = normalizedDB.replace(/[^a-z0-9]/g, '');
              if (extractedNoSpecial === dbNoSpecial) {
                console.log(`  ✅ NEAR-EXACT match: "${s.name}"`);
                return true;
              }

              // 2. Enhanced variations map - CRITICAL: Math AI and Math AA must be matched separately
              const variations = {
                'english': ['english a', 'english language and literature', 'english lang lit', 'language and literature', 'english literature', 'eng lit', 'english lang', 'lang lit'],
                'spanish': ['spanish a', 'spanish b', 'spanish language', 'spanish ab initio', 'spanish ab', 'spanish lang'],
                'french': ['french a', 'french b', 'french language', 'french ab initio', 'french ab', 'french lang'],
                'german': ['german a', 'german b', 'german language', 'german ab initio', 'german ab', 'german lang'],
                'chinese': ['chinese a', 'chinese b', 'chinese language', 'chinese ab initio', 'chinese ab', 'chinese lang', 'mandarin'],
                'math_ai': ['math ai', 'mathematics ai', 'math applications', 'mathematics applications', 'applications and interpretation', 'applications & interpretation'],
                'math_aa': ['math aa', 'mathematics aa', 'math analysis', 'mathematics analysis', 'analysis and approaches', 'analysis & approaches'],
                'mathematics': ['mathematics', 'maths'],
                'physics': ['physics', 'phys'],
                'chemistry': ['chemistry', 'chem'],
                'biology': ['biology', 'bio'],
                'history': ['history', 'hist'],
                'geography': ['geography', 'geo', 'geog'],
                'economics': ['economics', 'econ', 'eco'],
                'business': ['business management', 'business studies', 'business', 'business man', 'bm'],
                'psychology': ['psychology', 'psych'],
                'environmental': ['environmental systems and societies', 'ess', 'environmental systems', 'environmental', 'env systems'],
                'visual arts': ['visual arts', 'art', 'arts', 'va'],
                'music': ['music'],
                'theatre': ['theatre', 'theater', 'drama', 'theatre arts'],
                'film': ['film', 'film studies'],
                'dance': ['dance'],
                'computer science': ['computer science', 'comp sci', 'cs', 'computing', 'computer'],
                'design technology': ['design technology', 'design tech', 'dt', 'design', 'technology'],
                'tok': ['theory of knowledge', 'tok'],
                'ee': ['extended essay', 'ee'],
                'cas': ['creativity activity service', 'cas']
              };

              // Check variations with flexible matching
              for (const [key, varList] of Object.entries(variations)) {
                const extractedMatchesKey = varList.some(v => {
                  const normalized = v.replace(/\s+/g, ' ').trim();
                  return normalizedExtracted.includes(normalized) || 
                         normalized.includes(normalizedExtracted) ||
                         normalizedExtracted.replace(/\s/g, '').includes(normalized.replace(/\s/g, ''));
                });
                const dbMatchesKey = varList.some(v => {
                  const normalized = v.replace(/\s+/g, ' ').trim();
                  return normalizedDB.includes(normalized) || 
                         normalized.includes(normalizedDB) ||
                         normalizedDB.replace(/\s/g, '').includes(normalized.replace(/\s/g, ''));
                });

                if (extractedMatchesKey && dbMatchesKey) {
                  console.log(`  ✅ VARIATION match via "${key}": "${s.name}"`);
                  return true;
                }
              }

              // 3. Enhanced partial match - check core words
              const extractedWords = normalizedExtracted.split(' ').filter(w => w.length > 2);
              const dbWords = normalizedDB.split(' ').filter(w => w.length > 2);
              
              const commonWords = extractedWords.filter(w => dbWords.includes(w));
              if (commonWords.length >= Math.min(extractedWords.length, dbWords.length, 2)) {
                console.log(`  ✅ WORD match (${commonWords.length} common words): "${s.name}"`);
                return true;
              }

              // 4. Substring match (more flexible)
              if (normalizedDB.includes(normalizedExtracted) || normalizedExtracted.includes(normalizedDB)) {
                console.log(`  ✅ SUBSTRING match: "${s.name}"`);
                return true;
              }

              // 5. Code match with flexibility
              if (codeDB && (normalizedExtracted.includes(codeDB) || codeDB.includes(normalizedExtracted) || normalizedExtracted.replace(/\s/g, '') === codeDB.replace(/\s/g, ''))) {
                console.log(`  ✅ CODE match: "${s.name}"`);
                return true;
              }

              return false;
            });

            if (matchedSubject) {
              console.log(`✅ FINAL MATCH: "${subj.name}" → "${matchedSubject.name}" (${subj.level})`);
              return {
                subject_id: matchedSubject.id,
                level: subj.level || 'SL',
                ib_group: matchedSubject.ib_group
              };
            } else {
              console.warn(`❌ NO MATCH FOUND for: "${subj.name}" (${subj.level})`);
              console.warn(`   Available subjects in DB:`, subjectsList.map(s => s.name).join(', '));
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

      // Batch create
      const batchSize = 25;
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
        } catch (error) {
          console.error('Batch error:', error);
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

            <Button type="button" variant="outline" onClick={handleServiceVerify}>
              Verify
            </Button>
            <Button type="button" variant="outline" onClick={handleAttachVisible}>
              Attach Visible
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

      {school && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6">
          <p className="text-sm text-slate-700">
            Your plan: <strong>{(school.subscription_tier || 'unknown').toUpperCase()}</strong>. Enabled programmes: {allowedProgrammes.join(', ')}.
            {(!allowedProgrammes.includes('DP') || !allowedProgrammes.includes('PYP')) && (
              <> <Link to={createPageUrl('Subscription')} className="text-blue-700 underline">Upgrade</Link> for more.</>
            )}
          </p>
        </div>
      )}

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
           {allowedProgrammes.includes('DP') && (
             <>
               <TabsTrigger value="DP1" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white transition-all">DP1 ({dp1Count})</TabsTrigger>
               <TabsTrigger value="DP2" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-purple-500 data-[state=active]:text-white transition-all">DP2 ({dp2Count})</TabsTrigger>
             </>
           )}
           {allowedProgrammes.includes('MYP') && (
             <>
               <TabsTrigger value="MYP1" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP1 ({mypCounts.MYP1})</TabsTrigger>
               <TabsTrigger value="MYP2" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP2 ({mypCounts.MYP2})</TabsTrigger>
               <TabsTrigger value="MYP3" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP3 ({mypCounts.MYP3})</TabsTrigger>
               <TabsTrigger value="MYP4" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP4 ({mypCounts.MYP4})</TabsTrigger>
               <TabsTrigger value="MYP5" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500 data-[state=active]:to-teal-500 data-[state=active]:text-white transition-all">MYP5 ({mypCounts.MYP5})</TabsTrigger>
             </>
           )}
           {allowedProgrammes.includes('PYP') && (
             <>
               <TabsTrigger value="PYP-A" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP A ({pypCounts['PYP-A']})</TabsTrigger>
               <TabsTrigger value="PYP-B" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP B ({pypCounts['PYP-B']})</TabsTrigger>
               <TabsTrigger value="PYP-C" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP C ({pypCounts['PYP-C']})</TabsTrigger>
               <TabsTrigger value="PYP-D" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP D ({pypCounts['PYP-D']})</TabsTrigger>
               <TabsTrigger value="PYP-E" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP E ({pypCounts['PYP-E']})</TabsTrigger>
               <TabsTrigger value="PYP-F" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white transition-all">PYP F ({pypCounts['PYP-F']})</TabsTrigger>
             </>
           )}
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

      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0">
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
                        {allowedProgrammes.includes('PYP') && (
                          <SelectItem value="PYP">PYP (Primary Years)</SelectItem>
                        )}
                        {allowedProgrammes.includes('MYP') && (
                          <SelectItem value="MYP">MYP (Middle Years)</SelectItem>
                        )}
                        {allowedProgrammes.includes('DP') && (
                          <SelectItem value="DP">DP (Diploma Programme)</SelectItem>
                        )}
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
                
                {editingStudent && formData.subject_choices && formData.subject_choices.length > 0 && (
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-medium text-slate-600 mb-3">Current Subjects:</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.subject_choices.map((choice, idx) => {
                        const subject = subjects.find(s => s.id === choice.subject_id);
                        return subject ? (
                          <Badge key={idx} variant="secondary" className="bg-white border border-slate-300 text-slate-700">
                            {subject.name} {choice.level ? `(${choice.level})` : ''}
                          </Badge>
                        ) : (
                          <Badge key={idx} variant="secondary" className="bg-amber-50 border border-amber-300 text-amber-700">
                            Unknown Subject {choice.level ? `(${choice.level})` : ''}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
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