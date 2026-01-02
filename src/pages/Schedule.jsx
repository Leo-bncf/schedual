import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  GraduationCap,
  List
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

export default function Schedule() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
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
  const [formData, setFormData] = useState({
    name: '',
    academic_year: '2024-2025',
    term: 'Fall',
    status: 'draft'
  });

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
    setGenerationProgress({
      stage: 'Initializing',
      percent: 0,
      message: 'Starting schedule generation...',
      currentStep: 'teachers',
      completedSteps: [],
      completed: false
    });
    
    try {
      console.log('=== SCHEDULE GENERATION START ===');
      console.log('School ID:', schoolId);
      console.log('Selected Version:', selectedVersion);
      console.log('Teaching Groups:', teachingGroups.length);
      console.log('Teachers:', teachers.length);
      console.log('Students:', students.length);
      console.log('Rooms:', rooms.length);
      
      // Step 1: Assign teachers to teaching groups
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
      const periods = Array.from({ length: 12 }, (_, i) => i + 1);
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

      // Separate groups by IB level
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

      console.log('Groups by IB Level:', {
        DP: groupsByLevel.DP.length,
        MYP: groupsByLevel.MYP.length,
        PYP: groupsByLevel.PYP.length
      });

      // Schedule each IB level separately but track teachers globally
      const scheduleLevels = ['DP', 'MYP', 'PYP'];
      
      for (const level of scheduleLevels) {
        console.log(`\n=== Scheduling ${level} ===`);

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
          
          console.log(`Using ClassGroup-based scheduling for ${level}`);
          const { data: result } = await base44.functions.invoke('generatePYPMYPSchedule', {
            schedule_version_id: selectedVersion.id,
            level
          });
          
          if (result.slots) {
            console.log(`Generated ${result.slots.length} slots for ${level}`);
            newSlots.push(...result.slots);
            
            setGenerationProgress(prev => ({
              ...prev,
              message: `Created ${result.slots.length} ${level} schedule slots`,
              completedSteps: [...prev.completedSteps, level.toLowerCase()]
            }));
            
            // Update availability tracking
            result.slots.forEach(slot => {
              if (slot.teacher_id && teacherSchedules[slot.teacher_id]) {
                teacherSchedules[slot.teacher_id].push({ day: slot.day, period: slot.period });
              }
              if (slot.room_id && roomSchedules[slot.room_id]) {
                roomSchedules[slot.room_id].push({ day: slot.day, period: slot.period });
              }
            });
          }
          continue;
        }

        // DP: Use TeachingGroups-based scheduling
        setGenerationProgress(prev => ({
          ...prev,
          stage: 'Scheduling DP',
          percent: 30,
          message: 'Creating DP teaching group schedules...',
          currentStep: 'dp'
        }));
        
        const levelGroupsFromUpdated = updatedGroups.filter(g => {
          if (g.is_active === false) return false;
          if (!g.hours_per_week || g.hours_per_week <= 0) return false;
          const ibLevel = getIBLevel(g.year_group);
          return ibLevel === level;
        }).sort((a, b) => (a.student_ids?.length || 0) - (b.student_ids?.length || 0));

        console.log(`Found ${levelGroupsFromUpdated.length} DP groups`);

        for (const group of levelGroupsFromUpdated) {
          // Determine hours based on subject's HL/SL hours and group's level
          const subject = subjects.find(s => s.id === group.subject_id);
          let hoursPerWeek = group.hours_per_week;

          if (subject && group.level) {
            if (group.level === 'HL' && subject.hl_hours_per_week) {
              hoursPerWeek = subject.hl_hours_per_week;
            } else if (group.level === 'SL' && subject.sl_hours_per_week) {
              hoursPerWeek = subject.sl_hours_per_week;
            }
          }

          const periodsNeeded = Math.ceil(hoursPerWeek || group.hours_per_week || 4);
          console.log(`Scheduling "${group.name}" (${group.level}): ${periodsNeeded} periods needed`);

          let periodsScheduled = 0;
          let studentIds = group.student_ids || [];
          const teacherId = group.teacher_id;

          if (!teacherId) {
            console.warn(`No teacher assigned to "${group.name}"`);
          }

          // Initialize teacher schedule if needed
          if (teacherId && !teacherSchedules[teacherId]) {
            teacherSchedules[teacherId] = [];
          }

        // If no students assigned, try to find matching students from their ClassGroup
        if (studentIds.length === 0 && group.subject_id && group.year_group) {
          const matchingStudents = students.filter(s => {
            // Skip inactive students
            if (s.is_active === false) return false;
            
            // Match by year_group
            if (s.year_group !== group.year_group) return false;

            // For DP students, check subject choices AND ClassGroup
            if (s.ib_programme === 'DP' && s.subject_choices) {
              // Check if student chose this subject at this level
              const hasSubject = s.subject_choices.some(choice => 
                choice.subject_id === group.subject_id && 
                (!group.level || choice.level === group.level)
              );
              return hasSubject;
            }

            return false;
          });

          studentIds = matchingStudents.map(s => s.id);
          
          // Get all unique ClassGroups these students belong to
          const studentClassGroups = new Set(matchingStudents.map(s => s.classgroup_id).filter(Boolean));
          
          console.log(`Auto-assigned ${studentIds.length} DP students from ${studentClassGroups.size} ClassGroup(s) to "${group.name}"`);
          
          // Update the teaching group with student assignments
          if (studentIds.length > 0) {
            await base44.entities.TeachingGroup.update(group.id, { student_ids: studentIds });
          }
        }
        
        // Log assignment status for debugging
        if (level === 'MYP' || level === 'PYP') {
          console.log(`${level} Group "${group.name}": ${studentIds.length} students, Teacher: ${teacherId ? 'Yes' : 'No'}`);
        }

        // Find suitable room
        let preferredRooms = rooms.filter(r => r.is_active);
        
        if (subject?.requires_special_room) {
          preferredRooms = preferredRooms.filter(r => r.room_type === subject.requires_special_room);
        }
        if (group.preferred_room_id) {
          const preferred = rooms.find(r => r.id === group.preferred_room_id);
          if (preferred) preferredRooms = [preferred, ...preferredRooms.filter(r => r.id !== preferred.id)];
        }

        // Calculate ideal distribution across the week - VARIED SCHEDULING
        const daysToUse = Math.min(periodsNeeded, 5); // Spread across max 5 days
        const basePeriodsPerDay = Math.floor(periodsNeeded / daysToUse);
        const extraPeriods = periodsNeeded % daysToUse;

        // Track periods scheduled per day for this group
        const dayPeriodCount = {};
        const usedDayPeriods = new Set(); // Track day-period combos to avoid repetition
        days.forEach(d => { dayPeriodCount[d] = 0; });

        // Create DIFFERENT period assignments for each day to maximize variety
        const periodsByDay = {};
        days.forEach((day, dayIndex) => {
          // Each day gets a different starting period offset
          const offset = dayIndex * 2; // Shift by 2 periods each day
          const dayPeriods = [...periods]
            .map(p => ((p - 1 + offset) % 12) + 1) // Rotate periods differently for each day
            .sort(() => Math.random() - 0.5); // Then shuffle for extra randomness
          periodsByDay[day] = dayPeriods;
        });

        // Try to schedule periods for this group - distribute across week with MAXIMUM VARIATION
        for (const day of days) {
          if (periodsScheduled >= periodsNeeded) break;

          // Each day should get different periods to avoid repetition
          const targetForDay = dayPeriodCount[day] < basePeriodsPerDay 
            ? basePeriodsPerDay 
            : (dayPeriodCount[day] < basePeriodsPerDay + 1 && extraPeriods > 0) 
              ? basePeriodsPerDay + 1 
              : 0;

          for (const period of periodsByDay[day]) {
            if (periodsScheduled >= periodsNeeded) break;
            if (dayPeriodCount[day] >= targetForDay) break;

            // Avoid using same period on consecutive days (creates variety)
            const prevDay = days[days.indexOf(day) - 1];
            if (prevDay && usedDayPeriods.has(`${prevDay}-${period}`)) {
              continue; 
            }

            // Check if all students are available (or no students assigned yet)
            const studentsFree = studentIds.length === 0 || studentIds.every(studentId => {
              const schedule = studentSchedules[studentId] || [];
              const isSlotFree = !schedule.some(s => s.day === day && s.period === period);

              if (!isSlotFree) return false;

              // Check consecutive subject limit (max 2 consecutive hours of same subject)
              if (period > 1) {
                const daySchedule = schedule.filter(s => s.day === day && s.period < period);
                const sortedSchedule = daySchedule.sort((a, b) => b.period - a.period);

                // Check if previous 2 periods were the same subject
                if (sortedSchedule.length >= 2) {
                  const prev1 = sortedSchedule.find(s => s.period === period - 1);
                  const prev2 = sortedSchedule.find(s => s.period === period - 2);

                  if (prev1 && prev2 && 
                      prev1.subjectId === group.subject_id && 
                      prev2.subjectId === group.subject_id) {
                    return false; // Already 2 consecutive hours of this subject
                  }
                }
              }

              return true;
            });

            // Check if teacher is available (if assigned)
            let teacherFree = true;
            let teacherAvailable = true;

            if (teacherId) {
              teacherFree = !teacherSchedules[teacherId]?.some(s => s.day === day && s.period === period);
              const teacher = teachers.find(t => t.id === teacherId);
              teacherAvailable = !teacher?.unavailable_slots?.some(u => u.day === day && u.period === period);
            }

            if (studentsFree && teacherFree && teacherAvailable) {
              // Find available room
              let assignedRoom = null;
              for (const room of preferredRooms) {
                const roomFree = !roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
                const hasCapacity = !room.capacity || (studentIds.length <= room.capacity);
                
                if (roomFree && hasCapacity) {
                  assignedRoom = room;
                  break;
                }
              }

              if (assignedRoom) {
                // For PYP/MYP: use classgroup_id and populate teacher/subject directly
                // For DP: use teaching_group_id (traditional approach)
                const isPYPorMYP = level === 'PYP' || level === 'MYP';
                const slot = isPYPorMYP ? {
                  school_id: schoolId,
                  schedule_version: selectedVersion.id,
                  classgroup_id: group.classgroup_id || null,
                  teacher_id: teacherId,
                  subject_id: group.subject_id,
                  room_id: assignedRoom.id,
                  day,
                  period,
                  status: 'scheduled'
                } : {
                  school_id: schoolId,
                  schedule_version: selectedVersion.id,
                  teaching_group_id: group.id,
                  room_id: assignedRoom.id,
                  day,
                  period,
                  status: 'scheduled'
                };

                newSlots.push(slot);

                // Mark as busy
                if (studentIds.length > 0) {
                  studentIds.forEach(studentId => {
                    studentSchedules[studentId].push({ 
                      day, 
                      period, 
                      subjectId: group.subject_id 
                    });
                  });
                }
                if (teacherId && teacherSchedules[teacherId]) {
                  teacherSchedules[teacherId].push({ day, period });
                }
                roomSchedules[assignedRoom.id].push({ day, period });

                periodsScheduled++;
                dayPeriodCount[day]++;
                usedDayPeriods.add(`${day}-${period}`);
                }
                }
                }
                }

                // Second pass: fill remaining periods if needed (more flexible)
                if (periodsScheduled < periodsNeeded) {
                for (const day of days) {
                if (periodsScheduled >= periodsNeeded) break;

                for (const period of periods) {
                if (periodsScheduled >= periodsNeeded) break;

                const studentsFree = studentIds.length === 0 || studentIds.every(studentId => {
                const schedule = studentSchedules[studentId] || [];
                const isSlotFree = !schedule.some(s => s.day === day && s.period === period);

                if (!isSlotFree) return false;

                if (period > 1) {
                  const daySchedule = schedule.filter(s => s.day === day && s.period < period);
                  const sortedSchedule = daySchedule.sort((a, b) => b.period - a.period);

                  if (sortedSchedule.length >= 2) {
                    const prev1 = sortedSchedule.find(s => s.period === period - 1);
                    const prev2 = sortedSchedule.find(s => s.period === period - 2);

                    if (prev1 && prev2 && 
                        prev1.subjectId === group.subject_id && 
                        prev2.subjectId === group.subject_id) {
                      return false;
                    }
                  }
                }

                return true;
                });

                let teacherFree = true;
                let teacherAvailable = true;

                if (teacherId) {
                teacherFree = !teacherSchedules[teacherId]?.some(s => s.day === day && s.period === period);
                const teacher = teachers.find(t => t.id === teacherId);
                teacherAvailable = !teacher?.unavailable_slots?.some(u => u.day === day && u.period === period);
                }

                if (studentsFree && teacherFree && teacherAvailable) {
                let assignedRoom = null;
                for (const room of preferredRooms) {
                  const roomFree = !roomSchedules[room.id]?.some(s => s.day === day && s.period === period);
                  const hasCapacity = !room.capacity || (studentIds.length <= room.capacity);

                  if (roomFree && hasCapacity) {
                    assignedRoom = room;
                    break;
                  }
                }

                if (assignedRoom) {
                  const isPYPorMYP = level === 'PYP' || level === 'MYP';
                  const slot = isPYPorMYP ? {
                    school_id: schoolId,
                    schedule_version: selectedVersion.id,
                    classgroup_id: group.classgroup_id || null,
                    teacher_id: teacherId,
                    subject_id: group.subject_id,
                    room_id: assignedRoom.id,
                    day,
                    period,
                    status: 'scheduled'
                  } : {
                    school_id: schoolId,
                    schedule_version: selectedVersion.id,
                    teaching_group_id: group.id,
                    room_id: assignedRoom.id,
                    day,
                    period,
                    status: 'scheduled'
                  };

                  newSlots.push(slot);

                  if (studentIds.length > 0) {
                    studentIds.forEach(studentId => {
                      studentSchedules[studentId].push({ 
                        day, 
                        period, 
                        subjectId: group.subject_id 
                      });
                    });
                  }
                  if (teacherId && teacherSchedules[teacherId]) {
                    teacherSchedules[teacherId].push({ day, period });
                  }
                  roomSchedules[assignedRoom.id].push({ day, period });

                  periodsScheduled++;
                }
                }
                }
                }
                }

          // Debug: Log if group wasn't fully scheduled
          if (periodsScheduled < periodsNeeded) {
            console.log(`⚠️ Group "${group.name}" only scheduled ${periodsScheduled}/${periodsNeeded} periods`);
          }
        }
      }

      // Create all slots in batches to avoid rate limits
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
        const batchSize = 5; // Reduced from 10 to avoid rate limits
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
            // Wait longer before retry
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Retry individually with longer delays
            for (const slot of batch) {
              try {
                await base44.entities.ScheduleSlot.create(slot);
                totalCreated++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 500ms
              } catch (slotError) {
                console.error(`Failed to create slot:`, slotError.message);
              }
            }
          }

          // Much longer delay between batches to avoid rate limits
          if (i + batchSize < newSlots.length) {
            await new Promise(resolve => setTimeout(resolve, 3000)); // Increased from 2000ms
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

      newSlots.forEach(slot => {
        const group = teachingGroups.find(g => g.id === slot.teaching_group_id);
        if (group) {
          scheduledGroups.add(group.id);
          group.student_ids?.forEach(sid => scheduledStudents.add(sid));
          if (group.teacher_id) scheduledTeachers.add(group.teacher_id);
        }
      });

      // Count all unique teachers from all groups
      const allTeachersInGroups = new Set();
      Object.values(groupsByLevel).flat().forEach(g => {
        if (g.teacher_id) allTeachersInGroups.add(g.teacher_id);
      });

      const totalGroups = Object.values(groupsByLevel).flat().length;

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
          warnings_count: totalGroups - scheduledGroups.size,
          notes: `DP: ${groupsByLevel.DP.length} groups, MYP: ${groupsByLevel.MYP.length} groups, PYP: ${groupsByLevel.PYP.length} groups | Scheduled ${scheduledStudents.size}/${students.length} students, ${scheduledGroups.size}/${totalGroups} groups (${allTeachersInGroups.size} teachers) across ${newSlots.length} periods.`
        }
      });

      // Refresh slots and teaching groups
      queryClient.invalidateQueries({ queryKey: ['scheduleSlots'] });
      queryClient.invalidateQueries({ queryKey: ['teachingGroups'] });
      
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
      
      setGenerationProgress({
        stage: 'Error',
        percent: 0,
        message: `Generation failed: ${error.message}`,
        currentStep: '',
        completedSteps: [],
        completed: true
      });
    }
    
    setTimeout(() => {
      setIsGenerating(false);
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
        description="Generate and manage timetables for all IB programmes (PYP, MYP, DP)"
        actions={
          <Button onClick={() => setIsDialogOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" />
            New Version
          </Button>
        }
      />

      {/* Quick Stats Bar */}
      {selectedVersion && scheduleSlots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-500 to-blue-600 overflow-hidden relative group hover:shadow-md transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs text-blue-100 mb-2 font-medium">Students Scheduled</p>
                  <p className="text-3xl font-bold text-white mb-1">{stats.studentsScheduled}<span className="text-lg text-blue-100">/{students.length}</span></p>
                  <div className="h-1.5 bg-blue-400/30 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${stats.coverage}%` }} />
                  </div>
                </div>
                <div className="text-4xl font-bold text-white/90">{stats.coverage}%</div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-emerald-600 overflow-hidden relative group hover:shadow-md transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-emerald-100 mb-2 font-medium">Teachers Assigned</p>
                  <p className="text-3xl font-bold text-white">{stats.teachersAssigned}<span className="text-lg text-emerald-100">/{teachers.length}</span></p>
                  <p className="text-xs text-emerald-100 mt-2">
                    {teachers.length > 0 ? Math.round((stats.teachersAssigned/teachers.length)*100) : 0}% Utilization
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-500 to-violet-600 overflow-hidden relative group hover:shadow-md transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-violet-100 mb-2 font-medium">Total Periods</p>
                  <p className="text-3xl font-bold text-white">{stats.totalSlots}</p>
                  <p className="text-xs text-violet-100 mt-2">
                    {Math.floor(stats.totalSlots / 5)} per day avg
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`border-0 shadow-sm overflow-hidden relative group hover:shadow-md transition-all ${
            selectedVersion.conflicts_count > 0 
              ? 'bg-gradient-to-br from-rose-500 to-rose-600' 
              : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
          }`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between">
                <div>
                  <p className={`text-xs mb-2 font-medium ${
                    selectedVersion.conflicts_count > 0 ? 'text-rose-100' : 'text-emerald-100'
                  }`}>
                    {selectedVersion.conflicts_count > 0 ? 'Issues Found' : 'All Clear'}
                  </p>
                  <p className="text-3xl font-bold text-white">
                    {(selectedVersion.conflicts_count || 0) + (selectedVersion.warnings_count || 0)}
                  </p>
                  <p className={`text-xs mt-2 ${
                    selectedVersion.conflicts_count > 0 ? 'text-rose-100' : 'text-emerald-100'
                  }`}>
                    {selectedVersion.conflicts_count > 0 ? 'Needs attention' : 'Ready to publish'}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  selectedVersion.conflicts_count > 0 ? 'bg-white/20' : 'bg-white/20'
                }`}>
                  {selectedVersion.conflicts_count > 0 ? (
                    <AlertTriangle className="w-6 h-6 text-white" />
                  ) : (
                    <CheckCircle className="w-6 h-6 text-white" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Version Control Card */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-1" />
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1">
                <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Active Schedule Version</Label>
                <Select value={selectedVersion?.id || ''} onValueChange={(id) => setSelectedVersion(scheduleVersions.find(v => v.id === id))}>
                  <SelectTrigger className="w-full lg:w-[360px] h-12 border-slate-200">
                    <SelectValue placeholder="Select a schedule version" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleVersions.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">No versions yet. Create one to start.</div>
                    ) : (
                      <>
                        {publishedVersion && (
                          <SelectItem value={publishedVersion.id}>
                            <div className="flex items-center gap-2 py-1">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="font-medium">{publishedVersion.name}</span>
                              <Badge className="ml-2 bg-emerald-100 text-emerald-700 border-0 text-xs">Live</Badge>
                            </div>
                          </SelectItem>
                        )}
                        {draftVersions.map(version => (
                          <SelectItem key={version.id} value={version.id}>
                            <div className="flex items-center gap-2 py-1">
                              <div className="w-2 h-2 rounded-full bg-slate-400" />
                              <span>{version.name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">Draft</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {selectedVersion && (
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{selectedVersion.academic_year}</span>
                    </div>
                    <span>•</span>
                    <span>{selectedVersion.term || 'Full Year'}</span>
                    {selectedVersion.generated_at && (
                      <>
                        <span>•</span>
                        <span>Updated {new Date(selectedVersion.generated_at).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            {selectedVersion && (
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={handleGenerateSchedule}
                  disabled={isGenerating}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white border-0 shadow-sm"
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
                    className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    onClick={() => handlePublish(selectedVersion)}
                    size="lg"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Publish
                  </Button>
                )}
                {selectedVersion.status === 'draft' && (
                  <Button 
                    variant="outline"
                    size="lg"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
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

      <div className="space-y-4">
        {selectedVersion ? (
          <>
            {/* Conflicts/Warnings */}
              {selectedVersion && (selectedVersion.conflicts_count > 0 || selectedVersion.warnings_count > 0) && (
                <div className="space-y-3">
                  {selectedVersion.conflicts_count > 0 && (
                    <ConflictAlert 
                      severity="error"
                      title={`${selectedVersion.conflicts_count} Scheduling Conflicts`}
                      description="There are unresolved conflicts that need attention before publishing."
                    />
                  )}
                  {selectedVersion.warnings_count > 0 && (
                    <ConflictAlert 
                      severity="warning"
                      title={`${selectedVersion.warnings_count} Warnings`}
                      description="Review these soft constraint violations for optimal scheduling."
                    />
                  )}
                  {selectedVersion.id && <ConflictViewer scheduleVersionId={selectedVersion.id} />}
                </div>
              )}

              {/* Timetable */}
              <Tabs defaultValue="grid" className="space-y-6">
                <div className="flex items-center justify-between">
                  <TabsList className="bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="grid" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <Calendar className="w-4 h-4 mr-2" />
                      Master Schedule
                    </TabsTrigger>
                    <TabsTrigger value="student" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <GraduationCap className="w-4 h-4 mr-2" />
                      Student View
                    </TabsTrigger>
                    <TabsTrigger value="teacher" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <Users className="w-4 h-4 mr-2" />
                      Teacher View
                    </TabsTrigger>
                    <TabsTrigger value="list" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <List className="w-4 h-4 mr-2" />
                      Period List
                    </TabsTrigger>
                  </TabsList>
                  {scheduleSlots.length > 0 && (
                    <div className="text-sm text-slate-500">
                      {scheduleSlots.length} periods scheduled
                    </div>
                  )}
                </div>
                
                <TabsContent value="grid">
                  {scheduleSlots.length === 0 ? (
                    <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5" />
                      <CardContent className="py-20 text-center relative">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                          <Calendar className="w-10 h-10 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-3">Ready to Generate Your Schedule</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">
                          Create an optimized timetable for all your students, teachers, and classrooms with one click
                        </p>
                        <Button 
                          onClick={handleGenerateSchedule}
                          disabled={isGenerating}
                          size="lg"
                          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg"
                        >
                          <Sparkles className="w-5 h-5 mr-2" />
                          Generate Schedule Now
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Label className="text-sm font-medium text-slate-700">View ClassGroup:</Label>
                          <Select 
                            value={selectedClassGroupId || ''} 
                            onValueChange={setSelectedClassGroupId}
                          >
                            <SelectTrigger className="w-[320px]">
                              <SelectValue placeholder="Select a ClassGroup to view" />
                            </SelectTrigger>
                            <SelectContent>
                              {classGroups.map(cg => (
                                <SelectItem key={cg.id} value={cg.id}>
                                  {cg.name} ({cg.ib_programme} - {cg.year_group})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {selectedClassGroupId && (
                          <ScheduleExporter 
                            elementId="master-schedule-grid"
                            filename={`master-schedule-${classGroups.find(cg => cg.id === selectedClassGroupId)?.name || 'schedule'}`}
                            label="Export Schedule"
                            headerData={{
                              schoolName: school?.name || '',
                              studentName: classGroups.find(cg => cg.id === selectedClassGroupId)?.name || '',
                              lastUpdated: selectedVersion?.generated_at ? new Date(selectedVersion.generated_at).toLocaleDateString() : ''
                            }}
                          />
                        )}
                      </div>
                    {selectedClassGroupId ? (
                     <div id="master-schedule-grid">
                       <TimetableGrid 
                         slots={scheduleSlots.filter(slot => {
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
                         })}
                         groups={teachingGroups}
                         rooms={rooms}
                         subjects={subjects}
                         teachers={teachers}
                         classGroups={classGroups}
                         onSlotClick={(day, period, slot) => {
                           console.log('Clicked:', day, period, slot);
                         }}
                         exportId="master-timetable"
                       />
                     </div>
                    ) : (
                      <Card className="border-0 shadow-sm">
                        <CardContent className="py-16 text-center">
                          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <h4 className="font-medium text-slate-900 mb-1">Select a ClassGroup</h4>
                          <p className="text-sm text-slate-500">Choose a ClassGroup above to view their weekly schedule</p>
                        </CardContent>
                      </Card>
                    )}
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
            </>
        ) : (
          <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5" />
            <CardContent className="py-20 relative">
              <div className="text-center max-w-2xl mx-auto">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center mx-auto mb-8 shadow-xl">
                  <Calendar className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Welcome to Schedule Management</h2>
                <p className="text-lg text-slate-600 mb-8">
                  Create your first schedule version to organize classes for all IB programmes (PYP, MYP, DP). 
                  The system will automatically assign teachers, students, and rooms across the week.
                </p>
                <Button 
                  onClick={() => setIsDialogOpen(true)}
                  size="lg"
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your First Schedule
                </Button>
                <div className="grid grid-cols-3 gap-6 mt-12 text-left">
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
                      <GraduationCap className="w-5 h-5 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-1">Auto-assign Students</h4>
                    <p className="text-sm text-slate-500">Intelligent placement based on subject choices</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
                      <Users className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-1">Optimize Teachers</h4>
                    <p className="text-sm text-slate-500">Balanced workload distribution</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5 text-violet-600" />
                    </div>
                    <h4 className="font-semibold text-slate-900 mb-1">Conflict Detection</h4>
                    <p className="text-sm text-slate-500">Automatic validation and warnings</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
          setGenerationProgress({
            stage: '',
            percent: 0,
            message: '',
            currentStep: '',
            completedSteps: [],
            completed: false
          });
        }}
      />
    </div>
  );
}