import React from 'react';
import { SlotCard } from '@/components/schedule/timetableGridUtils';

export default function TimetableCell({
  day,
  uiRow,
  primarySlot,
  carryOverSlot,
  nextStartingSlot,
  empty,
  renderSlotData,
  onSlotClick,
}) {
  if (empty) {
    return <div className="min-h-[116px] border-r border-slate-300 last:border-r-0 bg-slate-50/40" />;
  }

  const topSlot = primarySlot || carryOverSlot;
  const bottomSlot = nextStartingSlot || null;
  const split = !!carryOverSlot || !!nextStartingSlot;

  return (
    <div className="min-h-[116px] border-r border-slate-300 last:border-r-0 bg-white">
      {split ? (
        <div className="grid h-full min-h-[116px] grid-rows-2">
          <div className="border-b border-slate-200">
            {topSlot ? (
              <SlotCard
                {...renderSlotData(topSlot)}
                slot={topSlot}
                segmentType={carryOverSlot ? 'continuation' : 'half'}
                onClick={() => onSlotClick(topSlot)}
              />
            ) : (
              <div className="h-full min-h-[58px] bg-white" />
            )}
          </div>
          <div>
            {bottomSlot ? (
              <SlotCard
                {...renderSlotData(bottomSlot)}
                slot={bottomSlot}
                segmentType="half"
                onClick={() => onSlotClick(bottomSlot)}
              />
            ) : (
              <div className="h-full min-h-[58px] bg-white" />
            )}
          </div>
        </div>
      ) : (
        <SlotCard
          {...renderSlotData(primarySlot)}
          slot={primarySlot}
          segmentType="full"
          onClick={() => onSlotClick(primarySlot)}
        />
      )}
    </div>
  );
}