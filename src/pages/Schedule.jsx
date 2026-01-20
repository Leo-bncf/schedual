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
import TeacherScheduleView from '../components/schedule/TeacherScheduleView';
import ScheduleExporter from '../components/schedule/ScheduleExporter';
import ConflictAlert from '../components/schedule/ConflictAlert';
import ConflictViewer from '../components/schedule/ConflictViewer';
import EmptyState from '../components/ui-custom/EmptyState';
import GenerationProgress from '../components/schedule/GenerationProgress';
import ScheduleUpdateBanner from '../components/schedule/ScheduleUpdateBanner';
import UtilizationStats from '../components/schedule/UtilizationStats';
import TOKCASManager from '../components/settings/TOKCASManager';

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
  const [constraintType, setConstraintType] = useState('hard');
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
    status: 'draft'
  });
  const [schoolConfig, setSchoolConfig] = useState({
    periods_per_day: 8,
    period_duration_minutes: 45,
    days_per_week: 5,
    school_start_time: '08:00',
    hl_hours: 6,
    sl_hours: 4,
    lunch_duration_minutes: 30,
    lunch_period: 4,
    break_duration_minutes: 15,
    break_periods: [2, 6],
    test_config: {
      PYP: { tests_per_week: 1, test_duration_minutes: 60 },
      MYP: { tests_per_week: 1, test_duration_minutes: 60 },
      DP1: { tests_per_week: 2, test_duration_minutes: 90 },
      DP2: { tests_per_week: 2, test_duration_minutes: 90 }
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
        period_duration_minutes: school.period_duration_minutes || 45,
        days_per_week: school.days_per_week || 5,
        school_start_time: school.school_start_time || '08:00',
        hl_hours: school.settings?.hl_hours || 6,
        sl_hours: school.settings?.sl_hours || 4,
        lunch_duration_minutes: school.settings?.lunch_duration_minutes || 30,
        lunch_period: school.settings?.lunch_period || 4,
        break_duration_minutes: school.settings?.break_duration_minutes || 15,
        break_periods: school.settings?.break_periods || [2, 6],
        test_config: school.settings?.test_config || {
          PYP: { tests_per_week: 1, test_duration_minutes: 60 },
          MYP: { tests_per_week: 1, test_duration_minutes: 60 },
          DP1: { tests_per_week: 2, test_duration_minutes: 90 },
          DP2: { tests_per_week: 2, test_duration_minutes: 90 }
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
          periods_per_day: schoolConfig.periods_per_day,
          period_duration_minutes: schoolConfig.period_duration_minutes,
          days_per_week: schoolConfig.days_per_week,
          school_start_time: schoolConfig.school_start_time,
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
    } catch (error) {
      console.error('Failed to save configuration:', error);
    } finally {
      setIsSavingConfig(false);
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
            hours_per_week: g.hours_per_week,
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
        if (!g.hours_per_week || g.hours_per_week <= 0) return;

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

          const slHours = subject.sl_hours_per_week || schoolConfig.sl_hours || 4;
          const hlHours = subject.hl_hours_per_week || schoolConfig.hl_hours || 6;
          const sharedCount = Math.min(slHours, hlHours); // usually SL hours
          const hlExtra = Math.max(0, hlHours - slHours);

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

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Master Schedule"
        description={`Generate and manage timetables for ${allowedProgrammes.join(', ')}`}
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="bg-slate-900 hover:bg-slate-800 rounded-xl">
            <Plus className="w-4 h-4 mr-2" />
            New Version
          </Button>
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
          <TabsTrigger value="schedule" disabled={!selectedVersion}>
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="constraints">Constraints</TabsTrigger>
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

                {/* Schedule Views */}
                <Tabs defaultValue="grid">
                <div className="flex items-center justify-between mb-4">
                  <TabsList className="bg-slate-100">
                    <TabsTrigger value="grid">Master Schedule</TabsTrigger>
                    <TabsTrigger value="student">Student View</TabsTrigger>
                    <TabsTrigger value="teacher">Teacher View</TabsTrigger>
                    <TabsTrigger value="list">List View</TabsTrigger>
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
                         periodsPerDay={school?.periods_per_day || 8}
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
                    {/* Daily Schedule */}
                    <Card className="border-0 shadow-md">
                      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-100">
                              <Clock className="w-5 h-5 text-amber-700" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">Daily Schedule Configuration</CardTitle>
                              <CardDescription>Configure your school's daily timetable structure</CardDescription>
                            </div>
                          </div>
                          <Button 
                            onClick={handleSaveConfig}
                            disabled={isSavingConfig}
                            className="bg-indigo-600 hover:bg-indigo-700"
                          >
                            {isSavingConfig ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              'Save Changes'
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                            <Label htmlFor="periods" className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
                              <Hash className="w-4 h-4" />
                              Periods Per Day
                            </Label>
                            <Input 
                              id="periods"
                              type="number"
                              min="4"
                              max="12"
                              value={schoolConfig.periods_per_day}
                              onChange={(e) => setSchoolConfig({...schoolConfig, periods_per_day: parseInt(e.target.value)})}
                              className="h-12 text-lg font-semibold border-blue-300"
                            />
                            <p className="text-xs text-blue-700 mt-2">Total teaching periods (4-12)</p>
                          </div>

                          <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200">
                            <Label htmlFor="duration" className="flex items-center gap-2 text-sm font-semibold text-emerald-900 mb-3">
                              <Timer className="w-4 h-4" />
                              Period Length
                            </Label>
                            <div className="flex items-center gap-2">
                              <Input 
                                id="duration"
                                type="number"
                                min="30"
                                max="90"
                                value={schoolConfig.period_duration_minutes}
                                onChange={(e) => setSchoolConfig({...schoolConfig, period_duration_minutes: parseInt(e.target.value)})}
                                className="h-12 text-lg font-semibold border-emerald-300"
                              />
                              <span className="text-lg font-semibold text-emerald-700">min</span>
                            </div>
                            <p className="text-xs text-emerald-700 mt-2">Duration per period (30-90 min)</p>
                          </div>

                          <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-violet-200">
                            <Label htmlFor="days" className="flex items-center gap-2 text-sm font-semibold text-violet-900 mb-3">
                              <Calendar className="w-4 h-4" />
                              School Week
                            </Label>
                            <Select 
                              value={String(schoolConfig.days_per_week)} 
                              onValueChange={(value) => setSchoolConfig({...schoolConfig, days_per_week: parseInt(value)})}
                            >
                              <SelectTrigger className="h-12 text-lg font-semibold border-violet-300">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="5">5 Days (Mon-Fri)</SelectItem>
                                <SelectItem value="6">6 Days (Mon-Sat)</SelectItem>
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-violet-700 mt-2">Teaching days per week</p>
                          </div>

                          <div className="p-5 rounded-xl bg-gradient-to-br from-rose-50 to-rose-100 border-2 border-rose-200">
                            <Label htmlFor="startTime" className="flex items-center gap-2 text-sm font-semibold text-rose-900 mb-3">
                              <Clock className="w-4 h-4" />
                              Start Time
                            </Label>
                            <Input 
                              id="startTime"
                              type="time"
                              value={schoolConfig.school_start_time}
                              onChange={(e) => setSchoolConfig({...schoolConfig, school_start_time: e.target.value})}
                              className="h-12 text-lg font-semibold border-rose-300"
                            />
                            <p className="text-xs text-rose-700 mt-2">First period begins at</p>
                          </div>
                        </div>

                        <div className="mt-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
                          <div className="flex gap-2">
                            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-blue-800">
                              <p className="font-semibold mb-1">Schedule Preview:</p>
                              <p>School day runs from <strong>{schoolConfig.school_start_time}</strong> with <strong>{schoolConfig.periods_per_day}</strong> periods of <strong>{schoolConfig.period_duration_minutes}</strong> minutes each, over <strong>{schoolConfig.days_per_week}</strong> days per week.</p>
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

{/* DP Core Components */}
                    <Card className="border-0 shadow-md">
                      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-100">
                            <Clock className="w-5 h-5 text-purple-700" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">DP Core Components</CardTitle>
                            <CardDescription>Configure TOK, CAS, and EE teaching hours and assignments</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <TOKCASManager schoolId={schoolId} />
                      </CardContent>
                    </Card>

                    {/* Test Slot Configuration */}
                    <Card className="border-0 shadow-md">
                      <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-red-100">
                            <Clock className="w-5 h-5 text-red-700" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">Test & Assessment Slots by Level</CardTitle>
                            <CardDescription>Configure weekly test allocation per IB programme level</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          {/* PYP */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center">
                                <span className="font-bold text-yellow-900">PYP</span>
                              </div>
                              <div>
                                <p className="font-bold text-yellow-900 text-base">Primary Years</p>
                                <p className="text-xs text-yellow-700">Weekly assessments</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-yellow-800 mb-1.5 block">Tests per week</Label>
                                <Input 
                                  type="number"
                                  min="0"
                                  max="5"
                                  className="h-9 text-center font-semibold border-yellow-300"
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
                                <Label className="text-xs text-yellow-800 mb-1.5 block">Duration (minutes)</Label>
                                <Input 
                                  type="number"
                                  min="30"
                                  max="120"
                                  step="15"
                                  className="h-9 text-center font-semibold border-yellow-300"
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
                            <p className="text-xs text-yellow-600 mt-3">
                              <strong>{schoolConfig.test_config.PYP.tests_per_week}</strong> tests × <strong>{schoolConfig.test_config.PYP.test_duration_minutes}min</strong> per week
                            </p>
                          </div>

                          {/* MYP */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center">
                                <span className="font-bold text-green-900">MYP</span>
                              </div>
                              <div>
                                <p className="font-bold text-green-900 text-base">Middle Years</p>
                                <p className="text-xs text-green-700">Weekly assessments</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-green-800 mb-1.5 block">Tests per week</Label>
                                <Input 
                                  type="number"
                                  min="0"
                                  max="5"
                                  className="h-9 text-center font-semibold border-green-300"
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
                                <Label className="text-xs text-green-800 mb-1.5 block">Duration (minutes)</Label>
                                <Input 
                                  type="number"
                                  min="30"
                                  max="120"
                                  step="15"
                                  className="h-9 text-center font-semibold border-green-300"
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
                            <p className="text-xs text-green-600 mt-3">
                              <strong>{schoolConfig.test_config.MYP.tests_per_week}</strong> tests × <strong>{schoolConfig.test_config.MYP.test_duration_minutes}min</strong> per week
                            </p>
                          </div>

                          {/* DP1 */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                                <span className="font-bold text-blue-900">DP1</span>
                              </div>
                              <div>
                                <p className="font-bold text-blue-900 text-base">Diploma Year 1</p>
                                <p className="text-xs text-blue-700">Weekly assessments</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-blue-800 mb-1.5 block">Tests per week</Label>
                                <Input 
                                  type="number"
                                  min="0"
                                  max="5"
                                  className="h-9 text-center font-semibold border-blue-300"
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
                                <Label className="text-xs text-blue-800 mb-1.5 block">Duration (minutes)</Label>
                                <Input 
                                  type="number"
                                  min="30"
                                  max="180"
                                  step="15"
                                  className="h-9 text-center font-semibold border-blue-300"
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
                            <p className="text-xs text-blue-600 mt-3">
                              <strong>{schoolConfig.test_config.DP1.tests_per_week}</strong> tests × <strong>{schoolConfig.test_config.DP1.test_duration_minutes}min</strong> per week
                            </p>
                          </div>

                          {/* DP2 */}
                          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100 border-2 border-indigo-200">
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-200 flex items-center justify-center">
                                <span className="font-bold text-indigo-900">DP2</span>
                              </div>
                              <div>
                                <p className="font-bold text-indigo-900 text-base">Diploma Year 2</p>
                                <p className="text-xs text-indigo-700">Weekly assessments</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <Label className="text-xs text-indigo-800 mb-1.5 block">Tests per week</Label>
                                <Input 
                                  type="number"
                                  min="0"
                                  max="5"
                                  className="h-9 text-center font-semibold border-indigo-300"
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
                                <Label className="text-xs text-indigo-800 mb-1.5 block">Duration (minutes)</Label>
                                <Input 
                                  type="number"
                                  min="30"
                                  max="180"
                                  step="15"
                                  className="h-9 text-center font-semibold border-indigo-300"
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
                            <p className="text-xs text-indigo-600 mt-3">
                              <strong>{schoolConfig.test_config.DP2.tests_per_week}</strong> tests × <strong>{schoolConfig.test_config.DP2.test_duration_minutes}min</strong> per week
                            </p>
                          </div>
                        </div>

                        <div className="mt-6 p-4 rounded-lg bg-red-50 border border-red-200">
                          <div className="flex gap-2">
                            <Info className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-red-800">
                              <p className="font-semibold mb-1">Assessment Schedule Summary:</p>
                              <p>
                                <strong>PYP:</strong> {schoolConfig.test_config.PYP.tests_per_week} tests of {Math.floor(schoolConfig.test_config.PYP.test_duration_minutes / 60)}h{schoolConfig.test_config.PYP.test_duration_minutes % 60 > 0 ? ` ${schoolConfig.test_config.PYP.test_duration_minutes % 60}min` : ''} • 
                                <strong> MYP:</strong> {schoolConfig.test_config.MYP.tests_per_week} tests of {Math.floor(schoolConfig.test_config.MYP.test_duration_minutes / 60)}h{schoolConfig.test_config.MYP.test_duration_minutes % 60 > 0 ? ` ${schoolConfig.test_config.MYP.test_duration_minutes % 60}min` : ''} • 
                                <strong> DP1:</strong> {schoolConfig.test_config.DP1.tests_per_week} tests of {Math.floor(schoolConfig.test_config.DP1.test_duration_minutes / 60)}h{schoolConfig.test_config.DP1.test_duration_minutes % 60 > 0 ? ` ${schoolConfig.test_config.DP1.test_duration_minutes % 60}min` : ''} • 
                                <strong> DP2:</strong> {schoolConfig.test_config.DP2.tests_per_week} tests of {Math.floor(schoolConfig.test_config.DP2.test_duration_minutes / 60)}h{schoolConfig.test_config.DP2.test_duration_minutes % 60 > 0 ? ` ${schoolConfig.test_config.DP2.test_duration_minutes % 60}min` : ''}
                              </p>
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
              <TabsTrigger value="soft" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
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