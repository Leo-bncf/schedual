import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function GlobalPeriodCoverageReport({ 
  periodCoverageData, 
  teachingGroups, 
  subjects,
  periodDurationMinutes = 60,
  missingPeriodsByReason = {},
  unmetRequirements = [],
  subjectRequirements = [] // SOURCE OF TRUTH for requiredPeriods by section
}) {
  // Detect unmappable timeslot_ids in slots
  const unmappableSlots = React.useMemo(() => {
    if (!periodCoverageData || !Array.isArray(periodCoverageData)) return { count: 0, details: [] };
    
    const unmappable = [];
    periodCoverageData.forEach(section => {
      // Check if section has slots that couldn't be mapped to UI
      if (section.unmappableTimeslotCount && section.unmappableTimeslotCount > 0) {
        unmappable.push({
          section: section.studentGroup || section.section,
          count: section.unmappableTimeslotCount,
          timeslotIds: section.unmappableTimeslotIds || []
        });
      }
    });
    
    return {
      count: unmappable.reduce((sum, item) => sum + item.count, 0),
      details: unmappable
    };
  }, [periodCoverageData]);

  const coverageReport = React.useMemo(() => {
    if (!periodCoverageData) return null;
    
    const coverageArray = Array.isArray(periodCoverageData) 
      ? periodCoverageData 
      : Object.values(periodCoverageData);
    
    // Map and enrich coverage data
    const enriched = coverageArray.map(cov => {
      const tgId = String(cov.studentGroup || cov.section || '').replace('TG_', '');
      const tg = teachingGroups.find(g => g.id === tgId);
      const subj = tg ? subjects.find(s => s.id === tg.subject_id) : null;
      const level = tg?.level || '?';
      const yearGroup = tg?.year_group || '?';
      const isDPHL = level === 'HL' && (subj?.ib_level === 'DP' || yearGroup?.includes('DP'));
      const isDPSL = level === 'SL' && (subj?.ib_level === 'DP' || yearGroup?.includes('DP'));
      
      // SOURCE OF TRUTH for Expected: 1) TG.periods_per_week 2) subjectRequirements.requiredPeriods 3) cov.requiredPeriods
      const studentGroupKey = cov.studentGroup || cov.section;
      const reqFromSubjectReqs = subjectRequirements.find(r => r.studentGroup === studentGroupKey);
      const expectedPeriods = tg?.periods_per_week || reqFromSubjectReqs?.requiredPeriods || cov.requiredPeriods || null;
      
      const expectedIB = isDPHL ? 6 : isDPSL ? 4 : null; // IB 2026 standards: HL=6, SL=4
      const inputBad = expectedIB && expectedPeriods && expectedPeriods < expectedIB;
      const missing = cov.missingPeriods || 0;
      const solverBlocked = !inputBad && expectedIB && expectedPeriods && expectedPeriods >= expectedIB && missing > 0;
      
      return {
        ...cov,
        tgId,
        tgName: tg?.name || 'Unknown',
        subjectCode: subj?.code || subj?.name || '?',
        level,
        yearGroup,
        isDPHL,
        isDPSL,
        expectedPeriods, // OVERRIDE: Use TG.periods_per_week as source of truth
        expectedIB,
        inputBad,
        solverBlocked,
        studentCount: tg?.student_ids?.length || 0,
        minutesPerWeek: cov.minutesPerWeek || tg?.minutes_per_week || null
      };
    });
    
    // Sort: missingPeriods DESC, then requiredPeriods DESC
    enriched.sort((a, b) => {
      if ((b.missingPeriods || 0) !== (a.missingPeriods || 0)) {
        return (b.missingPeriods || 0) - (a.missingPeriods || 0);
      }
      return b.requiredPeriods - a.requiredPeriods;
    });
    
    // Calculate statistics
    const totalSections = enriched.length;
    const sectionsWithMissing = enriched.filter(c => (c.missingPeriods || 0) > 0).length;
    const percentIncomplete = totalSections > 0 ? Math.round((sectionsWithMissing / totalSections) * 100) : 0;
    const inputBadHL = enriched.filter(c => c.isDPHL && c.inputBad);
    const inputBadSL = enriched.filter(c => c.isDPSL && c.inputBad);
    const solverBlockedSections = enriched.filter(c => c.solverBlocked);
    
    return {
      enriched,
      totalSections,
      sectionsWithMissing,
      percentIncomplete,
      inputBadHL,
      inputBadSL,
      solverBlockedSections,
      hasInputErrors: inputBadHL.length > 0 || inputBadSL.length > 0,
      hasSolverErrors: solverBlockedSections.length > 0
    };
  }, [periodCoverageData, teachingGroups, subjects, periodDurationMinutes]);

  if (!coverageReport) {
    return (
      <Card className="border-slate-300 bg-slate-50">
        <CardContent className="p-6 text-center text-sm text-slate-500">
          No period coverage data available. Run solver with debug=true to enable.
        </CardContent>
      </Card>
    );
  }

  const { 
    enriched, 
    totalSections, 
    sectionsWithMissing, 
    percentIncomplete,
    inputBadHL,
    inputBadSL,
    solverBlockedSections,
    hasInputErrors,
    hasSolverErrors
  } = coverageReport;

  const isComplete = sectionsWithMissing === 0;
  const cardColor = hasInputErrors ? 'border-amber-400 bg-amber-50' :
                    hasSolverErrors ? 'border-rose-400 bg-rose-50' :
                    isComplete ? 'border-green-400 bg-green-50' :
                    'border-blue-300 bg-blue-50';

  return (
    <Card className={`border-2 ${cardColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {hasInputErrors ? (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            ) : hasSolverErrors ? (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            ) : isComplete ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-blue-600" />
            )}
            Global Period Coverage Report
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={isComplete ? 'default' : 'destructive'} className="text-sm">
              {sectionsWithMissing}/{totalSections} sections incomplete ({percentIncomplete}%)
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* INPUT ERROR ALERTS */}
        {hasInputErrors && (
          <div className="p-4 bg-amber-100 border-2 border-amber-400 rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <XCircle className="w-5 h-5" />
              INPUT ERROR: requiredPeriods trop bas (IB standards non respectés)
            </div>
            <div className="text-sm text-amber-900">
            <div className="font-semibold mb-1">Règle IB 2026 (si period=60min):</div>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>HL = 360min/semaine (6h) → <strong>6 périodes/semaine minimum</strong></li>
              <li>SL = 240min/semaine (4h) → <strong>4 périodes/semaine minimum</strong></li>
            </ul>
            </div>
            
            {inputBadHL.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded border border-amber-300">
                <div className="font-bold text-amber-900 mb-2">
                  ❌ {inputBadHL.length} sections HL avec expectedPeriods {'<'} 6:
                </div>
                <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                  {inputBadHL.slice(0, 10).map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{c.subjectCode} - {c.tgName}</span>
                      <span className="font-mono font-bold text-rose-700">
                        {c.expectedPeriods}/6 ({c.minutesPerWeek || '?'}min)
                      </span>
                    </div>
                  ))}
                  {inputBadHL.length > 10 && (
                    <div className="text-slate-500">... +{inputBadHL.length - 10} more</div>
                  )}
                </div>
              </div>
            )}
            
            {inputBadSL.length > 0 && (
              <div className="mt-3 p-3 bg-white rounded border border-amber-300">
                <div className="font-bold text-amber-900 mb-2">
                  ❌ {inputBadSL.length} sections SL avec expectedPeriods {'<'} 4:
                </div>
                <div className="space-y-1 text-xs max-h-32 overflow-y-auto">
                  {inputBadSL.slice(0, 10).map((c, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{c.subjectCode} - {c.tgName}</span>
                      <span className="font-mono font-bold text-rose-700">
                        {c.expectedPeriods}/4 ({c.minutesPerWeek || '?'}min)
                      </span>
                    </div>
                  ))}
                  {inputBadSL.length > 10 && (
                    <div className="text-slate-500">... +{inputBadSL.length - 10} more</div>
                  )}
                </div>
              </div>
            )}
            
            <div className="mt-3 p-3 bg-amber-200 rounded border border-amber-400 text-sm text-amber-900 font-semibold">
              → À corriger: buildSchedulingProblem → minutesPerWeek calculation ou DP1+DP2 merging logic
            </div>
          </div>
        )}

        {/* SOLVER BLOCKED ALERTS */}
        {hasSolverErrors && !hasInputErrors && (
          <div className="p-4 bg-rose-100 border-2 border-rose-400 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-rose-900 font-bold">
              <AlertTriangle className="w-5 h-5" />
              SOLVER BLOCKED: {solverBlockedSections.length} sections correctes mais partiellement schedulées
            </div>
            <div className="text-sm text-rose-900">
              requiredPeriods respecte les standards IB, mais le solver n'a pas pu placer toutes les périodes.
            </div>
            
            {/* Missing Periods Breakdown by Reason */}
            {Object.keys(missingPeriodsByReason).length > 0 && (
              <div className="p-3 bg-white rounded border border-rose-300">
                <div className="font-bold text-rose-900 mb-2">📊 Missing Periods Breakdown by Reason:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(missingPeriodsByReason)
                    .sort((a, b) => b[1] - a[1])
                    .map(([reason, count]) => (
                      <div key={reason} className="flex justify-between items-center p-2 bg-rose-50 rounded">
                        <span className="font-medium">{reason.replace(/_/g, ' ')}</span>
                        <Badge variant="destructive" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Unmet Requirements Details */}
            {unmetRequirements.length > 0 && (
              <div className="p-3 bg-white rounded border border-rose-300">
                <div className="font-bold text-rose-900 mb-2">❌ Unmet Requirements ({unmetRequirements.length}):</div>
                <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                  {unmetRequirements.slice(0, 15).map((req, i) => (
                    <div key={i} className="flex justify-between items-start p-2 bg-rose-50 rounded border border-rose-200">
                      <div className="flex-1">
                        <div className="font-semibold">{req.subject} - {req.section}</div>
                        <div className="text-[10px] text-slate-600">
                          Reason: <span className="font-medium text-rose-700">{req.reason || 'unknown'}</span>
                        </div>
                      </div>
                      <div className="text-right font-mono text-rose-700 font-bold">
                        -{req.missing || 0}p
                      </div>
                    </div>
                  ))}
                  {unmetRequirements.length > 15 && (
                    <div className="text-slate-500 text-center">... +{unmetRequirements.length - 15} more</div>
                  )}
                </div>
              </div>
            )}
            
            {/* Unmappable Timeslots Warning */}
            {unmappableSlots.count > 0 && (
              <div className="p-3 bg-amber-100 border border-amber-400 rounded">
                <div className="font-bold text-amber-900 mb-2">
                  ⚠️ UI Mapping Bug: {unmappableSlots.count} slots non rendus (timeslot_id non mappable)
                </div>
                <div className="text-xs text-amber-900 space-y-1">
                  <p>Ces slots existent dans la DB mais ne s'affichent pas car timeslot_id invalide.</p>
                  <div className="max-h-32 overflow-y-auto mt-2 space-y-1">
                    {unmappableSlots.details.slice(0, 10).map((item, i) => (
                      <div key={i} className="bg-white p-2 rounded border border-amber-300">
                        <span className="font-semibold">{item.section}</span>: {item.count} slots
                        {item.timeslotIds.length > 0 && (
                          <span className="text-[10px] text-slate-600 ml-2">
                            (IDs: {item.timeslotIds.join(', ')})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-3 p-3 bg-white rounded border border-rose-300">
              <div className="font-bold text-rose-900 mb-2">Top {Math.min(20, solverBlockedSections.length)} sections bloquées:</div>
              <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                {solverBlockedSections.slice(0, 20).map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-rose-50 rounded border border-rose-200">
                    <div className="flex-1">
                      <div className="font-semibold">{c.subjectCode} {c.level} - {c.tgName}</div>
                      <div className="text-[10px] text-slate-600">
                        {c.yearGroup} | {c.studentCount} students | {c.minutesPerWeek || '?'}min/sem
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-rose-700">
                        {c.scheduledPeriods}/{c.requiredPeriods}
                      </div>
                      <div className="text-[10px] text-rose-600 font-semibold">-{c.missingPeriods} missing</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-rose-200 rounded border border-rose-400 text-sm text-rose-900 space-y-1">
              <div className="font-semibold">Causes possibles:</div>
              <ul className="list-disc ml-5 text-xs space-y-0.5">
                <li>Enseignants insuffisants ou indisponibles pour ces créneaux</li>
                <li>Salles insuffisantes (surtout labs/special rooms)</li>
                <li>Conflits avec d'autres cours (élèves déjà occupés)</li>
                <li>Contraintes hard trop strictes</li>
                <li>blockId concurrency issues (electives qui bloquent des créneaux)</li>
              </ul>
              <div className="mt-2 font-bold">→ Vérifier: teacher availability, room capacity, hard constraints</div>
            </div>
          </div>
        )}

        {/* COMPLETE SUCCESS */}
        {isComplete && (
          <div className="p-4 bg-green-100 border-2 border-green-400 rounded-lg">
            <div className="flex items-center gap-2 text-green-900 font-bold">
              <CheckCircle className="w-5 h-5" />
              ✅ Schedule Complete: toutes les sections 100% schedulées
            </div>
          </div>
        )}

        {/* DIAGNOSTIC LEGEND */}
        <div className="p-3 bg-slate-100 rounded border border-slate-300 text-xs space-y-2">
        <div className="font-bold text-slate-900">📋 Interprétation des statuts:</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="flex items-start gap-2">
            <Badge className="bg-amber-200 text-amber-900 text-[10px] mt-0.5">INPUT_BAD</Badge>
            <span className="text-[10px]">
              expectedPeriods &lt; 6 (HL) ou &lt; 4 (SL) → Bug TeachingGroup config ou buildSchedulingProblem
            </span>
          </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-rose-200 text-rose-900 text-[10px] mt-0.5">SOLVER_BLOCKED</Badge>
              <span className="text-[10px]">
                expectedPeriods OK mais missingPeriods &gt; 0 → Conflits prof/salle/bloc
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-200 text-blue-900 text-[10px] mt-0.5">UI_MAP</Badge>
              <span className="text-[10px]">
                scheduledPeriods == expectedPeriods mais pas visible → Bug TimetableGrid mapping
              </span>
            </div>
          </div>
        </div>

        {/* FULL TABLE */}
        <div className="rounded-lg border-2 border-slate-300 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-slate-100 sticky top-0">
                <TableRow>
                  <TableHead className="w-[250px]">Teaching Group</TableHead>
                  <TableHead className="w-[120px]">Subject</TableHead>
                  <TableHead className="w-[60px]">Level</TableHead>
                  <TableHead className="w-[80px]">Year</TableHead>
                  <TableHead className="text-right w-[70px]">Min/Wk</TableHead>
                  <TableHead className="text-right w-[70px]">Required</TableHead>
                  <TableHead className="text-right w-[70px]">Scheduled</TableHead>
                  <TableHead className="text-right w-[70px]">Missing</TableHead>
                  <TableHead className="w-[100px]">Diagnostic</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((cov, idx) => {
                  const missing = cov.missingPeriods || 0;
                  const isError = cov.inputBad || cov.solverBlocked;
                  const hasUIBug = cov.scheduledPeriods === cov.expectedPeriods && missing === 0 && unmappableSlots.details.some(d => d.section === (cov.studentGroup || cov.section));
                  
                  return (
                    <TableRow 
                      key={idx} 
                      className={
                        cov.inputBad ? 'bg-amber-100 hover:bg-amber-200' :
                        cov.solverBlocked ? 'bg-rose-100 hover:bg-rose-200' :
                        hasUIBug ? 'bg-blue-100 hover:bg-blue-200' :
                        missing > 0 ? 'bg-blue-50 hover:bg-blue-100' :
                        'hover:bg-slate-50'
                      }
                    >
                      <TableCell className="font-medium text-xs">
                        <div>{cov.tgName}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">{cov.studentGroup || cov.section}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold">{cov.subjectCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          cov.isDPHL ? 'bg-indigo-100 text-indigo-800 text-xs' :
                          cov.isDPSL ? 'bg-blue-100 text-blue-800 text-xs' :
                          'text-xs'
                        }>
                          {cov.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">{cov.yearGroup}</TableCell>
                      <TableCell className="text-right text-xs text-slate-600">
                        {cov.minutesPerWeek || '?'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {cov.expectedPeriods !== null && cov.expectedPeriods !== undefined ? (
                          <>
                            <div className={cov.inputBad ? 'text-amber-700' : 'text-slate-900'}>
                              {cov.expectedPeriods}
                            </div>
                            {cov.inputBad && cov.expectedIB && (
                              <div className="text-[9px] text-amber-600">IB: {cov.expectedIB}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-900">
                        {cov.scheduledPeriods}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        <span className={missing > 0 ? 'text-rose-700' : 'text-green-700'}>
                          {missing > 0 ? `-${missing}` : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {hasUIBug ? (
                          <Badge className="bg-blue-200 text-blue-900 text-[10px]">UI_MAP</Badge>
                        ) : cov.inputBad ? (
                          <Badge className="bg-amber-200 text-amber-900 text-[10px]">INPUT_BAD</Badge>
                        ) : cov.solverBlocked ? (
                          <Badge className="bg-rose-200 text-rose-900 text-[10px]">SOLVER_BLOCKED</Badge>
                        ) : missing > 0 ? (
                          <Badge className="bg-blue-200 text-blue-900 text-[10px]">INCOMPLETE</Badge>
                        ) : (
                          <Badge className="bg-green-200 text-green-900 text-[10px]">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* SUMMARY STATS */}
        <div className="grid md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-white border border-slate-200">
            <div className="font-semibold text-slate-900 mb-1">Total Coverage</div>
            <div className="text-2xl font-bold text-slate-900">{totalSections - sectionsWithMissing}/{totalSections}</div>
            <div className="text-slate-600">sections fully scheduled</div>
          </div>
          
          {hasInputErrors && (
            <div className="p-3 rounded-lg bg-amber-100 border border-amber-300">
              <div className="font-semibold text-amber-900 mb-1">Input Errors</div>
              <div className="space-y-1">
                <div>HL sections {'<'} 6 periods: <strong className="text-amber-800">{inputBadHL.length}</strong></div>
                <div>SL sections {'<'} 4 periods: <strong className="text-amber-800">{inputBadSL.length}</strong></div>
              </div>
            </div>
          )}
          
          {hasSolverErrors && (
            <div className="p-3 rounded-lg bg-rose-100 border border-rose-300">
              <div className="font-semibold text-rose-900 mb-1">Solver Blocked</div>
              <div className="text-2xl font-bold text-rose-900">{solverBlockedSections.length}</div>
              <div className="text-rose-700">sections avec périodes manquantes</div>
            </div>
          )}
        </div>

        {/* STRICT MODE WARNING */}
        {sectionsWithMissing > 0 && (
          <div className="p-4 bg-slate-900 text-white rounded-lg">
            <div className="flex items-center gap-2 font-bold mb-2">
              <XCircle className="w-5 h-5" />
              ⛔ STRICT MODE: PUBLICATION BLOQUÉE
            </div>
            <div className="text-sm">
              Schedule incomplet ({percentIncomplete}% sections avec périodes manquantes).
              {hasInputErrors && (
                <div className="mt-2 text-amber-300 font-semibold">
                  → À corriger d'abord: buildSchedulingProblem (minutesPerWeek / periodDurationMinutes / DP1+DP2)
                </div>
              )}
              {hasSolverErrors && !hasInputErrors && (
                <div className="mt-2 text-rose-300 font-semibold">
                  → Résoudre: contraintes solveur ou allocation ressources (teachers/rooms)
                </div>
              )}
              <div className="mt-3 p-2 bg-white/10 rounded text-xs text-white">
                Le bouton "Publish" sera désactivé tant que des périodes sont manquantes.
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}