import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const periodTimes = {
  1: '08:00',
  2: '08:45',
  3: '09:30',
  4: '10:15',
  5: '11:00',
  6: '11:45',
  7: '13:00',
  8: '13:45',
  9: '14:30',
  10: '15:15',
  11: '16:00',
  12: '16:45',
};

const subjectColors = {
  1: 'bg-blue-200/80 border-blue-400',
  2: 'bg-emerald-200/80 border-emerald-400',
  3: 'bg-amber-200/80 border-amber-400',
  4: 'bg-rose-200/80 border-rose-400',
  5: 'bg-violet-200/80 border-violet-400',
  6: 'bg-cyan-200/80 border-cyan-400',
};

export default function TimetableGrid({ slots = [], groups = [], rooms = [], subjects = [], teachers = [], onSlotClick, periodsPerDay = 12 }) {
  const getSlotData = (day, period) => {
    return slots.find(s => s.day === day && s.period === period);
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

  const activePeriods = PERIODS.slice(0, periodsPerDay);

  // Calculate if a slot spans multiple periods (check if next period has same group)
  const getSlotSpan = (day, period) => {
    const currentSlot = getSlotData(day, period);
    if (!currentSlot) return 1;

    let span = 1;
    let checkPeriod = period + 1;
    
    while (checkPeriod <= periodsPerDay) {
      const nextSlot = getSlotData(day, checkPeriod);
      if (nextSlot && nextSlot.teaching_group_id === currentSlot.teaching_group_id) {
        span++;
        checkPeriod++;
      } else {
        break;
      }
    }
    
    return span;
  };

  // Check if this cell should be skipped (part of a multi-period slot above)
  const shouldSkipCell = (day, period) => {
    for (let p = period - 1; p >= 1; p--) {
      const slot = getSlotData(day, p);
      if (slot) {
        const span = getSlotSpan(day, p);
        if (p + span > period) {
          return true;
        }
      }
    }
    return false;
  };

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[1000px]">
          {/* Header Row */}
          <div className="grid grid-cols-[80px_repeat(5,1fr)] bg-white border-b-2 border-slate-300">
            <div className="p-3 font-semibold text-slate-600 text-sm border-r border-slate-200"></div>
            {DAYS.map(day => (
              <div key={day} className="p-3 font-semibold text-slate-700 text-center text-sm border-r border-slate-200 last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Period Rows */}
          {activePeriods.map(period => (
            <div key={period} className="grid grid-cols-[80px_repeat(5,1fr)] border-b border-slate-200 last:border-0" style={{ minHeight: '60px' }}>
              <div className="p-2 bg-slate-50 border-r border-slate-200 flex flex-col justify-center">
                <div className="text-xs font-medium text-slate-700">{periodTimes[period]}</div>
              </div>
              {DAYS.map(day => {
                if (shouldSkipCell(day, period)) {
                  return null;
                }

                const slot = getSlotData(day, period);
                const span = slot ? getSlotSpan(day, period) : 1;
                const group = slot ? getGroupInfo(slot.teaching_group_id) : null;
                const room = slot ? getRoomInfo(slot.room_id) : null;
                const subject = group ? getSubjectInfo(group.subject_id) : null;
                const teacher = group ? getTeacherInfo(group.teacher_id) : null;
                const colorClass = subject ? subjectColors[subject.ib_group || 1] : '';

                return (
                  <div 
                    key={`${day}-${period}`} 
                    className="border-r border-slate-200 last:border-r-0 hover:bg-slate-50/50 transition-colors cursor-pointer relative"
                    style={{ 
                      gridRow: span > 1 ? `span ${span}` : undefined,
                    }}
                    onClick={() => onSlotClick && onSlotClick(day, period, slot)}
                  >
                    {slot && group && (
                      <div className={`h-full p-2 border-l-4 ${colorClass} flex flex-col justify-center`}>
                        <div className="font-semibold text-xs text-slate-900 leading-tight mb-0.5">
                          {subject?.name || group.name}
                        </div>
                        <div className="text-[10px] text-slate-700 leading-tight">
                          [{subject?.code || ''}] {group.level}
                        </div>
                        {teacher && (
                          <div className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                            {teacher.full_name}
                          </div>
                        )}
                        {room && (
                          <div className="text-[10px] text-slate-500 leading-tight">
                            {room.name}
                          </div>
                        )}
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
  );
}