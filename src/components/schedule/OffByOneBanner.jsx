import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function OffByOneBanner({ conflicts = [] }) {
  const relevant = conflicts.filter(c =>
    c.conflict_type === 'insufficient_hours' || c.conflict_type === 'ib_requirement_violation'
  );
  if (relevant.length === 0) return null;

  return (
    <Card className="p-4 border-2 border-amber-300 bg-amber-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-700 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-amber-900 mb-1">
            Detected subject hour mismatches ({relevant.length})
          </div>
          <ul className="list-disc ml-5 space-y-1 text-amber-900">
            {relevant.slice(0, 6).map((c) => (
              <li key={c.id}>{c.description}</li>
            ))}
          </ul>
          {relevant.length > 6 && (
            <div className="text-xs text-amber-800 mt-1">
              +{relevant.length - 6} more… See full details in the Issues panel below.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}