import React from 'react';
import { Card } from '@/components/ui/card';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const normalizeDay = (value) => {
  if (!value) return null;
  const map = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
  };
  const upper = String(value).toUpperCase();
  return map[upper] || `${String(value).charAt(0).toUpperCase()}${String(value).slice(1).toLowerCase()}`;
};

const formatClockTime = (value) => String(value || '').slice(0, 5);

const getSubjectColor = (subjectName) => {
  if (!subjectName) return { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-900' };
  const colors = [
    { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-950' },
    { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-950' },
    { bg: 'bg-violet-100', border: 'border-violet-500', text: 'text-violet-950' },
    { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-950' },
    { bg: 'bg-fuchsia-100', border: 'border-fuchsia-500', text: 'text-fuchsia-950' },
    { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-950' },
    { bg: 'bg-rose-100', border: 'border-rose-500', text: 'text-rose-950' },
    { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-950' },
    { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-950' },
    { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-950' },
    { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-950' },
    { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-950' },
    { bg: 'bg-sky-100', border: 'border-sky-500', text: 'text-sky-950' },
  ];
  let hash = 0;
  for (let i = 0; i < subjectName.length; i += 1) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

function LessonCard({ item, compact }) {
  const color = item.isBreak
    ? { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-950' }
    : getSubjectColor(item.subjectName);

  return (
    <div
      className={`h-full w-full border-l-4 border-y border-r ${color.bg} ${color.border} ${color.text} px-2 py-1 flex flex-col justify-center overflow-hidden ${compact ? 'text-[10px]' : 'text-xs'}`}
      title={`${item.subjectName} | ${item.teacherName || 'No teacher'} | ${item.roomName || 'No room'} | ${item.startTime || '--:--'}-${item.endTime || '--:--'}`}
    >
      <div className={`font-bold leading-tight text-center ${compact ? 'text-[10px]' : 'text-xs'}`}>{item.subjectShort}</div>
      <div className="leading-tight text-center opacity-80">{item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : `${item.duration} min`}</div>
      {item.roomName && <div className="leading-tight text-center opacity-80 truncate">{item.roomName}</div>}
    </div>
  );
}

export default function AdminTimetableGrid({
  slots = [],
  groups = [],
  rooms = [],
  subjects = [],
  teachers = [],
  timeslots = [],
  periodsPerDay = 8,
  dayStartTime = '08:00',
  periodDurationMinutes = 60,
}) {
  const groupMap = React.useMemo(() => Object.fromEntries(groups.map((item) => [item.id, item])), [groups]);
  const roomMap = React.useMemo(() => Object.fromEntries(rooms.map((item) => [item.id, item])), [rooms]);
  const subjectMap = React.useMemo(() => Object.fromEntries(subjects.map((item) => [item.id, item])), [subjects]);
  const teacherMap = React.useMemo(() => Object.fromEntries(teachers.map((item) => [item.id, item])), [teachers]);

  const timeslotsByDay = React.useMemo(() => {
    const result = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [] };
    (timeslots || []).forEach((slot) => {
      const day = normalizeDay(slot.dayOfWeek);
      if (day && result[day]) result[day].push(slot);
    });
    Object.keys(result).forEach((day) => {
      result[day] = result[day].sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    });
    return result;
  }, [timeslots]);

  const periodRows = React.useMemo(() => {
    const maxRowsFromTimeslots = Math.max(...Object.values(timeslotsByDay).map((list) => list.length), 0);
    const totalRows = Math.max(periodsPerDay, maxRowsFromTimeslots || 0);
    const rows = [];
    let [hour, minute] = (dayStartTime || '08:00').split(':').map(Number);
    for (let index = 0; index < totalRows; index += 1) {
      const startHour = String(hour).padStart(2, '0');
      const startMinute = String(minute).padStart(2, '0');
      const start = `${startHour}:${startMinute}`;
      hour += Math.floor((minute + periodDurationMinutes) / 60);
      minute = (minute + periodDurationMinutes) % 60;
      const end = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      rows.push({ rowIndex: index + 1, start, end });
    }
    return rows;
  }, [dayStartTime, periodDurationMinutes, periodsPerDay, timeslotsByDay]);

  const rowStartToIndex = React.useMemo(
    () => Object.fromEntries(periodRows.map((row) => [row.start, row.rowIndex])),
    [periodRows]
  );

  const itemsByCell = React.useMemo(() => {
    const result = {};

    const pushItem = (day, rowIndex, segment, item) => {
      const key = `${day}-${rowIndex}-${segment}`;
      if (!result[key]) result[key] = [];
      result[key].push(item);
    };

    (slots || []).forEach((slot) => {
      const timeslot = (timeslotsByDay[normalizeDay(slot.day)] || []).find((entry) => String(entry.id) === String(slot.timeslot_id))
        || (timeslots || []).find((entry) => String(entry.id) === String(slot.timeslot_id));
      const day = normalizeDay(slot.day || timeslot?.dayOfWeek);
      if (!day) return;

      const startTime = formatClockTime(timeslot?.startTime);
      const endTime = formatClockTime(slot?.end_time_override || timeslot?.endTime);
      const baseRowIndex = rowStartToIndex[startTime];
      if (!baseRowIndex) return;

      const group = groupMap[slot.teaching_group_id];
      const subject = subjectMap[slot.subject_id || group?.subject_id];
      const teacher = teacherMap[slot.teacher_id || group?.teacher_id];
      const room = roomMap[slot.room_id];
      const subjectName = slot.is_break ? (slot.notes || 'Break') : (subject?.name || slot.notes || 'Unassigned');
      const subjectShort = slot.is_break ? 'BREAK' : (subject?.code || subject?.name || '---');
      const duration = slot.duration_minutes_override
        ? Number(slot.duration_minutes_override)
        : startTime && endTime
          ? ((Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3, 5))) - (Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5))))
          : Number(periodDurationMinutes || 60);

      const item = {
        id: slot.id,
        subjectName,
        subjectShort,
        teacherName: teacher?.full_name || '',
        roomName: room?.name || '',
        startTime,
        endTime,
        duration,
        isBreak: !!slot.is_break,
      };

      if (duration <= 30) {
        pushItem(day, baseRowIndex, 'top', item);
        return;
      }

      pushItem(day, baseRowIndex, 'full', item);

      if (duration > 60) {
        const overflowMinutes = duration - 60;
        const nextRow = baseRowIndex + 1;
        if (overflowMinutes >= 30) {
          pushItem(day, nextRow, 'top', { ...item, id: `${slot.id}-overflow`, duration: overflowMinutes });
        }
      }
    });

    return result;
  }, [groupMap, periodDurationMinutes, roomMap, rowStartToIndex, slots, subjectMap, teacherMap, timeslots, timeslotsByDay]);

  const getCellItems = (day, rowIndex, segment) => itemsByCell[`${day}-${rowIndex}-${segment}`] || [];

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <div className="grid grid-cols-[76px_repeat(5,1fr)] border-b border-slate-300 bg-slate-100">
            <div className="p-2 text-sm font-bold text-slate-700 border-r border-slate-300">Time</div>
            {DAYS.map((day) => (
              <div key={day} className="p-2 text-sm font-bold text-center text-slate-700 border-r last:border-r-0 border-slate-300">{day}</div>
            ))}
          </div>

          {periodRows.map((row, rowIdx) => {
            const currentHour = row.start.slice(0, 2);
            const previousHour = rowIdx > 0 ? periodRows[rowIdx - 1].start.slice(0, 2) : null;
            const showHour = currentHour !== previousHour;

            return (
              <div key={row.rowIndex} className="grid grid-cols-[76px_repeat(5,1fr)] border-b border-slate-300">
                <div className="border-r border-slate-300 bg-slate-50 px-2 py-2 flex flex-col justify-center items-center min-h-[92px]">
                  {showHour ? (
                    <>
                      <div className="text-sm font-bold text-slate-800">{currentHour}:00</div>
                      <div className="text-[10px] text-slate-500 mt-1">{row.start} - {row.end}</div>
                    </>
                  ) : null}
                </div>

                {DAYS.map((day) => {
                  const fullItems = getCellItems(day, row.rowIndex, 'full');
                  const topItems = getCellItems(day, row.rowIndex, 'top');
                  const bottomItems = getCellItems(day, row.rowIndex, 'bottom');
                  const hasSplit = topItems.length > 0 || bottomItems.length > 0;
                  const topDisplay = fullItems.length > 0 ? fullItems : topItems;

                  return (
                    <div key={`${day}-${row.rowIndex}`} className="border-r last:border-r-0 border-slate-300 bg-[#f4f4f4] min-h-[92px]">
                      {hasSplit ? (
                        <div className="h-full min-h-[92px] flex flex-col">
                          <div className="h-[46px] border-b border-slate-300 flex gap-0">
                            {topDisplay.length === 0 ? <div className="flex-1" /> : topDisplay.map((item) => <div key={item.id} className="flex-1 min-w-0"><LessonCard item={item} compact /></div>)}
                          </div>
                          <div className="h-[46px] flex gap-0">
                            {bottomItems.length === 0 ? <div className="flex-1" /> : bottomItems.map((item) => <div key={item.id} className="flex-1 min-w-0"><LessonCard item={item} compact /></div>)}
                          </div>
                        </div>
                      ) : fullItems.length > 0 ? (
                        <div className="h-full min-h-[92px] flex gap-0">
                          {fullItems.map((item) => <div key={item.id} className="flex-1 min-w-0"><LessonCard item={item} /></div>)}
                        </div>
                      ) : (
                        <div className="min-h-[92px]" />
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
  );
}