import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import PageHeader from '../components/ui-custom/PageHeader';
import { BookOpen, AlertCircle, CheckCircle, Users, GraduationCap, Shield, Star } from 'lucide-react';

export default function Documentation() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader 
        title="IB Schedule Documentation"
        description="Complete guide to constraint rules and best practices"
      />

      {/* Teacher Rules */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Teacher Qualification Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-indigo-200 bg-indigo-50">
            <Shield className="h-4 w-4 text-indigo-600" />
            <AlertTitle className="text-indigo-900">Hard Constraint</AlertTitle>
            <AlertDescription className="text-indigo-700">
              Teachers can only be assigned to classes matching their subject and IB level qualifications
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-medium text-slate-900 mb-2">Rule T1: Subject-Level Qualification</p>
              <p className="text-sm text-slate-600 mb-2">
                Each teacher must have explicit qualifications for:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-4">
                <li>The specific subject (e.g., Physics, Mathematics)</li>
                <li>The IB programme level (PYP, MYP, or DP)</li>
                <li>The course level if applicable (HL or SL for DP)</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-medium text-slate-900 mb-2">Example</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-slate-700">Teacher qualified for "Physics DP" can teach Physics HL or SL in DP programme</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                  <span className="text-slate-700">Same teacher CANNOT teach Physics in MYP without MYP qualification</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Rules */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            Student Enrollment Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <Badge className="bg-rose-100 text-rose-700 border-0 mb-3">Critical</Badge>
              <p className="font-medium text-slate-900 mb-2">Rule S1: Programme Assignment</p>
              <p className="text-sm text-slate-600">
                Each student must belong to exactly ONE IB programme (PYP, MYP, or DP)
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <Badge className="bg-rose-100 text-rose-700 border-0 mb-3">Critical</Badge>
              <p className="font-medium text-slate-900 mb-2">Rule S2: Level-Bound Enrollment</p>
              <p className="text-sm text-slate-600">
                Students can only take subjects from their assigned programme level
              </p>
            </div>
          </div>

          <Alert className="border-violet-200 bg-violet-50">
            <BookOpen className="h-4 w-4 text-violet-600" />
            <AlertTitle className="text-violet-900">DP-Specific Requirements</AlertTitle>
            <AlertDescription className="text-violet-700 space-y-2">
              <p className="font-medium">Rule S3-S5: DP Subject Structure</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Exactly 6 subjects total</li>
                <li>3-4 subjects at Higher Level (HL)</li>
                <li>Remaining subjects at Standard Level (SL)</li>
                <li>Subjects must span at least 5 of the 6 IB groups</li>
                <li>HL/SL class sections are separate</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-900">Rule S6: No Time Conflicts</AlertTitle>
            <AlertDescription className="text-amber-700">
              Students cannot be scheduled in two classes simultaneously or during their unavailable time slots
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Constraint Types */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-700" />
            Constraint Types
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border-2 border-rose-200 bg-rose-50">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-rose-600" />
                <h3 className="font-semibold text-rose-900">Hard Constraints</h3>
              </div>
              <p className="text-sm text-rose-700 mb-3">
                MUST be satisfied. Schedule generation will fail if violated.
              </p>
              <ul className="text-sm text-rose-600 space-y-1">
                <li>• Teacher qualifications</li>
                <li>• No double booking</li>
                <li>• Room capacity limits</li>
                <li>• IB programme requirements</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg border-2 border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">Soft Constraints</h3>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                Preferences that optimizer tries to satisfy when possible.
              </p>
              <ul className="text-sm text-amber-600 space-y-1">
                <li>• Teacher free day preferences</li>
                <li>• Minimize student gaps</li>
                <li>• Preferred room assignments</li>
                <li>• Balanced daily workload</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-medium text-emerald-700">1</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Configure School Settings First</p>
                <p className="text-sm text-slate-600">Set up periods per day, duration, and academic year before adding data</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-medium text-emerald-700">2</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Define Subjects with Correct IB Groups</p>
                <p className="text-sm text-slate-600">Ensure each subject has proper group assignment (1-6) for DP validation</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-medium text-emerald-700">3</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Add Teacher Qualifications Carefully</p>
                <p className="text-sm text-slate-600">Specify exact subject-level combinations each teacher can handle</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-medium text-emerald-700">4</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Validate DP Student Choices</p>
                <p className="text-sm text-slate-600">Use the built-in validator to ensure 6 subjects, 3-4 HL, 5+ groups</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-medium text-emerald-700">5</span>
              </div>
              <div>
                <p className="font-medium text-slate-900">Review Constraints Before Generation</p>
                <p className="text-sm text-slate-600">Use the Constraint Validator to check for conflicts and ensure critical rules are active</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}