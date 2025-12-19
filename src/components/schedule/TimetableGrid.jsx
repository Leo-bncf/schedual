import React from 'react';
import { Card } from "@/components/ui/card";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const periodTimes = {
  1: '08:00 - 08:45',
  2: '08:50 - 09:35',
  3: '09:40 - 10:25',
  4: '10:45 - 11:30',
  5: '11:35 - 12:20',
  6: '13:15 - 14:00',
  7: '14:05 - 14:50',
  8: '14:55 - 15:40',
  9: '15:45 - 16:30',
  10: '16:35 - 17:20',
  11: '17:25 - 18:10',
  12: '18:15 - 19:00',
};

const subjectColors = {
  1: 'bg-blue-50 border-blue-200 text-blue-800',
  2: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  3: 'bg-amber-50 border-amber-200 text-amber-800',
  4: 'bg-violet-50 border-violet-200 text-violet-800',
  5: 'bg-rose-50 border-rose-200 text-rose-800',
  6: 'bg-cyan-50 border-cyan-200 text-cyan-800',
};

export default function TimetableGrid({ slots = [], groups = [], rooms = [], onSlotClick, periodsPerDay = 12 }) {
  const getSlotData = (day, period) => {
    return slots.find(s => s.day === day && s.period === period);
  };

  const getGroupInfo = (groupId) => {
    return groups.find(g => g.id === groupId);
  };

  const getRoomInfo = (roomId) => {
    return rooms.find(r => r.id === roomId);
  };

  const activePeriods = PERIODS.slice(0, periodsPerDay);

  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header Row */}
          <div className="grid grid-cols-[100px_repeat(5,1fr)] bg-slate-50 border-b border-slate-200">
            <div className="p-4 font-semibold text-slate-500 text-sm">Time</div>
            {DAYS.map(day => (
              <div key={day} className="p-4 font-semibold text-slate-700 text-center border-l border-slate-200">
                {day}
              </div>
            ))}
          </div>

          {/* Period Rows */}
          {activePeriods.map(period => (
            <div key={period} className="grid grid-cols-[100px_repeat(5,1fr)] border-b border-slate-100 last:border-0">
              <div className="p-3 bg-slate-50 border-r border-slate-200">
                <div className="text-sm font-medium text-slate-700">Period {period}</div>
                <div className="text-xs text-slate-400 mt-0.5">{periodTimes[period]}</div>
              </div>
              {DAYS.map(day => {
                const slot = getSlotData(day, period);
                const group = slot ? getGroupInfo(slot.teaching_group_id) : null;
                const room = slot ? getRoomInfo(slot.room_id) : null;
                const colorClass = group ? subjectColors[group.ib_group || 1] : '';

                return (
                  <div 
                    key={`${day}-${period}`} 
                    className="p-2 border-l border-slate-100 min-h-[80px] hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => onSlotClick && onSlotClick(day, period, slot)}
                  >
                    {slot && group && (
                      <div className={`h-full p-2 rounded-lg border ${colorClass}`}>
                        <div className="font-medium text-sm truncate">{group.name}</div>
                        <div className="text-xs opacity-75 mt-1">{group.level}</div>
                        {room && (
                          <div className="text-xs opacity-60 mt-1">📍 {room.name}</div>
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