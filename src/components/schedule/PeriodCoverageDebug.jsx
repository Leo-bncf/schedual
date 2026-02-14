import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

export default function PeriodCoverageDebug({ 
  periodCoverageData, 
  students, 
  teachingGroups, 
  subjects,
  selectedStudentId,
  onStudentChange 
}) {
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  
  // Filter coverage data for selected student's teaching groups
  const studentCoverage = React.useMemo(() => {
    if (!selectedStudent || !periodCoverageData) return [];
    
    const assignedTGIds = selectedStudent.assigned_groups || [];
    const coverageArray = Array.isArray(periodCoverageData) 
      ? periodCoverageData 
      : Object.values(periodCoverageData);
    
    return coverageArray.filter(cov => {
      const tgId = String(cov.studentGroup || cov.section || '').replace('TG_', '');
      return assignedTGIds.includes(tgId);
    }).map(cov => {
      const tgId = String(cov.studentGroup || cov.section || '').replace('TG_', '');
      const tg = teachingGroups.find(g => g.id === tgId);
      const subj = tg ? subjects.find(s => s.id === tg.subject_id) : null;
      const level = tg?.level || '?';
      const isDPHL = level === 'HL' && (subj?.ib_level === 'DP' || tg?.year_group?.includes('DP'));
      const isDPSL = level === 'SL' && (subj?.ib_level === 'DP' || tg?.year_group?.includes('DP'));
      const expectedIB = isDPHL ? 5 : isDPSL ? 3 : null;
      const inputMismatch = expectedIB && cov.requiredPeriods !== expectedIB;
      
      return {
        ...cov,
        tgId,
        tgName: tg?.name || 'Unknown',
        subjectCode: subj?.code || subj?.name || '?',
        level,
        isDPHL,
        isDPSL,
        expectedIB,
        inputMismatch,
        studentCount: tg?.student_ids?.length || 0
      };
    });
  }, [selectedStudent, periodCoverageData, teachingGroups, subjects]);

  const totalExpected = studentCoverage.reduce((sum, c) => sum + c.requiredPeriods, 0);
  const totalScheduled = studentCoverage.reduce((sum, c) => sum + c.scheduledPeriods, 0);
  const totalMissing = studentCoverage.reduce((sum, c) => sum + (c.missingPeriods || 0), 0);
  const hasInputMismatches = studentCoverage.some(c => c.inputMismatch);
  const hasSolverMismatches = studentCoverage.some(c => !c.inputMismatch && (c.missingPeriods || 0) > 0);

  if (!periodCoverageData) {
    return (
      <Card className="border-slate-300 bg-slate-50">
        <CardContent className="p-4 text-center text-sm text-slate-500">
          No period coverage data available. Run solver with debug=true to see detailed metrics.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${hasSolverMismatches ? 'border-rose-400 bg-rose-50' : hasInputMismatches ? 'border-amber-400 bg-amber-50' : 'border-green-400 bg-green-50'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {hasSolverMismatches ? (
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          ) : hasInputMismatches ? (
            <Info className="w-5 h-5 text-amber-600" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          Solver Debug: Period Coverage by Teaching Group
        </CardTitle>
        <div className="flex items-center gap-3 mt-2">
          <Select value={selectedStudentId || ''} onValueChange={onStudentChange}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select student to analyze..." />
            </SelectTrigger>
            <SelectContent>
              {students.map(student => (
                <SelectItem key={student.id} value={student.id}>
                  {student.full_name} ({student.year_group})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStudent && (
            <div className="flex gap-2 text-xs">
              <Badge>{totalScheduled}/{totalExpected} periods scheduled</Badge>
              {totalMissing > 0 && (
                <Badge variant="destructive">{totalMissing} missing</Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {selectedStudent && studentCoverage.length > 0 && (
        <CardContent className="space-y-3">
          {/* Summary Alert */}
          {hasInputMismatches && (
            <div className="p-3 bg-amber-100 border-2 border-amber-400 rounded-lg text-xs text-amber-900">
              <div className="font-bold mb-1">⚠️ INPUT ERROR: requiredPeriods mismatch</div>
              <div>Some teaching groups have incorrect requiredPeriods (HL should be 5, SL should be 3 for 60min periods).</div>
              <div className="mt-1 font-semibold">→ Check buildSchedulingProblem: minutesPerWeek calculation or DP1+DP2 merging logic</div>
            </div>
          )}
          
          {hasSolverMismatches && !hasInputMismatches && (
            <div className="p-3 bg-rose-100 border-2 border-rose-400 rounded-lg text-xs text-rose-900">
              <div className="font-bold mb-1">⚠️ SOLVER BLOCKED: requiredPeriods correct but missingPeriods {'>'} 0</div>
              <div>Solver could not schedule all required periods. Likely cause: insufficient resources or conflicting constraints.</div>
              <div className="mt-1 font-semibold">→ Check: teacher availability, room capacity, or hard constraints blocking slots</div>
            </div>
          )}

          {/* Detailed Breakdown */}
          <div className="space-y-2">
            {studentCoverage.map((cov, idx) => {
              const missing = cov.missingPeriods || 0;
              const isInputError = cov.inputMismatch;
              const isSolverError = !isInputError && missing > 0;
              
              return (
                <div key={idx} className={`p-3 rounded-lg border-2 text-xs ${
                  isSolverError ? 'bg-rose-100 border-rose-400' : 
                  isInputError ? 'bg-amber-100 border-amber-400' : 
                  'bg-white border-slate-200'
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-slate-900">{cov.subjectCode}</span>
                        <Badge variant="outline" className={
                          cov.isDPHL ? 'bg-indigo-100 text-indigo-800' :
                          cov.isDPSL ? 'bg-blue-100 text-blue-800' :
                          'bg-slate-100'
                        }>
                          {cov.level}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        <div>TG: {cov.tgName} ({cov.studentCount} students)</div>
                        <div className="font-mono text-slate-500">{cov.studentGroup || cov.section}</div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`font-bold text-lg ${
                        missing > 0 ? 'text-rose-700' : 'text-green-700'
                      }`}>
                        {cov.scheduledPeriods}/{cov.requiredPeriods}
                      </div>
                      {missing > 0 && (
                        <div className="text-rose-700 font-semibold">-{missing} périodes</div>
                      )}
                    </div>
                  </div>

                  {/* Diagnostic info */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div className="text-[11px] text-slate-600">
                      {cov.minutesPerWeek && (
                        <span>{cov.minutesPerWeek}min/sem</span>
                      )}
                    </div>
                    
                    {isInputError && (
                      <div className="flex items-center gap-1 text-amber-700 font-semibold text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        IB Standard: {cov.expectedIB}p/sem (got {cov.requiredPeriods})
                      </div>
                    )}
                    
                    {isSolverError && (
                      <div className="flex items-center gap-1 text-rose-700 font-semibold text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        Solver blocked
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="pt-3 border-t-2 border-slate-300">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-slate-900">Total for {selectedStudent.full_name}:</span>
              <span className={totalMissing > 0 ? 'text-rose-700' : 'text-green-700'}>
                {totalScheduled}/{totalExpected} periods {totalMissing > 0 && `(${totalMissing} missing)`}
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}