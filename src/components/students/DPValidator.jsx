import React from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

export default function DPValidator({ subjectChoices, subjects }) {
  const violations = [];
  const warnings = [];
  const validations = [];
  const specialDpCodes = new Set(['TOK', 'EE', 'TEST']);
  const diplomaChoices = subjectChoices.filter((choice) => {
    const subject = subjects.find((item) => item.id === choice.subject_id);
    const code = String(subject?.code || '').trim().toUpperCase();
    return !subject?.is_core && !specialDpCodes.has(code);
  });

  // Get HL and SL counts
  const hlSubjects = diplomaChoices.filter(sc => sc.level === 'HL');
  const slSubjects = diplomaChoices.filter(sc => sc.level === 'SL');
  const totalSubjects = diplomaChoices.length;

  // Rule S3: Exactly 6 subjects
  if (totalSubjects === 6) {
    validations.push({ rule: 'S3', message: 'Exactly 6 DP subjects ✓', status: 'success' });
  } else if (totalSubjects < 6) {
    violations.push({ rule: 'S3', message: `Only ${totalSubjects}/6 subjects selected`, severity: 'high' });
  } else {
    violations.push({ rule: 'S3', message: `Too many subjects: ${totalSubjects}/6`, severity: 'high' });
  }

  // Rule S4: 3-4 HL, rest SL
  const hlCount = hlSubjects.length;
  if (hlCount >= 3 && hlCount <= 4) {
    validations.push({ rule: 'S4', message: `${hlCount} HL subjects (valid range: 3-4) ✓`, status: 'success' });
  } else {
    violations.push({ 
      rule: 'S4', 
      message: `${hlCount} HL subjects (must be 3 or 4)`, 
      severity: 'critical' 
    });
  }

  // Rule S3: At least 5 different IB groups
  const uniqueGroups = new Set(diplomaChoices.map(sc => sc.ib_group).filter(Boolean));
  if (uniqueGroups.size >= 5) {
    validations.push({ rule: 'S3', message: `${uniqueGroups.size} IB groups covered (min: 5) ✓`, status: 'success' });
  } else {
    violations.push({ 
      rule: 'S3', 
      message: `Only ${uniqueGroups.size}/5 IB groups covered`, 
      severity: 'high' 
    });
  }

  // Rule S8: One subject per group (check duplicates)
  const groupCounts = {};
  diplomaChoices.forEach(sc => {
    const subject = subjects.find(s => s.id === sc.subject_id);
    if (subject && subject.ib_group) {
      groupCounts[subject.ib_group] = (groupCounts[subject.ib_group] || 0) + 1;
    }
  });

  Object.entries(groupCounts).forEach(([group, count]) => {
    if (count > 1) {
      warnings.push({ 
        rule: 'S8', 
        message: `Multiple subjects from Group ${group} (${count})`, 
        severity: 'medium' 
      });
    }
  });

  // Check for balanced workload (soft constraint)
  if (hlCount === 4) {
    warnings.push({ 
      rule: 'S10', 
      message: '4 HL subjects is demanding - ensure student workload is manageable', 
      severity: 'low' 
    });
  }

  const hasViolations = violations.length > 0;
  const hasWarnings = warnings.length > 0;
  const isValid = !hasViolations && totalSubjects === 6;

  return (
    <Card className={`border-0 shadow-sm ${
      hasViolations ? 'ring-2 ring-rose-200' : 
      hasWarnings ? 'ring-2 ring-amber-200' : 
      isValid ? 'ring-2 ring-emerald-200' : ''
    }`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {hasViolations ? (
            <>
              <AlertCircle className="w-5 h-5 text-rose-600" />
              DP Requirements Validation
            </>
          ) : isValid ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              DP Requirements Met
            </>
          ) : (
            <>
              <Info className="w-5 h-5 text-blue-600" />
              DP Requirements Validation
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge className={totalSubjects === 6 ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
            {totalSubjects}/6 Subjects
          </Badge>
          <Badge className={hlCount >= 3 && hlCount <= 4 ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-rose-100 text-rose-700 border-0'}>
            {hlCount} HL
          </Badge>
          <Badge className={slSubjects.length === (6 - hlCount) && totalSubjects === 6 ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-600 border-0'}>
            {slSubjects.length} SL
          </Badge>
          <Badge className={uniqueGroups.size >= 5 ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-rose-100 text-rose-700 border-0'}>
            {uniqueGroups.size}/5+ Groups
          </Badge>
        </div>

        {/* Violations */}
        {violations.length > 0 && (
          <div className="space-y-2">
            {violations.map((v, i) => (
              <Alert key={i} className="border-rose-200 bg-rose-50">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <AlertTitle className="text-rose-900 text-sm">Rule {v.rule} Violation</AlertTitle>
                <AlertDescription className="text-rose-700 text-sm">{v.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <Alert key={i} className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900 text-sm">Rule {w.rule} Warning</AlertTitle>
                <AlertDescription className="text-amber-700 text-sm">{w.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {/* Success validations */}
        {isValid && validations.length > 0 && (
          <div className="space-y-1">
            {validations.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle className="w-4 h-4" />
                <span>{v.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Help text */}
        {!isValid && (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>DP Requirements:</strong> Students must take exactly 6 subjects (3-4 HL, rest SL) 
              from at least 5 different IB groups (1-6).
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}