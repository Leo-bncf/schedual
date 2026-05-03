import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, XCircle, ChevronDown, ChevronUp, Users, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

function ConstraintRow({ name, score }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-700">{name}</span>
      <Badge className="bg-rose-100 text-rose-700 border-rose-200 font-mono text-xs">
        {score}
      </Badge>
    </div>
  );
}

export default function SolveConflictPanel({ selectedVersion }) {
  const [expanded, setExpanded] = useState(false);

  const details = selectedVersion?.conflict_details;
  const conflictsCount = selectedVersion?.conflicts_count ?? 0;

  if (!details && conflictsCount === 0) return null;

  const failed = details?.failed || [];
  const primaryCode = details?.primaryCode || 'SOLUTION_INFEASIBLE';
  const primaryBlocker = details?.primaryBlocker;

  // Aggregate constraint breakdown across all failed programmes
  const allConstraints = [];
  for (const f of failed) {
    if (Array.isArray(f.hardConstraintsBreakdown)) {
      for (const c of f.hardConstraintsBreakdown) {
        const existing = allConstraints.find(x => x.constraintName === c.constraintName);
        if (existing) {
          existing.score = (existing.score || 0) + (c.score || 0);
          existing.count = (existing.count || 0) + (c.count || 0);
        } else {
          allConstraints.push({ ...c });
        }
      }
    }
  }

  const overlapSamples = failed.flatMap(f => f.studentOverlapSamples || []).slice(0, 5);
  const totalHardScore = failed.reduce((sum, f) => sum + (f.hardScore || 0), 0);

  const codeLabel = {
    SOLUTION_INFEASIBLE: 'Infeasible',
    HARD_CONSTRAINTS_VIOLATED: 'Hard Constraints Violated',
    PRE_SOLVE_VALIDATION_FAILED: 'Validation Failed',
    STUDENT_OVERLAP_DETECTED: 'Student Overlap',
    ASSIGNMENT_COUNT_MISMATCH: 'Assignment Mismatch',
  }[primaryCode] || primaryCode;

  return (
    <Card className="border border-rose-200 bg-rose-50/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-rose-700 text-base">
            <XCircle className="w-5 h-5" />
            Last Solve Failed
            <Badge className="bg-rose-100 text-rose-700 border-rose-200 ml-1">{codeLabel}</Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="text-rose-600 hover:text-rose-800 hover:bg-rose-100"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Hide' : 'Details'}
          </Button>
        </div>
        {primaryBlocker && (
          <p className="text-sm text-rose-600 mt-1">
            <strong>Blocker:</strong> {primaryBlocker}
          </p>
        )}
        {totalHardScore < 0 && (
          <p className="text-xs text-rose-500 font-mono">Hard score: {totalHardScore}</p>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Per-programme failures */}
          {failed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Failed Programmes</p>
              <div className="space-y-2">
                {failed.map((f, i) => (
                  <div key={i} className="p-3 bg-white rounded-lg border border-rose-100">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-rose-600 text-white text-xs">{f.programme}</Badge>
                      <span className="text-xs text-slate-500">{f.stage || 'SOLVE'}</span>
                    </div>
                    {f.blocker && (
                      <p className="text-sm text-slate-700"><strong>Blocker:</strong> {f.blocker}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hard constraint breakdown */}
          {allConstraints.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Violated Constraints
              </p>
              <div className="bg-white rounded-lg border border-rose-100 px-3 divide-y divide-slate-100">
                {allConstraints
                  .filter(c => c.score < 0)
                  .sort((a, b) => (a.score || 0) - (b.score || 0))
                  .map((c, i) => (
                    <ConstraintRow key={i} name={c.constraintName} score={c.score} />
                  ))}
              </div>
            </div>
          )}

          {/* Student overlap samples */}
          {overlapSamples.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                <Users className="w-3 h-3 inline mr-1" />
                Student Overlap Samples
              </p>
              <div className="space-y-1">
                {overlapSamples.map((s, i) => (
                  <div key={i} className="text-xs text-slate-600 bg-white px-3 py-2 rounded border border-rose-100">
                    {JSON.stringify(s)}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Solved at: {details?.solvedAt ? new Date(details.solvedAt).toLocaleString() : 'unknown'}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
