import React from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentScheduleView({ students, slots, groups, subjects, teachers, rooms, selectedStudentId, onStudentChange, exportId = "student-schedule", unassignedBySubjectCode = {}, timeslots = [], scheduleSettings = {} }) {
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  
  // DYNAMIC PERIOD CALCULATION: Derive from timeslots, not hardcoded
  const DAY_MAP = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };
  
  const { timeslotToPosition, periodTimes, maxPeriodsPerDay, breakRows } = React.useMemo(() => {
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
        if (!times[uiRow]) times[uiRow] = ts.startTime;
      });
    });
    
    // Parse breaks from scheduleSettings
    const breaks = Array.isArray(scheduleSettings?.breaks) ? scheduleSettings.breaks : [];
    const breakRowsData = breaks.map((br, idx) => ({
      id: `break-${idx}`,
      label: idx === 0 ? 'Break' : 'Lunch',
      emoji: idx === 0 ? '☕' : '🍽️',
      startTime: br.start,
      endTime: br.end,
      colorFrom: idx === 0 ? 'from-sky-100' : 'from-amber-100',
      colorTo: idx === 0 ? 'to-blue-100' : 'to-orange-100',
      borderColor: idx === 0 ? 'border-sky-300' : 'border-amber-300',
      bgColor: idx === 0 ? 'bg-sky-200' : 'bg-amber-200',
      textColor: idx === 0 ? 'text-sky-900' : 'text-amber-900'
    }));
    
    return { timeslotToPosition: map, periodTimes: times, maxPeriodsPerDay: maxPeriods, breakRows: breakRowsData };
  }, [timeslots, scheduleSettings]);

  const getStudentSlots = (studentId) => {
    const student = students.find(s => s.id === studentId);
    const matchedSlots = slots.filter(slot => {
      // PYP/MYP: match by classgroup_id
      if (slot.classgroup_id && student?.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }
      // DP test slots: include DP1/DP2 test slots by year_group marker in notes
      if (slot?.notes?.includes('Test') && (slot?.notes?.includes('DP1') || slot?.notes?.includes('DP2'))) {
        return student?.year_group && slot.notes.includes(student.year_group);
      }
      // DP: check membership in teaching group
      if (slot.teaching_group_id) {
        const group = groups.find(g => g.id === slot.teaching_group_id);
        const inGroup = group?.student_ids?.includes(studentId);
        if (inGroup) return true;
        
        // CRITICAL FIX: Include core subjects (TOK/CAS/EE) for same DP year
        // Core TGs may not have student_ids populated, but should be included for all DP students in that year
        const subject = subjects.find(s => s.id === group?.subject_id);
        const coreSubjects = ['TOK', 'CAS', 'EE'];
        const isCoreSubject = subject && (subject.is_core || coreSubjects.some(c => 
          subject.code?.toUpperCase().includes(c) || subject.name?.toUpperCase().includes(c)
        ));
        
        if (isCoreSubject && student?.year_group && group?.year_group) {
          // Normalize year_group to support both "DP1,DP2" and "DP1+DP2" formats
          const groupYears = String(group.year_group).split(/[,+]/).map(y => y.trim());
          return groupYears.includes(student.year_group);
        }
      }
      
      return false;
    });

    // Diagnostic 3: Log teaching group IDs used for this student
    const tgIds = new Set(matchedSlots.filter(s => s.teaching_group_id).map(s => s.teaching_group_id));
    console.log(`[StudentScheduleView] Student ${student?.full_name} (${student?.year_group}):`, {
      teaching_group_ids_matched: Array.from(tgIds),
      total_slots: matchedSlots.length,
      core_slots: matchedSlots.filter(s => {
        const group = groups.find(g => g.id === s.teaching_group_id);
        const subject = subjects.find(sub => sub.id === group?.subject_id);
        return subject && (subject.is_core || ['TOK','CAS','EE'].some(c => 
          subject.code?.toUpperCase().includes(c) || subject.name?.toUpperCase().includes(c)
        ));
      }).length
    });

    return matchedSlots;
  };

  const studentSlots = selectedStudent ? getStudentSlots(selectedStudent.id) : [];

  const getSlotForPeriod = (day, uiRow) => {
    return studentSlots.find(s => {
      const slotUiRow = s.timeslot_id ? timeslotToPosition[Number(s.timeslot_id)]?.uiRow : s.period;
      return s.day === day && slotUiRow === uiRow;
    });
  };
  
  // Debug logging
  React.useEffect(() => {
    if (selectedStudent) {
      console.log('[StudentScheduleView] DEBUG - timeslots.length:', timeslots.length);
      console.log('[StudentScheduleView] DEBUG - timeslots[0]:', timeslots[0]);
      console.log('[StudentScheduleView] DEBUG - studentSlots.length:', studentSlots.length);
      console.log('[StudentScheduleView] DEBUG - studentSlots[0] keys:', Object.keys(studentSlots[0] || {}));
      console.log('[StudentScheduleView] DEBUG - studentSlots sample:', studentSlots.slice(0, 3));
      console.log('[StudentScheduleView] DEBUG - timeslotToPosition sample:', Object.entries(timeslotToPosition).slice(0, 5));
    }
  }, [selectedStudent, studentSlots, timeslots, timeslotToPosition]);

  const subjectColors = {
    1: 'bg-blue-200/80 border-blue-400',
    2: 'bg-emerald-200/80 border-emerald-400',
    3: 'bg-amber-200/80 border-amber-400',
    4: 'bg-rose-200/80 border-rose-400',
    5: 'bg-violet-200/80 border-violet-400',
    6: 'bg-cyan-200/80 border-cyan-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <GraduationCap className="w-5 h-5 text-indigo-600" />
        <Select value={selectedStudentId || ''} onValueChange={onStudentChange}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a student..." />
          </SelectTrigger>
          <SelectContent>
            {students.map(student => (
              <SelectItem key={student.id} value={student.id}>
                {student.full_name} ({student.year_group})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedStudent && (
          <Badge variant="outline">{studentSlots.length} periods per week</Badge>
        )}
        {selectedStudent && (
          (() => {
            const warnCore = (unassignedBySubjectCode?.TOK || 0) + (unassignedBySubjectCode?.CAS || 0) + (unassignedBySubjectCode?.EE || 0);
            if (warnCore > 0) {
              return (
                <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">
                  Warning: core lessons unassigned (TOK/CAS/EE) — check OR-Tool details.
                </div>
              );
            }
            return null;
          })()
        )}
      </div>

      {selectedStudent && (
        <Card className="overflow-hidden border-blue-200 shadow-sm" id={exportId}>
          <div className="h-1 bg-blue-500" />
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-white border-b-2 border-slate-300">
                <div className="p-3 border-r border-slate-200"></div>
                {DAYS.map(day => (
                  <div key={day} className="p-3 font-semibold text-slate-700 text-center text-sm border-r border-slate-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Dynamic periods based on actual timeslots */}
              {Array.from({ length: maxPeriodsPerDay }, (_, idx) => idx + 1).map(period => (
                <div key={period} className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-slate-200" style={{ minHeight: '60px' }}>
                  <div className="p-2 bg-slate-50 border-r border-slate-200 flex flex-col justify-center">
                    <div className="text-xs font-medium text-slate-700">{periodTimes[period]}</div>
                  </div>
                  {DAYS.map(day => {
                    const slot = getSlotForPeriod(day, period);
                    let subject = null;
                    let teacher = null;
                    let level = null;
                    
                    if (slot) {
                      // Check if this is a test slot (no subject_id, has notes)
                      if (!slot.subject_id && slot.notes?.includes('Test')) {
                        // Display as a test period
                        subject = { name: 'Test/Assessment', ib_group: null };
                        teacher = null;
                        level = null;
                      }
                      // PYP/MYP: subject_id and teacher_id are directly on the slot
                      else if (slot.subject_id) {
                        subject = subjects.find(s => s.id === slot.subject_id);
                        teacher = teachers.find(t => t.id === slot.teacher_id);
                        level = selectedStudent?.ib_programme || '';
                      } else {
                        // DP: get from teaching group
                        const group = groups.find(g => g.id === slot.teaching_group_id);
                        if (group) {
                          subject = subjects.find(s => s.id === group.subject_id);
                          teacher = teachers.find(t => t.id === group.teacher_id);
                          level = group.level;
                        }
                      }
                    }
                    
                    const room = slot ? rooms.find(r => r.id === slot.room_id) : null;
                    const isTestSlot = slot?.notes?.includes('Test');
                    const colorClass = isTestSlot 
                      ? 'bg-red-200/90 border-red-500' 
                      : (subject ? subjectColors[subject.ib_group || 1] : '');

                    return (
                      <div key={`${day}-${period}`} className="border-r border-slate-200 last:border-r-0 hover:bg-slate-50/50">
                        {slot && subject && (
                          <div className={`h-full p-2 border-l-4 ${colorClass}`}>
                            <div className={`font-semibold text-xs leading-tight ${isTestSlot ? 'text-red-900' : 'text-slate-900'}`}>
                              {subject.name}
                            </div>
                            {level && <div className="text-[10px] text-slate-700 leading-tight">{level}</div>}
                            {teacher && <div className="text-[10px] text-slate-600 mt-0.5">{teacher.full_name}</div>}
                            {room && <div className="text-[10px] text-slate-500">{room.name}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {/* Break rows from scheduleSettings.breaks */}
              {breakRows.map(breakRow => (
                <div key={breakRow.id} className={`grid grid-cols-[80px_repeat(5,1fr)] border-b-2 ${breakRow.borderColor} bg-gradient-to-r ${breakRow.colorFrom} ${breakRow.colorTo}`} style={{ minHeight: '50px' }}>
                  <div className={`p-3 ${breakRow.bgColor} border-r-2 ${breakRow.borderColor} flex items-center justify-center`}>
                    <div className={`text-sm font-bold ${breakRow.textColor}`}>{breakRow.emoji} {breakRow.label}</div>
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
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}