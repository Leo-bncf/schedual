import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, BookOpen, AlertCircle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function SubjectCoverageReport({ scheduleVersionId, schoolId }) {
  const [filterLevel, setFilterLevel] = useState('all');

  const { data: slots = [] } = useQuery({
    queryKey: ['scheduleSlots', scheduleVersionId],
    queryFn: () => base44.entities.ScheduleSlot.filter({ 
      schedule_version: scheduleVersionId,
      status: 'scheduled'
    }),
    enabled: !!scheduleVersionId
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const coverageData = useMemo(() => {
    const subjectMap = new Map();

    subjects.forEach(s => {
      subjectMap.set(s.id, {
        subject: s,
        scheduledPeriods: 0,
        requiredPeriods: 0,
        teachingGroups: 0,
        coverage: 0
      });
    });

    // Calculate required periods from teaching groups
    teachingGroups.forEach(tg => {
      if (!tg.subject_id) return;
      
      const data = subjectMap.get(tg.subject_id);
      if (data) {
        data.teachingGroups++;
        // Estimate required periods (minutes_per_week / 60)
        const requiredPeriods = Math.ceil((tg.minutes_per_week || 0) / 60);
        data.requiredPeriods += requiredPeriods;
      }
    });

    // Count scheduled periods
    slots.forEach(slot => {
      if (!slot.subject_id) return;
      
      const data = subjectMap.get(slot.subject_id);
      if (data) {
        data.scheduledPeriods++;
      }
    });

    return Array.from(subjectMap.values())
      .map(d => ({
        ...d,
        coverage: d.requiredPeriods > 0 
          ? ((d.scheduledPeriods / d.requiredPeriods) * 100).toFixed(1)
          : 0,
        shortfall: Math.max(0, d.requiredPeriods - d.scheduledPeriods)
      }))
      .sort((a, b) => parseFloat(a.coverage) - parseFloat(b.coverage));
  }, [slots, subjects, teachingGroups]);

  const filteredData = filterLevel === 'all' 
    ? coverageData
    : coverageData.filter(d => d.subject.ib_level === filterLevel);

  const exportCSV = () => {
    const csv = [
      ['Subject', 'IB Level', 'Teaching Groups', 'Required Periods', 'Scheduled Periods', 'Coverage %', 'Shortfall'],
      ...filteredData.map(d => [
        d.subject.name,
        d.subject.ib_level,
        d.teachingGroups,
        d.requiredPeriods,
        d.scheduledPeriods,
        d.coverage,
        d.shortfall
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subject-coverage-report.csv';
    a.click();
  };

  const avgCoverage = (coverageData.reduce((sum, d) => sum + parseFloat(d.coverage), 0) / Math.max(1, coverageData.length)).toFixed(1);
  const underscheduledCount = coverageData.filter(d => parseFloat(d.coverage) < 90).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{subjects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgCoverage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Under-scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{underscheduledCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subject Coverage Analysis</CardTitle>
              <CardDescription>Compare required vs scheduled periods for each subject</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="PYP">PYP</SelectItem>
                  <SelectItem value="MYP">MYP</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportCSV} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredData.map(d => {
              const coverage = parseFloat(d.coverage);
              const isUnderscheduled = coverage < 90;
              const isOverscheduled = coverage > 110;
              const isOptimal = !isUnderscheduled && !isOverscheduled;

              return (
                <div key={d.subject.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-gray-400" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{d.subject.name}</h3>
                        <p className="text-sm text-gray-500">
                          {d.subject.ib_level} • {d.teachingGroups} Teaching Groups
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUnderscheduled && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Under {d.shortfall}p
                        </Badge>
                      )}
                      {isOverscheduled && (
                        <Badge variant="secondary">Over-scheduled</Badge>
                      )}
                      {isOptimal && (
                        <Badge variant="default" className="bg-green-100 text-green-800">Optimal</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-500">Required:</span>
                      <p className="font-semibold">{d.requiredPeriods}p</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Scheduled:</span>
                      <p className="font-semibold">{d.scheduledPeriods}p</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Coverage:</span>
                      <p className={`font-semibold ${isUnderscheduled ? 'text-red-600' : isOverscheduled ? 'text-yellow-600' : 'text-green-600'}`}>
                        {d.coverage}%
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Shortfall:</span>
                      <p className="font-semibold text-red-600">{d.shortfall}p</p>
                    </div>
                  </div>

                  {/* Coverage bar */}
                  <div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${isUnderscheduled ? 'bg-red-500' : isOverscheduled ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(coverage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}