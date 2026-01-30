import React from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 'break', 'lunch', 7, 8, 9, 10, 11, 12];

const periodTimes = {
  1: '08:00', 2: '08:45', 3: '09:30', 4: '10:15', 5: '11:00', 6: '11:45',
  break: '12:15', lunch: '12:30', 7: '13:00', 8: '13:45', 9: '14:30', 10: '15:15', 11: '16:00', 12: '16:45',
};

export default function StudentScheduleView({ students, slots, groups, subjects, teachers, rooms, selectedStudentId, onStudentChange, exportId = "student-schedule" }) {
  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const getStudentSlots = (studentId) => {
    const student = students.find(s => s.id === studentId);
    return slots.filter(slot => {
      // PYP/MYP: match by classgroup_id
      if (slot.classgroup_id && student?.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }
      // DP: match by teaching_group_id (fallback: DP1+DP2 core even if student_ids empty)
      const group = groups.find(g => g.id === slot.teaching_group_id);
      const inGroup = group?.student_ids?.includes(studentId);
      if (inGroup) return true;
      const subj = group ? subjects.find(s => s.id === group.subject_id) : null;
      const codeNorm = (subj?.code || subj?.name || '').toUpperCase().replace(/\s+/g, '_');
      const isCore = (group?.is_core === true) || (subj?.is_core === true) || ['TOK','CAS','EE'].some(k => codeNorm.includes(k));
      const dpFallback = group && subj && group.year_group === 'DP1+DP2' && isCore;
      return !!dpFallback;
    });
  };

  const studentSlots = selectedStudent ? getStudentSlots(selectedStudent.id) : [];

  const getSlotForPeriod = (day, period) => {
    return studentSlots.find(s => s.day === day && s.period === period);
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
      </div>

      {selectedStudent && (
        <Card className="overflow-hidden border-0 shadow-sm" id={exportId}>
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

              {PERIODS.map(period => {
                // Break row
                if (period === 'break') {
                  return (
                    <div key="break" className="grid grid-cols-[80px_repeat(5,1fr)] border-b-2 border-sky-300 bg-gradient-to-r from-sky-100 to-blue-100" style={{ minHeight: '50px' }}>
                      <div className="p-3 bg-sky-200 border-r-2 border-sky-300 flex items-center justify-center">
                        <div className="text-sm font-bold text-sky-900">☕ Break</div>
                      </div>
                      {DAYS.map(day => (
                        <div key={`${day}-break`} className="border-r-2 border-sky-300 last:border-r-0 flex items-center justify-center bg-sky-50">
                          <div className="text-center">
                            <div className="text-xs font-bold text-sky-900">BREAK</div>
                            <div className="text-[10px] text-sky-700 mt-0.5">12:15 - 12:30</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Lunch break row
                if (period === 'lunch') {
                  return (
                    <div key="lunch" className="grid grid-cols-[80px_repeat(5,1fr)] border-b-2 border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100" style={{ minHeight: '55px' }}>
                      <div className="p-3 bg-amber-200 border-r-2 border-amber-300 flex items-center justify-center">
                        <div className="text-sm font-bold text-amber-900">🍽️ Lunch</div>
                      </div>
                      {DAYS.map(day => (
                        <div key={`${day}-lunch`} className="border-r-2 border-amber-300 last:border-r-0 flex items-center justify-center bg-amber-50">
                          <div className="text-center">
                            <div className="text-xs font-bold text-amber-900">LUNCH BREAK</div>
                            <div className="text-[10px] text-amber-700 mt-0.5">12:30 - 13:00</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }

                // Regular period row
                return (
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
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}