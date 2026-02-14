import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, AlertCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function StudentScheduleView({ students, slots, groups, subjects, teachers, rooms, selectedStudentId, onStudentChange, exportId = "student-schedule", unassignedBySubjectCode = {}, timeslots = [], scheduleSettings }) {
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
    const assignedGroupIds = Array.isArray(student?.assigned_groups) ? student.assigned_groups : [];
    
    const matchedSlots = slots.filter(slot => {
      // PYP/MYP: match by classgroup_id
      if (slot.classgroup_id && student?.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }
      // DP test slots: include DP1/DP2 test slots by year_group marker in notes
      if (slot?.notes?.includes('Test') && (slot?.notes?.includes('DP1') || slot?.notes?.includes('DP2'))) {
        return student?.year_group && slot.notes.includes(student.year_group);
      }
      // DP: Use student.assigned_groups instead of teachingGroup.student_ids
      if (slot.teaching_group_id) {
        return assignedGroupIds.includes(slot.teaching_group_id);
      }
      
      return false;
    });

    // ENHANCED DEBUG: Expected vs actual periods by teaching group and subject
    const expectedByTG = {};
    const actualByTG = {};
    const expectedBySubject = {};
    const actualBySubject = {};
    
    // Calculate expected periods from assigned teaching groups
    assignedGroupIds.forEach(tgId => {
      const group = groups.find(g => g.id === tgId);
      if (!group) return;
      
      const subject = subjects.find(s => s.id === group.subject_id);
      const subjectCode = subject?.code || subject?.name || 'Unknown';
      
      // Get expected periods for this TG
      const periodDuration = scheduleSettings?.periodDurationMinutes || scheduleSettings?.period_duration_minutes || 60;
      let expectedPeriods = 0;
      
      if (group.periods_per_week) {
        expectedPeriods = group.periods_per_week;
      } else if (group.minutes_per_week) {
        expectedPeriods = Math.ceil(group.minutes_per_week / periodDuration);
      } else if (group.hours_per_week) {
        expectedPeriods = Math.ceil((group.hours_per_week * 60) / periodDuration);
      } else {
        // Fallback: HL=5, SL=3 (IB standard for 60min periods)
        const level = String(group.level || '').toUpperCase();
        expectedPeriods = level === 'HL' ? 5 : level === 'SL' ? 3 : 3;
      }
      
      expectedByTG[tgId] = expectedPeriods;
      expectedBySubject[subjectCode] = (expectedBySubject[subjectCode] || 0) + expectedPeriods;
      actualByTG[tgId] = 0;
    });
    
    // Count actual slots per TG and subject
    matchedSlots.forEach(s => {
      const group = s.teaching_group_id ? groups.find(g => g.id === s.teaching_group_id) : null;
      const subject = group ? subjects.find(sub => sub.id === group.subject_id) : 
                      s.subject_id ? subjects.find(sub => sub.id === s.subject_id) : null;
      const subjectCode = subject?.code || subject?.name || 'Unknown';
      
      if (s.teaching_group_id) {
        actualByTG[s.teaching_group_id] = (actualByTG[s.teaching_group_id] || 0) + 1;
      }
      actualBySubject[subjectCode] = (actualBySubject[subjectCode] || 0) + 1;
    });

    // Build mismatch report
    const mismatchesByTG = [];
    const mismatchesBySubject = [];
    
    Object.keys(expectedByTG).forEach(tgId => {
      const expected = expectedByTG[tgId];
      const actual = actualByTG[tgId] || 0;
      if (expected !== actual) {
        const group = groups.find(g => g.id === tgId);
        const subject = group ? subjects.find(s => s.id === group.subject_id) : null;
        mismatchesByTG.push({
          tg_id: tgId,
          name: group?.name || 'Unknown',
          subject_code: subject?.code || subject?.name || 'Unknown',
          level: group?.level || null,
          expected,
          actual,
          diff: actual - expected
        });
      }
    });
    
    Object.keys(expectedBySubject).forEach(subjectCode => {
      const expected = expectedBySubject[subjectCode];
      const actual = actualBySubject[subjectCode] || 0;
      if (expected !== actual) {
        mismatchesBySubject.push({
          subject_code: subjectCode,
          expected,
          actual,
          diff: actual - expected
        });
      }
    });

    console.log(`[StudentScheduleView] 📊 Student ${student?.full_name} (${student?.year_group}):`, {
      assigned_groups_count: assignedGroupIds.length,
      assigned_groups: assignedGroupIds,
      total_slots_displayed: matchedSlots.length,
      expectedByTG,
      actualByTG,
      expectedBySubject,
      actualBySubject,
      mismatchesByTG,
      mismatchesBySubject
    });
    
    // Log critical mismatches prominently
    if (mismatchesByTG.length > 0) {
      console.warn(`⚠️ ${student?.full_name}: ${mismatchesByTG.length} teaching groups with hour mismatches:`, mismatchesByTG);
    }
    if (mismatchesBySubject.length > 0) {
      console.warn(`⚠️ ${student?.full_name}: ${mismatchesBySubject.length} subjects with hour mismatches:`, mismatchesBySubject);
    }

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

  // Hard check: block render if student has no assigned_groups
  const hasNoAssignedGroups = selectedStudent && (!selectedStudent.assigned_groups || selectedStudent.assigned_groups.length === 0);
  
  const handleResyncStudent = async () => {
    try {
      const { base44 } = await import('@/api/base44Client');
      await base44.functions.invoke('syncStudentTeachingGroups');
      window.location.reload();
    } catch (e) {
      alert('Sync failed: ' + e.message);
    }
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
          <>
            <Badge variant="outline">{studentSlots.length} periods per week</Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-900">
              {(selectedStudent.assigned_groups || []).length} groups assigned
            </Badge>
          </>
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
          
          {/* Expected vs Actual Periods Debug Panel */}
          {(() => {
            const assignedGroupIds = Array.isArray(selectedStudent?.assigned_groups) ? selectedStudent.assigned_groups : [];
            const periodDuration = scheduleSettings?.periodDurationMinutes || scheduleSettings?.period_duration_minutes || 60;
            const tgReport = [];
            
            assignedGroupIds.forEach(tgId => {
              const group = groups.find(g => g.id === tgId);
              if (!group) return;
              
              const subject = subjects.find(s => s.id === group.subject_id);
              const subjectCode = subject?.code || subject?.name || 'Unknown';
              
              let expectedPeriods = 0;
              if (group.periods_per_week) {
                expectedPeriods = group.periods_per_week;
              } else if (group.minutes_per_week) {
                expectedPeriods = Math.ceil(group.minutes_per_week / periodDuration);
              } else {
                const level = String(group.level || '').toUpperCase();
                expectedPeriods = level === 'HL' ? 5 : level === 'SL' ? 3 : 3;
              }
              
              const actualPeriods = studentSlots.filter(s => s.teaching_group_id === tgId).length;
              const diff = actualPeriods - expectedPeriods;
              
              tgReport.push({
                tgId,
                name: group.name,
                subject: subjectCode,
                level: group.level,
                expected: expectedPeriods,
                actual: actualPeriods,
                diff,
                status: diff === 0 ? 'ok' : diff > 0 ? 'over' : 'under'
              });
            });
            
            const totalExpected = tgReport.reduce((sum, r) => sum + r.expected, 0);
            const totalActual = tgReport.reduce((sum, r) => sum + r.actual, 0);
            const hasMismatches = tgReport.some(r => r.diff !== 0);
            
            if (!hasMismatches && assignedGroupIds.length > 0) return null;
            
            return (
              <Card className="mb-4 border-amber-300 bg-amber-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-amber-900">📊 Expected vs Actual Periods</div>
                    <Badge variant={hasMismatches ? 'destructive' : 'default'}>
                      {totalActual}/{totalExpected} periods ({hasMismatches ? 'MISMATCH' : 'OK'})
                    </Badge>
                  </div>
                  <div className="space-y-2 text-xs">
                    {tgReport.map((r, idx) => (
                      <div key={idx} className={`flex items-center justify-between p-2 rounded ${
                        r.status === 'ok' ? 'bg-emerald-50 border border-emerald-200' :
                        r.status === 'under' ? 'bg-rose-50 border border-rose-200' :
                        'bg-blue-50 border border-blue-200'
                      }`}>
                        <div className="flex-1">
                          <span className="font-medium">{r.subject}</span>
                          {r.level && <Badge variant="outline" className="ml-2 text-[10px]">{r.level}</Badge>}
                        </div>
                        <div className={`font-mono font-semibold ${
                          r.status === 'ok' ? 'text-emerald-700' :
                          r.status === 'under' ? 'text-rose-700' :
                          'text-blue-700'
                        }`}>
                          {r.actual}/{r.expected} {r.diff !== 0 && `(${r.diff > 0 ? '+' : ''}${r.diff})`}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
          
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
        </>
      )}
    </div>
  );
}