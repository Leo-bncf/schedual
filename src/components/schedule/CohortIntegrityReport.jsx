import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function CohortIntegrityReport({ cohortData }) {
  if (!cohortData) return null;

  const {
    total_sections = 0,
    fully_scheduled = 0,
    partially_scheduled = 0,
    not_scheduled = 0,
    split_sections = 0,
    sectionCoverageReport = []
  } = cohortData;

  const hasIssues = partially_scheduled > 0 || not_scheduled > 0 || split_sections > 0;

  return (
    <Card className={`border-2 ${hasIssues ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
      <CardHeader className={hasIssues ? 'bg-amber-100' : 'bg-emerald-100'}>
        <CardTitle className="text-lg flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="w-5 h-5 text-amber-900" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-900" />
          )}
          <span className={hasIssues ? 'text-amber-900' : 'text-emerald-900'}>
            Cohort Integrity Check
          </span>
        </CardTitle>
        <CardDescription>
          Validates that students in the same section attend together
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-white border-2 border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-600">Total Sections</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{total_sections}</div>
          </div>
          
          <div className="p-4 rounded-xl bg-white border-2 border-emerald-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-emerald-700">Fully Scheduled</span>
              <CheckCircle className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-emerald-900">{fully_scheduled}</div>
            <div className="text-xs text-emerald-600 mt-1">
              {total_sections > 0 ? Math.round((fully_scheduled / total_sections) * 100) : 0}%
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-white border-2 border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-amber-700">Partial Coverage</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-900">{partially_scheduled}</div>
          </div>
          
          <div className="p-4 rounded-xl bg-white border-2 border-rose-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-rose-700">Not Scheduled</span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-900">{not_scheduled}</div>
          </div>
        </div>

        {/* Split Section Alert */}
        {split_sections > 0 && (
          <div className="p-4 rounded-xl bg-rose-100 border-2 border-rose-400">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-rose-900" />
              <span className="font-bold text-rose-900">CRITICAL: {split_sections} Split Sections Detected</span>
            </div>
            <p className="text-sm text-rose-800">
              Same section scheduled multiple times at same timeslot (physically impossible). This is a solver bug.
            </p>
          </div>
        )}

        {/* Section Coverage Details */}
        {sectionCoverageReport.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="coverage-details" className="border-slate-200">
              <AccordionTrigger className="text-sm font-semibold text-slate-900 hover:text-blue-900">
                Section Coverage Details ({sectionCoverageReport.length} sections)
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {sectionCoverageReport
                    .sort((a, b) => a.coverage_percent - b.coverage_percent)
                    .map((section, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border-2 ${
                          section.coverage_percent === 100
                            ? 'bg-emerald-50 border-emerald-200'
                            : section.coverage_percent > 0
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-rose-50 border-rose-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-semibold text-slate-900">
                              {section.subject} • {section.studentGroup}
                            </div>
                            <div className="text-xs text-slate-600 mt-1">
                              {section.assigned_periods}/{section.expected_periods} periods assigned
                              {section.unassigned_periods > 0 && (
                                <span className="text-rose-600 font-medium ml-2">
                                  ({section.unassigned_periods} unassigned)
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge
                            className={
                              section.coverage_percent === 100
                                ? 'bg-emerald-600 text-white'
                                : section.coverage_percent > 0
                                ? 'bg-amber-600 text-white'
                                : 'bg-rose-600 text-white'
                            }
                          >
                            {section.coverage_percent}%
                          </Badge>
                        </div>
                        
                        {section.timeslots_assigned.length > 0 && (
                          <div className="text-xs text-slate-600">
                            <span className="font-medium">Timeslots:</span> {section.timeslots_assigned.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Success Message */}
        {!hasIssues && (
          <div className="p-4 rounded-xl bg-emerald-100 border-2 border-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-900" />
              <span className="font-semibold text-emerald-900">
                ✅ All sections properly scheduled — students in same course attend together
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}