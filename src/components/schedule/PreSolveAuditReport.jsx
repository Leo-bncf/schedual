import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, XCircle, Users, AlertCircle, Ban } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from 'sonner';

export default function PreSolveAuditReport({ auditResult, onProceed, onCancel }) {
  if (!auditResult) return null;

  const passed = auditResult.ok === true;
  
  // GUARD: Safe destructuring with fallbacks
  const validationErrors = auditResult.validationErrors || [];
  const studentAuditIssueCounts = auditResult.studentAuditIssueCounts || {};
  const studentAuditIssueSamples = auditResult.sampleAuditIssues || auditResult.studentAuditIssueSamples || {};
  
  const issueCount = typeof studentAuditIssueCounts === 'object'
    ? Object.values(studentAuditIssueCounts).reduce((sum, count) => sum + (count || 0), 0)
    : 0;

  const issueTypes = {
    DUPLICATE_SUBJECT_CHOICE: {
      label: 'Duplicate Subject Choices',
      description: 'Students enrolled in multiple teaching groups for the same subject',
      icon: AlertCircle,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-300'
    },
    MISSING_TEACHING_GROUP: {
      label: 'Missing Teaching Groups',
      description: 'Students with subject choices but no matching teaching group',
      icon: XCircle,
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-300'
    },
    TEACHING_GROUP_OVERLAP: {
      label: 'Teaching Group Overlaps',
      description: 'Multiple teaching groups scheduled at the same time',
      icon: AlertTriangle,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-300'
    }
  };

  return (
    <Card className={`border-2 ${passed ? 'border-emerald-500 bg-emerald-50' : 'border-rose-500 bg-rose-50'}`}>
      <CardContent className="pt-6 space-y-4">
        {/* Error/Status Display */}
        {!passed && (
          <div className="space-y-3">
            {/* Stage and Error Code */}
            <div className="bg-white p-4 rounded-lg border-2 border-rose-300">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <div className="font-bold text-rose-900 mb-1">
                    Stage: {auditResult.stage || 'UNKNOWN'}
                    {auditResult.errorCode && <span className="ml-2 text-xs text-rose-600">({auditResult.errorCode})</span>}
                  </div>
                  <div className="text-sm text-rose-800 mb-2">
                    {auditResult.message || auditResult.errorMessage || auditResult.error || 'Audit validation failed'}
                  </div>
                  {auditResult.requestId && (
                    <div className="text-xs text-rose-700 font-mono mb-2">
                      Request ID: {auditResult.requestId}
                    </div>
                  )}
                  {auditResult.suggestion && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                      <div className="font-semibold text-amber-900 mb-1">💡 Suggested Fix:</div>
                      <p className="text-sm text-amber-800">{auditResult.suggestion}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Details Array (standardized) */}
            {auditResult.details && Array.isArray(auditResult.details) && auditResult.details.length > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-rose-300">
                <div className="font-bold text-rose-900 mb-3">
                  📋 Issues Detected ({auditResult.details.length})
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResult.details.map((detail, idx) => (
                    <div key={idx} className="p-3 bg-rose-50 rounded border border-rose-200">
                      <div className="font-semibold text-rose-900">
                        {detail.entity || 'Unknown'}.{detail.field || 'N/A'}
                      </div>
                      <div className="text-xs text-rose-700 mt-1">
                        {detail.reason}
                      </div>
                      {detail.hint && (
                        <div className="text-xs text-amber-700 mt-1 italic">💡 {detail.hint}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Legacy: Missing Subjects (HL/SL Hours) - fallback */}
            {!auditResult.details?.length && (auditResult.missingSubjects?.length > 0 || auditResult.missingGroups?.length > 0) && (
              <div className="bg-white p-4 rounded-lg border-2 border-rose-300">
                <div className="font-bold text-rose-900 mb-3">
                  Missing Configuration ({(auditResult.missingSubjects || auditResult.missingGroups || []).length} items)
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(auditResult.missingSubjects || auditResult.missingGroups || []).slice(0, 20).map((item, idx) => (
                    <div key={idx} className="p-3 bg-rose-50 rounded border border-rose-200">
                      <div className="font-semibold text-rose-900">{item.name || item.code || 'Unknown'}</div>
                      <div className="text-xs text-rose-700 mt-1">
                        {item.missing && <div>Missing: {item.missing}</div>}
                        {item.reason && <div>Reason: {item.reason}</div>}
                        {item.error && <div>{item.error}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Standardized Details Display */}
            {auditResult.details && Array.isArray(auditResult.details) && auditResult.details.length > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-rose-300">
                <div className="font-bold text-rose-900 mb-3">
                  📋 Details ({auditResult.details.length})
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResult.details.map((detail, idx) => (
                    <div key={idx} className="p-3 bg-rose-50 rounded border border-rose-200">
                      <div className="font-semibold text-rose-900">
                        {detail.entity || 'N/A'}.{detail.field || 'N/A'}
                      </div>
                      <div className="text-xs text-rose-700 mt-1">
                        {detail.reason || 'No reason provided'}
                      </div>
                      {detail.hint && (
                        <div className="text-xs text-amber-700 mt-1 italic">💡 {detail.hint}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Legacy: Split Sections (Cohort Integrity) */}
            {!auditResult.details?.length && auditResult.splitSections?.length > 0 && (
              <div className="bg-white p-4 rounded-lg border-2 border-rose-300">
                <div className="font-bold text-rose-900 mb-3">
                  Split Sections ({auditResult.splitSections.length} sections)
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditResult.splitSections.slice(0, 10).map((section, idx) => (
                    <div key={idx} className="p-3 bg-rose-50 rounded border border-rose-200">
                      <div className="font-semibold text-rose-900">
                        {section.subject} - {section.studentGroup}
                      </div>
                      <div className="text-xs text-rose-700 mt-1">
                        Timeslots: {JSON.stringify(section.timeslots_list)}
                      </div>
                      <div className="text-xs text-rose-600 mt-1 italic">{section.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Info */}
            <div className="bg-slate-100 p-3 rounded-lg text-xs">
              <div className="font-bold text-slate-700 mb-2">🔍 Debug Info:</div>
              <div className="space-y-1 text-slate-600">
                <div>Stage: <strong>{auditResult.stage || 'undefined'}</strong></div>
                <div>Error Code: <strong className="text-rose-600">{auditResult.errorCode || auditResult.code || 'N/A'}</strong></div>
                {auditResult.requestId && (
                  <div className="mt-1 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-semibold text-blue-900 text-xs mb-1">🔍 Request ID:</div>
                    <div className="font-mono text-[10px] text-blue-700 select-all break-all">{auditResult.requestId}</div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(auditResult.requestId);
                        toast.success('Request ID copied');
                      }}
                      className="mt-1 text-xs text-blue-700 hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                )}
                {auditResult.meta && (
                  <div className="mt-1">Meta: <code className="text-[10px]">{JSON.stringify(auditResult.meta)}</code></div>
                )}
                
                {/* School timing config (if timeslots=0) */}
                {auditResult.schoolConfig && (
                  <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="font-semibold text-blue-900 mb-1">🏫 School Configuration:</div>
                    <div className="text-[10px] space-y-0.5 text-blue-700">
                      <div>Day: {auditResult.schoolConfig.day_start_time} → {auditResult.schoolConfig.day_end_time} ({auditResult.schoolConfig.total_minutes_available}min)</div>
                      <div>Period: {auditResult.schoolConfig.period_duration_minutes}min</div>
                      <div>Breaks: {auditResult.schoolConfig.breaks_count}</div>
                      <div>Days/week: {auditResult.schoolConfig.days_of_week?.join(', ')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {passed && issueCount === 0 && (
          <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-300">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
              <div>
                <div className="font-bold text-emerald-900 mb-1">All Validations Passed</div>
                <div className="text-sm text-emerald-700">Ready to proceed with OptaPlanner optimization</div>
              </div>
            </div>
          </div>
        )}

        {/* Legacy: Validation Errors (only if array exists) */}
        {Array.isArray(validationErrors) && validationErrors.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold text-slate-900">Validation Errors:</div>
            {validationErrors.map((error, idx) => (
              <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            ))}
          </div>
        )}

        {/* Legacy: Issue Type Breakdown (only if studentAuditIssueCounts exists) */}
        {!passed && studentAuditIssueCounts && typeof studentAuditIssueCounts === 'object' && Object.keys(studentAuditIssueCounts).length > 0 && (
          <div className="space-y-4">
            <div className="font-semibold text-slate-900">Issue Breakdown:</div>
            
            {Object.entries(studentAuditIssueCounts).map(([issueType, count]) => {
              const config = issueTypes[issueType] || {
                label: issueType,
                description: 'Unknown issue type',
                icon: AlertTriangle,
                color: 'text-slate-700',
                bg: 'bg-slate-50',
                border: 'border-slate-300'
              };
              
              const Icon = config.icon;
              const samples = (studentAuditIssueSamples && studentAuditIssueSamples[issueType]) || [];

              if (!count || count === 0) return null;

              return (
                <Card key={issueType} className={`border-2 ${config.border} ${config.bg}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 ${config.color}`} />
                        <div>
                          <CardTitle className={`text-base ${config.color}`}>{config.label}</CardTitle>
                          <CardDescription className="text-xs">{config.description}</CardDescription>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-lg px-3 py-1">
                        {count}
                      </Badge>
                    </div>
                  </CardHeader>

                  {Array.isArray(samples) && samples.length > 0 && (
                    <CardContent className="pt-0">
                      <Accordion type="single" collapsible>
                        <AccordionItem value="samples">
                          <AccordionTrigger className="text-sm font-medium">
                            View samples ({Math.min(samples.length, 10)} shown)
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {samples.slice(0, 10).map((sample, idx) => (
                                <div key={idx} className="p-3 bg-white rounded border border-slate-200 text-xs">
                                  <div className="font-semibold text-slate-900 mb-1">
                                    {sample.studentName || sample.student_name || `Student ${idx + 1}`}
                                  </div>
                                  <div className="text-slate-600 space-y-0.5">
                                    {sample.details && <div>{sample.details}</div>}
                                    {sample.subjectName && <div>Subject: {sample.subjectName}</div>}
                                    {sample.groupsAffected && (
                                      <div>Groups: {Array.isArray(sample.groupsAffected) ? sample.groupsAffected.join(', ') : sample.groupsAffected}</div>
                                    )}
                                    {sample.rawData && (
                                      <details className="mt-2">
                                        <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Raw data</summary>
                                        <pre className="mt-1 text-[10px] bg-slate-50 p-2 rounded overflow-x-auto">
                                          {JSON.stringify(sample.rawData, null, 2)}
                                        </pre>
                                      </details>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
          {auditResult?.stage === 'VALIDATION_FAILED_MISSING_HL_SL_HOURS' && (
            <Button
              onClick={() => window.location.href = '/Subjects'}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              Go to Subjects Page
            </Button>
          )}
          <Button
            onClick={onProceed}
            disabled={!passed}
            className={passed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'}
          >
            {passed ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Proceed to Optimization
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Fix Issues First
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}