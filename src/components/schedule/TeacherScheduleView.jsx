import React from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function TeacherScheduleView({ teachers, slots, groups, subjects, rooms, selectedTeacherId, onTeacherChange, exportId = "teacher-schedule", timeslots = [] }) {
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  
  // Build timeslot mapping
  const DAY_MAP = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };
  const timeslotToPosition = React.useMemo(() => {
    const map = {};
    const timeslotsByDay = {};
    
    DAYS.forEach(day => {
      const dayUpper = day.toUpperCase();
      timeslotsByDay[day] = (timeslots || [])
        .filter(t => t.dayOfWeek === dayUpper)
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    });
    
    Object.values(timeslotsByDay).forEach(daySlots => {
      daySlots.forEach((ts, idx) => {
        map[ts.id] = { uiRow: idx + 1, startTime: ts.startTime };
      });
    });
    
    return map;
  }, [timeslots]);
  
  const periodTimes = React.useMemo(() => {
    const times = {};
    Object.values(timeslotToPosition).forEach(({ uiRow, startTime }) => {
      if (!times[uiRow]) times[uiRow] = startTime;
    });
    return times;
  }, [timeslotToPosition]);

  const getTeacherSlots = (teacherId) => {
    return slots.filter(slot => {
      // PYP/MYP: teacher_id is directly on the slot
      if (slot.teacher_id) {
        return slot.teacher_id === teacherId;
      }
      // DP: get from teaching group
      const group = groups.find(g => g.id === slot.teaching_group_id);
      return group?.teacher_id === teacherId;
    });
  };

  const teacherSlots = selectedTeacher ? getTeacherSlots(selectedTeacher.id) : [];

  const getSlotForPeriod = (day, uiRow) => {
    return teacherSlots.find(s => {
      const slotUiRow = s.timeslot_id ? timeslotToPosition[s.timeslot_id]?.uiRow : s.period;
      return s.day === day && slotUiRow === uiRow;
    });
  };

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
        <User className="w-5 h-5 text-indigo-600" />
        <Select value={selectedTeacherId || ''} onValueChange={onTeacherChange}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Select a teacher..." />
          </SelectTrigger>
          <SelectContent>
            {teachers.map(teacher => (
              <SelectItem key={teacher.id} value={teacher.id}>
                {teacher.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedTeacher && (
          <Badge variant="outline">{teacherSlots.length} periods per week</Badge>
        )}
      </div>

      {selectedTeacher && (
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

              {PERIODS.map(period => (
                <div key={period} className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-slate-200" style={{ minHeight: '60px' }}>
                  <div className="p-2 bg-slate-50 border-r border-slate-200 flex flex-col justify-center">
                    <div className="text-xs font-medium text-slate-700">{periodTimes[period]}</div>
                  </div>
                  {DAYS.map(day => {
                    const slot = getSlotForPeriod(day, period);
                    let subject = null;
                    let displayText = '';
                    let studentCount = 0;
                    
                    if (slot) {
                      // PYP/MYP: subject_id is directly on the slot
                      if (slot.subject_id) {
                        subject = subjects.find(s => s.id === slot.subject_id);
                        displayText = subject?.ib_level || '';
                      } else {
                        // DP: get from teaching group
                        const group = groups.find(g => g.id === slot.teaching_group_id);
                        if (group) {
                          subject = subjects.find(s => s.id === group.subject_id);
                          displayText = `${group.level} - ${group.name}`;
                          studentCount = group.student_ids?.length || 0;
                        }
                      }
                    }
                    
                    const room = slot ? rooms.find(r => r.id === slot.room_id) : null;
                    const colorClass = subject ? subjectColors[subject.ib_group || 1] : '';

                    return (
                      <div key={`${day}-${period}`} className="border-r border-slate-200 last:border-r-0 hover:bg-slate-50/50">
                        {slot && subject && (
                          <div className={`h-full p-2 border-l-4 ${colorClass}`}>
                            <div className="font-semibold text-xs text-slate-900 leading-tight">{subject.name}</div>
                            <div className="text-[10px] text-slate-700 leading-tight">{displayText}</div>
                            {studentCount > 0 && (
                              <div className="text-[10px] text-slate-600 mt-0.5">
                                {studentCount} students
                              </div>
                            )}
                            {room && <div className="text-[10px] text-slate-500">{room.name}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}