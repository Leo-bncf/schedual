import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

// Calculate period times dynamically from dayStartTime + periodDurationMinutes
const calculatePeriodTimes = (dayStartTime = '08:00', periodDurationMinutes = 60, periodsPerDay = 8) => {
  const times = {};
  const [startHour, startMin] = (dayStartTime || '08:00').split(':').map(Number);
  let totalMinutes = startHour * 60 + startMin;
  
  for (let i = 1; i <= periodsPerDay; i++) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    times[i] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    totalMinutes += (periodDurationMinutes || 60);
  }
  
  return times;
};

const subjectGroupColors = {
  '1': { bg: 'bg-purple-100', border: 'border-l-purple-600', text: 'text-purple-900', name: 'Language & Literature' },
  '2': { bg: 'bg-sky-100', border: 'border-l-sky-600', text: 'text-sky-900', name: 'Language Acquisition' },
  '3': { bg: 'bg-emerald-100', border: 'border-l-emerald-600', text: 'text-emerald-900', name: 'Individuals & Societies' },
  '4': { bg: 'bg-amber-100', border: 'border-l-amber-600', text: 'text-amber-900', name: 'Sciences' },
  '5': { bg: 'bg-orange-100', border: 'border-l-orange-600', text: 'text-orange-900', name: 'Mathematics' },
  '6': { bg: 'bg-pink-100', border: 'border-l-pink-600', text: 'text-pink-900', name: 'The Arts' },
};

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function TimetableGrid({ 
  slots = [], 
  groups = [], 
  rooms = [], 
  subjects = [], 
  teachers = [], 
  classGroups = [], 
  periodsPerDay = 8, 
  breakPeriods = [], 
  lunchPeriod = 4, 
  onSlotClick, 
  onUpdateSlot,
  exportId = "timetable-grid",
  dayStartTime = '08:00',
  dayEndTime = '18:00',
  periodDurationMinutes = 60,
  timeslots = []
}) {
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({});
  
  // Build timeslot index: timeslot_id → UI row position (chronological per day, includes breaks)
  const DAY_MAP = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };
  const normalizeDay = (d) => {
    if (!d) return d;
    const up = String(d).toUpperCase();
    if (DAY_MAP[up]) return DAY_MAP[up];
    return String(d).charAt(0).toUpperCase() + String(d).slice(1).toLowerCase();
  };
  
  const timeslotToPosition = React.useMemo(() => {
    const map = {};
    const timeslotsByDay = {};
    
    // Group timeslots by day and sort chronologically
    DAYS.forEach(day => {
      const dayUpper = day.toUpperCase();
      timeslotsByDay[day] = (timeslots || [])
        .filter(t => t.dayOfWeek === dayUpper)
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    });
    
    // Map each timeslot to its UI row position (1-based, chronological)
    // CRITICAL: Use String(ts.id) as key to avoid NaN when timeslot_id is UUID/string
    Object.values(timeslotsByDay).forEach(daySlots => {
      daySlots.forEach((ts, idx) => {
        map[String(ts.id)] = idx + 1;
      });
    });
    
    return map;
  }, [timeslots]);
  
  const periodTimes = React.useMemo(() => {
    const times = {};
    // Build from actual timeslots for accurate display
    timeslots.forEach(ts => {
      const position = timeslotToPosition[ts.id];
      if (position && !times[position]) {
        times[position] = ts.startTime || '';
      }
    });
    return times;
  }, [timeslots, timeslotToPosition]);

  const normalizedSlots = React.useMemo(() => {
    console.log('[TimetableGrid] DEBUG - timeslots.length:', timeslots.length);
    console.log('[TimetableGrid] DEBUG - timeslots[0]:', timeslots[0]);
    console.log('[TimetableGrid] DEBUG - slots.length:', slots.length);
    console.log('[TimetableGrid] DEBUG - slots[0] keys:', Object.keys(slots[0] || {}));
    console.log('[TimetableGrid] DEBUG - slots[0]:', slots[0]);
    console.log('[TimetableGrid] DEBUG - timeslotToPosition sample:', Object.entries(timeslotToPosition).slice(0, 5));
    
    // DEBUG COUNTERS: Track mapping failures
    let invalidTimeslotIdCount = 0;
    let missingDayCount = 0;
    let successfullyMappedCount = 0;
    
    const normalized = (slots || []).map(s => {
      let day = normalizeDay(s.day || s.day_of_week || s.dayOfWeek);
      // FIX BUG #1: Use String(s.timeslot_id) instead of Number() to avoid NaN
      let uiRow = s.timeslot_id ? timeslotToPosition[String(s.timeslot_id)] : s.period;
      
      // FALLBACK 1: Derive day from timeslot if missing
      if (!day && s.timeslot_id) {
        const ts = timeslots.find(t => String(t.id) === String(s.timeslot_id));
        if (ts?.dayOfWeek) {
          day = normalizeDay(ts.dayOfWeek);
          console.log(`[TimetableGrid] FALLBACK: Derived day="${day}" from timeslot_id=${s.timeslot_id}`);
        }
      }
      
      // FALLBACK 2: Derive uiRow from timeslot position if undefined
      if (!uiRow && s.timeslot_id) {
        const tsId = String(s.timeslot_id);
        if (timeslotToPosition[tsId]) {
          uiRow = timeslotToPosition[tsId];
          console.log(`[TimetableGrid] FALLBACK: Derived uiRow=${uiRow} from timeslot_id=${s.timeslot_id}`);
        } else {
          invalidTimeslotIdCount++;
          console.warn(`[TimetableGrid] ❌ Invalid timeslot_id=${s.timeslot_id} (type: ${typeof s.timeslot_id}) not in timeslotToPosition map`);
        }
      }
      
      // FALLBACK 3: Use period as uiRow if still undefined (no upper limit check - let it render)
      if (!uiRow && s.period) {
        uiRow = s.period;
        console.log(`[TimetableGrid] FALLBACK: Using period=${s.period} as uiRow`);
      }
      
      // COUNT FAILURES
      if (!day) {
        missingDayCount++;
        console.warn(`[TimetableGrid] ❌ Missing day for slot:`, s);
      }
      if (!uiRow) {
        console.warn(`[TimetableGrid] ❌ Missing uiRow for slot (timeslot_id=${s.timeslot_id}, period=${s.period}):`, s);
      }
      if (day && uiRow) {
        successfullyMappedCount++;
      }
      
      return {
        ...s,
        day,
        uiRow,
      };
    });
    
    console.log('[TimetableGrid] 📊 MAPPING DIAGNOSTICS:', {
      totalSlots: slots.length,
      successfullyMapped: successfullyMappedCount,
      invalidTimeslotId: invalidTimeslotIdCount,
      missingDay: missingDayCount,
      unmappable: slots.length - successfullyMappedCount
    });
    
    return normalized;
  }, [slots, timeslotToPosition, timeslots]);

  const getSlotData = (day, uiRow) => {
    return normalizedSlots.filter(s => s.day === day && s.uiRow === uiRow);
  };

  const getGroupInfo = (groupId) => {
    return groups.find(g => g.id === groupId);
  };

  const getRoomInfo = (roomId) => {
    return rooms.find(r => r.id === roomId);
  };

  const getSubjectInfo = (subjectId) => {
    return subjects.find(s => s.id === subjectId);
  };

  const getTeacherInfo = (teacherId) => {
    return teachers.find(t => t.id === teacherId);
  };

  // FIX BUG #2: Calculate actual periods needed based on timeslots per day (not just config)
  const computedPeriodsPerDay = React.useMemo(() => {
    if (!timeslots || timeslots.length === 0) return periodsPerDay;
    
    // Count timeslots per day
    const countsPerDay = {};
    DAYS.forEach(day => {
      const dayUpper = day.toUpperCase();
      countsPerDay[day] = timeslots.filter(t => t.dayOfWeek === dayUpper).length;
    });
    
    const maxTimeslotsPerDay = Math.max(...Object.values(countsPerDay), 0);
    
    // Also check max period in normalized slots
    const maxPeriodInSlots = normalizedSlots.reduce((max, s) => Math.max(max, s.uiRow || 0), 0);
    
    const computed = Math.max(periodsPerDay, maxTimeslotsPerDay, maxPeriodInSlots);
    
    if (computed > periodsPerDay) {
      console.warn(`[TimetableGrid] ⚠️ GRID EXPANSION: periodsPerDay=${periodsPerDay} but timeslots/slots require ${computed} rows. Expanding grid to prevent hiding slots.`);
    }
    
    console.log('[TimetableGrid] 📊 GRID SIZE DIAGNOSTIC:', {
      configPeriodsPerDay: periodsPerDay,
      maxTimeslotsPerDay,
      maxPeriodInSlots,
      computedPeriodsPerDay: computed,
      countsPerDay
    });
    
    return computed;
  }, [timeslots, periodsPerDay, normalizedSlots]);

  const activePeriods = Array.from({ length: computedPeriodsPerDay }, (_, i) => i + 1);

  const getSlotSpan = (day, period, slotId) => {
    const currentSlots = getSlotData(day, period);
    const currentSlot = currentSlots.find(s => s.id === slotId);
    if (!currentSlot) return 1;

    let span = 1;
    let checkPeriod = period + 1;
    
    // Use computedPeriodsPerDay instead of periodsPerDay to allow spans beyond config limit
    while (checkPeriod <= computedPeriodsPerDay) {
      const nextSlots = getSlotData(day, checkPeriod);
      if (nextSlots.some(s => s.teaching_group_id === currentSlot.teaching_group_id)) {
        span++;
        checkPeriod++;
      } else {
        break;
      }
    }
    
    return span;
  };

  const shouldSkipCell = (day, period, slotId) => {
    for (let p = period - 1; p >= 1; p--) {
      const prevSlots = getSlotData(day, p);
      const prevSlot = prevSlots.find(s => s.id === slotId);
      if (prevSlot) {
        const span = getSlotSpan(day, p, slotId);
        if (p + span > period) {
          return true;
        }
      }
    }
    return false;
  };

  const handleSlotClick = (slot) => {
    if (!slot) return;
    
    let group, subject, teacher;
    
    // DP style: teaching_group_id on slot (check this first!)
    if (slot.teaching_group_id) {
      group = getGroupInfo(slot.teaching_group_id);
      subject = group ? getSubjectInfo(group.subject_id) : null;
      teacher = group ? getTeacherInfo(group.teacher_id) : null;
    }
    // PYP/MYP style: direct subject_id on slot
    else if (slot.subject_id) {
      const classGroup = classGroups.find(cg => cg.id === slot.classgroup_id);
      subject = getSubjectInfo(slot.subject_id);
      teacher = slot.teacher_id ? getTeacherInfo(slot.teacher_id) : null;
      
      // Create a group-like object for modal compatibility
      group = {
        name: classGroup?.name || 'Class',
        level: classGroup?.year_group || subject?.ib_level,
        student_ids: classGroup?.student_ids || []
      };
    }
    // Fallback: slot with direct teacher_id only
    else if (slot.teacher_id) {
      teacher = getTeacherInfo(slot.teacher_id);
    }
    
    const room = getRoomInfo(slot.room_id);
    setSelectedSlot({ slot, group, room, subject, teacher });
    setIsEditing(false);
  };

  // Calculate mapping diagnostics for display
  const mappingDiagnostics = React.useMemo(() => {
    const invalidTimeslotId = normalizedSlots.filter(s => 
      s.timeslot_id && !timeslotToPosition[Number(s.timeslot_id)]
    ).length;
    
    const missingDay = normalizedSlots.filter(s => !s.day).length;
    
    const unmappable = normalizedSlots.filter(s => !s.day || !s.uiRow).length;
    
    return {
      totalSlots: slots.length,
      rendered: normalizedSlots.filter(s => s.day && s.uiRow).length,
      invalidTimeslotId,
      missingDay,
      unmappable
    };
  }, [normalizedSlots, timeslotToPosition, slots.length]);

  return (
    <>
      <div className="mb-3 space-y-2">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
          <div className="grid grid-cols-3 gap-4 font-mono">
            <div>
              <span className="font-bold">dayStartTime:</span> {dayStartTime}
            </div>
            <div>
              <span className="font-bold">periodDurationMinutes:</span> {periodDurationMinutes}
            </div>
            <div>
              <span className="font-bold">dayEndTime:</span> {dayEndTime}
            </div>
          </div>
        </div>
        
        {/* MAPPING DIAGNOSTICS */}
        {mappingDiagnostics.unmappable > 0 && (
          <div className="p-3 bg-rose-100 border-2 border-rose-400 rounded-lg text-xs space-y-2">
            <div className="font-bold text-rose-900 flex items-center gap-2">
              <span>⚠️ UI MAPPING FAILURE:</span>
              <Badge variant="destructive">{mappingDiagnostics.unmappable} slots non rendus</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-rose-900">
              <div>
                <span className="font-semibold">Total slots:</span> {mappingDiagnostics.totalSlots}
              </div>
              <div>
                <span className="font-semibold">Rendered:</span> {mappingDiagnostics.rendered}
              </div>
              <div>
                <span className="font-semibold">Unmappable:</span> {mappingDiagnostics.unmappable}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-2 bg-white rounded border border-rose-300">
                <span className="font-semibold">Invalid timeslot_id:</span> {mappingDiagnostics.invalidTimeslotId}
              </div>
              <div className="p-2 bg-white rounded border border-rose-300">
                <span className="font-semibold">Missing day:</span> {mappingDiagnostics.missingDay}
              </div>
            </div>
            <div className="text-[10px] text-rose-800 bg-white p-2 rounded border border-rose-300 mt-2">
              Ces slots existent dans ScheduleSlot mais ne peuvent pas être affichés. Vérifier: timeslot_id valide, day présent.
            </div>
          </div>
        )}
        
        {mappingDiagnostics.unmappable === 0 && mappingDiagnostics.totalSlots > 0 && (
          <div className="p-2 bg-green-100 border border-green-300 rounded-lg text-xs text-green-900">
            <span className="font-semibold">✅ All {mappingDiagnostics.totalSlots} slots successfully mapped and rendered</span>
          </div>
        )}
      </div>
      
      <Card className="overflow-hidden border-0 shadow-sm" id={exportId}>
        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* Header Row */}
            <div className="grid grid-cols-[100px_repeat(5,1fr)] bg-slate-100 border-b-2 border-slate-300">
              <div className="p-4 font-bold text-slate-700 text-base border-r border-slate-300">Time</div>
              {DAYS.map(day => (
                <div key={day} className="p-4 font-bold text-slate-700 text-center text-base border-r border-slate-300 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Period Rows */}
            {activePeriods.map(uiRow => (
              <React.Fragment key={uiRow}>
                <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b border-slate-300">
                  <div className="p-4 bg-slate-50 border-r border-slate-300 flex flex-col justify-center min-h-[120px]">
                    <div className="text-sm font-semibold text-slate-700">Period {uiRow}</div>
                    <div className="text-sm text-slate-500 mt-1">{periodTimes[uiRow]}</div>
                  </div>
                {DAYS.map(day => {
                  const slotsInCell = getSlotData(day, uiRow);
                  
                  if (slotsInCell.length === 0) {
                    return (
                      <div 
                        key={`${day}-${uiRow}`} 
                        className="border-r border-slate-300 last:border-r-0 min-h-[120px] bg-slate-50/50"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const sourceSlotId = e.dataTransfer.getData('slotId');
                          const sourceDay = e.dataTransfer.getData('sourceDay');
                          const sourcePeriod = parseInt(e.dataTransfer.getData('sourcePeriod'));
                          
                          onSlotClick?.(day, uiRow, { 
                            action: 'move', 
                            sourceSlotId, 
                            sourceDay,
                            sourcePeriod,
                            targetDay: day,
                            targetPeriod: uiRow
                          });
                        }}
                      />
                    );
                  }

                  // Filter out slots that should be skipped due to spanning
                  const visibleSlots = slotsInCell.filter(slot => !shouldSkipCell(day, uiRow, slot.id));

                  if (visibleSlots.length === 0) {
                    return null;
                  }

                  // MULTI-LESSON DISPLAY: Show all visible slots in this cell
                  const displayCount = Math.min(visibleSlots.length, 2); // Show max 2 cards
                  const remainingCount = visibleSlots.length - displayCount;

                  return (
                    <div 
                      key={`${day}-${uiRow}`} 
                      className="border-r border-slate-300 last:border-r-0 p-2 space-y-1 relative"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceSlotId = e.dataTransfer.getData('slotId');
                        const sourceDay = e.dataTransfer.getData('sourceDay');
                        const sourcePeriod = parseInt(e.dataTransfer.getData('sourcePeriod'));
                        
                        // Check if dropping on a slot or empty space
                        const targetSlot = visibleSlots[0];
                        if (sourceSlotId !== targetSlot?.id) {
                          onSlotClick?.(day, uiRow, { 
                            action: targetSlot ? 'swap' : 'move', 
                            sourceSlotId, 
                            targetSlotId: targetSlot?.id,
                            sourceDay,
                            sourcePeriod,
                            targetDay: day,
                            targetPeriod: uiRow
                          });
                        }
                      }}
                    >
                      {/* Show first N lessons as cards */}
                      {visibleSlots.slice(0, displayCount).map(slot => {
                        const span = getSlotSpan(day, uiRow, slot.id);
                        const room = getRoomInfo(slot.room_id);
                        
                        let subject = null;
                        let teacher = null;
                        let level = '';
                        let displayName = '';
                        
                        // DP style: teaching_group_id on slot (check this first!)
                        if (slot.teaching_group_id) {
                          const group = getGroupInfo(slot.teaching_group_id);
                          if (group) {
                            subject = getSubjectInfo(group.subject_id);
                            teacher = getTeacherInfo(group.teacher_id);
                            level = group.level;
                            displayName = group.name;
                          }
                        }
                        // PYP/MYP style: subject_id directly on slot
                        else if (slot.subject_id) {
                          subject = getSubjectInfo(slot.subject_id);
                          teacher = slot.teacher_id ? getTeacherInfo(slot.teacher_id) : null;
                          const classGroup = classGroups.find(cg => cg.id === slot.classgroup_id);
                          level = classGroup?.ib_programme || '';
                          displayName = classGroup?.name || '';
                        }
                        // Fallback: slot with direct teacher_id only
                        else if (slot.teacher_id) {
                          teacher = getTeacherInfo(slot.teacher_id);
                        }
                        
                        const colorScheme = subject && subjectGroupColors[subject.ib_group] 
                          ? subjectGroupColors[subject.ib_group] 
                          : { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-900' };

                        return (
                          <div 
                            key={slot.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('slotId', slot.id);
                              e.dataTransfer.setData('sourceDay', day);
                              e.dataTransfer.setData('sourcePeriod', String(uiRow));
                            }}
                            className="cursor-move hover:shadow-lg hover:scale-105 transition-all rounded-lg overflow-hidden group"
                            onClick={() => handleSlotClick(slot)}
                          >
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <div className="px-1.5 py-0.5 bg-white/90 rounded shadow text-[10px] font-bold text-slate-600">⋮⋮</div>
                            </div>
                            {subject && (
                              <div className={`p-3 border-l-4 ${colorScheme.bg} ${colorScheme.border} border border-slate-200 relative`}>
                                <div className="font-bold text-sm text-slate-900 leading-tight mb-1.5">
                                  {subject.name}
                                </div>
                                <Badge variant="outline" className="w-fit mb-2 bg-white/70 font-semibold text-xs">
                                  {level}
                                </Badge>
                                <div className="text-xs text-slate-700 space-y-1">
                                  {teacher ? (
                                    <div className="font-medium">👤 {teacher.full_name}</div>
                                  ) : (
                                    <div className="font-medium text-amber-600">👤 No teacher assigned</div>
                                  )}
                                  <div className="font-medium">📍 {room?.name || 'TBD'}</div>
                                </div>
                                {span > 1 && (
                                  <div className="mt-2 text-xs text-slate-500 font-medium">
                                    {span} periods
                                  </div>
                                )}
                              </div>
                            )}

                            {!subject && slot.notes?.includes('Study') && (
                              <div className="p-3 border-l-4 border-slate-400 bg-slate-50 border border-slate-200">
                                <div className="font-bold text-sm text-slate-700 leading-tight mb-1.5">
                                  Study / Free Period
                                </div>
                                <div className="text-xs text-slate-500">Self-study time</div>
                              </div>
                            )}

                            {!subject && !slot.notes?.includes('Study') && (slot.notes?.includes('Test') || slot.notes?.includes('Assessment')) && (
                              <div className="p-3 border-l-4 border-red-400 bg-red-50 border border-red-200">
                                <div className="font-bold text-sm text-red-900 leading-tight mb-1.5">
                                  📝 {slot.notes}
                                </div>
                                <div className="text-xs text-red-700">
                                  Assessment Period
                                </div>
                              </div>
                            )}

                            {!subject && !slot.notes?.includes('Study') && !(slot.notes?.includes('Test') || slot.notes?.includes('Assessment')) && (
                              <div className="p-3 border-l-4 border-slate-300 bg-slate-50 border border-slate-200">
                                <div className="font-bold text-sm text-slate-600 leading-tight mb-1.5">
                                  Unassigned Class
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                  {teacher ? (
                                    <div className="font-medium">👤 {teacher.full_name}</div>
                                  ) : (
                                    <div className="font-medium text-amber-600">👤 No teacher assigned</div>
                                  )}
                                  <div className="font-medium">📍 {room?.name || 'TBD'}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {/* "+N more" badge if there are remaining lessons */}
                      {remainingCount > 0 && (
                        <button
                          onClick={() => {
                            // Show all lessons in this cell
                            const allLessons = visibleSlots.map(slot => {
                              let subject = null;
                              let teacher = null;
                              let level = '';
                              
                              if (slot.teaching_group_id) {
                                const group = getGroupInfo(slot.teaching_group_id);
                                if (group) {
                                  subject = getSubjectInfo(group.subject_id);
                                  teacher = getTeacherInfo(group.teacher_id);
                                  level = group.level;
                                }
                              } else if (slot.subject_id) {
                                subject = getSubjectInfo(slot.subject_id);
                                teacher = slot.teacher_id ? getTeacherInfo(slot.teacher_id) : null;
                                const classGroup = classGroups.find(cg => cg.id === slot.classgroup_id);
                                level = classGroup?.year_group || '';
                              }
                              
                              const room = getRoomInfo(slot.room_id);
                              return { slot, subject, teacher, level, room };
                            });
                            
                            setSelectedSlot({ 
                              multiple: true, 
                              lessons: allLessons, 
                              day, 
                              period: uiRow 
                            });
                          }}
                          className="w-full px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded text-xs font-semibold text-slate-700 transition-colors"
                        >
                          +{remainingCount} more
                        </button>
                      )}
                    </div>
                  );
                })}
                </div>
                
                {/* Break Row */}
                {breakPeriods.includes(uiRow) && (
                  <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b-2 border-blue-300 bg-gradient-to-r from-blue-50 to-cyan-50">
                    <div className="p-3 bg-blue-100 border-r border-blue-300 flex flex-col justify-center">
                      <div className="text-sm font-bold text-blue-900">☕ Break</div>
                      <div className="text-xs text-blue-700 mt-1">15 min</div>
                    </div>
                    {DAYS.map(day => (
                      <div key={`${day}-break-${uiRow}`} className="p-3 border-r border-blue-200 last:border-r-0 flex items-center justify-center">
                        <span className="text-blue-700 font-medium text-sm">Short Break</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Lunch Break Row */}
                {uiRow === lunchPeriod && (
                  <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="p-4 bg-amber-100 border-r border-amber-300 flex flex-col justify-center">
                      <div className="text-sm font-bold text-amber-900">🍽️ Lunch</div>
                      <div className="text-sm text-amber-700 mt-1">12:30 - 13:00</div>
                    </div>
                    {DAYS.map(day => (
                      <div key={`${day}-lunch`} className="p-4 border-r border-amber-200 last:border-r-0 flex items-center justify-center">
                        <span className="text-amber-700 font-medium text-sm">Lunch Break</span>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </Card>

      {/* Slot Details Modal - supports single or multiple lessons */}
      {selectedSlot && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSlot(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedSlot.multiple ? (
              // MULTIPLE LESSONS VIEW
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-slate-900 mb-2">
                      Parallel Lessons ({selectedSlot.lessons.length})
                    </h3>
                    <p className="text-slate-500 text-lg">
                      {selectedSlot.day}, Period {selectedSlot.period}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedSlot(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {selectedSlot.lessons.map((lesson, idx) => {
                    const colorScheme = lesson.subject && subjectGroupColors[lesson.subject.ib_group] 
                      ? subjectGroupColors[lesson.subject.ib_group] 
                      : { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-900' };

                    return (
                      <div 
                        key={idx}
                        className={`p-4 rounded-lg border-l-4 ${colorScheme.bg} ${colorScheme.border} border border-slate-200`}
                      >
                        <div className="font-bold text-lg text-slate-900 mb-2">
                          {lesson.subject?.name || lesson.slot.notes || 'Unassigned'}
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-slate-500 font-medium">Level</div>
                            <div className="font-semibold text-slate-900">{lesson.level || 'N/A'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 font-medium">Teacher</div>
                            <div className="font-semibold text-slate-900">{lesson.teacher?.full_name || 'Unassigned'}</div>
                          </div>
                          <div>
                            <div className="text-slate-500 font-medium">Room</div>
                            <div className="font-semibold text-slate-900">{lesson.room?.name || 'TBD'}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              // SINGLE LESSON VIEW
              <>
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-3xl font-bold text-slate-900">
                        {selectedSlot.subject?.name || selectedSlot.slot?.notes || 'Slot'}
                      </h3>
                      {!isEditing && onUpdateSlot && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setIsEditing(true);
                            setEditForm({
                              teacher_id: selectedSlot.slot?.teacher_id || 'unassigned',
                              room_id: selectedSlot.slot?.room_id || 'unassigned'
                            });
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </div>
                    <p className="text-slate-500 text-lg">
                      {selectedSlot.slot?.day}, Period {selectedSlot.slot?.uiRow || selectedSlot.slot?.period}
                    </p>
                  </div>
                  <button 
                    onClick={() => { setSelectedSlot(null); setIsEditing(false); }}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                  >
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                    <div className="text-sm font-semibold text-slate-600 mb-2">Level</div>
                    <div className="text-xl font-bold text-slate-900">{selectedSlot.group?.level}</div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                    <div className="text-sm font-semibold text-blue-600 mb-2">Teacher</div>
                    {isEditing ? (
                      <Select 
                        value={editForm.teacher_id} 
                        onValueChange={(val) => setEditForm(prev => ({ ...prev, teacher_id: val }))}
                      >
                        <SelectTrigger className="w-full bg-white text-lg h-12">
                          <SelectValue placeholder="Select teacher" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {teachers.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        <div className="text-xl font-bold text-blue-900">
                          {selectedSlot.teacher?.full_name || 'Not assigned'}
                        </div>
                        {selectedSlot.teacher?.email && (
                          <div className="text-sm text-blue-700 mt-2">{selectedSlot.teacher.email}</div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                    <div className="text-sm font-semibold text-emerald-600 mb-2">Room</div>
                    {isEditing ? (
                      <Select 
                        value={editForm.room_id} 
                        onValueChange={(val) => setEditForm(prev => ({ ...prev, room_id: val }))}
                      >
                        <SelectTrigger className="w-full bg-white text-lg h-12">
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {rooms.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name} ({r.capacity} cap)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
                        <div className="text-xl font-bold text-emerald-900">
                          {selectedSlot.room?.name || 'Not assigned'}
                        </div>
                        {selectedSlot.room?.building && (
                          <div className="text-sm text-emerald-700 mt-2">
                            Building {selectedSlot.room.building}
                            {selectedSlot.room.floor && `, Floor ${selectedSlot.room.floor}`}
                          </div>
                        )}
                        {selectedSlot.room?.capacity && (
                          <div className="text-sm text-emerald-700 mt-1">
                            Capacity: {selectedSlot.room.capacity} students
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-5 border border-violet-200">
                    <div className="text-sm font-semibold text-violet-600 mb-2">Group Details</div>
                    <div className="text-lg font-bold text-violet-900">{selectedSlot.group?.name}</div>
                    {selectedSlot.group?.student_ids?.length > 0 && (
                      <div className="text-sm text-violet-700 mt-2">
                        {selectedSlot.group.student_ids.length} students enrolled
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-3 pt-4">
                      <Button 
                        size="lg"
                        onClick={() => {
                          if (confirm('Save these changes?')) {
                            const newTeacherId = editForm.teacher_id === 'unassigned' ? null : editForm.teacher_id;
                            const newRoomId = editForm.room_id === 'unassigned' ? null : editForm.room_id;
                            onUpdateSlot?.(selectedSlot.slot.id, {
                              teacher_id: newTeacherId,
                              room_id: newRoomId
                            });
                            setIsEditing(false);
                            // Optimistically update local view
                            const updatedSlot = { 
                              ...selectedSlot.slot,
                              teacher_id: newTeacherId,
                              room_id: newRoomId
                            };
                            setSelectedSlot({
                              ...selectedSlot,
                              slot: updatedSlot,
                              teacher: teachers.find(t => t.id === newTeacherId) || null,
                              room: rooms.find(r => r.id === newRoomId) || null
                            });
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Save Changes
                      </Button>
                      <Button 
                        size="lg"
                        variant="outline" 
                        onClick={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}

            <button
              onClick={() => { setSelectedSlot(null); setIsEditing(false); }}
              className="w-full mt-6 px-6 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}