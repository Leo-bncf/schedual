import React from 'react';
import { Badge } from '@/components/ui/badge';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export const formatClockTime = (timeValue) => String(timeValue || '').slice(0, 5);

export const calculatePeriodTimes = (dayStartTime = '08:00', periodDurationMinutes = 60, periodsPerDay = 8, breaks = []) => {
  const times = {};
  const [startHour, startMin] = (dayStartTime || '08:00').split(':').map(Number);
  let currentMinutes = startHour * 60 + startMin;
  const sortedBreaks = [...breaks].sort((a, b) => {
    const [aH, aM] = a.start.split(':').map(Number);
    const [bH, bM] = b.start.split(':').map(Number);
    return (aH * 60 + aM) - (bH * 60 + bM);
  });

  for (let i = 1; i <= periodsPerDay; i++) {
    const currentH = Math.floor(currentMinutes / 60);
    const currentM = currentMinutes % 60;
    const currentStr = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`;
    const activeBreak = sortedBreaks.find((br) => br.start === currentStr);
    if (activeBreak) {
      const [endH, endM] = activeBreak.end.split(':').map(Number);
      currentMinutes = endH * 60 + endM;
    }

    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    const startTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    currentMinutes += (periodDurationMinutes || 60);
    const endH = Math.floor(currentMinutes / 60);
    const endM = currentMinutes % 60;
    const endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
    times[i] = `${startTimeStr} - ${endTimeStr}`;
  }

  return times;
};

export const getSubjectColor = (subjectName, isExamTime = false) => {
  if (isExamTime) return { bg: 'bg-red-50', border: 'border-l-red-400', text: 'text-red-900' };
  if (!subjectName) return { bg: 'bg-slate-50', border: 'border-l-slate-400', text: 'text-slate-900' };
  const colors = [
    { bg: 'bg-blue-50', border: 'border-l-blue-400', text: 'text-blue-900' },
    { bg: 'bg-indigo-50', border: 'border-l-indigo-400', text: 'text-indigo-900' },
    { bg: 'bg-violet-50', border: 'border-l-violet-400', text: 'text-violet-900' },
    { bg: 'bg-purple-50', border: 'border-l-purple-400', text: 'text-purple-900' },
    { bg: 'bg-fuchsia-50', border: 'border-l-fuchsia-400', text: 'text-fuchsia-900' },
    { bg: 'bg-pink-50', border: 'border-l-pink-400', text: 'text-pink-900' },
    { bg: 'bg-rose-50', border: 'border-l-rose-400', text: 'text-rose-900' },
    { bg: 'bg-orange-50', border: 'border-l-orange-400', text: 'text-orange-900' },
    { bg: 'bg-amber-50', border: 'border-l-amber-400', text: 'text-amber-900' },
    { bg: 'bg-emerald-50', border: 'border-l-emerald-400', text: 'text-emerald-900' },
    { bg: 'bg-teal-50', border: 'border-l-teal-400', text: 'text-teal-900' },
    { bg: 'bg-cyan-50', border: 'border-l-cyan-400', text: 'text-cyan-900' },
    { bg: 'bg-sky-50', border: 'border-l-sky-400', text: 'text-sky-900' },
  ];
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export function SlotCard({ slot, subject, teacher, room, level, isStudentView, isGlobalView, durationMinutes, segmentType, onClick }) {
  const isExamTime = String(subject?.code || '').trim().toUpperCase() === 'TEST' || String(subject?.name || '').trim().toUpperCase() === 'EXAM TIME';
  const colorScheme = getSubjectColor(subject?.name, isExamTime);
  const timing = slot.__timing || {};
  const baseClasses = `${colorScheme.bg} ${colorScheme.border} ${isGlobalView ? 'rounded-md' : 'rounded-xl'} border border-slate-200`;
  const segmentClasses = segmentType === 'half'
    ? 'min-h-[58px] h-full border-t-0'
    : segmentType === 'continuation'
      ? 'min-h-[58px] h-full border-t border-dashed border-slate-300'
      : 'min-h-[116px] h-full';

  if (slot.is_break) {
    return (
      <div onClick={onClick} className="h-full min-h-[116px] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center">
        <div className="font-semibold text-amber-900">{slot.notes || 'Break'}</div>
      </div>
    );
  }

  if (!subject) {
    return <div onClick={onClick} className={`h-full ${segmentClasses} rounded-xl border border-dashed border-slate-200 bg-slate-50`} />;
  }

  return (
    <div onClick={onClick} className={`h-full w-full cursor-pointer overflow-hidden border-l-4 px-3 py-2 ${baseClasses} ${segmentClasses}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-semibold text-slate-900 ${segmentType === 'full' ? 'text-sm' : 'text-xs'}`}>{subject.name}</div>
          {!isStudentView && teacher && <div className="truncate text-[11px] text-slate-600">{teacher.full_name}</div>}
          {room && <div className="truncate text-[11px] text-slate-500">{room.name}</div>}
        </div>
        <div className="flex flex-col items-end gap-1">
          {level ? <Badge variant="outline" className="bg-white/80 text-[10px]">{isExamTime ? 'Exam' : level}</Badge> : null}
          {durationMinutes > 60 ? <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">{durationMinutes} min</Badge> : null}
        </div>
      </div>
      <div className="mt-1 text-[10px] font-medium text-slate-500">
        {timing.start && timing.end ? `${timing.start} - ${timing.end}` : `${durationMinutes} min`}
      </div>
      {segmentType === 'continuation' ? <div className="mt-1 text-[10px] font-semibold text-violet-600">Continuation</div> : null}
    </div>
  );
}