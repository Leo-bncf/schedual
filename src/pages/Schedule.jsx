import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { toast } from 'sonner';
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Calendar, 
  Play, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Sparkles,
  Download,
  Eye,
  Archive,
  Loader2,
  Trash2,
  Users,
  Hash,
  Timer,
  Shield,
  Info
} from 'lucide-react';
import PageHeader from '../components/ui-custom/PageHeader';
import TimetableGrid from '../components/schedule/TimetableGrid';
import HoursSummary from '../components/schedule/HoursSummary';
import StudentScheduleView from '../components/schedule/StudentScheduleView';
import UnassignedBanner from '../components/schedule/UnassignedBanner';
import OffByOneBanner from '../components/schedule/OffByOneBanner';
import TeacherScheduleView from '../components/schedule/TeacherScheduleView';
import ScheduleExporter from '../components/schedule/ScheduleExporter';
import ConflictAlert from '../components/schedule/ConflictAlert';
import ConflictViewer from '../components/schedule/ConflictViewer';
import EmptyState from '../components/ui-custom/EmptyState';
import GenerationProgress from '../components/schedule/GenerationProgress';
import ScheduleUpdateBanner from '../components/schedule/ScheduleUpdateBanner';
import UtilizationStats from '../components/schedule/UtilizationStats';


export default function Schedule() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const [cancelGeneration, setCancelGeneration] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    stage: '',
    percent: 0,
    message: '',
    currentStep: '',
    completedSteps: [],
    completed: false
  });
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);
  const [selectedClassGroupId, setSelectedClassGroupId] = useState(null);
  const [constraintDialogOpen, setConstraintDialogOpen] = useState(false);
  const [constraintInput, setConstraintInput] = useState('');
  const [isGeneratingConstraint, setIsGeneratingConstraint] = useState(false);
  const [dpDiagOpen, setDpDiagOpen] = useState(false);
  const [dpDiagData, setDpDiagData] = useState(null);
  const [dpDiagLoading, setDpDiagLoading] = useState(false);
  const [constraintType, setConstraintType] = useState('hard');
  // OR-Tool response state
  const [orToolResult, setOrToolResult] = useState(null);
  const [orToolLoading, setOrToolLoading] = useState(false);
  const [orToolError, setOrToolError] = useState(null);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
    status: 'draft'
  });
  const [schoolConfig, setSchoolConfig] = useState({
    periods_per_day: 8,
    period_duration_minutes: 60,
    days_per_week: 5,
    school_start_time: '08:00',
    day_start_time: '08:00',
    day_end_time: '18:00',
    days_of_week: ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'],
    breaks: [],
    min_periods_per_day: 10,
    target_periods_per_day: 10,
    hl_hours: 6,
    sl_hours: 4,
    lunch_duration_minutes: 30,
    lunch_period: 4,
    break_duration_minutes: 15,
    break_periods: [2, 6],
    test_config: {
      PYP: { tests_per_week: 1, test_duration_minutes: 60, supervisor_id: null },
      MYP: { tests_per_week: 1, test_duration_minutes: 60, supervisor_id: null },
      DP1: { tests_per_week: 2, test_duration_minutes: 90, supervisor_id: null },
      DP2: { tests_per_week: 2, test_duration_minutes: 90, supervisor_id: null }
    }
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const schoolId = user?.school_id;

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => base44.entities.School.filter({ id: schoolId }),
    enabled: !!schoolId,
    select: (data) => data[0]
  });

  const allowedProgrammes = React.useMemo(() => {
    if (!school) return ['PYP','MYP','DP'];
    if (school.subscription_tier === 'tier1') return ['MYP'];
    if (school.subscription_tier === 'tier2' || school.subscription_tier === 'tier3') return ['PYP','MYP','DP'];
    return ['PYP','MYP','DP'];
  }, [school]);

  // Initialize school config when school data loads
  React.useEffect(() => {
    if (school) {
      setSchoolConfig({
        periods_per_day: school.periods_per_day || 8,
        period_duration_minutes: school.period_duration_minutes || 60,
        days_per_week: school.days_per_week || 5,
        school_start_time: school.school_start_time || '08:00',
        day_start_time: school.day_start_time || school.school_start_time || '08:00',
        day_end_time: school.day_end_time || '18:00',
        days_of_week: Array.isArray(school.days_of_week) && school.days_of_week.length > 0 ? school.days_of_week : ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'],
        breaks: school.breaks || [],
        min_periods_per_day: school.min_periods_per_day || 10,
        target_periods_per_day: school.target_periods_per_day || 10,
        hl_hours: school.settings?.hl_hours || 6,
        sl_hours: school.settings?.sl_hours || 4,
        lunch_duration_minutes: school.settings?.lunch_duration_minutes || 30,
        lunch_period: school.settings?.lunch_period || 4,
        break_duration_minutes: school.settings?.break_duration_minutes || 15,
        break_periods: school.settings?.break_periods || [2, 6],
        test_config: school.settings?.test_config || {
          PYP: { tests_per_week: 1, test_duration_minutes: 60, supervisor_id: null },
          MYP: { tests_per_week: 1, test_duration_minutes: 60, supervisor_id: null },
          DP1: { tests_per_week: 2, test_duration_minutes: 90, supervisor_id: null },
          DP2: { tests_per_week: 2, test_duration_minutes: 90, supervisor_id: null }
        }
      });
    }
  }, [school]);

  const { data: scheduleVersions = [], isLoading: loadingVersions } = useQuery({
    queryKey: ['scheduleVersions', schoolId],
    queryFn: () => base44.entities.ScheduleVersion.filter({ school_id: schoolId }, '-created_date'),
    enabled: !!schoolId,
  });

  const { data: scheduleSlots = [], isLoading: loadingSlots } = useQuery({
    queryKey: ['scheduleSlots', selectedVersion?.id],
    queryFn: () => selectedVersion ? base44.entities.ScheduleSlot.filter({ schedule_version: selectedVersion.id }) : [],
    enabled: !!selectedVersion,
  });

  const { data: offByOneConflicts = [] } = useQuery({
    queryKey: ['offByOneConflicts', selectedVersion?.id],
    queryFn: async () => selectedVersion ? await base44.entities.ConflictReport.filter({ schedule_version_id: selectedVersion.id }) : [],
    enabled: !!selectedVersion,
    select: (rows) => (rows || []).filter(r => r.conflict_type === 'insufficient_hours' || r.conflict_type === 'ib_requirement_violation')
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }),
    enabled: !!schoolId,
  });

  const { data: classGroups = [] } = useQuery({
    queryKey: ['classGroups', schoolId],
    queryFn: () => base44.entities.ClassGroup.filter({ school_id: schoolId }, '-year_group'),
    enabled: !!schoolId,
  });

  // Minutes-based helpers
  const getMinutesForGroup = (tg) => {
    const subj = subjects.find(s => s.id === tg.subject_id);
    const level = String(tg.level || '').toUpperCase();
    if (typeof tg.minutes_per_week === 'number' && tg.minutes_per_week > 0) return tg.minutes_per_week;
    if (typeof tg.hours_per_week === 'number' && tg.hours_per_week > 0) return Math.round(tg.hours_per_week * 60); // legacy fallback
    if (subj?.ib_level === 'DP') {
      return level === 'HL' ? (subj?.hl_minutes_per_week_default || 300) : (subj?.sl_minutes_per_week_default || 180);
    }
    return subj?.pyp_myp_minutes_per_week_default || 180;
  };

  const minutesToPeriods = (m) => {
    const period = school?.period_duration_minutes || schoolConfig.period_duration_minutes || 60;
    return Math.max(0, Math.ceil(m / period));
  };

  const periodsForGroup = (tg) => minutesToPeriods(getMinutesForGroup(tg));

  const { data: constraints = [], refetch: refetchConstraints } = useQuery({
    queryKey: ['constraints', schoolId],
    queryFn: async () => {
      console.log('Fetching constraints for school:', schoolId);
      const result = await base44.entities.Constraint.filter({ school_id: schoolId });
      console.log('Fetched constraints:', result);
      return result;
    },
    enabled: !!schoolId,
  });

  // Detect data changes to suggest regeneration
  React.useEffect(() => {
    if (selectedVersion?.generated_at) {
      const generatedTime = new Date(selectedVersion.generated_at).getTime();
      const hasRecentChanges = 
        teachers.some(t => new Date(t.updated_date).getTime() > generatedTime) ||
        students.some(s => new Date(s.updated_date).getTime() > generatedTime) ||
        rooms.some(r => new Date(r.updated_date).getTime() > generatedTime) ||
        teachingGroups.some(g => new Date(g.updated_date).getTime() > generatedTime);
      
      setShowUpdateBanner(hasRecentChanges);
    }
  }, [selectedVersion, teachers, students, rooms, teachingGroups]);

  const createVersionMutation = useMutation({
    mutationFn: (data) => {
      if (!schoolId) throw new Error('No school assigned');
      return base44.entities.ScheduleVersion.create({ ...data, school_id: schoolId });
    },
    onSuccess: (newVersion) => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      setIsDialogOpen(false);
      setSelectedVersion(newVersion);
      setFormData({ name: '', academic_year: '2024-2025', term: 'Fall', status: 'draft' });
    },
  });

  const updateVersionMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScheduleVersion.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleVersion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      setSelectedVersion(null);
    },
  });

  const updateSchoolMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.School.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school'] });
    },
  });

  const handleGenerateConstraint = async () => {
    if (!constraintInput.trim()) return;
    
    setIsGeneratingConstraint(true);
    
    try {
      console.log('Generating constraint with input:', constraintInput);
      console.log('Constraint type:', constraintType);
      console.log('School ID:', schoolId);
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a school scheduling constraint expert. Convert this natural language preference into a structured scheduling constraint:

"${constraintInput}"

Return a JSON object with these fields:
- name: short descriptive name (max 50 chars)
- description: detailed explanation
- category: one of: teacher, student, room, subject, time, ib_requirement, custom
- rule: object with specific constraint rules (e.g., {max_consecutive_periods: 4, teacher_id: "xyz"})
- weight: 0-1 for soft constraints (1 = highest priority)

Examples:
Input: "Teachers should not have more than 4 consecutive periods"
Output: {"name": "Max 4 consecutive periods", "description": "Limits teacher workload to 4 consecutive teaching periods", "category": "teacher", "rule": {"max_consecutive_periods": 4}, "weight": 1}

Input: "Dr. Smith prefers not to teach on Wednesday afternoons"
Output: {"name": "Dr. Smith - No Wed PM", "description": "Dr. Smith prefers to avoid Wednesday afternoon slots", "category": "teacher", "rule": {"unavailable_slots": [{"day": "Wednesday", "period": 5}, {"day": "Wednesday", "period": 6}, {"day": "Wednesday", "period": 7}, {"day": "Wednesday", "period": 8}]}, "weight": 0.8}

Now process the user's input and return ONLY the JSON object.`,
        response_json_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            category: { type: "string", enum: ["teacher", "student", "room", "subject", "time", "ib_requirement", "custom"] },
            rule: { type: "object" },
            weight: { type: "number" }
          },
          required: ["name", "description", "category", "rule", "weight"]
        }
      });

      console.log('LLM response:', response);

      const constraintData = {
        name: response.name,
        description: response.description,
        type: constraintType,
        category: response.category,
        rule: response.rule,
        weight: response.weight,
        school_id: schoolId,
        is_active: true,
        source: 'ai_suggested'
      };

      console.log('Creating constraint with data:', constraintData);

      const created = await base44.entities.Constraint.create(constraintData);
      console.log('Constraint created:', created);
      
      await queryClient.invalidateQueries({ queryKey: ['constraints', schoolId] });
      await refetchConstraints();
      
      setConstraintDialogOpen(false);
      setConstraintInput('');
      setConstraintType('hard');
      toast.success('✨ Constraint created from AI suggestion');
    } catch (error) {
      console.error('Error generating constraint:', error);
      console.error('Error details:', error.response?.data || error.message);
      toast.error(`Failed to generate constraint: ${error.message}`);
    } finally {
      setIsGeneratingConstraint(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!school) return;
    setIsSavingConfig(true);
    try {
      await updateSchoolMutation.mutateAsync({
        id: school.id,
        data: {
          days_per_week: schoolConfig.days_per_week,
          school_start_time: schoolConfig.school_start_time,
          period_duration_minutes: schoolConfig.period_duration_minutes,
          day_start_time: schoolConfig.day_start_time,
          day_end_time: schoolConfig.day_end_time,
          days_of_week: schoolConfig.days_of_week,
          breaks: schoolConfig.breaks,
          min_periods_per_day: schoolConfig.min_periods_per_day,
          target_periods_per_day: schoolConfig.target_periods_per_day,
          settings: {
            ...school.settings,
            hl_hours: schoolConfig.hl_hours,
            sl_hours: schoolConfig.sl_hours,
            lunch_duration_minutes: schoolConfig.lunch_duration_minutes,
            lunch_period: schoolConfig.lunch_period,
            break_duration_minutes: schoolConfig.break_duration_minutes,
            break_periods: schoolConfig.break_periods,
            test_config: schoolConfig.test_config
          }
        }
      });

      // Sync test subjects to Subject entity
      await base44.functions.invoke('syncTestSubjects');
      
      toast.success('Configuration saved successfully');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleRunDPDiagnostic = async () => {
    try {
      setDpDiagLoading(true);
      const { data } = await base44.functions.invoke('diagCoreScheduling', { run_solver: false });
      setDpDiagData(data);
      setDpDiagOpen(true);
    } catch (e) {
      console.error('DP diagnostic failed:', e);
      toast.error('DP diagnostic failed');
    } finally {
      setDpDiagLoading(false);
    }
  };

  // Fetch full OR-Tool scheduler JSON response and display it
  const handleFetchORTool = async () => {
    if (!selectedVersion) return;
    setOrToolLoading(true);
    setOrToolError(null);
    try {
      const res = await base44.functions.invoke('callORToolScheduler', { schedule_version_id: selectedVersion.id, dp_min_end_time: '16:00', dp_study_weekly: 8 });
      setOrToolResult(res.data);
      await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      toast.success('OR-Tool response retrieved');
    } catch (e) {
      console.error('OR-Tool fetch failed:', e);
      const data = e?.response?.data;
      if (data) {
        setOrToolResult(data);
      }
      setOrToolError(e?.message || 'Failed to fetch OR-Tool response');
      toast.error('Failed to retrieve OR-Tool response');
    } finally {
      setOrToolLoading(false);
    }
  };

  const handlePublish = async (version) => {
    // First unpublish any currently published version
    const currentPublished = scheduleVersions.find(v => v.status === 'published');
    if (currentPublished) {
      await updateVersionMutation.mutateAsync({ 
        id: currentPublished.id, 
        data: { status: 'archived' } 
      });
    }
    // Then publish the selected version
    await updateVersionMutation.mutateAsync({ 
      id: version.id, 
      data: { status: 'published', published_at: new Date().toISOString() } 
    });
  };

  const handleGenerateSchedule = async () => {
    if (!selectedVersion) return;
    
    setIsGenerating(true);
    setCancelGeneration(false);
    setGenerationProgress({
      stage: 'Initializing',
      percent: 0,
      message: 'Starting schedule generation...',
      currentStep: 'teachers',
      completedSteps: [],
      completed: false
    });
    
    try {
      if (cancelGeneration) {
        setGenerationProgress({
          stage: 'Cancelled',
          percent: 0,
          message: 'Schedule generation was cancelled',
          currentStep: '',
          completedSteps: [],
          completed: true
        });
        return;
      }

      console.log('=== SCHEDULE GENERATION START ===');
      console.log('School ID:', schoolId);
      console.log('Selected Version:', selectedVersion);
      console.log('Teaching Groups:', teachingGroups.length);
      console.log('Teachers:', teachers.length);
      console.log('Students:', students.length);
      console.log('Rooms:', rooms.length);
      console.log('Active Constraints:', constraints.filter(c => c.is_active).length);
      
      // Load active constraints
      const activeConstraints = constraints.filter(c => c.is_active);
      const hardConstraints = activeConstraints.filter(c => c.type === 'hard');
      const softConstraints = activeConstraints.filter(c => c.type === 'soft');
      console.log('Hard Constraints:', hardConstraints.length);
      console.log('Soft Constraints:', softConstraints.length);
      
      // Step 0: Auto-generate DP teaching groups
      if (cancelGeneration) throw new Error('Cancelled by user');
      
      if (allowedProgrammes.includes('DP')) {
        setGenerationProgress(prev => ({
          ...prev,
          stage: 'Generating DP Groups',
          percent: 5,
          message: 'Automatically creating DP teaching groups from student choices...'
        }));
        console.log('Auto-generating DP teaching groups...');
        
        try {
        // Try to clean up any duplicate subject assignments (optional)
        try {
          const { data: cleanupResult } = await base44.functions.invoke('cleanupDuplicateSubjects');
          if (cleanupResult?.students_fixed > 0) {
            console.log(`Fixed ${cleanupResult.students_fixed} students with duplicate subjects`);
          }
        } catch (cleanupError) {
          console.log('Cleanup function not available, continuing anyway...');
        }

        const { data: dpGroupResult } = await base44.functions.invoke('generateDpTeachingGroups', { 
          action: 'create', 
          max_group_size: 20 
        });
        console.log('DP group generation result:', dpGroupResult);
        console.log('DP groups created:', dpGroupResult?.created || 0);
        console.log('DP group names:', dpGroupResult?.groups?.map(g => g.name) || []);

        if (dpGroupResult?.duplicate_subjects?.length > 0) {
          console.warn('⚠️ Students with duplicate subjects:', dpGroupResult.duplicate_subjects);
        }

        if (!dpGroupResult?.success) {
          console.error('❌ DP group generation failed:', dpGroupResult?.message || dpGroupResult?.error);
        }
      } catch (dpError) {
        console.error('❌ DP group generation error:', dpError);
        console.error('Error details:', dpError.message, dpError.response?.data);
      }
      } else {
        console.log('Skipping DP group generation due to plan restrictions');
      }
      
      // Refresh teaching groups after auto-generation
      await queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 1: Assign teachers to teaching groups
      if (cancelGeneration) throw new Error('Cancelled by user');
      
      setGenerationProgress(prev => ({
        ...prev,
        stage: 'Assigning Teachers',
        percent: 10,
        message: 'Matching teachers to teaching groups based on qualifications...'
      }));
      console.log('Assigning teachers to teaching groups...');
      const { data: assignmentResult } = await base44.functions.invoke('assignTeachers');
      console.log('Teacher assignments:', assignmentResult);
      
      // Refresh teaching groups to get updated teacher assignments
      if (cancelGeneration) throw new Error('Cancelled by user');
      
      setGenerationProgress(prev => ({
        ...prev,
        stage: 'Preparing Data',
        percent: 15,
        message: 'Refreshing teaching group assignments...',
        completedSteps: ['teachers']
      }));
      await queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      await new Promise(resolve => setTimeout(resolve, 1000));
      const updatedGroups = await base44.entities.TeachingGroup.filter({ school_id: schoolId });
      console.log('Updated groups with teachers:', updatedGroups.filter(g => g.teacher_id).length);
      
      // Delete existing slots for this version (batch to avoid rate limits)
      if (cancelGeneration) throw new Error('Cancelled by user');
      
      setGenerationProgress(prev => ({
        ...prev,
        percent: 20,
        message: 'Clearing existing schedule slots...'
      }));
      const existingSlots = await base44.entities.ScheduleSlot.list();
      const slotsToDelete = existingSlots.filter(s => s.schedule_version === selectedVersion.id);
      
      console.log('Existing slots to delete:', slotsToDelete.length);
      
      if (slotsToDelete.length > 0) {
        // Delete in small batches with delays to avoid rate limits
        const batchSize = 3; // Reduced from 5
        for (let i = 0; i < slotsToDelete.length; i += batchSize) {
          const batch = slotsToDelete.slice(i, i + batchSize);
          await Promise.all(batch.map(slot => base44.entities.ScheduleSlot.delete(slot.id)));
          // Longer delay between batches to avoid rate limit
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1000ms
        }
        console.log('All slots deleted, waiting before creating new ones...');
        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 2000ms
      }

      // Comprehensive scheduling algorithm for all students, teachers, and rooms
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const periodsPerDay = school?.periods_per_day || 8;
      const periods = Array.from({ length: periodsPerDay }, (_, i) => i + 1);
      const newSlots = [];

      // Track availability for students, teachers, and rooms
      const studentSchedules = {};
      const teacherSchedules = {};
      const roomSchedules = {};
      const studentConsecutiveSubjects = {}; // Track consecutive subject periods

      // Initialize availability tracking
      students.forEach(s => { 
        studentSchedules[s.id] = []; 
        studentConsecutiveSubjects[s.id] = {}; // { day: [{ period, subjectId, count }] }
      });
      teachers.forEach(t => { teacherSchedules[t.id] = []; });
      rooms.forEach(r => { roomSchedules[r.id] = []; });

      // CRITICAL: Block break and lunch periods from scheduling (use school settings)
      const breakPeriods = school?.settings?.break_periods || [];
      const lunchPeriod = school?.settings?.lunch_period || 4;
      const blockedPeriods = new Set([...breakPeriods, lunchPeriod]);

      // Don't reserve test slots during class scheduling - they will be added at the end
      const reservedTestSlots = { PYP: [], MYP: [], DP1: [], DP2: [] };
      console.log('Test slots will be scheduled after classes to avoid blocking teaching periods');

      // Debug: Check why groups are being filtered out
      console.log('All teaching groups:', teachingGroups.length);
      teachingGroups.forEach((g, i) => {
        if (i < 3) { // Log first 3 groups
          console.log(`Group ${i}:`, {
            name: g.name,
            is_active: g.is_active,
            minutes_per_week: getMinutesForGroup(g),
            periods_per_week: minutesToPeriods(getMinutesForGroup(g)),
            teacher_id: g.teacher_id,
            student_ids_count: g.student_ids?.length || 0
          });
        }
      });

      // Helper to determine IB level from year_group
      const getIBLevel = (year_group) => {
        if (!year_group) return null;
        if (year_group.startsWith('DP')) return 'DP';
        if (year_group.startsWith('MYP')) return 'MYP';
        if (year_group.startsWith('PYP')) return 'PYP';
        return null;
      };

      // Separate groups by IB level and sort by teacher workload for balance
      const groupsByLevel = {
        DP: [],
        MYP: [],
        PYP: []
      };

      teachingGroups.forEach(g => {
        if (g.is_active === false) return;
        const mins = getMinutesForGroup(g);
        if (!mins || mins <= 0) return;

        const level = getIBLevel(g.year_group);
        if (level) {
          groupsByLevel[level].push(g);
        }
      });

      // Sort each level's groups to balance teacher workload
      Object.keys(groupsByLevel).forEach(level => {
        groupsByLevel[level].sort((a, b) => {
          const aHours = teacherSchedules[a.teacher_id]?.length || 0;
          const bHours = teacherSchedules[b.teacher_id]?.length || 0;
          return aHours - bHours; // Schedule for teachers with fewer hours first
        });
      });

      console.log('Groups by IB Level:', {
        DP: groupsByLevel.DP.length,
        MYP: groupsByLevel.MYP.length,
        PYP: groupsByLevel.PYP.length
      });

      // Schedule each IB level separately but track teachers globally
      const scheduleLevels = ['DP', 'MYP', 'PYP'].filter(level => allowedProgrammes.includes(level));
      
      for (const level of scheduleLevels) {
        if (cancelGeneration) throw new Error('Cancelled by user');

        console.log(`\n=== Scheduling ${level} ===`);
        if (!level) {
          console.warn('⚠️ Invalid level detected, skipping');
          continue;
        }

        // PYP/MYP: Use ClassGroups-based scheduling
        if (level === 'PYP' || level === 'MYP') {
          const levelPercent = level === 'DP' ? 30 : level === 'MYP' ? 50 : 70;
          setGenerationProgress(prev => ({
            ...prev,
            stage: `Scheduling ${level}`,
            percent: levelPercent,
            message: `Creating ${level} class schedules across the week...`,
            currentStep: level.toLowerCase()
          }));
          
          const levelClassGroups = classGroups.filter(cg => cg.ib_programme === level);
          console.log(`Using ClassGroup-based scheduling for ${level}`);
          console.log(`Found ${levelClassGroups.length} ${level} ClassGroups`);
          
          if (levelClassGroups.length === 0) {
            console.warn(`⚠️ No ${level} ClassGroups found - skipping ${level} scheduling`);
            continue;
          }
          
          const { data: result } = await base44.functions.invoke('generatePYPMYPSchedule', {
            schedule_version_id: selectedVersion.id,
            level
          });
          
          if (result.slots) {
            console.log(`✓ Generated ${result.slots.length} slots for ${level}`);
            newSlots.push(...result.slots);
            
            setGenerationProgress(prev => ({
              ...prev,
              message: `Created ${result.slots.length} ${level} schedule slots`,
              completedSteps: [...prev.completedSteps, level.toLowerCase()]
            }));
            
            // Update availability tracking
            result.slots.forEach(slot => {
              if (slot.teacher_id) {
                if (!teacherSchedules[slot.teacher_id]) teacherSchedules[slot.teacher_id] = [];
                teacherSchedules[slot.teacher_id].push({ day: slot.day, period: slot.period });
              }
              if (slot.room_id) {
                if (!roomSchedules[slot.room_id]) roomSchedules[slot.room_id] = [];
                roomSchedules[slot.room_id].push({ day: slot.day, period: slot.period });
              }
            });
          }
          continue;
        }

        // DP: HL/SL shared blocks + HL-only extras
        setGenerationProgress(prev => ({
          ...prev,
          stage: 'Scheduling DP',
          percent: 30,
          message: 'Creating SL shared blocks and HL extras...',
          currentStep: 'dp'
        }));

        // Consider only active DP groups
        const levelGroupsFromUpdated = updatedGroups.filter(g => {
          if (!g || g.is_active === false) return false;
          if (!g.subject_id) return false;
          const ibLevel = getIBLevel(g.year_group);
          return ibLevel === level && (level === 'DP' || ibLevel === level);
        });
        console.log(`Found ${levelGroupsFromUpdated.length} DP groups`);

        // Ensure groups have students (auto-assign if empty)
        for (const group of levelGroupsFromUpdated) {
          if (!Array.isArray(group.student_ids) || group.student_ids.length === 0) {
            const matching = students.filter(s => {
              if (s.is_active === false) return false;
              if (s.year_group !== group.year_group) return false;
              const has = (s.subject_choices || []).some(c => c.subject_id === group.subject_id && (!group.level || c.level === group.level));
              return has;
            });
            const ids = matching.map(s => s.id);
            if (ids.length > 0) {
              await base44.entities.TeachingGroup.update(group.id, { student_ids: ids });
              group.student_ids = ids;
              console.log(`Auto-assigned ${ids.length} students to ${group.name}`);
            }
          }
          if (group.teacher_id && !teacherSchedules[group.teacher_id]) teacherSchedules[group.teacher_id] = [];
        }

        // Group by subject and year_group
        const dpBySubjectYear = {};
        levelGroupsFromUpdated.forEach(g => {
          const key = `${g.subject_id}__${g.year_group}`;
          if (!dpBySubjectYear[key]) dpBySubjectYear[key] = [];
          dpBySubjectYear[key].push(g);
        });

        // Helper to shuffle
        const shuffleArray = (array) => {
          const a = [...array];
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          return a;
        };

        // Try to schedule N sessions for a "primary group" and mirror for others
        const scheduleSharedSessions = async ({ primaryGroup, mirrorGroups, subject, sessions }) => {
          let created = 0;
          const preferredRoomsBase = rooms.filter(r => r.is_active);
          const preferredRooms = subject?.requires_special_room
            ? preferredRoomsBase.filter(r => r.room_type === subject.requires_special_room)
            : preferredRoomsBase;

          const daysRandom = shuffleArray(days);
          const periodsRandomBase = [...periods];
          let periodsRandom = shuffleArray(periodsRandomBase);
          if (subject?.preferred_time === 'morning') periodsRandom = [...periods.filter(p => p <= 4), ...periods.filter(p => p > 4)];
          if (subject?.preferred_time === 'afternoon') periodsRandom = [...periods.filter(p => p > 4), ...periods.filter(p => p <= 4)];

          let teacherId = primaryGroup.teacher_id || mirrorGroups.find(m => m.teacher_id)?.teacher_id || null;
          if (!teacherId) {
            const candidates = teachers
              .filter(t => t.is_active !== false)
              .filter(t => {
                const subs = Array.isArray(t.subjects) ? t.subjects : [];
                const quals = Array.isArray(t.qualifications) ? t.qualifications : [];
                const has = subs.includes(subject.id) || quals.some(q => q.subject_id === subject.id);
                if (!has) return false;
                const q = quals.find(q => q.subject_id === subject.id);
                const levelOk = !q?.ib_levels || q.ib_levels.length === 0 || q.ib_levels.includes('DP');
                if (!levelOk) return false;
                const load = (teacherSchedules[t.id]?.length || 0);
                const max = t.max_hours_per_week || 25;
                return load < max;
              })
              .sort((a, b) => (teacherSchedules[a.id]?.length || 0) - (teacherSchedules[b.id]?.length || 0));
            if (candidates.length) {
              teacherId = candidates[0].id;
              await base44.entities.TeachingGroup.update(primaryGroup.id, { teacher_id: teacherId });
            }
          }
          if (teacherId && !teacherSchedules[teacherId]) teacherSchedules[teacherId] = [];

          const allStudentIds = [
            ...(primaryGroup.student_ids || []),
            ...mirrorGroups.flatMap(m => m.student_ids || [])
          ];

          for (const day of daysRandom) {
            if (created >= sessions) break;
            for (const period of periodsRandom) {
              if (created >= sessions) break;
              if (blockedPeriods.has(period)) continue;

              // Students free? Also block DP test times by year group
              const studentsFree = allStudentIds.every(sid => {
                const sched = studentSchedules[sid] || [];
                if (sched.some(s => s.day === day && s.period === period)) return false;
                const student = students.find(st => st.id === sid);
                if (student?.year_group && isReserved(student.year_group, day, period)) return false;
                if (period > 2) {
                  const prev1 = sched.find(s => s.day === day && s.period === period - 1);
                  const prev2 = sched.find(s => s.day === day && s.period === period - 2);
                  if (prev1 && prev2 && prev1.subjectId === subject.id && prev2.subjectId === subject.id) return false;
                }
                return true;
              });
              if (!studentsFree) continue;

              // Teacher free/available?
              let teacherFree = true;
              let teacherAvailable = true;
              if (teacherId) {
                teacherFree = !teacherSchedules[teacherId]?.some(s => s.day === day && s.period === period);
                const teacher = teachers.find(t => t.id === teacherId);
                teacherAvailable = !teacher?.unavailable_slots?.some(u => u.day === day && u.period === period);
                const teacherConstraints = hardConstraints.filter(c => c.category === 'teacher' && (!c.rule?.teacher_id || c.rule?.teacher_id === teacherId));
                for (const c of teacherConstraints) {
                  if (c.rule?.max_consecutive_periods) {
                    const consecutive = teacherSchedules[teacherId]
                      ?.filter(s => s.day === day && s.period < period && s.period >= period - c.rule.max_consecutive_periods)
                      .length || 0;
                    if (consecutive >= c.rule.max_consecutive_periods) teacherFree = false;
                  }
                  if (c.rule?.prohibited_days?.includes(day) || c.rule?.unavailable_slots?.some(u => u.day === day && u.period === period)) {
                    teacherAvailable = false;
                  }
                }
              }
              if (!teacherFree || !teacherAvailable) continue;

              // Hard constraints (subject/time)
              let violates = false;
              for (const c of hardConstraints) {
                if (c.category === 'subject' && c.rule?.subject_id === subject.id) {
                  if (c.rule?.prohibited_days?.includes(day) || c.rule?.prohibited_slots?.some(s => s.day === day && (!s.period || s.period === period))) { violates = true; break; }
                }
                if (c.category === 'time' && c.rule?.prohibited_slots?.some(s => s.day === day && s.period === period)) { violates = true; break; }
              }
              if (violates) continue;

              // Find a room for primary (mirror slots will have no room to avoid double booking)
              let assignedRoom = null;
              for (const room of preferredRooms) {
                const roomFree = !roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
                const hasCapacity = !room.capacity || ((primaryGroup.student_ids || []).length <= room.capacity);
                if (roomFree && hasCapacity) { assignedRoom = room; break; }
              }
              if (!assignedRoom) continue;

              // Create primary slot (with teacher and room)
              newSlots.push({
                school_id: schoolId,
                schedule_version: selectedVersion.id,
                teaching_group_id: primaryGroup.id,
                teacher_id: teacherId,
                room_id: assignedRoom.id,
                day,
                period,
                status: teacherId ? 'scheduled' : 'tentative'
              });
              if (!roomSchedules[assignedRoom.id]) roomSchedules[assignedRoom.id] = [];
              roomSchedules[assignedRoom.id].push({ day, period });
              if (teacherId) teacherSchedules[teacherId].push({ day, period });

              // Mirror slots for other groups (no teacher/room to avoid double conflicts)
              for (const mg of mirrorGroups) {
                newSlots.push({
                  school_id: schoolId,
                  schedule_version: selectedVersion.id,
                  teaching_group_id: mg.id,
                  room_id: null,
                  day,
                  period,
                  status: 'scheduled',
                  notes: `Shared with ${primaryGroup.name}`
                });
              }

              // Block students for all involved groups
              allStudentIds.forEach(sid => {
                if (!studentSchedules[sid]) studentSchedules[sid] = [];
                studentSchedules[sid].push({ day, period, subjectId: subject.id });
              });

              created++;
            }
          }
          return created;
        };

        // Build DP reserved test slots by year group (DP1/DP2)
        const dpTestConfig = school?.settings?.test_config || {};
        const reservedDPTests = { DP1: new Set(), DP2: new Set() };
        const makeKey = (d, p) => `${d}|${p}`;
        ['DP1', 'DP2'].forEach(yg => {
          const cfg = dpTestConfig[yg] || { tests_per_week: 0, test_duration_minutes: 0 };
          const testsPerWeek = cfg.tests_per_week || 0;
          const periodDuration = school?.period_duration_minutes || 45;
          const testDurationPeriods = Math.max(1, Math.ceil((cfg.test_duration_minutes || 0) / periodDuration));
          if (testsPerWeek > 0) {
            const testPeriods = periods.slice(-testDurationPeriods); // late afternoon by default
            const testDays = days.slice(0, Math.min(testsPerWeek, days.length));
            testDays.forEach(day => {
              testPeriods.forEach(period => reservedDPTests[yg].add(makeKey(day, period)));
            });
          }
        });
        const isReserved = (yearGroup, day, period) => reservedDPTests[yearGroup]?.has?.(makeKey(day, period));

        // Schedule per subject-year
        for (const [key, groups] of Object.entries(dpBySubjectYear)) {
          const [subjectId, yearGroup] = key.split('__');
          const subject = subjects.find(s => s.id === subjectId);
          if (!subject) continue;

          const slGroups = groups.filter(g => g.level === 'SL');
          const hlGroups = groups.filter(g => g.level === 'HL');

          const slPeriods = slGroups.length > 0
            ? periodsForGroup(slGroups[0])
            : minutesToPeriods(subject?.sl_minutes_per_week_default || 180);
          const hlPeriods = hlGroups.length > 0
            ? periodsForGroup(hlGroups[0])
            : minutesToPeriods(subject?.hl_minutes_per_week_default || 300);
          const sharedCount = Math.min(slPeriods, hlPeriods);
          const hlExtra = Math.max(0, hlPeriods - slPeriods);

          if (slGroups.length > 0 && (hlGroups.length > 0 || sharedCount > 0)) {
            // Use first SL group as primary for shared sessions
            const primary = slGroups[0];
            const mirrors = [...hlGroups];
            const made = await scheduleSharedSessions({ primaryGroup: primary, mirrorGroups: mirrors, subject, sessions: sharedCount });
            if (made < sharedCount) {
              console.warn(`Shared ${subject.name} in ${yearGroup}: scheduled ${made}/${sharedCount}`);
            }

            // If there are additional SL groups beyond the primary, try to align them too (mirror with primary)
            for (let i = 1; i < slGroups.length; i++) {
              const extraSL = slGroups[i];
              // Mirror primary's shared sessions by creating "mirror" copies for this SL group
              const primarySlots = newSlots.filter(s => s.teaching_group_id === primary.id && s.day && s.period);
              let mirrored = 0;
              for (const s of primarySlots) {
                if (mirrored >= sharedCount) break;
                // Avoid duplicates for extra SL group
                const exists = newSlots.some(ns => ns.teaching_group_id === extraSL.id && ns.day === s.day && ns.period === s.period);
                if (!exists) {
                  newSlots.push({
                    school_id: schoolId,
                    schedule_version: selectedVersion.id,
                    teaching_group_id: extraSL.id,
                    room_id: null,
                    day: s.day,
                    period: s.period,
                    status: 'scheduled',
                    notes: `Shared with ${primary.name}`
                  });
                  // Block students too
                  (extraSL.student_ids || []).forEach(sid => {
                    if (!studentSchedules[sid]) studentSchedules[sid] = [];
                    studentSchedules[sid].push({ day: s.day, period: s.period, subjectId: subject.id });
                  });
                  mirrored++;
                }
              }
            }
          }

          // HL-only extra sessions
          if (hlExtra > 0 && hlGroups.length > 0) {
            for (const hl of hlGroups) {
              let made = 0;
              const preferredRoomsBase = rooms.filter(r => r.is_active);
              const preferredRooms = subject?.requires_special_room
                ? preferredRoomsBase.filter(r => r.room_type === subject.requires_special_room)
                : preferredRoomsBase;

              const daysRandom = shuffleArray(days);
              let periodsRandom = shuffleArray(periods);
              if (subject?.preferred_time === 'morning') periodsRandom = [...periods.filter(p => p <= 4), ...periods.filter(p => p > 4)];
              if (subject?.preferred_time === 'afternoon') periodsRandom = [...periods.filter(p => p > 4), ...periods.filter(p => p <= 4)];

              const teacherId = hl.teacher_id || null;
              if (teacherId && !teacherSchedules[teacherId]) teacherSchedules[teacherId] = [];

              for (const day of daysRandom) {
                if (made >= hlExtra) break;
                for (const period of periodsRandom) {
                  if (made >= hlExtra) break;
                  if (blockedPeriods.has(period)) continue;

                  // Students free? Also block DP test times by year group
                  const studentsFree = (hl.student_ids || []).every(sid => {
                    const sched = studentSchedules[sid] || [];
                    if (sched.some(s => s.day === day && s.period === period)) return false;
                    const student = students.find(st => st.id === sid);
                    if (student?.year_group && isReserved(student.year_group, day, period)) return false;
                    if (period > 2) {
                      const prev1 = sched.find(s => s.day === day && s.period === period - 1);
                      const prev2 = sched.find(s => s.day === day && s.period === period - 2);
                      if (prev1 && prev2 && prev1.subjectId === subject.id && prev2.subjectId === subject.id) return false;
                    }
                    return true;
                  });
                  if (!studentsFree) continue;

                  // Teacher free/available?
                  let teacherFree = true;
                  let teacherAvailable = true;
                  if (teacherId) {
                    teacherFree = !teacherSchedules[teacherId]?.some(s => s.day === day && s.period === period);
                    const teacher = teachers.find(t => t.id === teacherId);
                    teacherAvailable = !teacher?.unavailable_slots?.some(u => u.day === day && u.period === period);
                  }
                  if (!teacherFree || !teacherAvailable) continue;

                  // Hard constraints
                  let violates = false;
                  for (const c of hardConstraints) {
                    if (c.category === 'subject' && c.rule?.subject_id === subject.id) {
                      if (c.rule?.prohibited_days?.includes(day) || c.rule?.prohibited_slots?.some(s => s.day === day && (!s.period || s.period === period))) { violates = true; break; }
                    }
                    if (c.category === 'time' && c.rule?.prohibited_slots?.some(s => s.day === day && s.period === period)) { violates = true; break; }
                  }
                  if (violates) continue;

                  // Find room
                  let assignedRoom = null;
                  for (const room of preferredRooms) {
                    const roomFree = !roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
                    const hasCapacity = !room.capacity || ((hl.student_ids || []).length <= room.capacity);
                    if (roomFree && hasCapacity) { assignedRoom = room; break; }
                  }
                  if (!assignedRoom) continue;

                  newSlots.push({
                    school_id: schoolId,
                    schedule_version: selectedVersion.id,
                    teaching_group_id: hl.id,
                    teacher_id: teacherId,
                    room_id: assignedRoom.id,
                    day,
                    period,
                    status: teacherId ? 'scheduled' : 'tentative',
                    notes: 'HL-only session'
                  });
                  if (!roomSchedules[assignedRoom.id]) roomSchedules[assignedRoom.id] = [];
                  roomSchedules[assignedRoom.id].push({ day, period });
                  if (teacherId) teacherSchedules[teacherId].push({ day, period });
                  (hl.student_ids || []).forEach(sid => {
                    if (!studentSchedules[sid]) studentSchedules[sid] = [];
                    studentSchedules[sid].push({ day, period, subjectId: subject.id });
                  });
                  made++;
                }
              }
              if (made < hlExtra) console.warn(`HL-only ${subject.name} ${yearGroup}: scheduled ${made}/${hlExtra}`);
            }
          }
        }
      }

      // Add test slots at the end (after classes are scheduled)
      const testConfig = school?.settings?.test_config || {};
      ['PYP', 'MYP', 'DP1', 'DP2'].forEach(level => {
        const config = testConfig[level] || { tests_per_week: 0, test_duration_minutes: 0 };
        const testsPerWeek = config.tests_per_week || 0;
        const periodDuration = school?.period_duration_minutes || 45;
        const testDurationPeriods = Math.ceil(config.test_duration_minutes / periodDuration);

        if (testsPerWeek > 0) {
          // Use late afternoon periods for tests to minimize disruption
          const testPeriods = periods.slice(-testDurationPeriods);
          const testDays = days.slice(0, testsPerWeek);

          testDays.forEach(day => {
            testPeriods.forEach(period => {
              if (blockedPeriods.has(period)) return;
              // Create a test slot for every relevant ClassGroup so it appears in class views
              const targetClassGroups = level === 'PYP' || level === 'MYP'
                ? classGroups.filter(cg => cg.ib_programme === level)
                : classGroups.filter(cg => cg.year_group === level);
              targetClassGroups.forEach(cg => {
                newSlots.push({
                  school_id: schoolId,
                  schedule_version: selectedVersion.id,
                  classgroup_id: cg.id,
                  subject_id: null,
                  teacher_id: null,
                  room_id: null,
                  day,
                  period,
                  status: 'scheduled',
                  notes: `${level} Test/Assessment Slot`
                });
              });
            });
          });
          console.log(`Added test slots for ${level} (late afternoon periods on ${testsPerWeek} days)`);
        }
      });

      // Create all slots in batches to avoid rate limits
      if (cancelGeneration) throw new Error('Cancelled by user');
      
      setGenerationProgress(prev => ({
        ...prev,
        stage: 'Creating Schedule Slots',
        percent: 75,
        message: `Creating ${newSlots.length} schedule slots...`,
        currentStep: 'slots',
        completedSteps: [...prev.completedSteps, 'dp']
      }));
      
      console.log('Total slots to create:', newSlots.length);
      console.log('Sample slot:', newSlots[0]);

      if (newSlots.length > 0) {
        const batchSize = 30; // Optimized batch size
        let totalCreated = 0;

        for (let i = 0; i < newSlots.length; i += batchSize) {
          const batch = newSlots.slice(i, i + batchSize);
          const batchNum = Math.floor(i/batchSize) + 1;
          const totalBatches = Math.ceil(newSlots.length/batchSize);

          setGenerationProgress(prev => ({
            ...prev,
            percent: 75 + Math.floor((batchNum / totalBatches) * 15),
            message: `Creating batch ${batchNum}/${totalBatches} (${totalCreated}/${newSlots.length} slots completed)`
          }));

          console.log(`Creating batch ${batchNum}/${totalBatches} (${batch.length} slots)...`);

          try {
            const created = await base44.entities.ScheduleSlot.bulkCreate(batch);
            totalCreated += created.length;
            console.log(`✓ Batch created: ${created.length} slots`);
          } catch (batchError) {
            console.error(`✗ Batch failed:`, batchError.message);
            // Shorter retry delay
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Retry individually
            for (const slot of batch) {
              try {
                await base44.entities.ScheduleSlot.create(slot);
                totalCreated++;
                await new Promise(resolve => setTimeout(resolve, 300));
              } catch (slotError) {
                console.error(`Failed to create slot:`, slotError.message);
              }
            }
          }

          // Shorter delay between batches
          if (i + batchSize < newSlots.length) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }

        console.log('Created slots:', totalCreated);
      } else {
        console.warn('No slots were generated!');
      }

      // Calculate actual stats
      const scheduledStudents = new Set();
      const scheduledTeachers = new Set();
      const scheduledGroups = new Set();
      const teacherHours = {};

      newSlots.forEach(slot => {
        const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
        if (group) {
          scheduledGroups.add(group.id);
          group.student_ids?.forEach(sid => scheduledStudents.add(sid));
          if (group.teacher_id) {
            scheduledTeachers.add(group.teacher_id);
            teacherHours[group.teacher_id] = (teacherHours[group.teacher_id] || 0) + 1;
          }
        }
      });

      // Calculate workload balance
      const hourValues = Object.values(teacherHours);
      const avgHours = hourValues.length > 0 ? hourValues.reduce((a, b) => a + b, 0) / hourValues.length : 0;
      const maxDeviation = Math.max(...hourValues.map(h => Math.abs(h - avgHours)));
      const balanceScore = Math.max(0, 100 - (maxDeviation / avgHours) * 100);

      // Count all unique teachers from all groups
      const allTeachersInGroups = new Set();
      Object.values(groupsByLevel).flat().forEach(g => {
        if (g.teacher_id) allTeachersInGroups.add(g.teacher_id);
      });

      const totalGroups = Object.values(groupsByLevel).flat().length;

      // Calculate constraint violations
      let constraintViolations = 0;
      softConstraints.forEach(constraint => {
        if (constraint.category === 'teacher' && constraint.rule?.max_hours_per_week) {
          Object.entries(teacherSchedules).forEach(([teacherId, schedule]) => {
            if (schedule.length > constraint.rule.max_hours_per_week) {
              constraintViolations++;
            }
          });
        }
      });

      // Update version with stats
      setGenerationProgress(prev => ({
        ...prev,
        stage: 'Finalizing',
        percent: 95,
        message: 'Updating schedule version and calculating statistics...',
        currentStep: 'finalize',
        completedSteps: [...prev.completedSteps, 'slots']
      }));
      
      await updateVersionMutation.mutateAsync({
        id: selectedVersion.id,
        data: { 
          generated_at: new Date().toISOString(),
          score: Math.floor((newSlots.length / (totalGroups * 6)) * 100),
          conflicts_count: 0,
          warnings_count: totalGroups - scheduledGroups.size + constraintViolations,
          notes: `DP: ${groupsByLevel.DP.length} groups, MYP: ${groupsByLevel.MYP.length} groups, PYP: ${groupsByLevel.PYP.length} groups | Scheduled ${scheduledStudents.size}/${students.length} students, ${scheduledGroups.size}/${totalGroups} groups (${allTeachersInGroups.size} teachers) across ${newSlots.length} periods. Workload balance: ${Math.round(balanceScore)}%. Applied ${activeConstraints.length} constraints.`
        }
      });

      // Refresh slots and version data
      await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
      await queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      
      setGenerationProgress({
        stage: 'Complete',
        percent: 100,
        message: `Successfully created ${newSlots.length} schedule slots!`,
        currentStep: '',
        completedSteps: ['teachers', 'dp', 'myp', 'pyp', 'slots', 'finalize'],
        completed: true
      });
      
      console.log('=== SCHEDULE GENERATION COMPLETE ===');
    } catch (error) {
      console.error('=== GENERATION ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      const wasCancelled = error.message === 'Cancelled by user' || cancelGeneration;
      
      setGenerationProgress({
        stage: wasCancelled ? 'Cancelled' : 'Error',
        percent: 0,
        message: wasCancelled ? 'Schedule generation was cancelled' : `Generation failed: ${error.message}`,
        currentStep: '',
        completedSteps: [],
        completed: true
      });
    }
    
    setTimeout(() => {
      setIsGenerating(false);
      setCancelGeneration(false);
    }, 2000);
  };

  const publishedVersion = scheduleVersions.find(v => v.status === 'published');
  const draftVersions = scheduleVersions.filter(v => v.status === 'draft');

  // Auto-select latest version on load
  React.useEffect(() => {
    if (!hasAutoSelected && scheduleVersions.length > 0 && !selectedVersion) {
      const latest = publishedVersion || draftVersions[0];
      if (latest) {
        setSelectedVersion(latest);
        setHasAutoSelected(true);
      }
    }
  }, [scheduleVersions, selectedVersion, publishedVersion, draftVersions, hasAutoSelected]);

  // Calculate stats for selected version
  const stats = React.useMemo(() => {
    if (!selectedVersion || scheduleSlots.length === 0) {
      return { studentsScheduled: 0, teachersAssigned: 0, totalSlots: 0, coverage: 0 };
    }

    const scheduledStudents = new Set();
    const scheduledTeachers = new Set();

    scheduleSlots.forEach(slot => {
      if (slot.teacher_id) scheduledTeachers.add(slot.teacher_id);
      
      // For classgroup-based slots (PYP/MYP)
      if (slot.classgroup_id) {
        const cg = classGroups.find(c => c.id === slot.classgroup_id);
        cg?.student_ids?.forEach(sid => scheduledStudents.add(sid));
      }
      
      // For teaching group-based slots (DP)
      if (slot.teaching_group_id) {
        const tg = teachingGroups.find(g => g.id === slot.teaching_group_id);
        tg?.student_ids?.forEach(sid => scheduledStudents.add(sid));
      }
    });

    const coverage = students.length > 0 ? Math.round((scheduledStudents.size / students.length) * 100) : 0;

    return {
      studentsScheduled: scheduledStudents.size,
      teachersAssigned: scheduledTeachers.size,
      totalSlots: scheduleSlots.length,
      coverage
    };
  }, [selectedVersion, scheduleSlots, students, teachingGroups, classGroups]);

  // Core recap (TOK/CAS/EE) derived from current slots
  const coreRecap = React.useMemo(() => {
    if (!selectedVersion || scheduleSlots.length === 0) return null;
    const codeById = {};
    subjects.forEach(s => {
      const code = String(s.code || s.name || '')
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '');
      codeById[s.id] = code;
    });
    const counts = { TOK: 0, CAS: 0, EE: 0 };
    let sample = null;
    scheduleSlots.forEach(slot => {
      const code = slot.subject_id ? codeById[slot.subject_id] : null;
      if (code && (code === 'TOK' || code === 'CAS' || code === 'EE')) {
        counts[code] += 1;
        if (!sample) sample = slot;
      }
    });
    return { counts, sample };
  }, [selectedVersion, scheduleSlots, subjects]);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Master Schedule"
        description={`Generate and manage timetables for ${allowedProgrammes.join(', ')}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleRunDPDiagnostic}
              disabled={dpDiagLoading}
            >
              {dpDiagLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running DP Diagnostic...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview DP Diagnostic
                </>
              )}
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
              <Plus className="w-4 h-4 mr-2" />
              New Version
            </Button>
          </div>
        }
      />

      {school && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            Your plan: <strong>{(school.subscription_tier || 'unknown').toUpperCase()}</strong>. Enabled programmes: {allowedProgrammes.join(', ')}.
          </p>
        </div>
      )}

      <ScheduleUpdateBanner 
        show={showUpdateBanner && selectedVersion && scheduleSlots.length > 0}
        onRegenerate={handleGenerateSchedule}
        onDismiss={() => setShowUpdateBanner(false)}
        isGenerating={isGenerating}
      />

      {selectedVersion && offByOneConflicts.length > 0 && (
        <OffByOneBanner conflicts={offByOneConflicts} />
      )}

      {/* Quick Stats Bar */}
      {selectedVersion && scheduleSlots.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Students Scheduled</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.studentsScheduled}/{students.length}</p>
                </div>
                <div className="text-3xl font-bold text-blue-600">{stats.coverage}%</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Teachers Assigned</p>
                  <p className="text-2xl font-bold text-emerald-900">{stats.teachersAssigned}/{teachers.length}</p>
                </div>
                <Users className="w-8 h-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Total Periods</p>
                  <p className="text-2xl font-bold text-violet-900">{stats.totalSlots}</p>
                </div>
                <Calendar className="w-8 h-8 text-violet-600" />
              </div>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${
            (selectedVersion?.conflicts_count || 0) > 0 
              ? 'bg-gradient-to-br from-rose-50 to-white' 
              : 'bg-gradient-to-br from-slate-50 to-white'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Issues</p>
                  <p className={`text-2xl font-bold ${
                    (selectedVersion?.conflicts_count || 0) > 0 ? 'text-rose-900' : 'text-slate-900'
                  }`}>
                    {(selectedVersion?.conflicts_count || 0) + (selectedVersion?.warnings_count || 0)}
                  </p>
                </div>
                {(selectedVersion?.conflicts_count || 0) > 0 ? (
                  <AlertTriangle className="w-8 h-8 text-rose-600" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Version Selector Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div>
                <Label className="text-sm text-slate-600 mb-2 block">Active Version</Label>
                <Select value={selectedVersion?.id || ''} onValueChange={(id) => setSelectedVersion(scheduleVersions.find(v => v.id === id))}>
                  <SelectTrigger className="w-[320px]">
                    <SelectValue placeholder="Select a schedule version" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleVersions.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No versions yet. Create one to start.</div>
                    ) : (
                      <>
                        {publishedVersion && (
                          <SelectItem value={publishedVersion.id}>
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-emerald-600" />
                              <span className="font-medium">{publishedVersion.name}</span>
                              <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-0 text-xs">Published</Badge>
                            </div>
                          </SelectItem>
                        )}
                        {draftVersions.map(version => (
                          <SelectItem key={version.id} value={version.id}>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-400" />
                              <span>{version.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">Draft</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {selectedVersion && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>•</span>
                  <span>{selectedVersion.academic_year}</span>
                  <span>•</span>
                  <span>{selectedVersion.term || 'Full Year'}</span>
                </div>
              )}
            </div>
            {selectedVersion && (
              <div className="flex gap-2">
                <Button 
                 onClick={handleGenerateSchedule}
                 disabled={isGenerating}
                 className="bg-indigo-600 hover:bg-indigo-700"
                 size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Schedule
                    </>
                  )}
                </Button>
                {selectedVersion.status === 'draft' && scheduleSlots.length > 0 && (
                 <Button 
                   className="bg-emerald-600 hover:bg-emerald-700"
                   onClick={() => handlePublish(selectedVersion)}
                 >
                   <CheckCircle className="w-4 h-4 mr-2" />
                   Publish
                 </Button>
                )}
                <Button 
                 variant="outline"
                 onClick={handleFetchORTool}
                 disabled={!selectedVersion || orToolLoading}
                >
                 {orToolLoading ? (
                   <>
                     <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                     OR-Tool JSON...
                   </>
                 ) : (
                   <>
                     <Hash className="w-4 h-4 mr-2" />
                     Run OR-Tool + JSON
                   </>
                 )}
                </Button>
                {selectedVersion.status === 'draft' && (
                  <Button 
                    variant="outline"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      if (confirm(`Delete "${selectedVersion.name}"?`)) {
                        deleteVersionMutation.mutate(selectedVersion.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Configuration & Constraints - Always Visible */}
      <Tabs defaultValue={selectedVersion ? "schedule" : "config"} className="w-full">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="schedule" disabled={!selectedVersion} className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="config" className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">Configuration</TabsTrigger>
          <TabsTrigger value="constraints" className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">Constraints</TabsTrigger>
        </TabsList>

          {/* Schedule Tab Content */}
          <TabsContent value="schedule">
            {selectedVersion ? (
              <div className="space-y-4">
                {/* Conflicts/Warnings */}
                {((selectedVersion.conflicts_count || 0) > 0 || (selectedVersion.warnings_count || 0) > 0) && (
                  <div className="space-y-3">
                    {(selectedVersion.conflicts_count || 0) > 0 && (
                      <ConflictAlert 
                        severity="error"
                        title={`${selectedVersion.conflicts_count || 0} Scheduling Conflicts`}
                        description="There are unresolved conflicts that need attention before publishing."
                      />
                    )}
                    {(selectedVersion.warnings_count || 0) > 0 && (
                      <ConflictAlert 
                        severity="warning"
                        title={`${selectedVersion.warnings_count || 0} Warnings`}
                        description="Review these soft constraint violations for optimal scheduling."
                      />
                    )}
                    {selectedVersion?.id && <ConflictViewer scheduleVersionId={selectedVersion.id} />}
                  </div>
                )}

                {/* Core recap (from persisted slots) */}
                {/* OR-Tool JSON response (on-demand) */}
                {orToolError && (
                  <Card className="border-0 shadow-sm bg-rose-50"><CardContent className="p-4 text-sm text-rose-700">{orToolError}</CardContent></Card>
                )}
                {orToolResult && (
                  <>
                  <UnassignedBanner unassigned={orToolResult?.unassignedBySubjectCode} />
                  {/* Force refresh hint: show current slot counts */}
                  <div className="text-xs text-slate-500">Persisted slots: {scheduleSlots.length} • Inserted this run: {orToolResult?.slotsInserted ?? orToolResult?.insertedCount ?? 0}</div>
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-700">
                          <div className="font-semibold text-slate-900 mb-1">OR-Tool Response</div>
                          <div className="flex gap-3">
                            <span>Assigned TOK: <strong>{orToolResult?.coreSlotsInsertedCount?.TOK || 0}</strong></span>
                            <span>CAS: <strong>{orToolResult?.coreSlotsInsertedCount?.CAS || 0}</strong></span>
                            <span>EE: <strong>{orToolResult?.coreSlotsInsertedCount?.EE || 0}</strong></span>
                          </div>
                        </div>
                        {orToolResult?.sampleCoreSlot && (
                          <div className="text-xs text-slate-600">
                            <div className="font-medium text-slate-800">Sample Core Slot</div>
                            <div>{orToolResult.sampleCoreSlot.day} • Period {orToolResult.sampleCoreSlot.period}</div>
                          </div>
                        )}
                      </div>

                      {/* Quick verification panel */}
                      <div className="grid md:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-slate-100">
                          <div className="font-semibold text-slate-900 mb-1">Endpoint</div>
                                                     <div className="truncate">{String(orToolResult?.orToolEndpointUsed || orToolResult?.endpoint || '—')}</div>
                                                     <div className="mt-1">HTTP: <strong>{orToolResult?.orToolHttpStatus ?? '—'}</strong></div>
                                                     <div className="mt-1">/health: <strong>{orToolResult?.orToolHealthStatus ?? '—'}</strong> {orToolResult?.orToolHealthOk === false ? '(down)' : ''}</div>
                                                     <div className="mt-1">Headers: <code>{JSON.stringify(orToolResult?.orToolRequestHeadersSent || [])}</code></div>
                                                     <div className="mt-1">Error: <span className="break-all">{(orToolResult?.orToolErrorBody || '').slice(0,140) || '—'}</span></div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-100">
                          <div className="font-semibold text-slate-900 mb-1">Persistence</div>
                          <div>schedule_version_id: <strong>{orToolResult?.schedule_version_id || '—'}</strong></div>
                          <div>performedDeletion: <strong>{String(orToolResult?.performedDeletion ?? false)}</strong></div>
                          <div>performedInsertion: <strong>{String(orToolResult?.performedInsertion ?? false)}</strong></div>
                          <div>slotsDeleted: <strong>{orToolResult?.slotsDeleted ?? orToolResult?.deletedCount ?? 0}</strong></div>
                          <div>slotsInserted: <strong>{orToolResult?.slotsInserted ?? orToolResult?.insertedCount ?? 0}</strong></div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-100">
                          <div className="font-semibold text-slate-900 mb-1">Timeslots</div>
                          <div>timeslotsCount: <strong>{orToolResult?.timeslotsCount ?? orToolResult?.buildMeta?.timeslotsCount ?? '—'}</strong></div>
                          <div>endTimeUsedByDay: <code>{JSON.stringify(orToolResult?.endTimeUsedByDay || {})}</code></div>
                        </div>
                      </div>

                      {orToolResult?.guardFailureCode && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                          <div className="font-semibold mb-1">Guard Failure: {orToolResult.guardFailureCode}</div>
                          <div className="grid md:grid-cols-3 gap-2">
                            <div>requestedSchoolId: <strong>{String(orToolResult.requestedSchoolId ?? 'null')}</strong></div>
                            <div>scheduleVersion.school_id: <strong>{String(orToolResult.scheduleVersionSchoolId ?? 'null')}</strong></div>
                            <div>whoami: <code>{JSON.stringify(orToolResult.whoami || orToolResult.user || null)}</code></div>
                          </div>
                        </div>
                      )}

                      {/* All-subjects comparison and stage counters will follow */}
                      {/* Requested recap fields */}
                      {(() => {
                        const exp = orToolResult?.expectedLessonsBySubject || {};
                        const expMin = orToolResult?.expectedMinutesBySubject || {};
                        const asg = orToolResult?.assignedLessonsBySubject || orToolResult?.assignmentsBySubjectCode || {};
                        const unasg = orToolResult?.unassignedLessonsBySubject || orToolResult?.unassignedBySubjectCode || {};
                        const core = orToolResult?.coreAssignments || {};
                        const meta = orToolResult?.buildMeta || {};
                        const maxP = orToolResult?.maxPeriodUsedByDay || {};
                        const slotsToInsert = orToolResult?.slotsToInsertBySubjectId || {};
                        const coreIns = orToolResult?.coreSlotsInsertedCount || {};
                        const sampleCores = orToolResult?.sampleCoreSlots || null;
                        const sampleLine = (arr) => {
                          const s = Array.isArray(arr) && arr[0];
                          return s && (s.day && s.period) ? `${s.day} • P${s.period}` : '—';
                        };
                        return (
                          <div className="space-y-3 text-xs text-slate-700">
                            <div className="grid md:grid-cols-3 gap-3">
                              <div className="p-3 rounded-lg bg-slate-100">
                                <div className="font-semibold text-slate-900 mb-1">Expected Core (per week)</div>
                                <div className="flex gap-4">
                                  <span>TOK: <strong>{exp.TOK ?? 0}</strong></span>
                                  <span>CAS: <strong>{exp.CAS ?? 0}</strong></span>
                                  <span>EE: <strong>{exp.EE ?? 0}</strong></span>
                                </div>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-100">
                                <div className="font-semibold text-slate-900 mb-1">Assigned vs Unassigned (Core)</div>
                                <div className="grid grid-cols-3 gap-2">
                                  {['TOK','CAS','EE'].map(k => (
                                    <div key={k}>
                                      <div className="text-[11px] text-slate-500">{k}</div>
                                      <div>✓ {asg[k] || 0} • ✗ {unasg[k] || 0}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-100">
                                <div className="font-semibold text-slate-900 mb-1">Schedule Span</div>
                                <div className="space-y-1">
                                  <div>maxPeriodUsedByDay: <code>{JSON.stringify(maxP)}</code></div>
                                  <div>timeslotsCount: <strong>{meta?.timeslotsCount ?? '—'}</strong></div>
                                  <div>periodDurationMinutes: <strong>{meta?.periodDurationMinutes ?? '—'}</strong></div>
                                  <div>endTimeUsedByDay: <code>{JSON.stringify(orToolResult?.endTimeUsedByDay || {})}</code></div>
                                  <div>lastTimeslot: <strong>{(meta?.lastTimeslot?.dayOfWeek || '—')} {meta?.lastTimeslot?.endTime ? `• ${meta?.lastTimeslot?.endTime}` : ''}</strong></div>
                                  <div>dpTargetPeriodsPerDay: <strong>{meta?.dpTargetPeriodsPerDay ?? '—'}</strong></div>
                                </div>
                              </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-3">
                              <div className="p-3 rounded-lg bg-slate-100">
                                <div className="font-semibold text-slate-900 mb-1">Core Assignments Samples</div>
                                <div className="space-y-1">
                                  <div>TOK: {sampleLine(core?.TOK)}</div>
                                  <div>CAS: {sampleLine(core?.CAS)}</div>
                                  <div>EE: {sampleLine(core?.EE)}</div>
                                </div>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-100">
                                <div className="font-semibold text-slate-900 mb-1">coreSlotsInsertedCount</div>
                                <pre className="bg-white rounded p-2 overflow-x-auto">{JSON.stringify(coreIns, null, 2)}</pre>
                                {orToolResult?.testSlotsInsertedCount && (
                                  <div className="mt-2 text-xs">testSlotsInsertedCount: <code>{JSON.stringify(orToolResult.testSlotsInsertedCount)}</code></div>
                                )}
                              </div>
                              <div className="p-3 rounded-lg bg-slate-100">
                                <div className="font-semibold text-slate-900 mb-1">slotsToInsertBySubjectId</div>
                                <pre className="bg-white rounded p-2 overflow-x-auto max-h-32">{JSON.stringify(slotsToInsert, null, 2)}</pre>
                                </div>
                                </div>

                                {/* Extended Diagnostics */}
                              <div className="grid md:grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Schedule Settings Sent</div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                                    <div className="text-slate-500">start</div>
                                    <div className="font-medium">{orToolResult?.scheduleSettingsSent?.day_start_time || '—'}</div>
                                    <div className="text-slate-500">end</div>
                                    <div className="font-medium">{orToolResult?.scheduleSettingsSent?.day_end_time || '—'}</div>
                                    <div className="text-slate-500">period</div>
                                    <div className="font-medium">{orToolResult?.scheduleSettingsSent?.period_duration_minutes ?? '—'} min</div>
                                    <div className="text-slate-500">days</div>
                                    <div className="font-medium">{(orToolResult?.scheduleSettingsSent?.days_of_week || []).join(', ') || '—'}</div>
                                    <div className="text-slate-500">min/target</div>
                                    <div className="font-medium">{orToolResult?.scheduleSettingsSent?.min_periods_per_day ?? '—'} / {orToolResult?.scheduleSettingsSent?.target_periods_per_day ?? '—'}</div>
                                    <div className="text-slate-500">breaks</div>
                                    <div className="font-medium">{(orToolResult?.scheduleSettingsSent?.breaks || []).map(b=>`${b.start}-${b.end}`).join(', ') || '—'}</div>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Timeslots & Usage</div>
                                  <div className="space-y-1">
                                    <div>timeslotsCount: <strong>{orToolResult?.timeslotsCount ?? meta?.timeslotsCount ?? '—'}</strong></div>
                                    <div>lastTimeslotUsed: <strong>{orToolResult?.lastTimeslotUsed ? `${orToolResult.lastTimeslotUsed.dayOfWeek} • ${orToolResult.lastTimeslotUsed.endTime}` : '—'}</strong></div>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Underfill</div>
                                  <div className="space-y-1">
                                    <div>underfilled: <strong>{String(orToolResult?.underfill?.underfilled ?? false)}</strong></div>
                                    <div>reason: <strong>{orToolResult?.underfill?.reason || '—'}</strong></div>
                                    <div>STUDY created: <strong>{orToolResult?.underfill?.study?.assigned_in_solver || 0}</strong> / returned: <strong>{orToolResult?.underfill?.study?.total_from_solver || 0}</strong> • prepared: <strong>{orToolResult?.underfill?.study?.prepared_for_insert || 0}</strong></div>
                                  </div>
                                </div>
                              </div>

                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">expectedMinutesBySubject</div>
                                  <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(expMin || {}, null, 2)}</pre>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">sampleCoreSlots</div>
                                  <div className="space-y-1">
                                    <div>TOK: {sampleCores?.TOK ? (sampleCores.TOK.day ? `${sampleCores.TOK.day} • P${sampleCores.TOK.period}` : '—') : '—'}</div>
                                    <div>CAS: {sampleCores?.CAS ? (sampleCores.CAS.day ? `${sampleCores.CAS.day} • P${sampleCores.CAS.period}` : '—') : '—'}</div>
                                    <div>EE: {sampleCores?.EE ? (sampleCores.EE.day ? `${sampleCores.EE.day} • P${sampleCores.EE.period}` : '—') : '—'}</div>
                                  </div>
                                </div>
                              </div>


                               <div className="grid md:grid-cols-2 gap-3">
                                 <div className="p-3 rounded-lg bg-slate-100">
                                   <div className="font-semibold text-slate-900 mb-1">Input Summary (minutes → periods)</div>
                                   <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(orToolResult?.inputSummaryBySubject || {}, null, 2)}</pre>
                                 </div>
                                 <div className="p-3 rounded-lg bg-slate-100">
                                   <div className="font-semibold text-slate-900 mb-1">Core TG Detected</div>
                                   <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(orToolResult?.coreTeachingGroupsDetected || [], null, 2)}</pre>
                                 </div>
                               </div>

                               {/* All-subjects comparison */}
                              <div className="grid md:grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">expectedLessonsBySubject</div>
                                  <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(exp, null, 2)}</pre>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">assignmentsBySubjectCode</div>
                                  <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(asg, null, 2)}</pre>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">unassignedBySubjectCode</div>
                                  <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(unasg, null, 2)}</pre>
                                </div>
                              </div>

                              {/* Debug counters for TOK/CAS/EE/TEST across stages */}
                              <div className="p-3 rounded-lg bg-slate-50">
                                <div className="font-semibold text-slate-900 mb-2">Stage Counters (TOK/CAS/EE/TEST)</div>
                                <div className="grid md:grid-cols-4 gap-2 text-xs">
                                  {['TOK','CAS','EE','TEST'].map(k => {
                                    const plc = orToolResult?.problemLessonsCreated || {};
                                    const sar = orToolResult?.solutionAssignmentsReturned || {};
                                    const spi = orToolResult?.slotsPreparedForInsert || {};
                                    return (
                                      <div key={k} className="p-2 rounded border bg-white">
                                        <div className="font-medium mb-1">{k}</div>
                                        <div>problemLessonsCreated: <strong>{plc[k] || 0}</strong></div>
                                        <div>solutionAssignmentsReturned: <strong>{sar[k] || 0}</strong></div>
                                        <div>slotsPreparedForInsert: <strong>{spi[k] || 0}</strong></div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                      {(() => {
                        const period = school?.period_duration_minutes || schoolConfig.period_duration_minutes || 60;
                        const items = teachingGroups
                          .filter(tg => {
                            const subj = subjects.find(s => s.id === tg.subject_id);
                            return subj?.ib_level === 'DP';
                          })
                          .slice(0, 8)
                          .map(tg => {
                            const subj = subjects.find(s => s.id === tg.subject_id);
                            const title = (subj?.name || subj?.code || 'Subject') + (tg.level ? ` ${String(tg.level).toUpperCase()}` : '');
                            const minutes = (typeof tg.minutes_per_week === 'number' && tg.minutes_per_week > 0)
                              ? tg.minutes_per_week
                              : (String(tg.level||'').toUpperCase()==='HL'
                                  ? (subj?.hl_minutes_per_week_default || 300)
                                  : (subj?.sl_minutes_per_week_default || 180));
                            const periods = Math.ceil(minutes / period);
                            const total = periods * period;
                            const over = total - minutes;
                            const exact = over === 0;
                            const text = exact
                              ? `${title} = ${minutes} min/week with ${period}-min periods → ${periods} periods (exact)`
                              : `${title} = ${minutes} min/week with ${period}-min periods → ${periods} periods (${total} min) (+${over} min rounding)`;
                            return { text };
                          });
                        if (items.length === 0) return null;
                        return (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                            <div className="font-semibold mb-1">Minutes → Periods Audit (DP)</div>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                              {items.map((it, i) => (<li key={i}>{it.text}</li>))}
                            </ul>
                          </div>
                        );
                      })()}

                      <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-72">{JSON.stringify(orToolResult, null, 2)}</pre>
                    </CardContent>
                  </Card>
                  </>
                  )}

                  {/* Close CardContent/Card properly above, continue other sections */}

                  {coreRecap && (
                  <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-700">
                          <div className="font-semibold text-slate-900 mb-1">DP Core Recap</div>
                          <div className="flex gap-3">
                            <span className="text-indigo-700">TOK: <strong>{coreRecap.counts.TOK}</strong></span>
                            <span className="text-purple-700">CAS: <strong>{coreRecap.counts.CAS}</strong></span>
                            <span className="text-amber-700">EE: <strong>{coreRecap.counts.EE}</strong></span>
                          </div>
                        </div>
                        {coreRecap.sample && (
                          <div className="text-xs text-slate-600">
                            <div className="font-medium text-slate-800">Sample Core Slot</div>
                            <div>{coreRecap.sample.day} • Period {coreRecap.sample.period}</div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Schedule Views */}
                <Tabs defaultValue="grid">
                <div className="flex items-center justify-between mb-4">
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="grid" className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">Master Schedule</TabsTrigger>
                    <TabsTrigger value="student" className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">Student View</TabsTrigger>
                    <TabsTrigger value="teacher" className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">Teacher View</TabsTrigger>
                    <TabsTrigger value="list" className="hover:bg-blue-50 hover:text-blue-700 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 transition-colors">List View</TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="grid" className="space-y-6">
                  {scheduleSlots.length > 0 && (
                    <UtilizationStats 
                      slots={scheduleSlots}
                      teachers={teachers}
                      rooms={rooms}
                      schoolConfig={schoolConfig}
                    />
                  )}

                  {scheduleSlots.length === 0 ? (
                    <Card className="border-0 shadow-sm">
                      <CardContent className="py-16 text-center">
                        <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Generated Yet</h3>
                        <p className="text-slate-500 mb-6">Click "Generate Schedule" above to create timetables for all programmes</p>
                        <Button 
                          onClick={handleGenerateSchedule}
                          disabled={isGenerating}
                          className="bg-indigo-600 hover:bg-indigo-700"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Schedule Now
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium text-slate-700">Filter by ClassGroup:</Label>
                          <Select 
                            value={selectedClassGroupId || 'all'} 
                            onValueChange={(value) => setSelectedClassGroupId(value === 'all' ? null : value)}
                          >
                            <SelectTrigger className="w-[320px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All ClassGroups (Master View)</SelectItem>
                              {classGroups.map(cg => (
                                <SelectItem key={cg.id} value={cg.id}>
                                  {cg.name} ({cg.ib_programme} - {cg.year_group})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <ScheduleExporter 
                          elementId="master-schedule-grid"
                          filename={`master-schedule-${selectedClassGroupId ? classGroups.find(cg => cg.id === selectedClassGroupId)?.name : 'all'}`}
                          label="Export Schedule"
                          headerData={{
                            schoolName: school?.name || '',
                            studentName: selectedClassGroupId ? classGroups.find(cg => cg.id === selectedClassGroupId)?.name : 'Master Schedule',
                            lastUpdated: selectedVersion?.generated_at ? new Date(selectedVersion.generated_at).toLocaleDateString() : ''
                          }}
                        />
                      </div>
                     <div id="master-schedule-grid">
                       <TimetableGrid 
                         slots={selectedClassGroupId ? scheduleSlots.filter(slot => {
                           // PYP/MYP slots use classgroup_id directly
                           if (slot.classgroup_id) {
                             return slot.classgroup_id === selectedClassGroupId;
                           }
                           // DP slots use teaching_group_id
                           const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
                           if (!group) return false;
                           const groupStudents = group.student_ids || [];
                           const classGroupStudents = students
                             .filter(s => s.classgroup_id === selectedClassGroupId)
                             .map(s => s.id);
                           return groupStudents.some(sid => classGroupStudents.includes(sid));
                         }) : scheduleSlots}
                         groups={teachingGroups}
                         rooms={rooms}
                         subjects={subjects}
                         teachers={teachers}
                         classGroups={classGroups}
                         periodsPerDay={orToolResult?.buildMeta?.periodsPerDay || school?.periods_per_day || 8}
                         breakPeriods={school?.settings?.break_periods || []}
                         lunchPeriod={school?.settings?.lunch_period || 4}
                         onSlotClick={(day, period, slot) => {
                           console.log('Clicked:', day, period, slot);
                         }}
                         exportId="master-timetable"
                       />
                     </div>
                    </div>
                    )}
                    </TabsContent>

                <TabsContent value="student">
                  <div className="space-y-4">
                    {selectedStudentId && (
                      <div className="flex justify-end">
                        <ScheduleExporter 
                          elementId="student-schedule"
                          filename={`student-schedule-${students.find(s => s.id === selectedStudentId)?.full_name || 'student'}`}
                          label="Export Student Schedule"
                          headerData={{
                            schoolName: school?.name || '',
                            studentName: students.find(s => s.id === selectedStudentId)?.full_name || '',
                            lastUpdated: selectedVersion?.generated_at ? new Date(selectedVersion.generated_at).toLocaleDateString() : ''
                          }}
                        />
                      </div>
                    )}
                    <StudentScheduleView
                      students={students.filter(s => s.is_active)}
                      slots={scheduleSlots}
                      groups={teachingGroups}
                      subjects={subjects}
                      teachers={teachers}
                      rooms={rooms}
                      selectedStudentId={selectedStudentId}
                      onStudentChange={setSelectedStudentId}
                      exportId="student-schedule"
                      unassignedBySubjectCode={orToolResult?.unassignedBySubjectCode}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="teacher">
                  <div className="space-y-4">
                    {selectedTeacherId && (
                      <div className="flex justify-end">
                        <ScheduleExporter 
                          elementId="teacher-schedule"
                          filename={`teacher-schedule-${teachers.find(t => t.id === selectedTeacherId)?.full_name || 'teacher'}`}
                          label="Export Teacher Schedule"
                          headerData={{
                            schoolName: school?.name || '',
                            studentName: teachers.find(t => t.id === selectedTeacherId)?.full_name || '',
                            lastUpdated: selectedVersion?.generated_at ? new Date(selectedVersion.generated_at).toLocaleDateString() : ''
                          }}
                        />
                      </div>
                    )}
                    <TeacherScheduleView
                      teachers={teachers.filter(t => t.is_active)}
                      slots={scheduleSlots}
                      groups={teachingGroups}
                      subjects={subjects}
                      rooms={rooms}
                      selectedTeacherId={selectedTeacherId}
                      onTeacherChange={setSelectedTeacherId}
                      exportId="teacher-schedule"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="list">
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-6">
                      {scheduleSlots.length === 0 ? (
                        <div className="text-center py-12">
                          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">No schedule slots yet. Click "Generate" to create a schedule.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {scheduleSlots.map(slot => {
                            const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
                            const room = rooms.find(r => r.id === slot.room_id);
                            return (
                              <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                <div>
                                  <p className="font-medium text-slate-900">{group?.name || 'Unknown Group'}</p>
                                  <p className="text-sm text-slate-500">
                                    {slot.day} Period {slot.period} • {room?.name || 'No room'}
                                  </p>
                                </div>
                                <Badge variant="outline">{group?.level}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                </Tabs>
                </div>
                ) : (
                <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Version Selected</h3>
                  <p className="text-slate-500 mb-6">Create a schedule version to start generating timetables</p>
                  <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Schedule Version
                  </Button>
                </CardContent>
                </Card>
                )}
                </TabsContent>

                {/* Configuration Tab Content */}
                <TabsContent value="config">
                  <div className="space-y-6">
                    {/* Top Action Bar */}
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleSaveConfig}
                        disabled={isSavingConfig}
                        size="lg"
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isSavingConfig ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Save All Changes
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Daily Schedule Configuration */}
                    <Card className="border-0 shadow-lg">
                      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-white/10 backdrop-blur">
                            <Clock className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">Daily Schedule Configuration</CardTitle>
                            <CardDescription className="text-slate-300">Define your school's daily timetable structure</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-8 pb-8">
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* School Week */}
                          <div className="space-y-3">
                            <Label htmlFor="days" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                              <Calendar className="w-4 h-4 text-violet-600" />
                              School Week
                            </Label>
                            <Select 
                              value={String(schoolConfig.days_per_week)} 
                              onValueChange={(value) => setSchoolConfig({...schoolConfig, days_per_week: parseInt(value)})}
                            >
                              <SelectTrigger className="h-14 text-lg font-bold border-2 border-slate-300 focus:border-violet-500">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5 Days</SelectItem>
                                <SelectItem value="6">6 Days</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-slate-500">Teaching days per week</p>
                          </div>

                          {/* Period Duration */}
                          <div className="space-y-3">
                            <Label htmlFor="periodDuration" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                              <Clock className="w-4 h-4 text-indigo-600" />
                              Period Duration (minutes)
                            </Label>
                            <Input
                              id="periodDuration"
                              type="number"
                              min="30"
                              step="5"
                              value={schoolConfig.period_duration_minutes}
                              onChange={(e) => setSchoolConfig({...schoolConfig, period_duration_minutes: parseInt(e.target.value || '0')})}
                              className="h-14 text-xl font-bold text-center border-2 border-slate-300 focus:border-indigo-500"
                            />
                            <p className="text-xs text-slate-500">Typical values: 45 or 60</p>
                          </div>

                          {/* Start Time */}
                          <div className="space-y-3">
                            <Label htmlFor="startTime" className="flex items-center gap-2 text-sm font-bold text-slate-900">
                              <Clock className="w-4 h-4 text-rose-600" />
                              Start Time
                            </Label>
                            <Input 
                              id="startTime"
                              type="time"
                              value={schoolConfig.school_start_time}
                              onChange={(e) => setSchoolConfig({...schoolConfig, school_start_time: e.target.value})}
                              className="h-14 text-xl font-bold text-center border-2 border-slate-300 focus:border-rose-500"
                            />
                            <p className="text-xs text-slate-500">First period begins at</p>
                          </div>
                        </div>

                        {/* Schedule Preview */}
                        <div className="mt-8 p-5 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-indigo-100 mt-0.5">
                              <Info className="w-5 h-5 text-indigo-700" />
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-indigo-900 mb-2">Schedule Preview</p>
                              <p className="text-sm text-indigo-800 leading-relaxed">
                                School day starts at <span className="font-bold">{schoolConfig.school_start_time}</span>, running <span className="font-bold">{schoolConfig.days_per_week} days</span> per week. The system will optimize period allocation automatically.
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Breaks & Lunch */}
                    <Card className="border-0 shadow-md">
                      <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-green-100">
                            <Timer className="w-5 h-5 text-green-700" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Breaks & Lunch Configuration</CardTitle>
                            <CardDescription>Set mandatory break and lunch times per local regulations</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          {/* Lunch Settings */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-orange-700" />
                              </div>
                              <div>
                                <p className="font-bold text-orange-900 text-base">Lunch Break</p>
                                <p className="text-xs text-orange-700">Required duration & timing</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-orange-800 mb-1.5 block">Duration (minutes)</Label>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="number"
                                    min="20"
                                    max="60"
                                    className="h-10 text-center font-semibold border-orange-300"
                                    value={schoolConfig.lunch_duration_minutes}
                                    onChange={(e) => setSchoolConfig({...schoolConfig, lunch_duration_minutes: parseInt(e.target.value)})}
                                  />
                                  <span className="text-sm text-orange-700 font-medium">min</span>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-orange-800 mb-1.5 block">After Period</Label>
                                <Select 
                                  value={String(schoolConfig.lunch_period)} 
                                  onValueChange={(value) => setSchoolConfig({...schoolConfig, lunch_period: parseInt(value)})}
                                >
                                  <SelectTrigger className="h-10 font-semibold border-orange-300">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({length: schoolConfig.periods_per_day}, (_, i) => i + 1).map(p => (
                                      <SelectItem key={p} value={String(p)}>Period {p}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <p className="text-xs text-orange-600 mt-3">Lunch occurs after this period</p>
                          </div>

                          {/* Break Settings */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100 border-2 border-cyan-200">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-10 h-10 rounded-full bg-cyan-200 flex items-center justify-center">
                                <Timer className="w-5 h-5 text-cyan-700" />
                              </div>
                              <div>
                                <p className="font-bold text-cyan-900 text-base">Short Breaks</p>
                                <p className="text-xs text-cyan-700">Spread throughout day</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-cyan-800 mb-1.5 block">Duration (minutes)</Label>
                                <div className="flex items-center gap-2">
                                  <Input 
                                    type="number"
                                    min="5"
                                    max="30"
                                    className="h-10 text-center font-semibold border-cyan-300"
                                    value={schoolConfig.break_duration_minutes}
                                    onChange={(e) => setSchoolConfig({...schoolConfig, break_duration_minutes: parseInt(e.target.value)})}
                                  />
                                  <span className="text-sm text-cyan-700 font-medium">min</span>
                                </div>
                              </div>
                              <div>
                                <Label className="text-xs text-cyan-800 mb-1.5 block">After Periods</Label>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({length: schoolConfig.periods_per_day}, (_, i) => i + 1)
                                    .filter(p => p !== schoolConfig.lunch_period)
                                    .map(period => (
                                    <button
                                      key={period}
                                      type="button"
                                      onClick={() => {
                                        const current = schoolConfig.break_periods || [];
                                        const updated = current.includes(period)
                                          ? current.filter(p => p !== period)
                                          : [...current, period].sort((a, b) => a - b);
                                        setSchoolConfig({...schoolConfig, break_periods: updated});
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                        (schoolConfig.break_periods || []).includes(period)
                                          ? 'bg-cyan-600 text-white shadow-md'
                                          : 'bg-white text-cyan-700 border-2 border-cyan-200 hover:bg-cyan-50'
                                      }`}
                                    >
                                      {period}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-cyan-600 mt-3">Select periods for breaks ({(schoolConfig.break_periods || []).length} selected)</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                          <div className="flex gap-2">
                            <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-green-800">
                              <p className="font-semibold mb-1">Daily Break Schedule:</p>
                              <p>
                                <strong>{(schoolConfig.break_periods || []).length}</strong> short breaks of <strong>{schoolConfig.break_duration_minutes} min</strong> after periods {(schoolConfig.break_periods || []).join(', ')}, 
                                and <strong>1</strong> lunch break of <strong>{schoolConfig.lunch_duration_minutes} min</strong> after period <strong>{schoolConfig.lunch_period}</strong>.
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>



                    {/* Advanced Schedule Settings */}
                    <Card className="border-0 shadow-md">
                      <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">Advanced Schedule Settings</CardTitle>
                            <CardDescription>Control day window, active weekdays, breaks, and period targets</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-900">Day Start Time</Label>
                            <Input type="time" value={schoolConfig.day_start_time}
                              onChange={(e)=>setSchoolConfig({...schoolConfig, day_start_time: e.target.value})}
                              className="h-12 text-center font-semibold" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-900">Day End Time</Label>
                            <Input type="time" value={schoolConfig.day_end_time}
                              onChange={(e)=>setSchoolConfig({...schoolConfig, day_end_time: e.target.value})}
                              className="h-12 text-center font-semibold" />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-900">Min Periods / Day</Label>
                            <Input type="number" min="1" value={schoolConfig.min_periods_per_day}
                              onChange={(e)=>setSchoolConfig({...schoolConfig, min_periods_per_day: parseInt(e.target.value || '0')})}
                              className="h-12 text-center font-semibold" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-bold text-slate-900">Target Periods / Day</Label>
                            <Input type="number" min="1" value={schoolConfig.target_periods_per_day}
                              onChange={(e)=>setSchoolConfig({...schoolConfig, target_periods_per_day: parseInt(e.target.value || '0')})}
                              className="h-12 text-center font-semibold" />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-bold text-slate-900">Active Days of Week</Label>
                          <div className="flex flex-wrap gap-2">
                            {['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY'].map(d => {
                              const active = (schoolConfig.days_of_week||[]).includes(d);
                              return (
                                <button key={d} type="button"
                                  onClick={()=>{
                                    const cur = schoolConfig.days_of_week || [];
                                    const next = active ? cur.filter(x=>x!==d) : [...cur, d];
                                    setSchoolConfig({...schoolConfig, days_of_week: next});
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border-slate-300'}`}
                                >{d.slice(0,3)}</button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-bold text-slate-900">Breaks</Label>
                            <Button variant="outline" size="sm" onClick={()=>{
                              const next = [...(schoolConfig.breaks||[]), {start: '12:00', end: '13:00'}];
                              setSchoolConfig({...schoolConfig, breaks: next});
                            }}>Add Break</Button>
                          </div>
                          <div className="space-y-2">
                            {(schoolConfig.breaks||[]).length === 0 ? (
                              <p className="text-xs text-slate-500">No breaks configured</p>
                            ) : (
                              (schoolConfig.breaks||[]).map((b, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Input type="time" value={b.start||''} onChange={(e)=>{
                                    const next = [...(schoolConfig.breaks||[])];
                                    next[idx] = { ...(next[idx]||{}), start: e.target.value };
                                    setSchoolConfig({...schoolConfig, breaks: next});
                                  }} className="h-10 w-32" />
                                  <span className="text-slate-500">to</span>
                                  <Input type="time" value={b.end||''} onChange={(e)=>{
                                    const next = [...(schoolConfig.breaks||[])];
                                    next[idx] = { ...(next[idx]||{}), end: e.target.value };
                                    setSchoolConfig({...schoolConfig, breaks: next});
                                  }} className="h-10 w-32" />
                                  <Button variant="ghost" size="icon" onClick={()=>{
                                    const next = (schoolConfig.breaks||[]).filter((_,i)=>i!==idx);
                                    setSchoolConfig({...schoolConfig, breaks: next});
                                  }}>✕</Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Test & Assessment Slots */}
                    <Card className="border-0 shadow-lg">
                      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-white/10 backdrop-blur">
                            <AlertTriangle className="w-6 h-6" />
                          </div>
                          <div>
                            <CardTitle className="text-xl">Test & Assessment Slots by Level</CardTitle>
                            <CardDescription className="text-slate-300">Configure weekly test allocation and supervision for each IB programme</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-8 pb-8">
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* PYP */}
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border-2 border-yellow-300 hover:border-yellow-400 transition-all">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
                                <span className="font-black text-white text-lg">PYP</span>
                              </div>
                              <div>
                                <p className="font-bold text-yellow-900 text-lg">Primary Years Programme</p>
                                <p className="text-xs text-yellow-700 font-medium">Weekly test configuration</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-bold text-yellow-900 mb-2 block">Tests/Week</Label>
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="5"
                                    className="h-12 text-xl font-bold text-center border-2 border-yellow-300 focus:border-yellow-500"
                                    value={schoolConfig.test_config.PYP.tests_per_week}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        PYP: { ...schoolConfig.test_config.PYP, tests_per_week: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-bold text-yellow-900 mb-2 block">Duration (min)</Label>
                                  <Input 
                                    type="number"
                                    min="30"
                                    max="120"
                                    step="15"
                                    className="h-12 text-xl font-bold text-center border-2 border-yellow-300 focus:border-yellow-500"
                                    value={schoolConfig.test_config.PYP.test_duration_minutes}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        PYP: { ...schoolConfig.test_config.PYP, test_duration_minutes: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs font-bold text-yellow-900 mb-2 block">Supervisor Teacher</Label>
                                <Select 
                                  value={schoolConfig.test_config.PYP.supervisor_id || 'none'}
                                  onValueChange={(value) => setSchoolConfig({
                                    ...schoolConfig,
                                    test_config: {
                                      ...schoolConfig.test_config,
                                      PYP: { ...schoolConfig.test_config.PYP, supervisor_id: value === 'none' ? null : value }
                                    }
                                  })}
                                >
                                  <SelectTrigger className="h-11 border-2 border-yellow-300 focus:border-yellow-500">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No supervisor assigned</SelectItem>
                                    {teachers.map(t => (
                                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* MYP */}
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 border-2 border-emerald-300 hover:border-emerald-400 transition-all">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg">
                                <span className="font-black text-white text-lg">MYP</span>
                              </div>
                              <div>
                                <p className="font-bold text-emerald-900 text-lg">Middle Years Programme</p>
                                <p className="text-xs text-emerald-700 font-medium">Weekly test configuration</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-bold text-emerald-900 mb-2 block">Tests/Week</Label>
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="5"
                                    className="h-12 text-xl font-bold text-center border-2 border-emerald-300 focus:border-emerald-500"
                                    value={schoolConfig.test_config.MYP.tests_per_week}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        MYP: { ...schoolConfig.test_config.MYP, tests_per_week: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-bold text-emerald-900 mb-2 block">Duration (min)</Label>
                                  <Input 
                                    type="number"
                                    min="30"
                                    max="120"
                                    step="15"
                                    className="h-12 text-xl font-bold text-center border-2 border-emerald-300 focus:border-emerald-500"
                                    value={schoolConfig.test_config.MYP.test_duration_minutes}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        MYP: { ...schoolConfig.test_config.MYP, test_duration_minutes: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs font-bold text-emerald-900 mb-2 block">Supervisor Teacher</Label>
                                <Select 
                                  value={schoolConfig.test_config.MYP.supervisor_id || 'none'}
                                  onValueChange={(value) => setSchoolConfig({
                                    ...schoolConfig,
                                    test_config: {
                                      ...schoolConfig.test_config,
                                      MYP: { ...schoolConfig.test_config.MYP, supervisor_id: value === 'none' ? null : value }
                                    }
                                  })}
                                >
                                  <SelectTrigger className="h-11 border-2 border-emerald-300 focus:border-emerald-500">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No supervisor assigned</SelectItem>
                                    {teachers.map(t => (
                                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* DP1 */}
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-sky-50 to-blue-50 border-2 border-blue-300 hover:border-blue-400 transition-all">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-lg">
                                <span className="font-black text-white text-lg">DP1</span>
                              </div>
                              <div>
                                <p className="font-bold text-blue-900 text-lg">Diploma Programme Year 1</p>
                                <p className="text-xs text-blue-700 font-medium">Weekly test configuration</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-bold text-blue-900 mb-2 block">Tests/Week</Label>
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="5"
                                    className="h-12 text-xl font-bold text-center border-2 border-blue-300 focus:border-blue-500"
                                    value={schoolConfig.test_config.DP1.tests_per_week}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        DP1: { ...schoolConfig.test_config.DP1, tests_per_week: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-bold text-blue-900 mb-2 block">Duration (min)</Label>
                                  <Input 
                                    type="number"
                                    min="30"
                                    max="180"
                                    step="15"
                                    className="h-12 text-xl font-bold text-center border-2 border-blue-300 focus:border-blue-500"
                                    value={schoolConfig.test_config.DP1.test_duration_minutes}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        DP1: { ...schoolConfig.test_config.DP1, test_duration_minutes: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs font-bold text-blue-900 mb-2 block">Supervisor Teacher</Label>
                                <Select 
                                  value={schoolConfig.test_config.DP1.supervisor_id || 'none'}
                                  onValueChange={(value) => setSchoolConfig({
                                    ...schoolConfig,
                                    test_config: {
                                      ...schoolConfig.test_config,
                                      DP1: { ...schoolConfig.test_config.DP1, supervisor_id: value === 'none' ? null : value }
                                    }
                                  })}
                                >
                                  <SelectTrigger className="h-11 border-2 border-blue-300 focus:border-blue-500">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No supervisor assigned</SelectItem>
                                    {teachers.map(t => (
                                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          {/* DP2 */}
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-indigo-50 border-2 border-indigo-300 hover:border-indigo-400 transition-all">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-lg">
                                <span className="font-black text-white text-lg">DP2</span>
                              </div>
                              <div>
                                <p className="font-bold text-indigo-900 text-lg">Diploma Programme Year 2</p>
                                <p className="text-xs text-indigo-700 font-medium">Weekly test configuration</p>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs font-bold text-indigo-900 mb-2 block">Tests/Week</Label>
                                  <Input 
                                    type="number"
                                    min="0"
                                    max="5"
                                    className="h-12 text-xl font-bold text-center border-2 border-indigo-300 focus:border-indigo-500"
                                    value={schoolConfig.test_config.DP2.tests_per_week}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        DP2: { ...schoolConfig.test_config.DP2, tests_per_week: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs font-bold text-indigo-900 mb-2 block">Duration (min)</Label>
                                  <Input 
                                    type="number"
                                    min="30"
                                    max="180"
                                    step="15"
                                    className="h-12 text-xl font-bold text-center border-2 border-indigo-300 focus:border-indigo-500"
                                    value={schoolConfig.test_config.DP2.test_duration_minutes}
                                    onChange={(e) => setSchoolConfig({
                                      ...schoolConfig, 
                                      test_config: {
                                        ...schoolConfig.test_config,
                                        DP2: { ...schoolConfig.test_config.DP2, test_duration_minutes: parseInt(e.target.value) }
                                      }
                                    })}
                                  />
                                </div>
                              </div>
                              
                              <div>
                                <Label className="text-xs font-bold text-indigo-900 mb-2 block">Supervisor Teacher</Label>
                                <Select 
                                  value={schoolConfig.test_config.DP2.supervisor_id || 'none'}
                                  onValueChange={(value) => setSchoolConfig({
                                    ...schoolConfig,
                                    test_config: {
                                      ...schoolConfig.test_config,
                                      DP2: { ...schoolConfig.test_config.DP2, supervisor_id: value === 'none' ? null : value }
                                    }
                                  })}
                                >
                                  <SelectTrigger className="h-11 border-2 border-indigo-300 focus:border-indigo-500">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">No supervisor assigned</SelectItem>
                                    {teachers.map(t => (
                                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    </div>
              </TabsContent>

              {/* Constraints Tab Content */}
              <TabsContent value="constraints">
                  <div className="space-y-4">
                    <Card className="border-0 shadow-sm">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle>Scheduling Constraints</CardTitle>
                            <CardDescription>Define rules and constraints for intelligent schedule generation</CardDescription>
                          </div>
                          <Button 
                            className="bg-indigo-600 hover:bg-indigo-700"
                            onClick={() => setConstraintDialogOpen(true)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Constraint
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          console.log('Rendering constraints tab. Total constraints:', constraints.length);
                          console.log('Constraints data:', constraints);
                          return null;
                        })()}
                        {constraints.length === 0 ? (
                          <div className="text-center py-12 text-slate-500">
                            <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p className="font-medium">No constraints defined yet</p>
                            <p className="text-sm mt-1">Add custom rules to optimize schedule generation</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {constraints.map((constraint) => (
                              <Card key={constraint.id} className="border-2">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-semibold text-slate-900">{constraint.name}</h4>
                                        <Badge variant={constraint.type === 'hard' ? 'destructive' : 'secondary'}>
                                          {constraint.type === 'hard' ? 'Hard' : 'Soft'}
                                        </Badge>
                                        <Badge variant="outline">{constraint.category}</Badge>
                                      </div>
                                      <p className="text-sm text-slate-600">{constraint.description}</p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={async () => {
                                        if (confirm('Delete this constraint?')) {
                                          await base44.entities.Constraint.delete(constraint.id);
                                          queryClient.invalidateQueries({ queryKey: ['constraints'] });
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4 text-slate-400" />
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                </Tabs>

      {/* Create Version Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Schedule Version</DialogTitle>
            <DialogDescription>
              Create a schedule version for all IB programmes. You can generate multiple versions to compare and choose the best one.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createVersionMutation.mutate(formData); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Version Name *</Label>
              <Input 
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Fall 2024 Draft v1"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="academic_year">Academic Year</Label>
                <Select 
                  value={formData.academic_year} 
                  onValueChange={(value) => setFormData({ ...formData, academic_year: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024-2025">2024-2025</SelectItem>
                    <SelectItem value="2025-2026">2025-2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term</Label>
                <Select 
                  value={formData.term} 
                  onValueChange={(value) => setFormData({ ...formData, term: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="Full Year">Full Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={createVersionMutation.isPending}>
                {createVersionMutation.isPending ? 'Creating...' : 'Create Version'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generation Progress Modal */}
      <GenerationProgress 
        open={isGenerating}
        progress={generationProgress}
        onClose={() => {
          setIsGenerating(false);
          setCancelGeneration(false);
          setGenerationProgress({
            stage: '',
            percent: 0,
            message: '',
            currentStep: '',
            completedSteps: [],
            completed: false
          });
        }}
        onCancel={() => {
          setCancelGeneration(true);
          toast.info('Cancelling schedule generation...');
        }}
      />

      <Dialog open={dpDiagOpen} onOpenChange={setDpDiagOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>DP Diagnostic (Preview)</DialogTitle>
            <DialogDescription>DP target: 9 periods/day • No slots persisted</DialogDescription>
          </DialogHeader>
          {dpDiagData ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-0 bg-slate-50">
                  <CardContent className="p-4">
                    <div className="font-semibold text-slate-700 mb-1">Expected vs Created (DP)</div>
                    <div className="text-slate-900">
                      {dpDiagData.recap?.expected_lessons_for_dp} expected vs {dpDiagData.recap?.created_lessons_for_dp} created
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-0 bg-slate-50">
                  <CardContent className="p-4">
                    <div className="font-semibold text-slate-700 mb-1">Underfilled Days</div>
                    <div className="text-slate-900">{dpDiagData.recap?.underfilled_days}</div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">Missing Core Subjects</div>
                <div className="text-slate-900">
                  {(dpDiagData.recap?.missing_core_subjects || []).length === 0 ? 'None' : (dpDiagData.recap?.missing_core_subjects || []).join(', ')}
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {['TOK','CAS','EE'].map(key => (
                  <Card key={key} className="border-0 bg-slate-50">
                    <CardContent className="p-4">
                      <div className="font-semibold text-slate-700 mb-1">{key} Samples</div>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap">{JSON.stringify((dpDiagData.recap?.core_lessons_sample?.[key] || []).slice(0,3), null, 2)}</pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">Off-by-one Check</div>
                <div className="text-slate-900">
                  {dpDiagData.recap?.off_by_one_issues && Object.keys(dpDiagData.recap.off_by_one_issues).length > 0
                    ? JSON.stringify(dpDiagData.recap.off_by_one_issues)
                    : 'OK — no +1/-1 discrepancies per subject'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500">No data</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDpDiagOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Constraint Dialog with AI */}
      <Dialog open={constraintDialogOpen} onOpenChange={setConstraintDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-600" />
              Add Scheduling Constraint
            </DialogTitle>
            <DialogDescription>
              Choose constraint type and describe your preference in natural language
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={constraintType} onValueChange={setConstraintType} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hard" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Hard Constraint
              </TabsTrigger>
              <TabsTrigger value="soft" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-blue-50 hover:text-blue-700 transition-colors">
                <Info className="w-4 h-4 mr-2" />
                Soft Constraint
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hard" className="space-y-4 mt-4">
              <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-rose-900 mb-1">Hard Constraint - Must Be Respected</p>
                    <p className="text-rose-700">This constraint <strong>must</strong> be followed no matter what, even if it requires regenerating the entire schedule. The system will never violate this rule.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hard-constraint-input">Describe Your Hard Constraint</Label>
                <Textarea 
                  id="hard-constraint-input"
                  value={constraintInput}
                  onChange={(e) => setConstraintInput(e.target.value)}
                  placeholder="e.g., 'Teachers cannot teach more than 4 consecutive periods' or 'No teacher can work on Fridays'"
                  className="min-h-[120px] resize-none border-rose-200 focus:ring-rose-500"
                />
                <p className="text-xs text-slate-500">
                  Examples: "Students must have lunch after period 4", "Room 101 is unavailable on Mondays", "Teachers maximum 25 hours per week"
                </p>
              </div>
            </TabsContent>

            <TabsContent value="soft" className="space-y-4 mt-4">
              <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-semibold text-blue-900 mb-1">Soft Constraint - Optimize When Possible</p>
                    <p className="text-blue-700">This constraint will be followed <strong>only if possible</strong> without violating any hard constraints. The system will try its best but may ignore it if necessary.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="soft-constraint-input">Describe Your Soft Constraint</Label>
                <Textarea 
                  id="soft-constraint-input"
                  value={constraintInput}
                  onChange={(e) => setConstraintInput(e.target.value)}
                  placeholder="e.g., 'Dr. Smith prefers not to teach on Wednesday afternoons' or 'Try to schedule labs in the morning'"
                  className="min-h-[120px] resize-none border-blue-200 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500">
                  Examples: "Prefer morning slots for science labs", "Balance teacher workload evenly", "Avoid back-to-back classes for the same subject"
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setConstraintDialogOpen(false);
                setConstraintInput('');
                setConstraintType('hard');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGenerateConstraint}
              disabled={!constraintInput.trim() || isGeneratingConstraint}
              className={constraintType === 'hard' 
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              }
            >
              {isGeneratingConstraint ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate {constraintType === 'hard' ? 'Hard' : 'Soft'} Constraint
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}