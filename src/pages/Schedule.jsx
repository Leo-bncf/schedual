import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  Info,
  Settings,
  FileText,
  Calculator
} from 'lucide-react';
import { createPageUrl } from '../utils';
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
import CohortIntegrityReport from '../components/schedule/CohortIntegrityReport';
import PreSolveAuditReport from '../components/schedule/PreSolveAuditReport';
import GlobalPeriodCoverageReport from '../components/schedule/GlobalPeriodCoverageReport';
import SolutionInfeasiblePanel from '../components/schedule/SolutionInfeasiblePanel';


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
  // OptaPlanner response state
  const [optaPlannerResult, setOptaPlannerResult] = useState(null);
  const [optaPlannerLoading, setOptaPlannerLoading] = useState(false);
  const [optaPlannerError, setOptaPlannerError] = useState(null);
  const [autoRunOptaPlanner, setAutoRunOptaPlanner] = useState(true);
  const [scheduleTab, setScheduleTab] = useState('grid');
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [solverTimeslots, setSolverTimeslots] = useState(null); // Persist timeslots from OptaPlanner
  const [auditResult, setAuditResult] = useState(null);
  const [showAuditReport, setShowAuditReport] = useState(false);

  // CRITICAL: Runtime validator for OptaPlanner response format
  const setOptaPlannerResultSafe = (payload) => {
    if (payload && typeof payload.ok !== 'boolean') {
      console.error('[Schedule] ❌ RUNTIME ASSERT FAILED: optaPlannerResult.ok is not boolean:', {
        ok_type: typeof payload.ok,
        ok_value: payload.ok,
        payload_keys: Object.keys(payload || {}),
        has_result: 'result' in payload,
        result_keys: payload.result ? Object.keys(payload.result) : null,
        stage: payload.stage,
        full_payload_sample: JSON.stringify(payload).slice(0, 300)
      });
    }
    setOptaPlannerResult(payload);
  };
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
    status: 'draft'
  });
  const [schoolConfig, setSchoolConfig] = useState({
    periods_per_day: 10, // Auto-calculated: 08:00-18:00 with 60min periods = 10 periods/day
    period_duration_minutes: 60,
    days_per_week: 5,
    school_start_time: '08:00',
    day_start_time: '08:00',
    day_end_time: '18:00',
    days_of_week: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
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
    if (!school) return ['PYP', 'MYP', 'DP'];
    if (school.subscription_tier === 'tier1') return ['MYP'];
    if (school.subscription_tier === 'tier2' || school.subscription_tier === 'tier3') return ['PYP', 'MYP', 'DP'];
    return ['PYP', 'MYP', 'DP'];
  }, [school]);

  // Initialize school config when school data loads
  React.useEffect(() => {
    if (school) {
      setSchoolConfig({
        periods_per_day: school.periods_per_day || 10,
        period_duration_minutes: school.period_duration_minutes || 60,
        days_per_week: school.days_per_week || 5,
        school_start_time: school.school_start_time || '08:00',
        day_start_time: school.day_start_time || school.school_start_time || '08:00',
        day_end_time: school.day_end_time || '18:00',
        days_of_week: Array.isArray(school.days_of_week) && school.days_of_week.length > 0 ? school.days_of_week : ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
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
  queryFn: async () => {
    if (!selectedVersion) return [];

    // CRITICAL: Always load persisted slots from DB - even if solver failed (keep grid stable)
    const slots = await base44.entities.ScheduleSlot.filter({ schedule_version: selectedVersion.id });
      const inserted = (optaPlannerResult?.persistedSlotsSample || []).map(s => ({ ...s, schedule_version: selectedVersion.id }));
      const result = Array.isArray(inserted) && inserted.length > 0 ? [...slots, ...inserted] : slots;

      // Determine actual timeslots source (must match useMemo logic)
      const timeslotsSource = solverTimeslots && solverTimeslots.length > 0 
        ? 'persisted from solver (stable)' 
        : optaPlannerResult?.timeslots && optaPlannerResult.timeslots.length > 0
          ? 'from solver result (temporary)'
          : result.length > 0 && optaPlannerResult?.scheduleSettingsSent
            ? 'reconstructed from solver scheduleSettings'
            : 'fallback - school config';

      // Debug logging - CRITICAL: Read ok from correct object
      const keepingGridStable = optaPlannerResult?.ok === false && result.length > 0;
      
      console.log('[Schedule] DEBUG - scheduleSlots.length:', result.length);
      console.log('[Schedule] DEBUG - timeslots source:', timeslotsSource);
      console.log('[Schedule] DEBUG - solverTimeslots:', solverTimeslots?.length || 0, 'slots');
      console.log('[Schedule] DEBUG - payload.ok:', optaPlannerResult?.ok);
      console.log('[Schedule] DEBUG - Solver failed but keeping grid stable:', keepingGridStable);

      return result;
    },
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
    if (typeof tg.hours_per_week === 'number' && tg.hours_per_week > 0) return Math.round(tg.hours_per_week * 60);
    if (subj?.ib_level === 'DP') {
      return level === 'HL' ? (subj?.hl_minutes_per_week_default || 300) : (subj?.sl_minutes_per_week_default || 180);
    }
    return subj?.pyp_myp_minutes_per_week_default || 180;
  };

  const minutesToPeriods = (m) => {
    // CRITICAL: Use school config for period duration (this is metadata, not computed from timeslots)
    const period = school?.period_duration_minutes || schoolConfig.period_duration_minutes || 60;
    return Math.max(0, Math.ceil(m / period));
  };

  const periodsForGroup = (tg) => minutesToPeriods(getMinutesForGroup(tg));

  // SOURCE OF TRUTH: Use solver timeslots OR reconstruct from scheduleSettings (NOT school config)
  const timeslots = React.useMemo(() => {
    // CRITICAL: When solver fails, keep grid stable - use last known timeslots (do NOT return empty)
    // Priority 1: Use persisted solver timeslots (set once by OptaPlanner, never overwritten)
    if (solverTimeslots && Array.isArray(solverTimeslots) && solverTimeslots.length > 0) {
      const source = optaPlannerResult?.ok === false ? '(stable - solver failed, using last known)' : '(stable)';
      console.log('[Schedule] ✅ Using PERSISTED timeslots from OptaPlanner solver:', solverTimeslots.length, 'slots', source);
      return solverTimeslots;
    }
    
    // Priority 2: Use current OptaPlanner result timeslots (temporary until persisted) - ONLY if solver succeeded
    if (optaPlannerResult?.ok === true && optaPlannerResult?.timeslots && Array.isArray(optaPlannerResult.timeslots) && optaPlannerResult.timeslots.length > 0) {
      console.log('[Schedule] ⚠️ Using TEMPORARY timeslots from OptaPlanner result:', optaPlannerResult.timeslots.length, 'slots (not yet persisted)');
      return optaPlannerResult.timeslots;
    }
    
    // Priority 3: If we have slots but no timeslots, reconstruct from scheduleSettings (solver config)
    if (scheduleSlots.length > 0 && optaPlannerResult?.scheduleSettingsSent) {
      console.log('[Schedule] 🔄 Reconstructing timeslots from SOLVER scheduleSettings (source of truth)');
      const settings = optaPlannerResult.scheduleSettingsSent;
      const dayStart = settings.day_start_time || '08:00';
      const dayEnd = settings.day_end_time || '18:00';
      const periodDuration = settings.period_duration_minutes || 60;
      const daysOfWeek = settings.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      const breaks = settings.breaks || [];
      
      const slots = [];
      let globalId = 1;
      
      daysOfWeek.forEach(day => {
        const [startHour, startMin] = dayStart.split(':').map(Number);
        const [endHour, endMin] = dayEnd.split(':').map(Number);
        let currentMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        while (currentMinutes < endMinutes) {
          const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
          const slotEnd = `${String(Math.floor((currentMinutes + periodDuration) / 60)).padStart(2, '0')}:${String((currentMinutes + periodDuration) % 60).padStart(2, '0')}`;
          
          // Check if this time overlaps with a break
          const isBreak = breaks.some(b => {
            const [bStartH, bStartM] = b.start.split(':').map(Number);
            const [bEndH, bEndM] = b.end.split(':').map(Number);
            const bStart = bStartH * 60 + bStartM;
            const bEnd = bEndH * 60 + bEndM;
            return currentMinutes < bEnd && (currentMinutes + periodDuration) > bStart;
          });
          
          if (!isBreak) {
            slots.push({
              id: globalId++,
              dayOfWeek: day,
              startTime: slotStart,
              endTime: slotEnd
            });
          }
          
          currentMinutes += periodDuration;
        }
      });
      
      const calculatedPeriodsPerDay = Math.ceil(slots.length / Math.max(1, daysOfWeek.length));
      console.log('[Schedule] ✅ Reconstructed from solver settings:', {
        timeslots: slots.length,
        periodsPerDay: calculatedPeriodsPerDay,
        dayStart,
        dayEnd,
        periodDuration,
        breaks: breaks.length
      });
      
      return slots;
    }
    
    // Fallback: Reconstruct from school config (only if no slots exist yet)
    console.log('[Schedule] 🔄 Reconstructing timeslots from school config (fallback - no solver data available)');
    
    if (!school) return [];
    
    const dayStart = school.day_start_time || '08:00';
    const dayEnd = school.day_end_time || '18:00';
    const periodDuration = school.period_duration_minutes || 60;
    const daysOfWeek = school.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const breaks = school.breaks || [];
    
    const slots = [];
    let globalId = 1;
    
    daysOfWeek.forEach(day => {
      const [startHour, startMin] = dayStart.split(':').map(Number);
      const [endHour, endMin] = dayEnd.split(':').map(Number);
      let currentMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      while (currentMinutes < endMinutes) {
        const slotStart = `${String(Math.floor(currentMinutes / 60)).padStart(2, '0')}:${String(currentMinutes % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((currentMinutes + periodDuration) / 60)).padStart(2, '0')}:${String((currentMinutes + periodDuration) % 60).padStart(2, '0')}`;
        
        // Check if this time overlaps with a break
        const isBreak = breaks.some(b => {
          const [bStartH, bStartM] = b.start.split(':').map(Number);
          const [bEndH, bEndM] = b.end.split(':').map(Number);
          const bStart = bStartH * 60 + bStartM;
          const bEnd = bEndH * 60 + bEndM;
          return currentMinutes < bEnd && (currentMinutes + periodDuration) > bStart;
        });
        
        if (!isBreak) {
          slots.push({
            id: globalId++,
            dayOfWeek: day,
            startTime: slotStart,
            endTime: slotEnd
          });
        }
        
        currentMinutes += periodDuration;
      }
    });
    
    return slots;
  }, [school, optaPlannerResult, solverTimeslots, scheduleSlots.length]);

  // SOURCE OF TRUTH: Calculate periodsPerDay from actual timeslots (NEVER fallback to hardcoded values)
  const dynamicPeriodsPerDay = React.useMemo(() => {
    // PRIORITY 1: If timeslots exist, ALWAYS use them (NEVER fallback to school config)
    if (timeslots.length > 0) {
      const daysOfWeek = optaPlannerResult?.scheduleSettingsSent?.days_of_week || school?.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
      const periodsPerDay = Math.ceil(timeslots.length / Math.max(1, daysOfWeek.length));
      
      console.log('[Schedule] ✅ periodsPerDay from timeslots (SOURCE OF TRUTH - PRIORITY 1):', {
        timeslots: timeslots.length,
        daysOfWeek: daysOfWeek.length,
        periodsPerDay,
        source: 'TIMESLOTS_ARRAY'
      });
      
      return periodsPerDay;
    }
    
    // PRIORITY 2: Calculate from scheduleSettings (solver config sent to OptaPlanner)
    if (optaPlannerResult?.scheduleSettingsSent) {
      const settings = optaPlannerResult.scheduleSettingsSent;
      const dayStart = settings.day_start_time || settings.school_start_time || '08:00';
      const dayEnd = settings.day_end_time || '18:00';
      const periodDuration = settings.period_duration_minutes || 60;
      const breaks = settings.breaks || [];
      
      const [startHour, startMin] = dayStart.split(':').map(Number);
      const [endHour, endMin] = dayEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      // Calculate total time minus breaks
      const totalMinutes = endMinutes - startMinutes;
      const breakMinutes = breaks.reduce((sum, b) => {
        const [bStartH, bStartM] = b.start.split(':').map(Number);
        const [bEndH, bEndM] = b.end.split(':').map(Number);
        return sum + ((bEndH * 60 + bEndM) - (bStartH * 60 + bStartM));
      }, 0);
      
      const availableMinutes = totalMinutes - breakMinutes;
      const calculatedPeriods = Math.floor(availableMinutes / periodDuration);
      
      console.log('[Schedule] 📊 periodsPerDay from scheduleSettings (SOURCE OF TRUTH - PRIORITY 2):', {
        source: 'SOLVER_SETTINGS',
        dayStart,
        dayEnd,
        periodDuration,
        totalMinutes,
        breakMinutes,
        availableMinutes,
        calculatedPeriods
      });
      
      return calculatedPeriods;
    }
    
    // PRIORITY 3: Calculate from school config (only if no timeslots AND no scheduleSettings)
    if (school) {
      const dayStart = school.day_start_time || school.school_start_time || '08:00';
      const dayEnd = school.day_end_time || '18:00';
      const periodDuration = school.period_duration_minutes || 60;
      const breaks = school.breaks || [];
      
      const [startHour, startMin] = dayStart.split(':').map(Number);
      const [endHour, endMin] = dayEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      const totalMinutes = endMinutes - startMinutes;
      const breakMinutes = breaks.reduce((sum, b) => {
        const [bStartH, bStartM] = b.start.split(':').map(Number);
        const [bEndH, bEndM] = b.end.split(':').map(Number);
        return sum + ((bEndH * 60 + bEndM) - (bStartH * 60 + bStartM));
      }, 0);
      
      const availableMinutes = totalMinutes - breakMinutes;
      const calculatedPeriods = Math.floor(availableMinutes / periodDuration);
      
      console.log('[Schedule] 📊 periodsPerDay from school config (PRIORITY 3 - no timeslots/settings):', {
        source: 'SCHOOL_CONFIG',
        dayStart,
        dayEnd,
        periodDuration,
        totalMinutes,
        breakMinutes,
        availableMinutes,
        calculatedPeriods
      });
      
      return calculatedPeriods;
    }
    
    // CRITICAL: No data available - return null to trigger loading state (NEVER return hardcoded fallback)
    console.warn('[Schedule] ⚠️ periodsPerDay: No data available (school/settings/timeslots) - returning null (loading state)');
    return null;
  }, [timeslots, optaPlannerResult?.scheduleSettingsSent, school]);

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

  // Auto-calculate periods_per_day from time range + duration
  const calculatePeriodsPerDay = (config) => {
    const dayStart = config.day_start_time || config.school_start_time || '08:00';
    const dayEnd = config.day_end_time || '18:00';
    const periodDuration = config.period_duration_minutes || 60;
    const breaks = config.breaks || [];
    
    const [startHour, startMin] = dayStart.split(':').map(Number);
    const [endHour, endMin] = dayEnd.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    const breakMinutes = breaks.reduce((sum, b) => {
      const [bStartH, bStartM] = b.start.split(':').map(Number);
      const [bEndH, bEndM] = b.end.split(':').map(Number);
      return sum + ((bEndH * 60 + bEndM) - (bStartH * 60 + bStartM));
    }, 0);
    
    const availableMinutes = totalMinutes - breakMinutes;
    return Math.floor(availableMinutes / periodDuration);
  };

  const handleRecalculatePeriodsPerDay = () => {
    const calculated = calculatePeriodsPerDay(schoolConfig);
    setSchoolConfig({ ...schoolConfig, periods_per_day: calculated });
    toast.success(`Recalculated: ${calculated} periods/day`);
  };

  const handleSaveConfig = async () => {
    if (!school) return;
    setIsSavingConfig(true);
    try {
      // Auto-calculate periods_per_day before saving
      const calculatedPeriods = calculatePeriodsPerDay(schoolConfig);
      
      await updateSchoolMutation.mutateAsync({
        id: school.id,
        data: {
          days_per_week: schoolConfig.days_per_week,
          school_start_time: schoolConfig.school_start_time,
          period_duration_minutes: schoolConfig.period_duration_minutes,
          periods_per_day: calculatedPeriods, // Force calculated value
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

      toast.success(`Configuration saved (${calculatedPeriods} periods/day calculated)`);
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

  // Fetch full OptaPlanner scheduler JSON response and display it
  const handleFetchORTool = async () => {
    if (!selectedVersion) return;
    
    // CRITICAL: Frontend gate - validate all required inputs are loaded before calling solver
    const inputValidation = {
      schoolId: !!school?.id,
      scheduleVersionId: !!selectedVersion?.id,
      timeslots: (timeslots && timeslots.length > 0) || scheduleSettings || (school?.day_start_time && school?.day_end_time),
      teachingGroups: teachingGroups && teachingGroups.length > 0,
      teachers: teachers && teachers.length > 0,
      rooms: rooms && rooms.length > 0
    };
    
    const missingInputs = Object.entries(inputValidation)
      .filter(([_, isValid]) => !isValid)
      .map(([key]) => key);
    
    if (missingInputs.length > 0) {
      console.error('[handleFetchORTool] ❌ BLOCKING: Required inputs not loaded:', missingInputs);
      toast.error(`Cannot generate schedule - still loading: ${missingInputs.join(', ')}`, { duration: 8000 });
      return;
    }
    
    console.log('[handleFetchORTool] ✅ Input validation passed - all required data loaded');
    
    setOptaPlannerLoading(true);
    setOptaPlannerError(null);
    try {
      const res = await base44.functions.invoke('optaPlannerPipeline', { schedule_version_id: selectedVersion.id });
      
      // CRITICAL: Normalize axios response - extract data at correct level
      const payload = res?.data || {};
      
      // RUNTIME ASSERTION: payload.ok MUST be boolean
      if (typeof payload.ok !== 'boolean') {
        console.error('[handleFetchORTool] ❌ RUNTIME ASSERT FAILED: payload.ok is not boolean:', {
          ok_type: typeof payload.ok,
          ok_value: payload.ok,
          payload_keys: Object.keys(payload || {}),
          has_result: 'result' in payload,
          result_keys: payload.result ? Object.keys(payload.result) : null,
          stage: payload.stage,
          axios_status: res?.status,
          full_response_sample: JSON.stringify(res).slice(0, 500)
        });
        
        toast.error(`❌ Invalid API response format (ok: ${typeof payload.ok}). Check diagnostics.`, { duration: 10000 });
        setOptaPlannerError(`MALFORMED RESPONSE: payload.ok is ${typeof payload.ok}, expected boolean.\n\nKeys: ${Object.keys(payload).join(', ')}\n\nThis indicates a backend response parsing issue.`);
        setOptaPlannerLoading(false);
        return; // STOP UI FLOW
      }
      
      setOptaPlannerResultSafe(payload);
      
      console.log('[handleFetchORTool] ✅ Response validated - ok:', payload.ok, 'stage:', payload.stage);

      // Log solver identity to console
      if (payload?.solverIdentity) {
        console.log(`🔧 SOLVER: ${payload.solverIdentity.engine} (${payload.solverIdentity.implementation}) v${payload.solverIdentity.version}`);
      }

      // Check if function returned error
      if (payload?.ok === false) {
        console.error(`❌ Solver returned error:`, payload);
      
      // UNIVERSAL ERROR DISPLAY
      const errorSummary = [
        `Stage: ${payload.stage || 'Unknown'}`,
        `Code: ${payload.code || payload.errorCode || 'N/A'}`,
        `Message: ${payload.message || payload.errorMessage || payload.error || 'Unknown error'}`,
        payload.meta?.school_id ? `School ID: ${payload.meta.school_id}` : null,
        payload.meta?.schedule_version_id ? `Schedule Version ID: ${payload.meta.schedule_version_id}` : null,
        payload.details?.length > 0 ? `\nDetails (${payload.details.length} issues):` : null,
        ...(payload.details || []).slice(0, 5).map((d, i) => 
          `  ${i+1}. ${d.entity || 'N/A'}.${d.field || 'N/A'}: ${d.reason || 'N/A'}\n     💡 ${d.hint || 'N/A'}`
        ),
        payload.details?.length > 5 ? `  ... +${payload.details.length - 5} more issues` : null,
        payload.suggestion ? `\nSuggestion: ${payload.suggestion}` : null,
        payload.requiredAction ? `Action Required: ${payload.requiredAction}` : null
      ].filter(Boolean).join('\n');
      
      setOptaPlannerError(errorSummary);
      
      // Toast: prioritize title → code → fallback
      toast.error(payload.title || payload.code || 'Erreur de génération', { 
        duration: 12000,
        description: payload.message || payload.errorMessage || payload.error
      });
      } else if (payload.ok === true) {
        // Success path - read from payload.result
        const result = payload.result || {};
        const inserted = result.slotsInserted ?? 0;
        const deleted = result.slotsDeleted ?? 0;
        
        console.log(`[handleFetchORTool] ✅ Success: deleted ${deleted}, inserted ${inserted}`);
        
        // CRITICAL: Block if 0 slots inserted
        if (inserted === 0) {
          toast.error('❌ OptaPlanner returned 0 slots. Check diagnostics.', { duration: 10000 });
          setOptaPlannerError(`OptaPlanner reported success but inserted 0 slots.\n\nDeleted: ${deleted}\nInserted: ${inserted}`);
        } else {
          toast.success(`✅ OptaPlanner: ${deleted} deleted, ${inserted} slots created`);
        }
        
        // Persist solver timeslots to prevent config reconstruction overwrite
        if (payload.timeslots && Array.isArray(payload.timeslots) && payload.timeslots.length > 0) {
          console.log('[handleFetchORTool] 💾 PERSISTING solver timeslots:', payload.timeslots.length, 'slots');
          setSolverTimeslots(payload.timeslots);
        }
        
        await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
        await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
        setScheduleTab('student');
      } else {
        // payload.ok is undefined or null - unexpected response format
        console.warn('[handleFetchORTool] ⚠️ Unexpected response format (ok is undefined):', payload);
        toast.warning('OptaPlanner response format unexpected. Check diagnostics.');
      }
    } catch (e) {
      console.error('OptaPlanner fetch failed:', e);
      const errorData = e?.response?.data;
      const statusCode = e?.response?.status;
      
      if (errorData && typeof errorData === 'object') {
        setOptaPlannerResultSafe(errorData);
        
        if (errorData.ok === false || errorData.code || errorData.stage) {
          // UNIVERSAL ERROR DISPLAY
          const errorSummary = [
            `Stage: ${errorData.stage || 'Unknown'}`,
            `Code: ${errorData.code || errorData.errorCode || 'N/A'}`,
            `Message: ${errorData.message || errorData.errorMessage || errorData.error || 'Unknown error'}`,
            errorData.meta?.school_id ? `School ID: ${errorData.meta.school_id}` : null,
            errorData.meta?.schedule_version_id ? `Schedule Version ID: ${errorData.meta.schedule_version_id}` : null,
            errorData.details?.length > 0 ? `\n📋 Details (${errorData.details.length} issues):` : null,
            ...(errorData.details || []).slice(0, 5).map((d, i) => 
              `  ${i+1}. ${d.entity || 'N/A'}.${d.field || 'N/A'}: ${d.reason || 'N/A'}\n     💡 ${d.hint || 'N/A'}`
            ),
            errorData.details?.length > 5 ? `  ... +${errorData.details.length - 5} more issues` : null,
            errorData.suggestion ? `\nSuggestion: ${errorData.suggestion}` : null,
            errorData.requiredAction ? `Action Required: ${errorData.requiredAction}` : null,
            errorData.errorStack ? `\nStack:\n${errorData.errorStack}` : null
          ].filter(Boolean).join('\n');
          
          setOptaPlannerError(errorSummary);
          
          // Toast: prioritize title → code → fallback
          toast.error(errorData.title || errorData.code || errorData.errorCode || 'Erreur de génération', { 
            duration: 12000,
            description: errorData.message || errorData.errorMessage || errorData.error
          });
        } else {
          setOptaPlannerError(e?.message || 'Failed to fetch OptaPlanner response');
          toast.error('Failed to retrieve OptaPlanner response');
        }
      } else {
        setOptaPlannerError(e?.message || 'Failed to fetch OptaPlanner response');
        toast.error('Failed to retrieve OptaPlanner response');
      }
    } finally {
      setOptaPlannerLoading(false);
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

    // VALIDATION: Block if no valid timeslots can be generated
    if (!school) {
      toast.error('School configuration missing - cannot generate schedule');
      return;
    }
    
    const dayStart = school.day_start_time || '08:00';
    const dayEnd = school.day_end_time || '18:00';
    const periodDuration = school.period_duration_minutes || 60;
    
    // Quick check: can we generate at least 1 timeslot?
    const [startHour, startMin] = dayStart.split(':').map(Number);
    const [endHour, endMin] = dayEnd.split(':').map(Number);
    const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    if (totalMinutes < periodDuration) {
      toast.error(`Invalid school configuration: day range ${dayStart}→${dayEnd} is too short for ${periodDuration}min periods. Configure timeslots in Settings.`, { duration: 8000 });
      return;
    }

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
          console.log('DP groups created:', dpGroupResult?.groups_created || dpGroupResult?.created || 0);
          console.log('DP group IDs:', dpGroupResult?.created_group_ids || []);
          console.log('DP groups returned:', dpGroupResult?.groups?.length || 0);

          if (dpGroupResult?.duplicate_subjects?.length > 0) {
            console.warn('⚠️ Students with duplicate subjects:', dpGroupResult.duplicate_subjects);
          }

          if (!dpGroupResult?.success) {
            console.error('❌ DP group generation failed:', dpGroupResult?.message || dpGroupResult?.error);
          }
          
          // CRITICAL: Sync student.assigned_groups after DP group creation
          console.log('🔄 Syncing student assigned_groups...');
          try {
            const { data: syncResult } = await base44.functions.invoke('syncStudentTeachingGroups');
            console.log('✅ Student sync result:', syncResult);
          } catch (syncError) {
            console.error('❌ Student sync failed:', syncError);
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
      const { data: assignmentResult } = await base44.functions.invoke('assignTeachers', {
        school_id: schoolId
      });
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

      // CRITICAL: If Codex auto-run enabled, skip ALL local scheduling
      // Codex becomes single source of truth (purge → optimize → persist)
      if (autoRunOptaPlanner && allowedProgrammes.includes('DP')) {
        console.log('[Schedule] 🚀 Codex auto-run enabled - SKIPPING all local scheduling');
        console.log('[Schedule] Codex will attempt to generate an optimized schedule. If feasible, will purge existing slots and persist new ones. If infeasible (hard constraints violated), existing schedule is preserved.');
        
        setGenerationProgress(prev => ({
          ...prev,
          stage: 'Preparing Codex Solver',
          percent: 30,
          message: 'Skipping local scheduler - Codex will handle everything...',
          completedSteps: ['teachers', 'preparation']
        }));
        
        // Skip directly to Codex pipeline below (no local slot generation)
      } else {
        // Local scheduling for MYP/PYP or when OptaPlanner disabled
        console.log('[Schedule] 🔧 Using local scheduling algorithm (OptaPlanner disabled or no DP)');

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
        // NORMALIZE days to match UI expectations (capitalize first letter only)
        const normalizeDay = (d) => {
          if (!d) return d;
          const up = String(d).toUpperCase();
          const dayMap = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };
          return dayMap[up] || String(d).charAt(0).toUpperCase() + String(d).slice(1).toLowerCase();
        };
        const days = (school?.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']).map(normalizeDay);
        
        // CRITICAL: Use dynamicPeriodsPerDay (calculated from timeslots/config), NEVER school.periods_per_day
        const periodsPerDay = dynamicPeriodsPerDay || 10; // Fallback to 10 only if dynamicPeriodsPerDay is null
        console.log('[Schedule] Local scheduling using periodsPerDay:', periodsPerDay, '(source: dynamicPeriodsPerDay)');
        
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
              // Normalize year_group to support both "DP1,DP2" and "DP1+DP2" formats
              const groupYears = String(group.year_group || '').split(/[,+]/).map(y => y.trim());
              if (!groupYears.includes(s.year_group)) return false;
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
          const batchNum = Math.floor(i / batchSize) + 1;
          const totalBatches = Math.ceil(newSlots.length / batchSize);

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

        console.log('=== LOCAL SCHEDULE GENERATION COMPLETE ===');
        console.log(`Total local slots created: ${newSlots.length}`);
      } // End of local scheduling block

      // Codex Pipeline: Generate optimized schedule (SINGLE SOURCE OF TRUTH)
      if (autoRunOptaPlanner && selectedVersion && allowedProgrammes.includes('DP')) {
        console.log('[Schedule] 🔄 Codex Pipeline Starting');
        console.log('[Schedule] Step 1: Running pre-solve audit...');
        
        try {
          // CRITICAL: Frontend gate before audit
          const inputValidation = {
            schoolId: !!school?.id,
            scheduleVersionId: !!selectedVersion?.id,
            timeslots: (timeslots && timeslots.length > 0) || scheduleSettings || (school?.day_start_time && school?.day_end_time),
            teachingGroups: teachingGroups && teachingGroups.length > 0,
            teachers: teachers && teachers.length > 0,
            rooms: rooms && rooms.length > 0
          };
          
          const missingInputs = Object.entries(inputValidation)
            .filter(([_, isValid]) => !isValid)
            .map(([key]) => key);
          
          if (missingInputs.length > 0) {
            console.error('[Schedule] ❌ BLOCKING AUDIT: Required inputs not loaded:', missingInputs);
            toast.error(`Cannot run audit - still loading: ${missingInputs.join(', ')}`, { duration: 8000 });
            setIsGenerating(false);
            return;
          }
          
          console.log('[Schedule] ✅ Audit input validation passed - all required data loaded');
          
          // STEP 1: Run audit first (audit=true)
          setGenerationProgress(prev => ({
            ...prev,
            stage: 'Running Pre-Solve Audit',
            percent: 85,
            message: 'Validating student assignments and teaching groups...'
          }));
          setOptaPlannerLoading(true);
          setOptaPlannerError(null);
          
          const auditRes = await base44.functions.invoke('optaPlannerPipeline', {
            schedule_version_id: selectedVersion.id,
            audit: true
          });
          
          // CRITICAL: Parse response if it's a string (double-stringify bug)
          let auditData = auditRes.data || {};
          
          if (typeof auditData === 'string') {
            console.warn('[Schedule] ⚠️ Audit response is STRING (should be object) - attempting parse');
            try {
              auditData = JSON.parse(auditData);
              console.log('[Schedule] ✅ Successfully parsed stringified response');
            } catch (parseErr) {
              console.error('[Schedule] ❌ Failed to parse stringified response:', parseErr);
              auditData = { ok: false, stage: 'PARSE_ERROR', error: 'Response is malformed string', rawString: auditData };
            }
          }
          
          console.log('[Schedule] 📋 RAW AUDIT RESPONSE (FULL):', JSON.stringify(auditData, null, 2));
          console.log('[Schedule] 📋 OptaPlanner Audit Call:', {
            function: 'optaPlannerPipeline', // Clean pipeline (no masking)
            payload: { 
              schedule_version_id: selectedVersion.id, 
              school_id: user.school_id,
              dp_min_end_time: '16:00', 
              dp_study_weekly: 8, 
              audit: true 
            },
            response_type: typeof auditData,
            response_keys: Object.keys(auditData),
            response_ok: auditData.ok,
            response_stage: auditData.stage,
            response_buildVersion: auditData.buildVersion,
            response_wrapperVersion: auditData.wrapperBuildVersion,
            solver_engine: 'OptaPlanner' // IMPORTANT: Using OptaPlanner solver
          });
          
          // CRITICAL: Check ok field FIRST - if not true, STOP immediately
          if (auditData.ok !== true) {
            console.error('[Schedule] ❌ AUDIT FAILED - ok !== true - BLOCKING generation');
            console.error('[Schedule] 📊 Error details:', {
              stage: auditData.stage,
              errorCode: auditData.errorCode || auditData.code,
              message: auditData.message || auditData.errorMessage || auditData.error,
              requestId: auditData.requestId || 'N/A',
              validationErrorsCount: Array.isArray(auditData.validationErrors) ? auditData.validationErrors.length : 0,
              detailsCount: Array.isArray(auditData.details) ? auditData.details.length : 0
            });
            
            // CRITICAL: Log Codex 422 structured error if present
            if (auditData.requestId) {
              console.error('[Schedule] 🔍 Codex requestId:', auditData.requestId);
            }
            if (Array.isArray(auditData.validationErrors) && auditData.validationErrors.length > 0) {
              console.error('[Schedule] ❌ Validation errors:', auditData.validationErrors);
            }
            if (Array.isArray(auditData.details) && auditData.details.length > 0) {
              console.error('[Schedule] 📋 Details:', auditData.details.map((d, i) => 
                `[${i+1}] ${d.entity || 'N/A'}.${d.field || 'N/A'}: ${d.reason || 'N/A'} (hint: ${d.hint || 'N/A'})`
              ));
            }
            
            // DIAGNOSTIC: Log school config if timeslots=0
            if (auditData.code === 'NO_TIMESLOTS' || (auditData.schoolConfig && auditData.schoolConfig.total_minutes_available <= 0)) {
              console.error('[Schedule] 🚨 ZERO TIMESLOTS - School timing invalid:', auditData.schoolConfig);
              console.error('[Schedule] 👉 Fix required: Settings → School Configuration → Verify day_start_time < day_end_time');
            }
            
            // Build structured error display
            const errorStage = auditData.stage || 'UNKNOWN_STAGE';
            const errorCode = auditData.error || auditData.code || 'AUDIT_FAILED';
            const errorMessage = auditData.errorMessage || auditData.error || 'Pre-solve audit failed';
            const errorDetails = auditData.details || auditData.missingSubjects || auditData.missingGroups || null;
            
            console.error('[Schedule] 📋 Parsed error:', {
              stage: errorStage,
              code: errorCode,
              message: errorMessage,
              hasDetails: !!errorDetails,
              detailsCount: Array.isArray(errorDetails) ? errorDetails.length : null,
              detailsSample: Array.isArray(errorDetails) ? errorDetails.slice(0, 3) : errorDetails,
              buildVersion: auditData.buildVersion || 'unknown',
              wrapperVersion: auditData.wrapperBuildVersion || 'unknown',
              solverEngine: 'OptaPlanner'
            });
            
            // Structured audit result for UI display
            setAuditResult({
              ok: false,
              stage: errorStage,
              errorCode: auditData.errorCode || errorCode,
              message: auditData.message || errorMessage,
              requestId: auditData.requestId || null,
              validationErrors: auditData.validationErrors || [],
              details: auditData.details || errorDetails || [],
              meta: auditData.meta || null,
              // Legacy fields (for backward compatibility)
              suggestion: auditData.suggestion || null,
              missingSubjects: auditData.missingSubjects || [],
              missingGroups: auditData.missingGroups || [],
              splitSections: auditData.splitSections || []
            });
            
            setShowAuditReport(true);
            setOptaPlannerLoading(false);
            setIsGenerating(false);
            
            // Toast: prioritize title → code → fallback
            toast.error(auditData.title || auditData.code || errorCode || 'Erreur d\'audit', { 
              duration: 12000,
              description: auditData.message || errorMessage
            });
            return; // CRITICAL: STOP - do not proceed to solver
          }
          
          // SUCCESS: Log audit pass details
          console.log('[Schedule] ✅ Codex Audit Passed:', {
            stage: auditData.stage,
            meta: auditData.meta,
            validationReport: auditData.result?.validationReport || null,
            message: 'Ready to proceed with Codex optimization'
          });
          
          // STEP 3: Audit passed (ok === true) - proceed with solver
          console.log('[Schedule] ✅ Pre-solve audit passed (ok=true) - proceeding to Codex solver');
          console.log('[Schedule] Codex will attempt optimization. On success (ok=true): 1) Purge existing slots 2) Insert optimized slots (atomic). On infeasibility (hardScore<0): existing schedule preserved.');
          
          // CRITICAL: Re-validate inputs before actual solver call (data may have changed)
          const solverInputValidation = {
            schoolId: !!school?.id,
            scheduleVersionId: !!selectedVersion?.id,
            timeslots: (timeslots && timeslots.length > 0) || scheduleSettings || (school?.day_start_time && school?.day_end_time),
            teachingGroups: teachingGroups && teachingGroups.length > 0,
            teachers: teachers && teachers.length > 0,
            rooms: rooms && rooms.length > 0
          };
          
          const solverMissingInputs = Object.entries(solverInputValidation)
            .filter(([_, isValid]) => !isValid)
            .map(([key]) => key);
          
          if (solverMissingInputs.length > 0) {
            console.error('[Schedule] ❌ BLOCKING SOLVER: Required inputs became unavailable:', solverMissingInputs);
            toast.error(`Cannot run solver - data changed: ${solverMissingInputs.join(', ')}`, { duration: 8000 });
            setOptaPlannerLoading(false);
            setIsGenerating(false);
            return;
          }
          
          setGenerationProgress(prev => ({
            ...prev,
            stage: 'Running Codex Solver',
            percent: 90,
            message: 'Codex: Purging + Optimizing + Persisting (atomic transaction)...'
          }));
          
          const res = await base44.functions.invoke('optaPlannerPipeline', {
            schedule_version_id: selectedVersion.id
          });
          
          // CRITICAL: Normalize axios response - extract data at correct level
          const payload = res?.data || {};
          
          // RUNTIME ASSERTION: payload.ok MUST be boolean
          if (typeof payload.ok !== 'boolean') {
            console.error('[Schedule] ❌ RUNTIME ASSERT FAILED: payload.ok is not boolean:', {
              ok_type: typeof payload.ok,
              ok_value: payload.ok,
              payload_keys: Object.keys(payload || {}),
              has_result: 'result' in payload,
              result_keys: payload.result ? Object.keys(payload.result) : null,
              stage: payload.stage,
              axios_status: res?.status,
              full_response_sample: JSON.stringify(res).slice(0, 500)
            });
            
            toast.error(`❌ Invalid API response format (ok: ${typeof payload.ok}). Check diagnostics.`, { duration: 10000 });
            setOptaPlannerError(`MALFORMED RESPONSE: payload.ok is ${typeof payload.ok}, expected boolean.\n\nKeys: ${Object.keys(payload).join(', ')}\n\nThis indicates a backend response parsing issue.`);
            setOptaPlannerLoading(false);
            setIsGenerating(false);
            return; // STOP UI FLOW
          }
          
          setOptaPlannerResultSafe(payload);
          
          console.log('[Schedule] ✅ Response validated - ok:', payload.ok, 'stage:', payload.stage);

          // Log solver identity to console
          if (payload?.solverIdentity) {
            console.log(`🔧 SOLVER: ${payload.solverIdentity.engine} (${payload.solverIdentity.implementation}) v${payload.solverIdentity.version}`);
          }

          // Check if function returned error
          if (payload.ok === false) {
            console.error(`❌ Codex returned error:`, payload);
            console.error('[Schedule] requestId:', payload.requestId || 'N/A');
            console.error('[Schedule] validationErrors:', payload.validationErrors || []);
            console.error('[Schedule] details:', payload.details || []);
            
            // Special handling for cohort integrity violation
            if (payload.stage === 'COHORT_INTEGRITY_VIOLATION') {
              const splitSections = payload.splitSections || [];
              const count = splitSections.length;
              const firstSection = splitSections[0] || {};
              
              const errorMsg = `❌ SOLVER BUG: ${count} section(s) have duplicate timeslot assignments\n\n` +
                `Example: ${firstSection.subject || 'Unknown'} - ${firstSection.studentGroup}\n` +
                `Timeslots: ${JSON.stringify(firstSection.timeslots_list)}\n` +
                `Reason: ${firstSection.reason}\n\n` +
                `${payload.suggestion || 'This is a solver constraint violation - same class cannot be scheduled multiple times at the same time.'}`;
              
              setOptaPlannerError(errorMsg);
              toast.error(payload.title || 'Violation d\'intégrité du solver', { 
                duration: 12000,
                description: payload.message || `${count} sections avec doublons de créneaux`
              });
            }
            // Special handling for missing HL/SL hours validation
            else if (payload.stage === 'VALIDATION_FAILED_MISSING_HL_SL_HOURS' || payload.error === 'MISSING_HL_SL_HOURS_CONFIG') {
              const missingSubjects = payload.missingSubjects || payload.missingGroups || [];
              const count = missingSubjects.length;
              const subjectNames = missingSubjects.slice(0, 5).map(s => `${s?.name || s?.code || 'Unknown'} (missing: ${s?.missing || '?'})`).join(', ');
              const moreText = count > 5 ? ` +${count - 5} more` : '';
              
              toast.error(payload.title || 'Configuration HL/SL manquante', { 
                duration: 12000,
                description: payload.message || `${count} matières DP nécessitent heures HL/SL`
              });
              setOptaPlannerError(`VALIDATION FAILED: Missing HL/SL Hours Configuration\n\n${count} DP subjects need hoursPerWeekHL and hoursPerWeekSL configured:\n\n${subjectNames}${moreText}\n\n${payload.suggestion || 'Go to Subjects page and set HL/SL hours for each DP subject'}\n\n${payload.requiredAction || ''}\n\nDetailed list:\n${JSON.stringify(missingSubjects, null, 2)}`);
            }
            // Special handling for missing config validation (legacy)
            else if (payload.error === 'MISSING_MINUTES_CONFIGURATION' || payload.stage === 'VALIDATION_FAILED_MISSING_CONFIG') {
              const missingGroups = payload.missingGroups || payload.filteredDPGroups || [];
              const count = payload.missingConfigurationCount || missingGroups.length;
              const groupNames = missingGroups.slice(0, 5).map(g => `${g?.name || 'Unknown'} (${g?.subject || '?'})`).join(', ');
              const moreText = count > 5 ? ` +${count - 5} more` : '';
              
              toast.error(payload.title || 'Configuration manquante', { 
                duration: 12000,
                description: payload.message || `${count} groupes sans config minutes/périodes`
              });
              setOptaPlannerError(`VALIDATION FAILED: ${count} TeachingGroups Missing Configuration\n\n${groupNames}${moreText}\n\n${payload.suggestion || 'Configure minutes_per_week, periods_per_week, or hours_per_week for each TeachingGroup'}\n\nDetailed list:\n${JSON.stringify(missingGroups, null, 2)}`);
            }
            // Special handling for timeslots validation
            else if (payload.stage === 'VALIDATION_TIMESLOTS_EMPTY') {
              toast.error(payload.title || 'Aucun créneau disponible', { 
                duration: 12000,
                description: payload.message || 'Vérifiez configuration horaire école'
              });
              setOptaPlannerError(`${payload.message || payload.errorMessage}\n\n${payload.suggestion || ''}`);
            }
            // CRITICAL: Special handling for SOLUTION_INFEASIBLE (hardScore < 0)
            else if (payload.stage === 'SOLUTION_INFEASIBLE') {
              toast.error(payload.title || 'Planning impossible', { 
                duration: 12000,
                description: payload.message || `Contraintes dures violées (score=${payload.meta?.hardScore})`
              });
              setOptaPlannerError(`${payload.message || payload.errorMessage}\n\n${payload.suggestion || ''}`);
            }
            // CRITICAL: Special handling for PERSISTENCE_BLOCKED (0 slots inserted)
            else if (payload.stage === 'PERSISTENCE_BLOCKED') {
              toast.error(payload.title || 'Aucun créneau généré', { 
                duration: 12000,
                description: payload.message || 'Planning actuel conservé'
              });
              setOptaPlannerError(`${payload.message || payload.errorMessage}\n\n${payload.suggestion || ''}`);
            }
            // Generic solver error
            else {
              toast.error(payload.title || payload.code || payload.stage || 'Erreur solver', { 
                duration: 12000,
                description: payload.message || payload.errorMessage || payload.error
              });
              setOptaPlannerError(`Stage: ${payload.stage}\nError: ${payload.message || payload.errorMessage || payload.error}\n\nStack:\n${payload.errorStack || 'N/A'}`);
            }
          } else {
            // Success path - read from payload.result object
            const result = payload.result || {};
            const inserted = result.slotsInserted ?? 0;
            const deleted = result.slotsDeleted ?? 0;
            
            console.log(`[Schedule] ✅ OptaPlanner completed: deleted ${deleted} old slots, inserted ${inserted} new slots`);
            console.log(`[Schedule] Full result object:`, result);
            
            // CRITICAL VALIDATION: Block success toast if slotsInserted === 0
            if (inserted === 0) {
              console.error('[Schedule] ❌ BLOCKING: slotsInserted=0 despite ok=true (backend validation bug?)');
              toast.error('❌ OptaPlanner returned 0 slots. Schedule may be empty. Check diagnostics.', { duration: 12000 });
              setOptaPlannerError(`OptaPlanner reported success but inserted 0 slots.\n\nDeleted: ${deleted}\nInserted: ${inserted}\n\nThis may indicate a solver validation bug or infeasible schedule.`);
            } else {
              // Success: slots were inserted
              toast.success(`✅ Codex: ${deleted} deleted, ${inserted} optimized slots created`);
            }

            // CRITICAL: Persist solver timeslots as single source of truth (never overwritten by config reconstruction)
            if (payload.timeslots && Array.isArray(payload.timeslots) && payload.timeslots.length > 0) {
              console.log('[Schedule] 💾 PERSISTING solver timeslots to prevent config overwrite:', payload.timeslots.length, 'slots');
              setSolverTimeslots(payload.timeslots);
            }

            await queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
            await queryClient.invalidateQueries({ queryKey: ['scheduleVersions'] });
            await queryClient.invalidateQueries({ queryKey: ['students'] });
            setScheduleTab('student');
          }
        } catch (e) {
          console.error('❌❌❌ Auto OptaPlanner step CRASHED:', e);
          console.error('Error message:', e?.message);
          console.error('Error stack:', e?.stack);
          console.error('Axios response:', e?.response);
          console.error('Response status:', e?.response?.status);
          console.error('Response data (FULL):', JSON.stringify(e?.response?.data, null, 2));
          console.error('Response headers:', e?.response?.headers);

          const errorData = e?.response?.data;
          const statusCode = e?.response?.status;
          
          // CRITICAL: Log Codex 422 fields (requestId, validationErrors, details)
          if (errorData?.requestId) {
            console.error('[Schedule] 🔍 Codex requestId:', errorData.requestId);
          }
          if (Array.isArray(errorData?.validationErrors) && errorData.validationErrors.length > 0) {
            console.error('[Schedule] ❌ Codex validationErrors:', errorData.validationErrors);
          }
          if (Array.isArray(errorData?.details) && errorData.details.length > 0) {
            console.error('[Schedule] 📋 Codex details:', errorData.details);
          }

          // Enhanced error logging for 500 errors
          if (statusCode === 500 || statusCode === 502) {
            console.error(`🔴 BACKEND ERROR ${statusCode}:`, {
              url: e?.config?.url,
              method: e?.config?.method,
              payload: JSON.parse(e?.config?.data || '{}'),
              responseData: errorData,
              responseText: typeof errorData === 'string' ? errorData : JSON.stringify(errorData),
              cfRay: e?.response?.headers?.['cf-ray'],
              rndrId: e?.response?.headers?.['rndr-id']
            });
          }

          // CRITICAL: Propagate Codex structured error
          if (errorData && typeof errorData === 'object' && (errorData.ok === false || errorData.requestId)) {
            console.log(`[Schedule] 📋 Codex error at stage:`, errorData.stage);
            console.error('[Schedule] requestId:', errorData.requestId || 'N/A');
            console.error('[Schedule] validationErrors:', errorData.validationErrors || []);
            console.error('[Schedule] details:', errorData.details || []);

            // Special handling for COHORT_INTEGRITY_VIOLATION
            if (errorData.stage === 'COHORT_INTEGRITY_VIOLATION') {
              const splitSections = errorData.splitSections || [];
              const errorMsg = `❌ SOLVER INTEGRITY VIOLATION\n\n` +
                `${errorData.error || errorData.errorMessage}\n\n` +
                `Affected sections: ${splitSections.length}\n\n` +
                `Example: ${splitSections[0]?.subject} - ${splitSections[0]?.studentGroup}\n` +
                `Duplicate timeslots: ${JSON.stringify(splitSections[0]?.timeslots_list)}\n\n` +
                `${errorData.suggestion || 'Solver bug: same class scheduled multiple times at same time'}\n\n` +
                (errorData.requestId ? `🔍 Codex requestId: ${errorData.requestId}\n` : '') +
                (errorData.validationErrors?.length ? `\n❌ Validation errors:\n${errorData.validationErrors.join('\n')}\n` : '') +
                (errorData.details?.length ? `\n📋 Details:\n${errorData.details.map(d => `• ${d.entity}.${d.field}: ${d.reason} (${d.hint})`).join('\n')}` : '');

              setOptaPlannerError(errorMsg);
              setOptaPlannerResultSafe(errorData);
              toast.error(errorData.title || 'Violation d\'intégrité', { 
                duration: 12000,
                description: errorData.message || `${splitSections.length} sections avec doublons`
              });
            }
            // Other Codex errors - UNIVERSAL DISPLAY FORMAT
            else {
              const errorSummary = [
                `Stage: ${errorData.stage || 'Unknown'}`,
                `Code: ${errorData.code || errorData.errorCode || 'N/A'}`,
                `Message: ${errorData.message || errorData.errorMessage || errorData.error || 'Unknown error'}`,
                errorData.meta?.school_id ? `School ID: ${errorData.meta.school_id}` : null,
                errorData.meta?.schedule_version_id ? `Schedule Version ID: ${errorData.meta.schedule_version_id}` : null,
                errorData.requestId ? `🔍 Codex Request ID: ${errorData.requestId}` : null,
                errorData.validationErrors?.length > 0 ? `\n❌ Validation Errors (${errorData.validationErrors.length}):` : null,
                ...(errorData.validationErrors || []).slice(0, 3).map((err, i) => `  ${i+1}. ${err}`),
                errorData.validationErrors?.length > 3 ? `  ... +${errorData.validationErrors.length - 3} more` : null,
                errorData.details?.length > 0 ? `\n📋 Details (${errorData.details.length} issues):` : null,
                ...(errorData.details || []).slice(0, 5).map((d, i) => 
                  `  ${i+1}. ${d.entity || 'N/A'}.${d.field || 'N/A'}: ${d.reason || 'N/A'}\n     💡 ${d.hint || 'N/A'}`
                ),
                errorData.details?.length > 5 ? `  ... +${errorData.details.length - 5} more issues` : null,
                errorData.suggestion ? `\nSuggestion: ${errorData.suggestion}` : null,
                errorData.requiredAction ? `Action Required: ${errorData.requiredAction}` : null
              ].filter(Boolean).join('\n');
              
              setOptaPlannerError(errorSummary);
              setOptaPlannerResultSafe(errorData);
              
              // Toast: prioritize title → code → fallback
              toast.error(errorData.title || errorData.code || errorData.errorCode || 'Erreur de génération', { 
                duration: 12000,
                description: errorData.message || errorData.errorMessage || errorData.error
              });
            }
          } 
          // HTTP 500 with no JSON body (actual crash)
          else if (statusCode === 500) {
            const errorMsg = `Backend function crashed (HTTP 500)\n\n${typeof errorData === 'string' ? errorData : JSON.stringify(errorData, null, 2)}\n\nCheck function logs for details.`;
            setOptaPlannerError(errorMsg);
            toast.error('❌ Pipeline crashed (500). Check function logs.', { duration: 10000 });
          }
          // HTTP 422 with structured error (PRE_SOLVE_VALIDATION, etc.)
          else if (statusCode === 422 && errorData && typeof errorData === 'object') {
            const errorSummary = [
              `Stage: ${errorData.stage || 'Unknown'}`,
              `Code: ${errorData.code || errorData.errorCode || 'N/A'}`,
              `Message: ${errorData.errorMessage || errorData.error || 'Validation failed'}`,
              errorData.meta?.school_id ? `School ID: ${errorData.meta.school_id}` : null,
              errorData.meta?.schedule_version_id ? `Schedule Version ID: ${errorData.meta.schedule_version_id}` : null,
              errorData.details?.length > 0 ? `\n📋 Details (${errorData.details.length} issues):` : null,
              ...(errorData.details || []).map((d, i) => 
                `  ${i+1}. ${d.entity || 'N/A'}.${d.field || 'N/A'}: ${d.reason || 'N/A'}\n     💡 ${d.hint || 'N/A'}`
              ),
              errorData.suggestion ? `\nSuggestion: ${errorData.suggestion}` : null,
              errorData.requiredAction ? `Action Required: ${errorData.requiredAction}` : null
            ].filter(Boolean).join('\n');
            
            setOptaPlannerError(errorSummary);
            setOptaPlannerResultSafe(errorData);
            
            // Toast: prioritize title → code → fallback
            toast.error(errorData.title || errorData.code || 'Erreur de validation', { 
              duration: 12000,
              description: errorData.message || errorData.errorMessage || errorData.error
            });
          }
          // Other errors
          else {
            setOptaPlannerError(e?.message || 'Solver failed');
            toast.error('Solver failed — keeping generated schedule (no rollback performed).');
          }
        } finally {
          setOptaPlannerLoading(false);
        }
      }
    } catch (error) {
      console.error('=== GENERATION ERROR ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      const wasCancelled = error.message === 'Cancelled by user' || cancelGeneration;

      // Check if error is from OptaPlanner response
      const isPlannerError = error?.response?.data?.ok === false || error?.response?.data?.stage;
      
      if (isPlannerError && !wasCancelled) {
        const errorData = error.response.data;
        setOptaPlannerResultSafe(errorData);
        setOptaPlannerError(`Stage: ${errorData.stage}\nError: ${errorData.errorMessage || errorData.error}\n\nStack:\n${errorData.errorStack || 'N/A'}`);
        
        setGenerationProgress({
          stage: 'Error',
          percent: 0,
          message: `OptaPlanner failed at "${errorData.stage}": ${errorData.errorMessage || errorData.error}`,
          currentStep: '',
          completedSteps: [],
          completed: true
        });
      } else {
        setGenerationProgress({
          stage: wasCancelled ? 'Cancelled' : 'Error',
          percent: 0,
          message: wasCancelled ? 'Schedule generation was cancelled' : `Generation failed: ${error.message}`,
          currentStep: '',
          completedSteps: [],
          completed: true
        });
      }
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

  // Clear solver timeslots when version changes (AFTER school data loaded to prevent race)
  React.useEffect(() => {
    if (selectedVersion && school) {
      console.log('[Schedule] Version changed (school loaded) - clearing persisted solver timeslots');
      setSolverTimeslots(null);
    }
  }, [selectedVersion?.id, school?.id]);

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
      {/* Header with Actions */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Master Schedule</h1>
          <p className="text-slate-600">Generate and manage timetables for {allowedProgrammes.join(', ')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRunDPDiagnostic}
            disabled={dpDiagLoading}
            className="border-slate-200"
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
          <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-900 hover:bg-blue-800">
            <Plus className="w-4 h-4 mr-2" />
            New Version
          </Button>
        </div>
      </div>

      {/* Subscription tier notice */}
      {school && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            <strong>{(school.subscription_tier || 'unknown').toUpperCase()}</strong> plan • Enabled: {allowedProgrammes.join(', ')}.
          </p>
        </div>
      )}
      
      {/* Config Mismatch Warning */}
      {school && scheduleSlots.length > 0 && (() => {
        const dayStart = school.day_start_time || '08:00';
        const dayEnd = school.day_end_time || '18:00';
        const periodDuration = school.period_duration_minutes || 60;
        const breaks = school.breaks || [];
        
        const [startHour, startMin] = dayStart.split(':').map(Number);
        const [endHour, endMin] = dayEnd.split(':').map(Number);
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
        const breakMinutes = breaks.reduce((sum, b) => {
          const [bStartH, bStartM] = b.start.split(':').map(Number);
          const [bEndH, bEndM] = b.end.split(':').map(Number);
          return sum + ((bEndH * 60 + bEndM) - (bStartH * 60 + bStartM));
        }, 0);
        const availableMinutes = totalMinutes - breakMinutes;
        const calculatedPeriods = Math.floor(availableMinutes / periodDuration);
        
        const configPeriods = school.periods_per_day || 8;
        const mismatch = calculatedPeriods !== configPeriods;
        
        if (mismatch) {
          return (
            <Card className="border-2 border-amber-500 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-amber-900 mb-1">⚠️ Configuration Mismatch Detected</div>
                    <div className="text-sm text-amber-800 mb-3">
                      School config says <strong>{configPeriods} periods/day</strong>, but time range {dayStart}→{dayEnd} with {periodDuration}min periods = <strong>{calculatedPeriods} periods/day</strong> (actual).
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (confirm(`Update school config to ${calculatedPeriods} periods/day?`)) {
                            await updateSchoolMutation.mutateAsync({
                              id: school.id,
                              data: { periods_per_day: calculatedPeriods }
                            });
                            toast.success('School config updated to match actual schedule');
                          }
                        }}
                        className="bg-amber-700 hover:bg-amber-800 text-white"
                      >
                        Fix: Update to {calculatedPeriods} periods/day
                      </Button>
                      <div className="text-xs text-amber-700 flex items-center">
                        Calculation: ({totalMinutes}min - {breakMinutes}min breaks) ÷ {periodDuration}min = {calculatedPeriods} periods
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        }
        return null;
      })()}

      {/* Version Selector & Controls */}
      <Card className="border-blue-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
              <div className="flex-1">
                <Label className="text-sm text-slate-600 mb-2 block">Active Version</Label>
                <Select value={selectedVersion?.id || ''} onValueChange={(id) => setSelectedVersion(scheduleVersions.find(v => v.id === id))}>
                  <SelectTrigger className="w-full">
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
                              <Badge className="ml-2 bg-emerald-100 text-emerald-700 text-xs">Published</Badge>
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
                  <span>{selectedVersion.academic_year}</span>
                  <span>•</span>
                  <span>{selectedVersion.term || 'Full Year'}</span>
                </div>
              )}
            </div>

            {selectedVersion && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating}
                  className="bg-blue-900 hover:bg-blue-800"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
                {selectedVersion.status === 'draft' && scheduleSlots.length > 0 && (
                  <Button
                    variant="outline"
                    className="border-blue-200 text-blue-900 hover:bg-blue-50"
                    onClick={() => {
                      const hasIncomplete = (optaPlannerResult?.solverDebugMetrics?.sectionsMissingPeriods || 0) > 0;
                      if (hasIncomplete) {
                        const confirm = window.confirm(
                          `⚠️ WARNING: ${optaPlannerResult.solverDebugMetrics.sectionsMissingPeriods} sections have missing periods.\n\n` +
                          `Publishing an incomplete schedule may cause issues.\n\n` +
                          `Continue anyway?`
                        );
                        if (!confirm) return;
                      }
                      handlePublish(selectedVersion);
                    }}
                    disabled={!optaPlannerResult || (optaPlannerResult?.solverDebugMetrics?.sectionsMissingPeriods || 0) > 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Publish
                  </Button>
                )}
              </div>
            )}
          </div>

          {selectedVersion && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Switch checked={autoRunOptaPlanner} onCheckedChange={setAutoRunOptaPlanner} />
                <Label className="text-slate-600 cursor-pointer" onClick={() => setAutoRunOptaPlanner(!autoRunOptaPlanner)}>
                  Auto-run optimizer
                </Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleFetchORTool}
                disabled={!selectedVersion || optaPlannerLoading || !school?.id || !teachers?.length || !rooms?.length || !teachingGroups?.length}
                className="border-slate-200 disabled:opacity-50"
                title={
                  !school?.id ? 'Loading school data...' :
                  !teachers?.length ? 'Loading teachers...' :
                  !rooms?.length ? 'Loading rooms...' :
                  !teachingGroups?.length ? 'Loading teaching groups...' :
                  optaPlannerLoading ? 'Running...' :
                  'Run OptaPlanner pipeline'
                }
              >
                {optaPlannerLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Hash className="w-4 h-4 mr-2" />
                    Run OptaPlanner
                  </>
                )}
              </Button>
              {selectedVersion.status === 'draft' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    if (confirm(`Delete "${selectedVersion.name}"?`)) {
                      deleteVersionMutation.mutate(selectedVersion.id);
                    }
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banners */}
      <ScheduleUpdateBanner
        show={showUpdateBanner && selectedVersion && scheduleSlots.length > 0}
        onRegenerate={handleGenerateSchedule}
        onDismiss={() => setShowUpdateBanner(false)}
        isGenerating={isGenerating}
      />

      {selectedVersion && offByOneConflicts.length > 0 && (
        <OffByOneBanner conflicts={offByOneConflicts} />
      )}

      {/* Quick Stats */}
      {selectedVersion && scheduleSlots.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Students Scheduled</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.studentsScheduled}/{students.length}</p>
                </div>
                <div className="text-3xl font-bold text-blue-600">{stats.coverage}%</div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Teachers Assigned</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.teachersAssigned}/{teachers.length}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-600 mb-1">Total Periods</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.totalSlots}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card className={`border-blue-200 ${
            (selectedVersion?.conflicts_count || 0) > 0 ? 'bg-rose-50' : 'bg-white'
          }`}>
            <CardContent className="p-5">
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

      {/* SOLUTION_INFEASIBLE: Enhanced display with requestId + constraint breakdown */}
      {selectedVersion && optaPlannerResult?.ok === false && optaPlannerResult?.stage === 'SOLUTION_INFEASIBLE' && (
        <SolutionInfeasiblePanel 
          result={optaPlannerResult} 
          onRetry={handleGenerateSchedule}
        />
      )}
      
      {/* OptaPlanner Error Panel (other error types) */}
      {selectedVersion && optaPlannerResult?.ok === false && optaPlannerResult?.stage !== 'SOLUTION_INFEASIBLE' && (
        <Card className="border-2 border-rose-500 shadow-xl bg-gradient-to-br from-rose-50 to-rose-100">
          <CardHeader className="bg-rose-600 text-white">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              {optaPlannerResult.title || optaPlannerResult.stage || 'Erreur de génération'}
            </CardTitle>
            <CardDescription className="text-rose-50">
              {optaPlannerResult.message || 'Génération arrêtée. Corrigez le problème et réessayez.'} Planning actuel conservé : aucune modification appliquée.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {/* Error Message */}
            <div className="bg-white p-4 rounded-lg border border-rose-300">
              <div className="font-semibold text-rose-900 mb-2">Error Details:</div>
              <p className="text-sm text-rose-800 whitespace-pre-wrap">
                {optaPlannerResult.errorMessage || optaPlannerResult.error || 'Unknown error'}
              </p>
            </div>

            {/* User Action / Suggestion */}
            {(optaPlannerResult.userAction || optaPlannerResult.suggestion) && (
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-300">
                <div className="font-semibold text-amber-900 mb-2">💡 Action requise :</div>
                <p className="text-sm text-amber-800">{optaPlannerResult.userAction || optaPlannerResult.suggestion}</p>
              </div>
            )}
            
            {/* Confirmation */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-4">
              <p className="text-sm text-blue-900 font-medium">
                ✅ Planning actuel conservé : aucune modification appliquée.
              </p>
            </div>

            {/* COHORT_INTEGRITY_VIOLATION: Show affected sections */}
            {optaPlannerResult.stage === 'COHORT_INTEGRITY_VIOLATION' && optaPlannerResult.splitSections && (
              <div className="space-y-2">
                <div className="font-semibold text-rose-900">Affected Sections ({optaPlannerResult.splitSections.length}):</div>
                {optaPlannerResult.splitSections.slice(0, 5).map((section, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border-l-4 border-rose-500">
                    <div className="font-semibold text-rose-900">
                      {section.subject} - {section.studentGroup}
                    </div>
                    <div className="text-xs text-rose-700 mt-1">
                      Timeslots: {JSON.stringify(section.timeslots_list)} 
                      <span className="ml-2 font-semibold">({section.timeslots_unique} unique, {section.timeslots_total - section.timeslots_unique} duplicates)</span>
                    </div>
                    <div className="text-xs text-rose-600 mt-1 italic">{section.reason}</div>
                  </div>
                ))}
                {optaPlannerResult.splitSections.length > 5 && (
                  <div className="text-xs text-rose-600">... and {optaPlannerResult.splitSections.length - 5} more sections</div>
                )}
              </div>
            )}

            {/* Missing HL/SL Hours: Show affected subjects */}
            {(optaPlannerResult.stage === 'VALIDATION_FAILED_MISSING_HL_SL_HOURS' || optaPlannerResult.error === 'MISSING_HL_SL_HOURS_CONFIG') && optaPlannerResult.missingSubjects && (
              <div className="space-y-2">
                <div className="font-semibold text-rose-900">Subjects Missing Configuration ({optaPlannerResult.missingSubjects.length}):</div>
                {optaPlannerResult.missingSubjects.slice(0, 10).map((subj, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border-l-4 border-rose-500">
                    <div className="font-semibold text-rose-900">{subj.name || subj.code}</div>
                    <div className="text-xs text-rose-700 mt-1">
                      Missing: <span className="font-semibold">{subj.missing === 'both' ? 'HL and SL hours' : `${subj.missing} hours`}</span>
                    </div>
                    <div className="text-xs text-rose-600 mt-1">
                      Current: HL={subj.hoursPerWeekHL || 'not set'}, SL={subj.hoursPerWeekSL || 'not set'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => {
                  setShowAdvanced(true);
                  const diagTab = document.querySelector('[value="diagnostics"]');
                  if (diagTab) {
                    diagTab.click();
                    setTimeout(() => {
                      diagTab.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                  }
                }}
                className="bg-blue-900 hover:bg-blue-800 text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                View Full Diagnostics
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateSchedule}
                disabled={isGenerating}
                className="border-rose-300 text-rose-700 hover:bg-rose-100"
              >
                <Play className="w-4 h-4 mr-2" />
                Retry Generation
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const debugData = {
                    timestamp: new Date().toISOString(),
                    stage: optaPlannerResult.stage,
                    error: optaPlannerResult.error,
                    errorMessage: optaPlannerResult.errorMessage,
                    suggestion: optaPlannerResult.suggestion,
                    meta: optaPlannerResult.meta,
                    splitSections: optaPlannerResult.splitSections,
                    missingSubjects: optaPlannerResult.missingSubjects,
                    solverIdentity: optaPlannerResult.solverIdentity,
                    solverHttpStatus: optaPlannerResult.solverHttpStatus,
                    solverEndpointUsed: optaPlannerResult.solverEndpointUsed,
                    buildVersion: optaPlannerResult.buildVersion,
                    wrapperBuildVersion: optaPlannerResult.wrapperBuildVersion
                  };
                  const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `optaplanner-error-${optaPlannerResult.stage}-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Debug Report
              </Button>

              {/* Quick fix actions based on error type */}
              {optaPlannerResult.stage === 'VALIDATION_FAILED_MISSING_HL_SL_HOURS' && (
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = createPageUrl('Subjects');
                  }}
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                >
                  Go to Subjects Page
                </Button>
              )}
              
              {optaPlannerResult.stage === 'VALIDATION_TIMESLOTS_EMPTY' && (
                <Button
                  size="sm"
                  onClick={() => {
                    const settingsTab = document.querySelector('[value="settings"]');
                    if (settingsTab) settingsTab.click();
                  }}
                  className="bg-rose-700 hover:bg-rose-800 text-white"
                >
                  Go to Settings Tab
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      {selectedVersion ? (
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="bg-white border border-blue-200">
            <TabsTrigger value="schedule" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
              <Calendar className="w-4 h-4 mr-2" />
              Timetables
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="constraints" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
              <Shield className="w-4 h-4 mr-2" />
              Constraints
            </TabsTrigger>
            {showAdvanced && (
              <TabsTrigger value="diagnostics" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
                <FileText className="w-4 h-4 mr-2" />
                Diagnostics
              </TabsTrigger>
            )}
          </TabsList>

          {/* Timetables Tab */}
          <TabsContent value="schedule" className="space-y-6">
            {((selectedVersion.conflicts_count || 0) > 0 || (selectedVersion.warnings_count || 0) > 0) && (
              <div className="space-y-3">
                {(selectedVersion.conflicts_count || 0) > 0 && (
                  <ConflictAlert
                    severity="error"
                    title={`${selectedVersion.conflicts_count || 0} Scheduling Conflicts`}
                    description="Unresolved conflicts need attention before publishing."
                  />
                )}
                {(selectedVersion.warnings_count || 0) > 0 && (
                  <ConflictAlert
                    severity="warning"
                    title={`${selectedVersion.warnings_count || 0} Warnings`}
                    description="Review these soft constraint violations."
                  />
                )}
                <ConflictViewer scheduleVersionId={selectedVersion.id} />
              </div>
            )}

            {scheduleSlots.length === 0 ? (
              <Card className="border-blue-200">
                <CardContent className="py-20 text-center">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Generated</h3>
                  <p className="text-slate-500 mb-6">Click "Generate" above to create timetables</p>
                  <Button
                    onClick={handleGenerateSchedule}
                    disabled={isGenerating}
                    className="bg-blue-900 hover:bg-blue-800"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Schedule Now
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Tabs value={scheduleTab} onValueChange={setScheduleTab}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <TabsList className="bg-white border border-blue-200">
                    <TabsTrigger value="grid" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">Master Grid</TabsTrigger>
                    <TabsTrigger value="student" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">Students</TabsTrigger>
                    <TabsTrigger value="teacher" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">Teachers</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="grid" className="space-y-4">
                  {scheduleSlots.length > 0 && (
                    <UtilizationStats
                      slots={scheduleSlots}
                      teachers={teachers}
                      rooms={rooms}
                      schoolConfig={schoolConfig}
                    />
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium text-slate-700">Filter by Class:</Label>
                      <Select
                        value={selectedClassGroupId || 'all'}
                        onValueChange={(value) => setSelectedClassGroupId(value === 'all' ? null : value)}
                      >
                        <SelectTrigger className="w-[280px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ClassGroups</SelectItem>
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
                      filename={`schedule-${selectedClassGroupId ? classGroups.find(cg => cg.id === selectedClassGroupId)?.name : 'master'}`}
                      label="Export"
                      headerData={{
                        schoolName: school?.name || '',
                        studentName: selectedClassGroupId ? classGroups.find(cg => cg.id === selectedClassGroupId)?.name : 'Master Schedule',
                        lastUpdated: selectedVersion?.generated_at ? new Date(selectedVersion.generated_at).toLocaleDateString() : ''
                      }}
                    />
                  </div>

                  <div id="master-schedule-grid">
                    {dynamicPeriodsPerDay === null ? (
                      <Card className="border-slate-200">
                        <CardContent className="py-12 text-center">
                          <Loader2 className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-spin" />
                          <p className="text-slate-500">Loading schedule configuration...</p>
                        </CardContent>
                      </Card>
                    ) : (
                      <TimetableGrid
                        slots={selectedClassGroupId ? scheduleSlots.filter(slot => {
                          if (slot.classgroup_id) {
                            return slot.classgroup_id === selectedClassGroupId;
                          }
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
                        periodsPerDay={dynamicPeriodsPerDay}
                        breakPeriods={school?.settings?.break_periods || []}
                        lunchPeriod={school?.settings?.lunch_period || 4}
                        dayStartTime={school?.day_start_time || schoolConfig.day_start_time}
                        dayEndTime={school?.day_end_time || schoolConfig.day_end_time}
                        periodDurationMinutes={school?.period_duration_minutes || schoolConfig.period_duration_minutes}
                        timeslots={timeslots}
                        onSlotClick={(day, period, slot) => {
                          console.log('Clicked:', day, period, slot);
                        }}
                        exportId="master-timetable"
                      />
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="student">
                  {dynamicPeriodsPerDay === null ? (
                    <Card className="border-slate-200">
                      <CardContent className="py-12 text-center">
                        <Loader2 className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-spin" />
                        <p className="text-slate-500">Loading schedule configuration...</p>
                      </CardContent>
                    </Card>
                  ) : (
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
                      scheduleVersionId={selectedVersion?.id}
                      unassignedBySubjectCode={optaPlannerResult?.unassignedBySubjectCode}
                      timeslots={timeslots}
                      scheduleSettings={optaPlannerResult?.problem?.scheduleSettings || school}
                    />
                  )}
                </TabsContent>

                <TabsContent value="teacher">
                  {dynamicPeriodsPerDay === null ? (
                    <Card className="border-slate-200">
                      <CardContent className="py-12 text-center">
                        <Loader2 className="w-12 h-12 text-slate-300 mx-auto mb-4 animate-spin" />
                        <p className="text-slate-500">Loading schedule configuration...</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <TeacherScheduleView
                      teachers={teachers.filter(t => t.is_active)}
                      slots={scheduleSlots}
                      groups={teachingGroups}
                      subjects={subjects}
                      rooms={rooms}
                      selectedTeacherId={selectedTeacherId}
                      onTeacherChange={setSelectedTeacherId}
                      exportId="teacher-schedule"
                      timeslots={timeslots}
                    />
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            {/* Validation Banner */}
            {(() => {
              const calculated = calculatePeriodsPerDay(schoolConfig);
              const mismatch = calculated !== schoolConfig.periods_per_day;
              
              if (mismatch) {
                return (
                  <Card className="border-2 border-rose-500 bg-rose-50">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold text-rose-900 mb-1">⚠️ Invalid Configuration Detected</div>
                          <div className="text-sm text-rose-800 mb-3">
                            Config says <strong>{schoolConfig.periods_per_day} periods/day</strong>, but time range {schoolConfig.day_start_time}→{schoolConfig.day_end_time} with {schoolConfig.period_duration_minutes}min periods = <strong>{calculated} periods/day</strong> (actual).
                          </div>
                          <Button
                            size="sm"
                            onClick={handleRecalculatePeriodsPerDay}
                            className="bg-rose-700 hover:bg-rose-800 text-white"
                          >
                            Recalculate to {calculated} periods/day
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              return null;
            })()}
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleRecalculatePeriodsPerDay}
                className="border-blue-200"
              >
                <Calculator className="w-4 h-4 mr-2" />
                Recalculate Periods/Day
              </Button>
              <Button
                onClick={handleSaveConfig}
                disabled={isSavingConfig}
                className="bg-blue-900 hover:bg-blue-800"
              >
                {isSavingConfig ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>

            {/* Basic Settings */}
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-900" />
                  Basic Schedule Settings
                </CardTitle>
                <CardDescription>Configure your school's daily structure</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">School Week</Label>
                    <Select
                      value={String(schoolConfig.days_per_week)}
                      onValueChange={(value) => setSchoolConfig({ ...schoolConfig, days_per_week: parseInt(value) })}
                    >
                      <SelectTrigger className="h-12 text-lg font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 Days</SelectItem>
                        <SelectItem value="6">6 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Period Duration</Label>
                    <Input
                      type="number"
                      min="30"
                      step="5"
                      value={schoolConfig.period_duration_minutes}
                      onChange={(e) => setSchoolConfig({ ...schoolConfig, period_duration_minutes: parseInt(e.target.value || '0') })}
                      className="h-12 text-lg font-semibold text-center"
                    />
                    <p className="text-xs text-slate-500 mt-1">minutes</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">Start Time</Label>
                    <Input
                      type="time"
                      value={schoolConfig.school_start_time}
                      onChange={(e) => setSchoolConfig({ ...schoolConfig, school_start_time: e.target.value })}
                      className="h-12 text-lg font-semibold text-center"
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-sm text-blue-900">
                    School runs <strong>{schoolConfig.days_per_week} days/week</strong> with <strong>{schoolConfig.period_duration_minutes}-minute</strong> periods starting at <strong>{schoolConfig.school_start_time}</strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Breaks & Lunch */}
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Timer className="w-5 h-5 text-blue-900" />
                  Breaks & Lunch
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-5 rounded-xl bg-white border-2 border-blue-200">
                    <p className="font-semibold text-slate-900 mb-4">Lunch Break</p>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-slate-600 mb-1.5 block">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min="20"
                          max="60"
                          className="h-10 text-center font-medium"
                          value={schoolConfig.lunch_duration_minutes}
                          onChange={(e) => setSchoolConfig({ ...schoolConfig, lunch_duration_minutes: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 mb-1.5 block">After Period</Label>
                        <Select
                          value={String(schoolConfig.lunch_period)}
                          onValueChange={(value) => setSchoolConfig({ ...schoolConfig, lunch_period: parseInt(value) })}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: schoolConfig.periods_per_day }, (_, i) => i + 1).map(p => (
                              <SelectItem key={p} value={String(p)}>Period {p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 rounded-xl bg-white border-2 border-blue-200">
                    <p className="font-semibold text-slate-900 mb-4">Short Breaks</p>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-slate-600 mb-1.5 block">Duration (minutes)</Label>
                        <Input
                          type="number"
                          min="5"
                          max="30"
                          className="h-10 text-center font-medium"
                          value={schoolConfig.break_duration_minutes}
                          onChange={(e) => setSchoolConfig({ ...schoolConfig, break_duration_minutes: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600 mb-1.5 block">After Periods</Label>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: schoolConfig.periods_per_day }, (_, i) => i + 1)
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
                                  setSchoolConfig({ ...schoolConfig, break_periods: updated });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                  (schoolConfig.break_periods || []).includes(period)
                                    ? 'bg-blue-900 text-white'
                                    : 'bg-white text-slate-700 border-2 border-slate-200 hover:bg-blue-50'
                                }`}
                              >
                                {period}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Test Configuration */}
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-900" />
                  Test & Assessment Slots
                </CardTitle>
                <CardDescription>Configure test periods for each IB programme</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  {['PYP', 'MYP', 'DP1', 'DP2'].map(level => {
                    const colors = {
                      PYP: { bg: 'from-yellow-50 to-amber-50', border: 'border-yellow-300', text: 'text-yellow-900', badge: 'bg-yellow-400' },
                      MYP: { bg: 'from-emerald-50 to-green-50', border: 'border-emerald-300', text: 'text-emerald-900', badge: 'bg-emerald-500' },
                      DP1: { bg: 'from-blue-50 to-sky-50', border: 'border-blue-300', text: 'text-blue-900', badge: 'bg-blue-500' },
                      DP2: { bg: 'from-indigo-50 to-violet-50', border: 'border-indigo-300', text: 'text-indigo-900', badge: 'bg-indigo-600' }
                    }[level];

                    return (
                      <div key={level} className={`p-5 rounded-xl bg-gradient-to-br ${colors.bg} border-2 ${colors.border}`}>
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`px-3 py-1 rounded-lg ${colors.badge} text-white font-bold text-sm`}>
                            {level}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className={`text-xs font-semibold ${colors.text} mb-1.5 block`}>Tests/Week</Label>
                              <Input
                                type="number"
                                min="0"
                                max="5"
                                className={`h-10 text-center font-semibold border-2 ${colors.border}`}
                                value={schoolConfig.test_config[level].tests_per_week}
                                onChange={(e) => setSchoolConfig({
                                  ...schoolConfig,
                                  test_config: {
                                    ...schoolConfig.test_config,
                                    [level]: { ...schoolConfig.test_config[level], tests_per_week: parseInt(e.target.value) }
                                  }
                                })}
                              />
                            </div>
                            <div>
                              <Label className={`text-xs font-semibold ${colors.text} mb-1.5 block`}>Duration (min)</Label>
                              <Input
                                type="number"
                                min="30"
                                max="180"
                                step="15"
                                className={`h-10 text-center font-semibold border-2 ${colors.border}`}
                                value={schoolConfig.test_config[level].test_duration_minutes}
                                onChange={(e) => setSchoolConfig({
                                  ...schoolConfig,
                                  test_config: {
                                    ...schoolConfig.test_config,
                                    [level]: { ...schoolConfig.test_config[level], test_duration_minutes: parseInt(e.target.value) }
                                  }
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="border-slate-200"
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
            </Button>

            {showAdvanced && (
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg">Advanced Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm mb-2 block">Day Start Time</Label>
                      <Input type="time" value={schoolConfig.day_start_time}
                        onChange={(e) => setSchoolConfig({ ...schoolConfig, day_start_time: e.target.value })}
                        className="h-10" />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Day End Time</Label>
                      <Input type="time" value={schoolConfig.day_end_time}
                        onChange={(e) => setSchoolConfig({ ...schoolConfig, day_end_time: e.target.value })}
                        className="h-10" />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Min Periods/Day</Label>
                      <Input type="number" min="1" value={schoolConfig.min_periods_per_day}
                        onChange={(e) => setSchoolConfig({ ...schoolConfig, min_periods_per_day: parseInt(e.target.value || '0') })}
                        className="h-10 text-center" />
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">Target Periods/Day</Label>
                      <Input type="number" min="1" value={schoolConfig.target_periods_per_day}
                        onChange={(e) => setSchoolConfig({ ...schoolConfig, target_periods_per_day: parseInt(e.target.value || '0') })}
                        className="h-10 text-center" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Constraints Tab */}
          <TabsContent value="constraints" className="space-y-4">
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-900" />
                      Scheduling Rules
                    </CardTitle>
                    <CardDescription>Define constraints for schedule generation</CardDescription>
                  </div>
                  <Button
                    className="bg-blue-900 hover:bg-blue-800"
                    onClick={() => setConstraintDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {constraints.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Shield className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium">No constraints defined</p>
                    <p className="text-sm mt-1">Add rules to guide schedule generation</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {constraints.map((constraint) => (
                      <div key={constraint.id} className="flex items-center justify-between p-4 rounded-xl bg-white border-2 border-slate-200 hover:border-blue-300 transition-colors">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-900">{constraint.name}</h4>
                            <Badge className={constraint.type === 'hard' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}>
                              {constraint.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{constraint.category}</Badge>
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
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Diagnostics Tab */}
          {showAdvanced && (
            <TabsContent value="diagnostics" className="space-y-4">
              {optaPlannerError && (
                <Card className="border-2 border-rose-500 shadow-lg bg-rose-50">
                  <CardHeader className="bg-rose-100 pb-3">
                    <CardTitle className="text-rose-900 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" />
                      {optaPlannerResult?.stage === 'COHORT_INTEGRITY_VIOLATION' 
                        ? 'Solver Integrity Violation' 
                        : 'Schedule Generation Error'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <pre className="text-xs text-rose-900 whitespace-pre-wrap bg-white p-3 rounded border border-rose-200 overflow-x-auto">{optaPlannerError}</pre>
                    
                    {optaPlannerResult?.stage === 'COHORT_INTEGRITY_VIOLATION' && optaPlannerResult?.splitSections && (
                      <div className="space-y-2">
                        <div className="font-bold text-rose-900">Affected Sections:</div>
                        {optaPlannerResult.splitSections.slice(0, 10).map((section, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border border-rose-300">
                            <div className="text-sm font-semibold text-rose-900">
                              {section.subject} - {section.studentGroup}
                            </div>
                            <div className="text-xs text-rose-700 mt-1">
                              Timeslots: {JSON.stringify(section.timeslots_list)}
                            </div>
                            <div className="text-xs text-rose-600 mt-1">
                              {section.timeslots_total} total, {section.timeslots_unique} unique (duplicates detected)
                            </div>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const payload = {
                                stage: optaPlannerResult.stage,
                                splitSections: optaPlannerResult.splitSections,
                                suggestion: optaPlannerResult.suggestion,
                                meta: optaPlannerResult.meta
                              };
                              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `cohort-integrity-violation-${new Date().toISOString()}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="border-rose-300 text-rose-700 hover:bg-rose-100"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Error Report
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {optaPlannerResult?.stage === 'VALIDATION_TIMESLOTS_EMPTY' && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          onClick={() => {
                            const settingsTab = document.querySelector('[data-state="inactive"][value="settings"]');
                            if (settingsTab) settingsTab.click();
                          }}
                          className="bg-rose-700 hover:bg-rose-800 text-white"
                        >
                          Go to Settings
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
              {optaPlannerResult && (
                <>
                  <UnassignedBanner unassigned={optaPlannerResult?.unassignedBySubjectCode} />
                  
                  {/* Cohort Integrity Validation */}
                  {optaPlannerResult?.cohortIntegrity && (
                    <CohortIntegrityReport cohortData={optaPlannerResult.cohortIntegrity} />
                  )}

                  {/* CORE DIAGNOSTICS PANEL */}
                  <Card className="border-2 border-rose-300 bg-rose-50">
                    <CardContent className="p-4">
                      <div className="font-bold text-rose-900 mb-3">🔍 TOK/CAS/EE Diagnostic</div>

                      {/* Show error if present */}
                      {(optaPlannerResult?.ok === false || optaPlannerResult?.error) && (
                        <div className="mb-4 p-4 bg-rose-100 border-2 border-rose-400 rounded-lg">
                          <div className="font-bold text-rose-900 mb-2">❌ Error at Stage: {optaPlannerResult?.stage || 'unknown'}</div>
                          <div className="text-sm text-rose-800 mb-2">{optaPlannerResult?.errorMessage || optaPlannerResult?.error}</div>
                          {optaPlannerResult?.errorStack && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-rose-700">Stack Trace</summary>
                              <pre className="mt-2 text-xs text-rose-700 bg-white p-2 rounded overflow-x-auto max-h-48">{optaPlannerResult.errorStack}</pre>
                            </details>
                          )}
                          {optaPlannerResult?.meta && (
                            <div className="mt-2 text-xs text-rose-700">
                              Meta: {JSON.stringify(optaPlannerResult.meta)}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-3 text-xs font-mono">
                        {/* Input: What we sent */}
                        <div className="bg-white p-3 rounded border border-rose-200">
                          <div className="font-bold text-rose-700 mb-2">📤 Input (buildSchedulingProblem)</div>
                          <div className="space-y-1 text-slate-700">
                            <div>coreRequirementsFound: <strong className={(optaPlannerResult?.coreSubjectRequirementsSample?.length || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.coreSubjectRequirementsSample?.length || 0}</strong></div>
                            {(optaPlannerResult?.coreSubjectRequirementsSample || []).slice(0, 5).map((req, i) => (
                              <div key={i} className="text-[11px] text-slate-600 truncate">
                                {req.subject}: {req.minutesPerWeek}min/week ({req.studentGroup})
                              </div>
                            ))}
                            <div className="mt-2 text-[11px] text-slate-600">
                              Core TGs detected: <strong>{(optaPlannerResult?.coreTeachingGroupsDetected || []).reduce((sum, c) => sum + c.tgs_count, 0)}</strong>
                            </div>
                          </div>
                        </div>

                        {/* Output: What solver returned */}
                        <div className="bg-white p-3 rounded border border-rose-200">
                          <div className="font-bold text-rose-700 mb-2">📥 Output (Solver assignments)</div>
                          <div className="space-y-1 text-slate-700">
                            <div>TOK lessons: <strong className={(optaPlannerResult?.expectedLessonsBySubject?.TOK || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.expectedLessonsBySubject?.TOK || 0}</strong></div>
                            <div>CAS lessons: <strong className={(optaPlannerResult?.expectedLessonsBySubject?.CAS || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.expectedLessonsBySubject?.CAS || 0}</strong></div>
                            <div>EE lessons: <strong className={(optaPlannerResult?.expectedLessonsBySubject?.EE || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.expectedLessonsBySubject?.EE || 0}</strong></div>
                          </div>
                        </div>

                        {/* DB Insertion */}
                        <div className="bg-white p-3 rounded border border-rose-200">
                          <div className="font-bold text-rose-700 mb-2">💾 DB Insertion (actual)</div>
                          <div className="space-y-1 text-slate-700">
                            <div>TOK inserted: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.TOK || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.TOK || 0}</strong></div>
                            <div>CAS inserted: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.CAS || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.CAS || 0}</strong></div>
                            <div>EE inserted: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.EE || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.EE || 0}</strong></div>
                          </div>
                        </div>

                        {/* Error Status */}
                        <div className="bg-white p-3 rounded border border-rose-200">
                          <div className="font-bold text-rose-700 mb-2">⚠️ Status</div>
                          <div className="space-y-1 text-slate-700">
                            <div>Stage: <strong>{optaPlannerResult?.stage || '—'}</strong></div>
                            <div>HTTP Status: <strong className={optaPlannerResult?.solverHttpStatus === 200 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.solverHttpStatus || '—'}</strong></div>
                            <div className="text-[10px]">Total inserted: {optaPlannerResult?.result?.slotsInserted || 0}</div>
                            {optaPlannerResult?.solverErrorBody && (
                              <div className="mt-2 text-rose-700 bg-rose-100 p-1 rounded text-[10px]">
                                {(optaPlannerResult.solverErrorBody || '').slice(0, 150)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Force refresh hint: show current slot counts */}
                      <div className="text-xs text-slate-500 mt-4">
                        Persisted slots: {scheduleSlots.length} • Inserted this run: {optaPlannerResult?.result?.slotsInserted ?? 0} • Deleted: {optaPlannerResult?.result?.slotsDeleted ?? 0}
                      </div>
                      <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-700">
                          <div className="font-semibold text-slate-900 mb-1">Core Slots (Final)</div>
                          <div className="flex gap-3">
                            <span>TOK: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.TOK || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.TOK || 0}</strong></span>
                            <span>CAS: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.CAS || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.CAS || 0}</strong></span>
                            <span>EE: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.EE || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.EE || 0}</strong></span>
                          </div>
                        </div>
                      </div>

                        {/* Quick verification panel */}
                        <div className="grid md:grid-cols-3 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-slate-100">
                           <div className="font-semibold text-slate-900 mb-1">Solver Info</div>
                           <div className="text-xs space-y-1">
                             <div>Engine: <strong className="text-blue-700">{optaPlannerResult?.solverIdentity?.engine || '—'}</strong></div>
                             <div>Implementation: <strong className="text-blue-700">{optaPlannerResult?.solverIdentity?.implementation || '—'}</strong></div>
                             <div>Version: <strong>{optaPlannerResult?.solverIdentity?.version || '—'}</strong></div>
                           </div>
                           <div className="mt-2 truncate text-xs">Endpoint: {String(optaPlannerResult?.solverEndpointUsed || optaPlannerResult?.endpoint || '—')}</div>
                           <div className="mt-1">HTTP: <strong className={optaPlannerResult?.solverHttpStatus === 200 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.solverHttpStatus ?? '—'}</strong></div>
                           <div className="mt-1">/health: <strong>{optaPlannerResult?.solverHealthStatus ?? '—'}</strong> {optaPlannerResult?.solverHealthOk === false ? '(down)' : ''}</div>
                           <div className="mt-1">Headers: <code className="text-[10px]">{JSON.stringify(optaPlannerResult?.solverRequestHeadersSent || {})}</code></div>

                           {/* Debug metrics from solver */}
                           {optaPlannerResult?.solverDebugMetrics && (
                             <div className="mt-3 pt-2 border-t border-slate-300">
                               <div className="font-bold text-xs mb-1">Debug Metrics</div>
                               <div className="space-y-0.5 text-[11px]">
                                 <div>Unknown TG IDs: <strong className={(optaPlannerResult.solverDebugMetrics.unknownTeachingGroupIdsInOutput?.length || 0) > 0 ? 'text-rose-600' : 'text-green-600'}>
                                   {optaPlannerResult.solverDebugMetrics.unknownTeachingGroupIdsInOutput?.length || 0}
                                 </strong></div>
                                 <div>Unique TG IDs: <strong>{optaPlannerResult.solverDebugMetrics.uniqueTeachingGroupIdsInOutput?.length || 0}</strong></div>
                                 <div>Sections missing periods: <strong className={(optaPlannerResult.solverDebugMetrics.sectionsMissingPeriods || 0) > 0 ? 'text-rose-600' : 'text-green-600'}>
                                   {optaPlannerResult.solverDebugMetrics.sectionsMissingPeriods || 0}
                                 </strong></div>
                               </div>
                               {(optaPlannerResult.solverDebugMetrics.unknownTeachingGroupIdsInOutput?.length || 0) > 0 && (
                                 <div className="mt-2 p-2 bg-rose-100 border border-rose-300 rounded text-[10px] text-rose-800">
                                   <div className="font-bold mb-1">❌ Unknown TG IDs in output:</div>
                                   <pre className="whitespace-pre-wrap">{JSON.stringify(optaPlannerResult.solverDebugMetrics.unknownTeachingGroupIdsInOutput, null, 2)}</pre>
                                 </div>
                               )}
                             </div>
                           )}
                           {optaPlannerResult?.solverErrorBody && (
                             <div className="mt-1 font-semibold text-rose-700">Error: <span className="break-all">{(optaPlannerResult?.solverErrorBody || '').slice(0, 300)}</span></div>
                           )}
                           {optaPlannerResult?.solverHttpStatus && optaPlannerResult?.solverHttpStatus !== 200 && (
                              <div className="mt-3 space-y-2 border-t border-slate-300 pt-2">
                                <div className="text-[10px] text-slate-600 bg-rose-50 p-2 rounded border border-rose-200">
                                  <div className="font-bold text-rose-700 mb-1">🔴 Solver Failed (HTTP {optaPlannerResult?.solverHttpStatus})</div>
                                  <div className="text-rose-700">{optaPlannerResult?.solverErrorBody}</div>
                                </div>
                              </div>
                            )}
                            {optaPlannerResult?.solverHttpStatus === 200 && (
                              <div className="mt-3 space-y-2 border-t border-slate-300 pt-2">
                                <div className="text-[10px] text-slate-600">
                                  <div className="font-bold mb-1">📤 subjects sent (first 5):</div>
                                  <pre className="bg-white rounded p-1.5 overflow-x-auto max-h-40">{JSON.stringify((optaPlannerResult?.problem?.subjects || []).slice(0, 5), null, 2)}</pre>
                                </div>
                                <div className="text-[10px] text-slate-600">
                                  <div className="font-bold mb-1">📤 subjectRequirements sent (first 10):</div>
                                  <pre className="bg-white rounded p-1.5 overflow-x-auto max-h-40">{JSON.stringify((optaPlannerResult?.problem?.subjectRequirements || []).slice(0, 10), null, 2)}</pre>
                                </div>
                                {optaPlannerResult?.builderDiagnostics && (
                                  <div className="text-[10px] text-slate-600 mt-2">
                                    <div className="font-bold mb-1">📊 Builder Validation Report:</div>
                                    <div className="bg-white rounded p-2 space-y-2">
                                      {optaPlannerResult.builderDiagnostics.skipped?.length > 0 && (
                                        <div>
                                          <div className="font-semibold text-rose-700">⚠️ Excluded: {optaPlannerResult.builderDiagnostics.skipped.length} TeachingGroups</div>
                                          <div className="ml-2 text-rose-600 space-y-0.5">
                                            {optaPlannerResult.builderDiagnostics.skipped.slice(0, 10).map((s, i) => (
                                              <div key={i}>• {s.name} ({s.subject_code}) - {s.reason}</div>
                                            ))}
                                            {optaPlannerResult.builderDiagnostics.skipped.length > 10 && (
                                              <div>... +{optaPlannerResult.builderDiagnostics.skipped.length - 10} more</div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {optaPlannerResult.builderDiagnostics.adjustments?.length > 0 && (
                                        <div>
                                          <div className="font-semibold text-blue-700">ℹ️ Adjusted: {optaPlannerResult.builderDiagnostics.adjustments.length} TeachingGroups</div>
                                          <div className="ml-2 text-blue-600 space-y-0.5">
                                            {optaPlannerResult.builderDiagnostics.adjustments.slice(0, 5).map((a, i) => (
                                              <div key={i}>• {a.name}: {a.adjustment}</div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {(optaPlannerResult?.subjectsInvalidIds || []).length > 0 && (
                                  <div className="text-[10px] text-rose-700">
                                    <div className="font-bold">❌ Invalid Subject IDs (not 24-char hex):</div>
                                    <pre className="bg-rose-50 rounded p-1.5">{JSON.stringify(optaPlannerResult.subjectsInvalidIds, null, 2)}</pre>
                                  </div>
                                )}
                                {(optaPlannerResult?.requirementsUnknownSubjects || []).length > 0 && (
                                  <div className="text-[10px] text-rose-700">
                                    <div className="font-bold">❌ Unknown Subjects in Requirements:</div>
                                    <pre className="bg-rose-50 rounded p-1.5">{JSON.stringify(optaPlannerResult.requirementsUnknownSubjects, null, 2)}</pre>
                                  </div>
                                )}
                                {(optaPlannerResult?.requirementsInvalidMinutes || []).length > 0 && (
                                  <div className="text-[10px] text-rose-700">
                                    <div className="font-bold">❌ Invalid minutesPerWeek:</div>
                                    <pre className="bg-rose-50 rounded p-1.5">{JSON.stringify(optaPlannerResult.requirementsInvalidMinutes, null, 2)}</pre>
                                  </div>
                                )}
                                {optaPlannerResult?.normalizedSubjectsIndex && (
                                  <div className="text-[10px] text-slate-600">
                                    <div className="font-bold mb-1">🔍 Normalized Subjects Index:</div>
                                    <pre className="bg-white rounded p-1.5 overflow-x-auto max-h-32">{JSON.stringify(optaPlannerResult.normalizedSubjectsIndex, null, 2)}</pre>
                                  </div>
                                )}
                                {optaPlannerResult?.normalizedRequirementsSubjects && (
                                  <div className="text-[10px] text-slate-600">
                                    <div className="font-bold mb-1">🔍 Normalized Requirements (first 20):</div>
                                    <pre className="bg-white rounded p-1.5 overflow-x-auto max-h-32">{JSON.stringify(optaPlannerResult.normalizedRequirementsSubjects, null, 2)}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="p-3 rounded-lg bg-slate-100">
                            <div className="font-semibold text-slate-900 mb-1">Persistence</div>
                            <div>schedule_version_id: <strong>{optaPlannerResult?.meta?.schedule_version_id || '—'}</strong></div>
                            <div>slotsDeleted: <strong className={optaPlannerResult?.result?.slotsDeleted > 0 ? 'text-amber-700' : ''}>{optaPlannerResult?.result?.slotsDeleted ?? 0}</strong></div>
                            <div>slotsInserted: <strong className={optaPlannerResult?.result?.slotsInserted === 0 ? 'text-rose-700' : 'text-green-700'}>{optaPlannerResult?.result?.slotsInserted ?? 0}</strong></div>
                            <div>lessonsCreated: <strong>{optaPlannerResult?.result?.lessonsCreated ?? '—'}</strong></div>
                            <div>lessonsAssigned: <strong>{optaPlannerResult?.result?.lessonsAssigned ?? '—'}</strong></div>
                            <div>lessonsUnassigned: <strong>{optaPlannerResult?.result?.lessonsUnassigned ?? '—'}</strong></div>
                            <div>score: <strong>{optaPlannerResult?.result?.score ?? '—'}</strong></div>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-100">
                            <div className="font-semibold text-slate-900 mb-1">Timeslots</div>
                            <div>timeslotsCount: <strong>{optaPlannerResult?.timeslotsCount ?? optaPlannerResult?.buildMeta?.timeslotsCount ?? '—'}</strong></div>
                            <div>endTimeUsedByDay: <code>{JSON.stringify(optaPlannerResult?.endTimeUsedByDay || {})}</code></div>
                          </div>
                        </div>

                        {optaPlannerResult?.guardFailureCode && (
                          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                            <div className="font-semibold mb-1">Guard Failure: {optaPlannerResult.guardFailureCode}</div>
                            <div className="grid md:grid-cols-3 gap-2">
                              <div>requestedSchoolId: <strong>{String(optaPlannerResult.requestedSchoolId ?? 'null')}</strong></div>
                              <div>scheduleVersion.school_id: <strong>{String(optaPlannerResult.scheduleVersionSchoolId ?? 'null')}</strong></div>
                              <div>whoami: <code>{JSON.stringify(optaPlannerResult.whoami || optaPlannerResult.user || null)}</code></div>
                            </div>
                          </div>
                        )}

                        {/* All-subjects comparison and stage counters will follow */}
                        {/* Requested recap fields */}
                        {(() => {
                          const exp = optaPlannerResult?.expectedLessonsBySubject || {};
                          const expMin = optaPlannerResult?.expectedMinutesBySubject || {};
                          const asg = optaPlannerResult?.assignedLessonsBySubject || optaPlannerResult?.assignmentsBySubjectCode || {};
                          const unasg = optaPlannerResult?.unassignedLessonsBySubject || optaPlannerResult?.unassignedBySubjectCode || {};
                          const core = optaPlannerResult?.coreAssignments || {};
                          const meta = optaPlannerResult?.buildMeta || {};
                          const maxP = optaPlannerResult?.maxPeriodUsedByDay || {};
                          const slotsToInsert = optaPlannerResult?.slotsToInsertBySubjectId || {};
                          const coreIns = optaPlannerResult?.coreSlotsInsertedCount || {};
                          const sampleCores = optaPlannerResult?.sampleCoreSlots || null;
                          const sampleLine = (arr) => {
                            const s = Array.isArray(arr) && arr[0];
                            return s && (s.day && s.period) ? `${s.day} • P${s.period}` : '—';
                          };
                          return (
                            <div className="space-y-3 text-xs text-slate-700">
                              <div className="grid md:grid-cols-3 gap-3">
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Expected Core (Input)</div>
                                  <div className="flex gap-4">
                                    <span>TOK: <strong>{(optaPlannerResult?.expectedLessonsBySubject?.TOK || 0)}</strong></span>
                                    <span>CAS: <strong>{(optaPlannerResult?.expectedLessonsBySubject?.CAS || 0)}</strong></span>
                                    <span>EE: <strong>{(optaPlannerResult?.expectedLessonsBySubject?.EE || 0)}</strong></span>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Core TGs Detected</div>
                                  <div className="space-y-1">
                                    {(optaPlannerResult?.coreTeachingGroupsDetected || []).map((core, i) => (
                                      <div key={i} className="text-[11px]">
                                        {core.subject}: <strong>{core.tgs_count}</strong> TGs, <strong>{core.lessons_count}</strong> lessons
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
                                    <div>endTimeUsedByDay: <code>{JSON.stringify(optaPlannerResult?.endTimeUsedByDay || {})}</code></div>
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
                                  <div className="font-semibold text-slate-900 mb-1">Core Slots Inserted (Final)</div>
                                  <div className="space-y-1">
                                    <div>TOK: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.TOK || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.TOK || 0}</strong></div>
                                    <div>CAS: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.CAS || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.CAS || 0}</strong></div>
                                    <div>EE: <strong className={(optaPlannerResult?.result?.coreSlotsInserted?.EE || 0) > 0 ? 'text-green-600' : 'text-rose-600'}>{optaPlannerResult?.result?.coreSlotsInserted?.EE || 0}</strong></div>
                                  </div>
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
                                    <div className="font-medium">{optaPlannerResult?.scheduleSettingsSent?.day_start_time || '—'}</div>
                                    <div className="text-slate-500">end</div>
                                    <div className="font-medium">{optaPlannerResult?.scheduleSettingsSent?.day_end_time || '—'}</div>
                                    <div className="text-slate-500">period</div>
                                    <div className="font-medium">{optaPlannerResult?.scheduleSettingsSent?.period_duration_minutes ?? '—'} min</div>
                                    <div className="text-slate-500">days</div>
                                    <div className="font-medium">{(optaPlannerResult?.scheduleSettingsSent?.days_of_week || []).join(', ') || '—'}</div>
                                    <div className="text-slate-500">min/target</div>
                                    <div className="font-medium">{optaPlannerResult?.scheduleSettingsSent?.min_periods_per_day ?? '—'} / {optaPlannerResult?.scheduleSettingsSent?.target_periods_per_day ?? '—'}</div>
                                    <div className="text-slate-500">breaks</div>
                                    <div className="font-medium">{(optaPlannerResult?.scheduleSettingsSent?.breaks || []).map(b => `${b.start}-${b.end}`).join(', ') || '—'}</div>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Timeslots & Usage</div>
                                  <div className="space-y-1">
                                    <div>timeslotsCount: <strong>{optaPlannerResult?.timeslotsCount ?? meta?.timeslotsCount ?? '—'}</strong></div>
                                    <div>lastTimeslotUsed: <strong>{optaPlannerResult?.lastTimeslotUsed ? `${optaPlannerResult.lastTimeslotUsed.dayOfWeek} • ${optaPlannerResult.lastTimeslotUsed.endTime}` : '—'}</strong></div>
                                  </div>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Underfill</div>
                                  <div className="space-y-1">
                                    <div>underfilled: <strong>{String(optaPlannerResult?.underfill?.underfilled ?? false)}</strong></div>
                                    <div>reason: <strong>{optaPlannerResult?.underfill?.reason || '—'}</strong></div>
                                    <div>STUDY created: <strong>{optaPlannerResult?.underfill?.study?.assigned_in_solver || 0}</strong> / returned: <strong>{optaPlannerResult?.underfill?.study?.total_from_solver || 0}</strong> • prepared: <strong>{optaPlannerResult?.underfill?.study?.prepared_for_insert || 0}</strong></div>
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
                                  <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(optaPlannerResult?.inputSummaryBySubject || {}, null, 2)}</pre>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-100">
                                  <div className="font-semibold text-slate-900 mb-1">Core TG Detected</div>
                                  <pre className="bg-white rounded p-2 overflow-x-auto max-h-40">{JSON.stringify(optaPlannerResult?.coreTeachingGroupsDetected || [], null, 2)}</pre>
                                </div>
                              </div>

                              {/* Solver Debug: Global Period Coverage Report */}
                              {optaPlannerResult?.solverDebugMetrics?.periodCoverageBySection && (
                                <GlobalPeriodCoverageReport
                                  periodCoverageData={optaPlannerResult.solverDebugMetrics.periodCoverageBySection}
                                  teachingGroups={teachingGroups}
                                  subjects={subjects}
                                  periodDurationMinutes={school?.period_duration_minutes || 60}
                                  missingPeriodsByReason={optaPlannerResult.solverDebugMetrics.missingPeriodsByReason || {}}
                                  unmetRequirements={optaPlannerResult.solverDebugMetrics.unmetRequirements || []}
                                  subjectRequirements={optaPlannerResult.subjectRequirements || []}
                                />
                              )}

                              {/* Subject Requirements Sent to Solver */}
                              {optaPlannerResult?.subjectRequirements && (
                                <div className="p-3 rounded-lg bg-amber-50 border-2 border-amber-300">
                                  <div className="font-semibold text-amber-900 mb-2">📋 Subject Requirements Envoyés au Solver</div>
                                  <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {optaPlannerResult.subjectRequirements.map((req, idx) => {
                                      const tgId = String(req.studentGroup || '').replace('TG_', '');
                                      const tg = teachingGroups.find(g => g.id === tgId);
                                      const subj = tg ? subjects.find(s => s.id === tg.subject_id) : null;
                                      const isDPHL = tg?.level === 'HL' && (subj?.ib_level === 'DP' || tg?.year_group?.includes('DP'));
                                      const isDPSL = tg?.level === 'SL' && (subj?.ib_level === 'DP' || tg?.year_group?.includes('DP'));
                                      const expectedIB = isDPHL ? 5 : isDPSL ? 3 : null;
                                      const mismatch = expectedIB && req.requiredPeriods !== expectedIB;

                                      return (
                                        <div key={idx} className={`p-2 rounded text-xs ${mismatch ? 'bg-rose-100 border border-rose-300' : 'bg-white'}`}>
                                          <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                              <div className="font-semibold">{req.subject} - {tg?.name || req.studentGroup}</div>
                                              <div className="text-[10px] text-slate-600">
                                                Level: {tg?.level || '?'} | Year: {tg?.year_group || '?'} | IB Level: {subj?.ib_level || '?'}
                                              </div>
                                            </div>
                                            <div className="text-right">
                                              <div className={mismatch ? 'font-bold text-rose-700' : 'text-slate-600'}>
                                                {req.requiredPeriods} périodes
                                              </div>
                                              <div className="text-[10px] text-slate-500">{req.minutesPerWeek}min/sem</div>
                                              {mismatch && (
                                                <div className="text-rose-700 font-bold text-[10px]">
                                                  ⚠️ IB: {expectedIB}p/sem
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

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
                                  {['TOK', 'CAS', 'EE', 'TEST'].map(k => {
                                    const plc = optaPlannerResult?.problemLessonsCreated || {};
                                    const sar = optaPlannerResult?.solutionAssignmentsReturned || {};
                                    const spi = optaPlannerResult?.slotsPreparedForInsert || {};
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
                                : (String(tg.level || '').toUpperCase() === 'HL'
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
                        <pre className="text-xs bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto max-h-72">{JSON.stringify(optaPlannerResult, null, 2)}</pre>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      ) : (
        <Card className="border-blue-200">
          <CardContent className="py-20 text-center">
            <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Schedule Version Selected</h3>
            <p className="text-slate-500 mb-6">Create a version to start generating timetables</p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-900 hover:bg-blue-800">
              <Plus className="w-4 h-4 mr-2" />
              Create Schedule Version
            </Button>
          </CardContent>
        </Card>
      )}

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
              <Button type="submit" className="bg-blue-900 hover:bg-blue-800" disabled={createVersionMutation.isPending}>
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

      {/* Pre-Solve Audit Report Modal */}
      <Dialog open={showAuditReport} onOpenChange={setShowAuditReport}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {auditResult?.stage === 'buildProblem' 
                ? '❌ Pre-Solve Validation Failed' 
                : auditResult?.stage === 'PRE_SOLVE_AUDIT'
                  ? '⚠️ Data Quality Issues Detected'
                  : '❌ Audit Failed'}
            </DialogTitle>
            <DialogDescription>
              {auditResult?.stage === 'buildProblem'
                ? 'Cannot generate schedule - fix configuration issues below and retry'
                : 'Review issues before proceeding with schedule generation'}
            </DialogDescription>
          </DialogHeader>
          <PreSolveAuditReport
            auditResult={auditResult}
            onProceed={() => {
              setShowAuditReport(false);
              // User can manually fix data and re-run generation
            }}
            onCancel={() => {
              setShowAuditReport(false);
              setAuditResult(null);
            }}
          />
        </DialogContent>
      </Dialog>

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
                {['TOK', 'CAS', 'EE'].map(key => (
                  <Card key={key} className="border-0 bg-slate-50">
                    <CardContent className="p-4">
                      <div className="font-semibold text-slate-700 mb-1">{key} Samples</div>
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap">{JSON.stringify((dpDiagData.recap?.core_lessons_sample?.[key] || []).slice(0, 3), null, 2)}</pre>
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
              <Sparkles className="w-5 h-5 text-blue-900" />
              Add Scheduling Constraint
            </DialogTitle>
            <DialogDescription>
              Describe your preference in natural language
            </DialogDescription>
          </DialogHeader>

          <Tabs value={constraintType} onValueChange={setConstraintType}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hard" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Hard (Must Follow)
              </TabsTrigger>
              <TabsTrigger value="soft" className="data-[state=active]:bg-blue-900 data-[state=active]:text-white">
                <Info className="w-4 h-4 mr-2" />
                Soft (Prefer)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hard" className="space-y-4 mt-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-900">
                  <strong>Hard constraints</strong> must be respected - the system will never violate this rule
                </p>
              </div>

              <div>
                <Label>Describe Your Rule</Label>
                <Textarea
                  value={constraintInput}
                  onChange={(e) => setConstraintInput(e.target.value)}
                  placeholder="e.g., 'Teachers cannot teach more than 4 consecutive periods'"
                  className="min-h-[100px] mt-2"
                />
              </div>
            </TabsContent>

            <TabsContent value="soft" className="space-y-4 mt-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Soft constraints</strong> are followed when possible without violating hard constraints
                </p>
              </div>

              <div>
                <Label>Describe Your Preference</Label>
                <Textarea
                  value={constraintInput}
                  onChange={(e) => setConstraintInput(e.target.value)}
                  placeholder="e.g., 'Prefer morning slots for science labs'"
                  className="min-h-[100px] mt-2"
                />
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
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-blue-900 hover:bg-blue-800'
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
                  Generate Constraint
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}