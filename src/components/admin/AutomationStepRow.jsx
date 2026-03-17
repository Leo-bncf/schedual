import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

export default function AutomationStepRow({ title, description, checked, delayHours, onToggle, onDelayChange }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        <Switch checked={checked} onCheckedChange={onToggle} />
        <div>
          <div className="text-sm font-medium text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 md:w-36">
        <span className="text-xs text-slate-500">Delay</span>
        <Input
          type="number"
          min="0"
          value={delayHours}
          onChange={(e) => onDelayChange(Number(e.target.value) || 0)}
          className="h-9"
        />
        <span className="text-xs text-slate-500">hrs</span>
      </div>
    </div>
  );
}