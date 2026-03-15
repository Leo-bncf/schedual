import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GraduationCap, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from "@/lib/utils";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const normalizeSearch = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const normalizeLevel = (value) => String(value || '').toUpperCase().trim();
const makeSubjectLevelKey = (subjectId, level) => subjectId ? `${subjectId}__${normalizeLevel(level)}` : '';

export default function StudentScheduleView({ students, slots, groups, subjects, teachers, rooms, selectedStudentId, onStudentChange, exportId = "student-schedule", unassignedBySubjectCode = {}, timeslots = [], scheduleSettings, scheduleVersionId }) {
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const [serverSlots, setServerSlots] = React.useState(null);
  const [diagnostics, setDiagnostics] = React.useState(null);
  const [loadingServerSlots, setLoadingServerSlots] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = React.useState("");
  
  // DYNAMIC PERIOD CALCULATION: Derive from timeslots, not hardcoded
  const DAY_MAP = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };
  
  const { timeslotToPosition, periodTimes, maxPeriodsPerDay, breakRows, lunchRowsMap } = React.useMemo(() => {
    const map = {};
    const times = {};
    const timeslotsByDay = {};
    let maxPeriods = 0;
    
    // Group timeslots by day and sort by start time
    DAYS.forEach(day => {
      const dayUpper = day.toUpperCase();
      const daySlots = (timeslots || [])
        .filter(t => t.dayOfWeek === dayUpper)
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
      
      timeslotsByDay[day] = daySlots;
      maxPeriods = Math.max(maxPeriods, daySlots.length);
    });
    
    // Build timeslot mapping
    Object.values(timeslotsByDay).forEach(daySlots => {
      daySlots.forEach((ts, idx) => {
        const uiRow = idx + 1;
        map[ts.id] = { uiRow, startTime: ts.startTime, endTime: ts.endTime };
        if (!times[uiRow]) times[uiRow] = ts.startTime ? `${ts.startTime.substring(0, 5)} - ${ts.endTime.substring(0, 5)}` : '';
      });
    });

    // Fallback if no timeslots
    if (Object.keys(times).length === 0) {
      const [startHour, startMin] = (scheduleSettings?.day_start_time || '08:00').split(':').map(Number);
      const periodDuration = scheduleSettings?.period_duration_minutes || 60;
      let totalMinutes = startHour * 60 + startMin;
      const periods = scheduleSettings?.periods_per_day || 10;
      
      for (let i = 1; i <= periods; i++) {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const startTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        totalMinutes += periodDuration;
        const endH = Math.floor(totalMinutes / 60);
        const endM = totalMinutes % 60;
        const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
        times[i] = `${startTimeStr} - ${endTimeStr}`;
      }
      maxPeriods = periods;
    }
    
    // Parse breaks from scheduleSettings
    const breaks = Array.isArray(scheduleSettings?.breaks) ? scheduleSettings.breaks : [];
    const breakRowsData = breaks.map((br, idx) => ({
      id: `break-${idx}`,
      label: idx === 0 ? 'Break' : 'Lunch',
      emoji: idx === 0 ? '☕' : '🍽️',
      startTime: br.start,
      endTime: br.end,
      afterPeriod: timeslots && timeslots.length > 0 
        ? Math.round(timeslots.filter(t => String(t.endTime).localeCompare(br.start) <= 0).length / DAYS.length) 
        : (() => {
            const [startHour, startMin] = (scheduleSettings?.day_start_time || '08:00').split(':').map(Number);
            const [breakStartHour, breakStartMin] = br.start.split(':').map(Number);
            const elapsedMins = (breakStartHour * 60 + breakStartMin) - (startHour * 60 + startMin);
            return Math.max(1, Math.round(elapsedMins / (scheduleSettings?.period_duration_minutes || 60)));
          })(),
      colorFrom: idx === 0 ? 'from-sky-100' : 'from-amber-100',
      colorTo: idx === 0 ? 'to-blue-100' : 'to-orange-100',
      borderColor: idx === 0 ? 'border-sky-300' : 'border-amber-300',
      bgColor: idx === 0 ? 'bg-sky-200' : 'bg-amber-200',
      textColor: idx === 0 ? 'text-sky-900' : 'text-amber-900'
    }));

    const lunchRows = {};
    (timeslots || []).forEach((ts) => {
      const row = map[String(ts.id)]?.uiRow || map[ts.id]?.uiRow;
      const start = String(ts.startTime || '').slice(0, 5);
      const end = String(ts.endTime || '').slice(0, 5);
      if (row && start === '12:00' && end === '13:00') {
        lunchRows[row] = { startTime: start, endTime: end };
      }
    });
    
    return { timeslotToPosition: map, periodTimes: times, maxPeriodsPerDay: maxPeriods, breakRows: breakRowsData, lunchRowsMap: lunchRows };
  }, [timeslots, scheduleSettings]);

  // SERVER-SIDE JOIN: Load slots via backend API (SOURCE OF TRUTH)
  React.useEffect(() => {
    if (!selectedStudent || !scheduleVersionId) {
      setServerSlots(null);
      setDiagnostics(null);
      return;
    }
    
    const loadServerSlots = async () => {
      setLoadingServerSlots(true);
      console.log('[StudentScheduleView] 🔍 Loading slots via server-side API:', {
        student_id: selectedStudent.id,
        schedule_version_id: scheduleVersionId,
        student_name: selectedStudent.full_name
      });
      
      try {
        const { base44 } = await import('@/api/base44Client');
        const response = await base44.functions.invoke('getStudentScheduleSlots', {
          student_id: selectedStudent.id,
          schedule_version_id: scheduleVersionId
        });
        
        console.log('[StudentScheduleView] ✅ Server response:', response.data);
        
        if (response.data?.ok) {
          setServerSlots(response.data.slots);
          setDiagnostics(response.data.diagnostics);
          
          console.log('[StudentScheduleView] 📊 Diagnostics:', {
            total_slots: response.data.slots.length,
            unique_tgs: response.data.diagnostics?.unique_teaching_groups,
            missing_tgs: response.data.diagnostics?.missing_teaching_groups?.length || 0
          });
        } else {
          console.error('[StudentScheduleView] ❌ Server error:', response.data);
        }
      } catch (error) {
        console.error('[StudentScheduleView] ❌ Failed to load server slots:', error);
      } finally {
        setLoadingServerSlots(false);
      }
    };
    
    loadServerSlots();
  }, [selectedStudent?.id, scheduleVersionId]);
  
  const studentSlots = serverSlots || [];

  // NORMALIZE EVENTS: Group by day and uiRow, create conflict-groups for overlaps
  const { normalizedEvents, overlaps } = React.useMemo(() => {
    // Group by day and uiRow directly
    const byCell = new Map(); // key: "day_period"
    
    visibleStudentSlots.forEach(slot => {
      // Robustly resolve uiRow (timeslot fallback)
      const tsId = slot.timeslot_id;
      const mappedTimeslot = tsId ? (timeslotToPosition[String(tsId)] || timeslotToPosition[Number(tsId)]) : null;
      const slotUiRow = mappedTimeslot?.uiRow || slot.period;
      
      if (!slotUiRow || !slot.day) return; // Skip invalid slots
      
      const cellKey = `${slot.day}_${slotUiRow}`;
      if (!byCell.has(cellKey)) byCell.set(cellKey, []);
      byCell.get(cellKey).push({ ...slot, uiRow: slotUiRow });
    });
    
    const events = new Map();
    const conflicts = [];
    
    byCell.forEach((slots, cellKey) => {
      const firstSlot = slots[0];
      
      if (slots.length === 1) {
        // Single slot: normal event
        events.set(cellKey, { type: 'single', slot: firstSlot });
      } else {
        // Multiple slots: conflict-group
        const conflictDetails = slots.map(s => {
          const { subject, teacher, room, level } = resolveSlotMeta(s);

          return {
            id: s.id,
            subject: subject?.name || s.notes || 'Unknown',
            subjectCode: subject?.code || null,
            teacher: teacher?.full_name || 'Unassigned',
            room: room?.name || 'TBD',
            level: level || null
          };
        });

        events.set(cellKey, {
          type: 'conflict',
          count: slots.length,
          day: firstSlot.day,
          period: firstSlot.uiRow,
          details: conflictDetails
        });
        
        conflicts.push({
          day: firstSlot.day,
          period: firstSlot.uiRow,
          count: slots.length,
          details: conflictDetails
        });
      }
    });
    
    if (conflicts.length > 0) {
      console.warn(`[StudentScheduleView] ⚠️ DOUBLE BOOKING: ${conflicts.length} periods with multiple courses`);
      console.warn('[StudentScheduleView] Conflict details:', conflicts);
    }
    
    return { normalizedEvents: events, overlaps: conflicts };
  }, [visibleStudentSlots, timeslotToPosition, resolveSlotMeta]);

  const getEventForPeriod = (day, uiRow) => {
    const key = `${day}_${uiRow}`;
    return normalizedEvents.get(key) || null;
  };
  
  // Debug logging
  React.useEffect(() => {
    if (selectedStudent) {
      console.log('[StudentScheduleView] DEBUG - timeslots.length:', timeslots.length);
      console.log('[StudentScheduleView] DEBUG - timeslots[0]:', timeslots[0]);
      console.log('[StudentScheduleView] DEBUG - studentSlots.length:', visibleStudentSlots.length);
      console.log('[StudentScheduleView] DEBUG - studentSlots[0] keys:', Object.keys(visibleStudentSlots[0] || {}));
      console.log('[StudentScheduleView] DEBUG - studentSlots sample:', visibleStudentSlots.slice(0, 3));
      console.log('[StudentScheduleView] DEBUG - timeslotToPosition sample:', Object.entries(timeslotToPosition).slice(0, 5));
    }
  }, [selectedStudent, visibleStudentSlots, timeslots, timeslotToPosition]);

  const getSubjectColor = (subjectName) => {
    if (!subjectName) return { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-900', badge: 'bg-slate-100 text-slate-700' };
    const colors = [
      { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-800' },
      { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-900', badge: 'bg-indigo-100 text-indigo-800' },
      { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-900', badge: 'bg-violet-100 text-violet-800' },
      { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-800' },
      { bg: 'bg-fuchsia-50', border: 'border-fuchsia-400', text: 'text-fuchsia-900', badge: 'bg-fuchsia-100 text-fuchsia-800' },
      { bg: 'bg-pink-50', border: 'border-pink-400', text: 'text-pink-900', badge: 'bg-pink-100 text-pink-800' },
      { bg: 'bg-rose-50', border: 'border-rose-400', text: 'text-rose-900', badge: 'bg-rose-100 text-rose-800' },
      { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-900', badge: 'bg-orange-100 text-orange-800' },
      { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-800' },
      { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' },
      { bg: 'bg-teal-50', border: 'border-teal-400', text: 'text-teal-900', badge: 'bg-teal-100 text-teal-800' },
      { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-900', badge: 'bg-cyan-100 text-cyan-800' },
      { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-900', badge: 'bg-sky-100 text-sky-800' },
    ];
    let hash = 0;
    for (let i = 0; i < subjectName.length; i++) {
      hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Only hard-block if the student has neither assigned groups nor subject choices.
  const hasNoAssignedGroups = selectedStudent && (!selectedStudent.assigned_groups || selectedStudent.assigned_groups.length === 0) && (!selectedStudent.subject_choices || selectedStudent.subject_choices.length === 0);
  
  const handleResyncStudent = async () => {
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.functions.invoke('syncStudentTeachingGroups');
      window.location.reload();
    } catch (e) {
      alert('Sync failed: ' + e.message);
    }
  };

  const groupsById = React.useMemo(
    () => Object.fromEntries((groups || []).map(group => [group.id, group])),
    [groups]
  );

  const subjectsById = React.useMemo(
    () => Object.fromEntries((subjects || []).map(subject => [subject.id, subject])),
    [subjects]
  );

  const teachersById = React.useMemo(
    () => Object.fromEntries((teachers || []).map(teacher => [teacher.id, teacher])),
    [teachers]
  );

  const roomsById = React.useMemo(
    () => Object.fromEntries((rooms || []).map(room => [room.id, room])),
    [rooms]
  );

  const studentLevelsBySubjectId = React.useMemo(() => {
    const levelMap = {};
    const assignedGroups = (selectedStudent?.assigned_groups || [])
      .map((groupId) => groupsById[groupId])
      .filter(Boolean);

    assignedGroups.forEach((group) => {
      if (!group?.subject_id || !group?.level) return;
      if (!levelMap[group.subject_id]) levelMap[group.subject_id] = new Set();
      levelMap[group.subject_id].add(normalizeLevel(group.level));
    });

    (selectedStudent?.subject_choices || []).forEach((choice) => {
      const level = normalizeLevel(choice?.level);
      if (!choice?.subject_id || !level) return;
      if (!levelMap[choice.subject_id]) levelMap[choice.subject_id] = new Set();
      levelMap[choice.subject_id].add(level);
    });

    return levelMap;
  }, [selectedStudent, groupsById]);

  const resolveStudentLevelForSubject = React.useCallback((subjectId) => {
    const levels = subjectId ? studentLevelsBySubjectId[subjectId] : null;
    return levels?.size === 1 ? Array.from(levels)[0] : '';
  }, [studentLevelsBySubjectId]);

  const resolveSlotMeta = React.useCallback((slot) => {
    const group = slot?.teaching_group_id ? groupsById[slot.teaching_group_id] : null;
    const subjectId = slot?.subject_id || group?.subject_id;
    const subject = subjectId ? subjectsById[subjectId] : null;
    const teacher = slot?.teacher_id
      ? teachersById[slot.teacher_id]
      : group?.teacher_id
        ? teachersById[group.teacher_id]
        : null;
    const room = slot?.room_id ? roomsById[slot.room_id] : null;
    const level = normalizeLevel(slot?.display_level_override || group?.level || resolveStudentLevelForSubject(subjectId));

    return { group, subject, teacher, room, level };
  }, [groupsById, subjectsById, teachersById, roomsById, resolveStudentLevelForSubject]);

  const allowedStudentSubjectKeys = React.useMemo(() => {
    const keys = new Set();

    (selectedStudent?.assigned_groups || []).forEach((groupId) => {
      const group = groupsById[groupId];
      const key = makeSubjectLevelKey(group?.subject_id, group?.level);
      if (key) keys.add(key);
    });

    (selectedStudent?.subject_choices || []).forEach((choice) => {
      const key = makeSubjectLevelKey(choice?.subject_id, choice?.level);
      if (key) keys.add(key);
    });

    return keys;
  }, [selectedStudent, groupsById]);

  const visibleStudentSlots = React.useMemo(() => {
    return (studentSlots || []).filter((slot) => {
      if (slot?.is_break) return true;
      if (slot?.notes?.includes('Test')) return true;
      const { subject, level } = resolveSlotMeta(slot);
      const key = makeSubjectLevelKey(subject?.id, level);
      return key && allowedStudentSubjectKeys.has(key);
    });
  }, [studentSlots, resolveSlotMeta, allowedStudentSubjectKeys]);

  const filteredStudentOptions = students.filter(student =>
    normalizeSearch(student.full_name).includes(normalizeSearch(studentSearchQuery))
  );

  return (
    <div className="space-y-4">
      {/* OVERLAP ALERT */}
      {overlaps.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>⚠️ Double Booking Detected</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <p className="font-semibold">{overlaps.length} timeslots have multiple courses scheduled:</p>
              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                {overlaps.slice(0, 5).map((overlap, idx) => (
                  <div key={idx} className="bg-white/50 p-2 rounded text-xs">
                    <div className="font-bold text-red-900">
                      {overlap.day} Period {overlap.period} - {overlap.count} courses:
                    </div>
                    <ul className="ml-4 mt-1 space-y-1">
                      {overlap.details.map((d, i) => (
                        <li key={i}>• {d.subject} ({d.level || 'N/A'}) - {d.teacher} in {d.room}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {overlaps.length > 5 && (
                  <div className="text-xs text-red-800 font-semibold">
                    ...and {overlaps.length - 5} more conflicts
                  </div>
                )}
              </div>
              <p className="mt-3 text-xs">
                This is a solver bug. The student cannot attend multiple courses at the same time. Contact support.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* DEBUG PANEL */}
      {selectedStudent && diagnostics && (
        <Card className="border-blue-300 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-blue-900">🔍 Slot Loading Diagnostics</div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-blue-700 font-semibold">Slots Loaded</div>
                <div className="text-2xl font-bold text-blue-900">{diagnostics.student_slots_returned}</div>
              </div>
              <div>
                <div className="text-blue-700 font-semibold">Unique Teaching Groups</div>
                <div className="text-2xl font-bold text-blue-900">{diagnostics.unique_teaching_groups}</div>
              </div>
              <div>
                <div className="text-blue-700 font-semibold">Missing TGs</div>
                <div className={cn("text-2xl font-bold", 
                  diagnostics.missing_teaching_groups?.length > 0 ? "text-red-600" : "text-green-600")}>
                  {diagnostics.missing_teaching_groups?.length || 0}
                </div>
              </div>
            </div>
            
            {diagnostics.missing_teaching_groups?.length > 0 && (
              <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-xs">
                <div className="font-bold text-red-800 mb-1">❌ Teaching Groups with NO SLOTS:</div>
                <div className="space-y-1">
                  {diagnostics.missing_teaching_groups.slice(0, 5).map((tg, i) => (
                    <div key={i} className="text-red-700">
                      • {tg.subject_name} ({tg.level || 'N/A'}) - {tg.periods_per_week}p/week expected
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-3 text-xs text-blue-700">
              <div><strong>Schedule Version:</strong> {scheduleVersionId}</div>
              <div><strong>Assigned Groups:</strong> {diagnostics.assigned_groups_count}</div>
              <div><strong>Loading Method:</strong> Server-side API (getStudentScheduleSlots)</div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-medium text-slate-700">Select Student</span>
          {selectedStudent && (
            <>
              <Badge variant="outline">{visibleStudentSlots.length} periods</Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-900">
                {(selectedStudent.assigned_groups || []).length} groups
              </Badge>
              {loadingServerSlots && <Badge variant="outline">Loading...</Badge>}
            </>
          )}
        </div>
        
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
            <div className="relative w-full sm:max-w-xs">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={studentSearchQuery}
                placeholder="Chercher un élève..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                onFocus={() => setStudentSearchQuery((prev) => prev)}
              />

              {studentSearchQuery && filteredStudentOptions.length > 0 && (
                <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
                  {filteredStudentOptions.map(student => (
                    <button
                      key={student.id}
                      onClick={() => {
                        onStudentChange(student.id);
                        setStudentSearchQuery(student.full_name);
                      }}
                      className="w-full px-3 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0"
                    >
                      <div className="font-medium text-sm text-slate-900">{student.full_name}</div>
                      <div className="text-xs text-slate-500">{student.year_group}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {selectedStudent && (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-900 px-3 py-1.5 rounded-lg border border-blue-100 text-sm font-medium">
                <GraduationCap className="w-4 h-4 text-blue-600" />
                Sélectionné : {selectedStudent.full_name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HARD CHECK: No assigned_groups = cannot render */}
      {hasNoAssignedGroups && (
        <Card className="border-2 border-rose-500 bg-rose-50">
          <CardContent className="p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-rose-900 font-bold text-lg">
              <AlertCircle className="w-6 h-6" />
              Student Has No Assigned Teaching Groups
            </div>
            <div className="text-sm text-rose-800">
              <p className="mb-2">
                <strong>{selectedStudent.full_name}</strong> ({selectedStudent.year_group}) has <strong>0 assigned_groups</strong>.
              </p>
              <p className="mb-3">
                The schedule cannot be displayed without assigned teaching groups.
              </p>
              <p className="text-xs text-rose-700 bg-white p-2 rounded border border-rose-300">
                This happens when DP groups are created/updated but student assignments aren't synced.
              </p>
            </div>
            <Button 
              onClick={handleResyncStudent}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Re-sync Student Assignments
            </Button>
          </CardContent>
        </Card>
      )}

      {selectedStudent && !hasNoAssignedGroups && (
        <>
          {/* CRITICAL DEBUG: Slot Matching Analysis */}
          {(() => {
            const assignedGroupIds = Array.isArray(selectedStudent?.assigned_groups) ? selectedStudent.assigned_groups : [];
            const allSlotTGIds = [...new Set(slots.filter(s => s.teaching_group_id).map(s => s.teaching_group_id))];
            const matchedTGIds = allSlotTGIds.filter(id => assignedGroupIds.includes(id));
            const unmatchedAssignedTGIds = assignedGroupIds.filter(id => !allSlotTGIds.includes(id));
            const unmatchedSlotTGIds = allSlotTGIds.filter(id => !assignedGroupIds.includes(id));
            
            return (
              <Card className="mb-4 border-purple-300 bg-purple-50">
                <CardContent className="p-4">
                  <div className="font-bold text-purple-900 mb-3">🔍 Slot Matching Debug: {selectedStudent.full_name}</div>
                  <div className="grid md:grid-cols-3 gap-3 text-xs font-mono">
                    <div className="p-3 bg-white rounded border border-purple-200">
                      <div className="font-semibold text-purple-900 mb-2">Student Assigned TGs ({assignedGroupIds.length})</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {assignedGroupIds.slice(0, 10).map((id, i) => {
                          const group = groups.find(g => g.id === id);
                          const matched = matchedTGIds.includes(id);
                          return (
                            <div key={i} className={matched ? 'text-green-700' : 'text-rose-700'}>
                              {matched ? '✓' : '✗'} {group?.name || id.slice(-8)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white rounded border border-purple-200">
                      <div className="font-semibold text-purple-900 mb-2">Available Slot TG IDs ({allSlotTGIds.length})</div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {allSlotTGIds.slice(0, 10).map((id, i) => {
                          const group = groups.find(g => g.id === id);
                          const matched = matchedTGIds.includes(id);
                          return (
                            <div key={i} className={matched ? 'text-green-700' : 'text-amber-700'}>
                              {matched ? '✓' : '○'} {group?.name || id.slice(-8)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-white rounded border border-purple-200">
                      <div className="font-semibold text-purple-900 mb-2">Matching Status</div>
                      <div className="space-y-1">
                        <div className="text-green-700">✓ Matched: {matchedTGIds.length}</div>
                        <div className="text-rose-700">✗ Student has, no slots: {unmatchedAssignedTGIds.length}</div>
                        <div className="text-amber-700">○ Slots exist, student not assigned: {unmatchedSlotTGIds.length}</div>
                        <div className="mt-2 text-slate-600">Filter field: <strong>teaching_group_id</strong></div>
                      </div>
                    </div>
                  </div>
                  
                  {unmatchedAssignedTGIds.length > 0 && (
                    <div className="mt-3 p-2 bg-rose-100 border border-rose-300 rounded text-xs">
                      <div className="font-bold text-rose-800 mb-1">❌ Student assigned to TGs with no slots:</div>
                      <div className="space-y-0.5 text-rose-700">
                        {unmatchedAssignedTGIds.slice(0, 5).map((id, i) => {
                          const group = groups.find(g => g.id === id);
                          return <div key={i}>• {group?.name || id}</div>;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
          
          {/* PERIOD COVERAGE REPORT - SOURCE OF TRUTH: periods_per_week */}
          {(() => {
            const assignedGroupIds = Array.isArray(selectedStudent?.assigned_groups) ? selectedStudent.assigned_groups : [];
            const tgCoverage = [];
            
            assignedGroupIds.forEach(tgId => {
              const group = groups.find(g => g.id === tgId);
              if (!group) return;
              
              const subject = subjects.find(s => s.id === group.subject_id);
              
              // SOURCE OF TRUTH: periods_per_week
              const expectedPeriods = group.periods_per_week || 0;
              
              const coverageKey = makeSubjectLevelKey(group.subject_id, group.level);

              // Count actual SCHEDULED slots by subject+level, using the same resolution as the grid.
              const scheduledSlots = visibleStudentSlots.filter((s) => {
                const { subject, level } = resolveSlotMeta(s);
                const slotKey = makeSubjectLevelKey(subject?.id, level);
                return slotKey === coverageKey && s.status === 'scheduled' && s.timeslot_id;
              });
              const actualPeriods = scheduledSlots.reduce((sum, s) => sum + (s.is_double_period ? 2 : 1), 0);
              
              // Count unscheduled slots by subject+level too
              const unscheduledSlots = visibleStudentSlots.filter((s) => {
                const { subject, level } = resolveSlotMeta(s);
                const slotKey = makeSubjectLevelKey(subject?.id, level);
                return slotKey === coverageKey && s.status === 'unscheduled';
              });
              
              tgCoverage.push({
                tgId,
                name: group.name,
                subject_name: subject?.name || 'Unknown',
                subject_code: subject?.code || 'Unknown',
                level: group.level || null,
                expectedPeriods,
                actualPeriods,
                missingPeriods: Math.max(0, expectedPeriods - actualPeriods),
                unscheduledCount: unscheduledSlots.length,
                isComplete: actualPeriods >= expectedPeriods,
                scheduledSlots,
                unscheduledSlots
              });
            });
            
            const hasMissingPeriods = tgCoverage.some(c => c.missingPeriods > 0);
            const hasUnscheduled = tgCoverage.some(c => c.unscheduledCount > 0);
            
            return (
              <>
                {/* Alert for incomplete schedules */}
                {hasMissingPeriods && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Incomplete Schedule Detected</AlertTitle>
                    <AlertDescription>
                      Some teaching groups have fewer periods scheduled than required (HL=6, SL=4). See details below.
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Period Coverage Table */}
                {tgCoverage.length > 0 && (
                  <Card className="mb-4">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-semibold text-slate-900">📊 Period Coverage by Teaching Group</div>
                        <Badge variant={hasMissingPeriods ? "destructive" : "default"}>
                          {tgCoverage.filter(c => c.isComplete).length}/{tgCoverage.length} complete
                        </Badge>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="text-left p-3">Subject</th>
                              <th className="text-left p-3">Level</th>
                              <th className="text-center p-3">Expected</th>
                              <th className="text-center p-3">Actual</th>
                              <th className="text-center p-3">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tgCoverage.map(coverage => (
                              <tr 
                                key={coverage.tgId} 
                                className={cn(
                                  "border-b",
                                  !coverage.isComplete && "bg-red-50"
                                )}
                              >
                                <td className="p-3 font-medium">{coverage.subject_name}</td>
                                <td className="p-3">
                                  {coverage.level && (
                                    <Badge variant="outline" className="text-xs">
                                      {coverage.level}
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-3 text-center font-mono">{coverage.expectedPeriods}</td>
                                <td className="p-3 text-center font-mono">{coverage.actualPeriods}</td>
                                <td className="p-3 text-center">
                                  {coverage.isComplete ? (
                                    <Badge variant="default" className="text-xs bg-green-600">Complete</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">
                                      Missing {coverage.missingPeriods}
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Unscheduled Lessons Section */}
                {hasUnscheduled && (
                  <Card className="mb-4 border-red-300 bg-red-50">
                    <CardContent className="p-4">
                      <div className="font-semibold text-red-900 mb-3">⚠️ Unscheduled Lessons</div>
                      <Alert variant="destructive" className="mb-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Some lessons could not be scheduled. Contact your schedule coordinator.
                        </AlertDescription>
                      </Alert>
                      <div className="space-y-2">
                        {tgCoverage
                          .filter(c => c.unscheduledCount > 0)
                          .map(coverage => (
                            <div key={coverage.tgId} className="border border-red-200 rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between mb-1">
                                <div className="font-medium text-slate-900">
                                  {coverage.subject_name} {coverage.level && `(${coverage.level})`}
                                </div>
                                <Badge variant="destructive" className="text-xs">
                                  {coverage.unscheduledCount} unscheduled
                                </Badge>
                              </div>
                              <div className="text-xs text-slate-600">
                                Teaching Group: {coverage.name}
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
          
          <Card className={cn("overflow-hidden border-blue-200 shadow-sm transition-all duration-300 bg-white", isFullscreen ? "fixed inset-4 z-[100] flex flex-col shadow-2xl overflow-hidden" : "")} id={exportId}>
            <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
              <div className="text-sm font-semibold text-slate-700 pl-2">
                Emploi du temps : {selectedStudent?.full_name}
              </div>
              <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="bg-white">
                {isFullscreen ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
                <span className="hidden sm:inline">{isFullscreen ? 'Quitter plein écran' : 'Plein écran (Paysage)'}</span>
              </Button>
            </div>
            <div className="h-1 bg-blue-500" />
            <div className={cn("overflow-auto", isFullscreen ? "flex-1" : "overflow-x-auto")}>
              <div className={cn("min-w-[900px]", isFullscreen ? "min-w-[1200px]" : "")}>
                <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-white border-b-2 border-slate-300 sticky top-0 z-10 shadow-sm">
                <div className="p-3 border-r border-slate-200"></div>
                {DAYS.map(day => (
                  <div key={day} className="p-3 font-semibold text-slate-700 text-center text-sm border-r border-slate-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Dynamic periods based on actual timeslots */}
              {Array.from({ length: maxPeriodsPerDay }, (_, idx) => idx + 1).map(period => (
                <React.Fragment key={period}>
                {lunchRowsMap[period] ? (
                  <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50" style={{ minHeight: '60px' }}>
                    <div className="p-3 bg-amber-100 border-r-2 border-amber-300 flex flex-col items-center justify-center text-center">
                      <div className="text-xs font-bold text-amber-900">🍽️</div>
                      <div className="text-xs font-bold text-amber-900">Lunch</div>
                      <div className="text-[10px] text-amber-700 mt-0.5">{lunchRowsMap[period].startTime} - {lunchRowsMap[period].endTime}</div>
                    </div>
                    {DAYS.map(day => (
                      <div key={`${day}-${period}-lunch`} className="border-r-2 border-amber-300 last:border-r-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-xs font-bold text-amber-900">LUNCH BREAK</div>
                          <div className="text-[10px] text-amber-700 mt-0.5">No lessons scheduled</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-slate-200" style={{ minHeight: '60px' }}>
                  <div className="p-2 bg-slate-50 border-r border-slate-200 flex flex-col justify-center items-center text-center">
                    <div className="text-sm font-bold text-slate-800">{period}</div>
                    <div className="text-[10px] text-slate-500 mt-1 whitespace-nowrap">{periodTimes[period]}</div>
                  </div>
                  {DAYS.map(day => {
                    const event = getEventForPeriod(day, period);
                    
                    if (!event) {
                      return (
                        <div key={`${day}-${period}`} className="border-r border-slate-200 last:border-r-0 hover:bg-slate-50/50" />
                      );
                    }
                    
                    // CONFLICT EVENT: Single block showing "Conflict (n)" with tooltip
                    if (event.type === 'conflict') {
                      return (
                        <div 
                          key={`${day}-${period}`} 
                          className="border-r border-slate-200 last:border-r-0 p-2 group relative cursor-help"
                          title={`${event.count} courses scheduled at the same time`}
                        >
                          <div className="h-full bg-red-100 border-l-4 border-red-600 rounded p-2 hover:bg-red-200 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-bold text-xs text-red-900">⚠️ Conflict</div>
                              <div className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] font-bold rounded">
                                {event.count}
                              </div>
                            </div>
                            <div className="text-[10px] text-red-700">Multiple courses</div>
                          </div>
                          
                          {/* Tooltip with conflict details */}
                          <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block bg-white border-2 border-red-500 rounded-lg shadow-xl p-3 min-w-[250px]">
                            <div className="font-bold text-xs text-red-900 mb-2">
                              {event.count} courses at {event.day} Period {event.period}:
                            </div>
                            <div className="space-y-2">
                              {event.details.map((d, idx) => (
                                <div key={idx} className="text-[10px] text-slate-900 bg-slate-50 p-2 rounded">
                                  <div className="font-semibold">{d.subject} {d.level && `(${d.level})`}</div>
                                  <div className="text-slate-600">👤 {d.teacher}</div>
                                  <div className="text-slate-600">📍 {d.room}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // SINGLE EVENT (normal case)
                    const slot = event.slot;
                    let { subject, teacher, room, level } = resolveSlotMeta(slot);

                    if (!slot.subject_id && slot.notes?.includes('Test')) {
                      subject = { name: 'Test/Assessment', ib_group: null };
                      teacher = null;
                      level = '';
                    }

                    const isTestSlot = slot.notes?.includes('Test');
                    
                    const colorData = isTestSlot 
                      ? { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-900', badge: 'bg-red-100 text-red-800' }
                      : getSubjectColor(subject?.name);

                    return (
                      <div key={`${day}-${period}`} className="border-r border-slate-200 last:border-r-0 p-1.5 hover:bg-slate-50/50 transition-colors">
                        {slot.is_break ? (
                          <div className="h-full p-2 rounded-md border-l-4 shadow-sm bg-amber-50 border-amber-400 text-amber-900 flex flex-col items-center justify-center cursor-default">
                            <div className="font-bold text-xs text-center leading-tight">🍽️ {slot.notes || 'Lunch Break'}</div>
                          </div>
                        ) : subject ? (
                          <div className={`h-full p-2 rounded-md border-l-4 shadow-sm hover:shadow hover:scale-[1.02] transition-all duration-200 cursor-default ${colorData.bg} ${colorData.border}`}>
                            <div className={`font-bold text-xs leading-tight line-clamp-2 mb-1 ${colorData.text}`}>
                              {subject.name}
                            </div>
                            {level && (
                              <div className={`inline-block mb-1 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide ${colorData.badge}`}>
                                {level}
                              </div>
                            )}
                            {teacher && <div className={`text-[10px] font-medium opacity-80 truncate ${colorData.text}`}>👤 {teacher.full_name}</div>}
                            {room && <div className={`text-[10px] font-medium opacity-80 truncate ${colorData.text}`}>📍 {room?.name}</div>}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                )}
                {/* Break rows from scheduleSettings.breaks */}
                {breakRows.filter(br => br.afterPeriod === period).map(breakRow => (
                  <div key={breakRow.id} className={`grid grid-cols-[80px_repeat(5,1fr)] border-b-2 ${breakRow.borderColor} bg-gradient-to-r ${breakRow.colorFrom} ${breakRow.colorTo}`} style={{ minHeight: '50px' }}>
                    <div className={`p-3 ${breakRow.bgColor} border-r-2 ${breakRow.borderColor} flex flex-col items-center justify-center text-center`}>
                      <div className={`text-xs font-bold ${breakRow.textColor}`}>{breakRow.emoji}</div>
                      <div className={`text-xs font-bold ${breakRow.textColor}`}>{breakRow.label}</div>
                    </div>
                    {DAYS.map(day => (
                      <div key={`${day}-${breakRow.id}`} className={`border-r-2 ${breakRow.borderColor} last:border-r-0 flex items-center justify-center bg-opacity-50`}>
                        <div className="text-center">
                          <div className={`text-xs font-bold ${breakRow.textColor}`}>{breakRow.label.toUpperCase()}</div>
                          <div className="text-[10px] text-slate-700 mt-0.5">{breakRow.startTime} - {breakRow.endTime}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        </Card>
        </>
      )}
    </div>
  );
}