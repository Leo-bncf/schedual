import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Download, Users, Building2, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '../../utils';

export default function SolutionInfeasiblePanel({ result, onRetry }) {
  const [copiedRequestId, setCopiedRequestId] = React.useState(false);
  
  if (!result || result.stage !== 'SOLUTION_INFEASIBLE') return null;
  
  const requestId = result.requestId || result.meta?.requestId || null;
  const hardScore = result.meta?.hardScore || 0;
  const constraintBreakdown = result.constraintBreakdown || null;
  const topViolations = constraintBreakdown?.summary || [];
  
  const handleCopyRequestId = () => {
    if (!requestId) return;
    navigator.clipboard.writeText(requestId);
    setCopiedRequestId(true);
    toast.success('Request ID copied to clipboard');
    setTimeout(() => setCopiedRequestId(false), 2000);
  };
  
  const handleDownloadDiagnostics = () => {
    const diagnosticsData = {
      timestamp: new Date().toISOString(),
      requestId,
      stage: result.stage,
      hardScore,
      constraintBreakdown,
      violatingConstraints: result.violatingConstraints || [],
      teacherCapacitySummary: result.teacherCapacitySummary || null,
      roomCapacitySummary: result.roomCapacitySummary || null,
      suggestion: result.suggestion,
      requiredAction: result.requiredAction,
      meta: result.meta,
      details: result.details || []
    };
    
    const blob = new Blob([JSON.stringify(diagnosticsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solver-infeasible-${requestId || 'unknown'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Diagnostics JSON downloaded');
  };
  
  return (
    <Card className="border-2 border-rose-500 shadow-xl bg-gradient-to-br from-rose-50 to-rose-100">
      <CardHeader className="bg-rose-600 text-white">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6" />
          {result.title || 'Planning impossible (contraintes dures violées)'}
        </CardTitle>
        <CardDescription className="text-rose-50">
          {result.message || 'OptaPlanner n\'a pas pu satisfaire toutes les contraintes obligatoires.'} Planning actuel conservé : aucune modification appliquée.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6 space-y-6">
        {/* Request ID Section */}
        {requestId && (
          <div className="bg-white p-4 rounded-lg border border-rose-300">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-rose-900">Request ID (Solver Trace)</div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyRequestId}
                className="h-7 text-xs"
              >
                {copiedRequestId ? (
                  <><CheckCircle className="w-3 h-3 mr-1" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                )}
              </Button>
            </div>
            <code className="text-xs text-rose-700 font-mono bg-rose-50 px-2 py-1 rounded block">
              {requestId}
            </code>
          </div>
        )}
        
        {/* Hard Score Summary */}
        <div className="bg-white p-4 rounded-lg border border-rose-300">
          <div className="font-semibold text-rose-900 mb-2">Score Summary</div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-sm text-slate-600">Hard Score: </span>
              <span className="text-2xl font-bold text-rose-700">{hardScore}</span>
              <span className="text-sm text-slate-500 ml-2">(must be 0 or positive)</span>
            </div>
            {constraintBreakdown && (
              <>
                <div className="h-8 w-px bg-slate-300" />
                <div>
                  <span className="text-sm text-slate-600">Constraints Violated: </span>
                  <span className="text-xl font-bold text-rose-700">{constraintBreakdown.totalConstraintsViolated || 0}</span>
                </div>
                <div className="h-8 w-px bg-slate-300" />
                <div>
                  <span className="text-sm text-slate-600">Total Violations: </span>
                  <span className="text-xl font-bold text-rose-700">{constraintBreakdown.totalViolationCount || 0}</span>
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Top Violating Constraints */}
        {topViolations.length > 0 && (
          <div className="space-y-3">
            <div className="font-semibold text-rose-900">Top Violating Constraints:</div>
            {topViolations.slice(0, 5).map((violation, idx) => (
              <div key={idx} className="bg-white p-4 rounded-lg border-l-4 border-rose-500">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-rose-900 flex items-center gap-2">
                      {violation.constraintName}
                      <Badge className="bg-rose-100 text-rose-700 text-xs">
                        {violation.violationCount}× violations
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Score impact: <span className="font-mono text-rose-700">{violation.scoreImpact}</span>
                    </div>
                  </div>
                </div>
                
                {/* Sample Violations */}
                {violation.sampleViolations && violation.sampleViolations.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs font-semibold text-slate-700">Example violations:</div>
                    {violation.sampleViolations.slice(0, 3).map((example, i) => (
                      <div key={i} className="bg-rose-50 p-2 rounded text-xs font-mono">
                        <div className="space-y-0.5">
                          {example.teacher && (
                            <div><span className="text-slate-600">Teacher:</span> <span className="text-rose-700">{example.teacher.slice(0, 8)}...</span></div>
                          )}
                          {example.teachingGroup && (
                            <div><span className="text-slate-600">Teaching Group:</span> <span className="text-rose-700">{example.teachingGroup.slice(0, 8)}...</span></div>
                          )}
                          {example.room && (
                            <div><span className="text-slate-600">Room:</span> <span className="text-rose-700">{example.room.slice(0, 8)}...</span></div>
                          )}
                          {example.day && example.period && (
                            <div><span className="text-slate-600">Time:</span> <span className="text-rose-700">{example.day} Period {example.period}</span></div>
                          )}
                          {example.timeslot && (
                            <div><span className="text-slate-600">Timeslot:</span> <span className="text-rose-700">{example.timeslot}</span></div>
                          )}
                          {example.description && (
                            <div className="text-slate-600 mt-1 italic">{example.description.slice(0, 150)}{example.description.length > 150 ? '...' : ''}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {topViolations.length > 5 && (
              <div className="text-sm text-slate-600 text-center">
                ... and {topViolations.length - 5} more constraint types violated
              </div>
            )}
          </div>
        )}
        
        {/* User Action / Suggestion */}
        {(result.userAction || result.suggestion) && (
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-300">
            <div className="font-semibold text-amber-900 mb-2">💡 Action requise :</div>
            <p className="text-sm text-amber-800 whitespace-pre-wrap">{result.userAction || result.suggestion}</p>
          </div>
        )}
        
        {/* Confirmation */}
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-900 font-medium">
            ✅ Planning actuel conservé : aucune modification appliquée.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-rose-200">
          <Button
            size="sm"
            onClick={handleDownloadDiagnostics}
            className="bg-slate-700 hover:bg-slate-800 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Diagnostics JSON
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Teachers')}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Users className="w-4 h-4 mr-2" />
            Open Teachers Load Report
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Rooms')}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Open Room Eligibility Report
          </Button>
          
          {onRetry && (
            <Button
              size="sm"
              onClick={onRetry}
              className="bg-rose-700 hover:bg-rose-800 text-white ml-auto"
            >
              Retry Generation
            </Button>
          )}
        </div>
        
        {/* Raw Details (Collapsible) */}
        {result.details && result.details.length > 0 && (
          <details className="bg-white p-4 rounded-lg border border-rose-200">
            <summary className="cursor-pointer text-sm font-semibold text-rose-900 hover:text-rose-700">
              Raw Details ({result.details.length} issues)
            </summary>
            <div className="mt-3 space-y-2">
              {result.details.slice(0, 10).map((detail, i) => (
                <div key={i} className="text-xs border-l-2 border-rose-300 pl-3 py-1">
                  <div className="font-semibold text-slate-900">
                    {detail.entity}.{detail.field}
                  </div>
                  <div className="text-slate-600">{detail.reason}</div>
                  {detail.hint && (
                    <div className="text-slate-500 italic mt-1">💡 {detail.hint}</div>
                  )}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}