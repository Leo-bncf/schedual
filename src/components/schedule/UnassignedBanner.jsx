import React from "react";
import { AlertTriangle } from "lucide-react";

export default function UnassignedBanner({ unassigned = {} }) {
  const entries = Object.entries(unassigned || {}).filter(([_, v]) => (v || 0) > 0);
  if (entries.length === 0) return null;
  return (
    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
      <div className="flex items-center gap-2 font-semibold mb-1">
        <AlertTriangle className="w-4 h-4" />
        Unassigned lessons detected
      </div>
      <div className="text-xs flex flex-wrap gap-3">
        {entries.slice(0, 12).map(([k, v]) => (
          <span key={k}>{k}: <strong>{v}</strong></span>
        ))}
        {entries.length > 12 && <span>+{entries.length - 12} more…</span>}
      </div>
    </div>
  );
}