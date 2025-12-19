import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ConstraintValidator({ constraints }) {
  const conflicts = [];
  const suggestions = [];

  // Check for conflicting hard constraints
  const hardConstraints = constraints.filter(c => c.type === 'hard' && c.is_active);
  
  // Rule: Teacher Qualification + No Double Booking
  const hasQualificationCheck = hardConstraints.some(c => 
    c.name?.includes('Qualification') || c.rule?.type === 'qualification_check'
  );
  const hasDoubleBooking = hardConstraints.some(c => 
    c.name?.includes('Double Booking') || c.rule?.type === 'no_overlap'
  );

  if (hasQualificationCheck && hasDoubleBooking) {
    suggestions.push({
      message: 'Teacher Qualification and No Double Booking constraints work together correctly',
      status: 'success'
    });
  }

  // Check for overlapping soft constraints
  const softConstraints = constraints.filter(c => c.type === 'soft' && c.is_active);
  const freeDayConstraints = softConstraints.filter(c => 
    c.name?.includes('Free Day') || c.rule?.type === 'free_day'
  );

  if (freeDayConstraints.length > 1) {
    conflicts.push({
      message: `Multiple "Free Day" soft constraints detected (${freeDayConstraints.length}). Consider consolidating them.`,
      severity: 'warning'
    });
  }

  // Check for missing critical constraints
  if (!hasQualificationCheck) {
    conflicts.push({
      message: 'Missing "Teacher Qualification Match" hard constraint. Teachers may be assigned to unauthorized subjects.',
      severity: 'critical'
    });
  }

  if (!hasDoubleBooking) {
    conflicts.push({
      message: 'Missing "No Double Booking" hard constraint. Schedule conflicts may occur.',
      severity: 'critical'
    });
  }

  // Check for balanced constraint weights
  const totalWeight = softConstraints.reduce((sum, c) => sum + (c.weight || 0), 0);
  if (softConstraints.length > 0 && totalWeight === 0) {
    suggestions.push({
      message: 'All soft constraints have 0 weight. Consider assigning weights to prioritize them.',
      status: 'info'
    });
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-500" />
          Constraint Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Conflicts */}
        {conflicts.map((conflict, i) => (
          <Alert key={i} className={
            conflict.severity === 'critical' 
              ? 'border-rose-200 bg-rose-50' 
              : 'border-amber-200 bg-amber-50'
          }>
            <AlertCircle className={`h-4 w-4 ${
              conflict.severity === 'critical' ? 'text-rose-600' : 'text-amber-600'
            }`} />
            <AlertDescription className={
              conflict.severity === 'critical' ? 'text-rose-700' : 'text-amber-700'
            }>
              {conflict.message}
            </AlertDescription>
          </Alert>
        ))}

        {/* Success messages */}
        {suggestions.filter(s => s.status === 'success').map((sugg, i) => (
          <Alert key={i} className="border-emerald-200 bg-emerald-50">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-emerald-700">
              {sugg.message}
            </AlertDescription>
          </Alert>
        ))}

        {/* Info messages */}
        {suggestions.filter(s => s.status === 'info').map((sugg, i) => (
          <Alert key={i} className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700">
              {sugg.message}
            </AlertDescription>
          </Alert>
        ))}

        {conflicts.length === 0 && suggestions.filter(s => s.status === 'success').length > 0 && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-sm text-emerald-700">
              ✓ No constraint conflicts detected. Your rules are properly configured.
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="pt-3 border-t border-slate-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500">Hard Constraints</p>
              <p className="text-lg font-semibold text-slate-900">{hardConstraints.length}</p>
            </div>
            <div>
              <p className="text-slate-500">Soft Constraints</p>
              <p className="text-lg font-semibold text-slate-900">{softConstraints.length}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}