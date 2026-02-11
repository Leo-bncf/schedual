import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, XCircle, Users, AlertCircle } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function PreSolveAuditReport({ auditResult, onProceed, onCancel }) {
  const { ok, validationErrors = [], studentAuditIssueCounts = {}, studentAuditIssueSamples = {} } = auditResult || {};

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

  const totalIssues = Object.values(studentAuditIssueCounts).reduce((sum, count) => sum + count, 0);

  return (
    <Card className="border-2 border-amber-300 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 pb-4">
        <CardTitle className="flex items-center gap-3 text-amber-900">
          <AlertTriangle className="w-6 h-6" />
          Pre-Solve Audit Results
        </CardTitle>
        <CardDescription>
          {ok 
            ? 'All validation checks passed. Ready to generate schedule.'
            : `Found ${totalIssues} data integrity issues that must be resolved before scheduling.`
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Overall Status */}
        <div className={`p-4 rounded-xl border-2 ${ok ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}>
          <div className="flex items-center gap-3">
            {ok ? (
              <>
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <div className="font-semibold text-green-900">Audit Passed</div>
                  <div className="text-sm text-green-700">All students properly assigned to teaching groups</div>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-8 h-8 text-amber-700" />
                <div>
                  <div className="font-semibold text-amber-900">Audit Failed</div>
                  <div className="text-sm text-amber-700">{totalIssues} issues detected across {Object.keys(studentAuditIssueCounts).length} categories</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="space-y-2">
            <div className="font-semibold text-slate-900">Validation Errors:</div>
            {validationErrors.map((error, idx) => (
              <div key={idx} className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                {error}
              </div>
            ))}
          </div>
        )}

        {/* Issue Type Breakdown */}
        {!ok && (
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
              const samples = studentAuditIssueSamples[issueType] || [];

              if (count === 0) return null;

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
                  
                  {samples.length > 0 && (
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

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {ok ? (
            <Button onClick={onProceed} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="w-4 h-4 mr-2" />
              Proceed to Generate
            </Button>
          ) : (
            <div className="text-sm text-amber-700">
              Fix issues before proceeding
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}