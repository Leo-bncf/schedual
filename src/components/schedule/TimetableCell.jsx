import React from 'react';
import { Badge } from '@/components/ui/badge';
import { getSubjectColor } from '@/components/schedule/timetableGridUtils';

/**
 * Renders a single timetable cell (one day × one period row).
 *
 * Floating-card approach for 90-min (or any overflowing) lessons:
 * - The card is positioned absolutely, starting at the top of this row.
 * - Its height is proportional to the lesson duration vs the base period.
 *   e.g. 90 min / 60 min base = 150% height → floats down over the next row.
 * - The next row still renders normally; if it has its own lesson the card
 *   sits behind/beside it (z-index ensures the earlier lesson is on top).
 */
export default function TimetableCell({
  slots = [],
  empty,
  renderSlotData,
  onSlotClick,
  globalView = false,
  periodDurationMinutes = 60,
}) {
  if (empty || !slots.length) {
    return (
      <div className="relative border-r border-slate-300 last:border-r-0 bg-slate-50/40" style={{ minHeight: 116 }} />
    );
  }

  return (
    <div className="relative border-r border-slate-300 last:border-r-0 bg-white" style={{ minHeight: 116 }}>
      {/* p-1 padding so cards don't touch the cell edge */}
      <div className={`absolute inset-1 flex ${globalView ? 'flex-row flex-wrap content-start' : 'flex-col'} gap-1`} style={{ zIndex: 1 }}>
        {slots.map((slot) => {
          const data = renderSlotData(slot);
          const duration = slot.__durationMinutes || 60;
          const base = 60;
          const topOffsetMinutes = Number(slot.__topOffsetMinutes || 0);
          const heightPct = `${(duration / base) * 100}%`;
          const topPct = `${(topOffsetMinutes / base) * 100}%`;
          const spills = topOffsetMinutes + duration > base;

          return (
            <FloatingSlotCard
              key={slot.id}
              {...data}
              slot={slot}
              heightPct={heightPct}
              topPct={topPct}
              spills={spills}
              globalView={globalView}
              onClick={() => onSlotClick(slot)}
            />
          );
        })}
      </div>
    </div>
  );
}

function FloatingSlotCard({ slot, subject, teacher, room, level, isStudentView, globalView, durationMinutes, heightPct, topPct = '0%', spills, onClick }) {
  const isExamTime =
    String(subject?.code || '').trim().toUpperCase() === 'TEST' ||
    String(subject?.name || '').trim().toUpperCase() === 'EXAM TIME';
  const colorScheme = getSubjectColor(subject?.name, isExamTime);
  const timing = slot.__timing || {};

  if (slot.is_break) {
    return (
      <div
        onClick={onClick}
        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center cursor-pointer"
        style={{ height: heightPct }}
      >
        <div className="font-semibold text-amber-900 text-xs">{slot.notes || 'Break'}</div>
      </div>
    );
  }

  if (!subject) {
    return (
      <div
        className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60"
        style={{ height: heightPct }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      className={`
        cursor-pointer overflow-hidden border-l-4 rounded-xl px-3 py-2
        ${colorScheme.bg} ${colorScheme.border} border border-slate-200
        shadow-sm hover:shadow-md transition-shadow
        ${globalView ? 'w-[calc(50%-4px)] lg:w-[calc(33.33%-4px)] flex flex-col items-center justify-center text-center p-1.5 relative' : 'w-full flex flex-col absolute left-0 right-0'}
        ${spills ? 'z-10 ring-1 ring-violet-300 shadow-[0_4px_12px_rgba(139,92,246,0.15)]' : 'z-[1]'}
      `}
      style={{ height: heightPct, top: topPct }}
    >
      {globalView ? (
        <>
          <div className="font-bold text-[10px] leading-tight truncate w-full">{subject.name}</div>
          {!isStudentView && teacher && <div className="truncate text-[9px] text-slate-600 opacity-80 w-full mt-0.5">{teacher.full_name}</div>}
          <div className="mt-0.5 text-[9px] font-medium text-slate-500 opacity-80 w-full truncate">
            {timing.start && timing.end ? `${timing.start}–${timing.end}` : `${durationMinutes}m`}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-900 text-sm leading-tight truncate">{subject.name}</div>
              {!isStudentView && teacher && (
                <div className="truncate text-[11px] text-slate-600 mt-0.5">{teacher.full_name}</div>
              )}
              {room && <div className="truncate text-[11px] text-slate-500">{room.name}</div>}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {level ? (
                <Badge variant="outline" className="bg-white/80 text-[10px]">
                  {isExamTime ? 'Exam' : level}
                </Badge>
              ) : null}
              {spills ? (
                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
                  {durationMinutes} min
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-500">
            {timing.start && timing.end ? `${timing.start} – ${timing.end}` : `${durationMinutes} min`}
          </div>
        </>
      )}
    </div>
  );
}