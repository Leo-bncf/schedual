import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function TeacherWorkloadReport({ scheduleVersionId, schoolId }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: slots = [] } = useQuery({
    queryKey: ['scheduleSlots', scheduleVersionId],
    queryFn: () => base44.entities.ScheduleSlot.filter({ 
      schedule_version: scheduleVersionId,
      status: 'scheduled'
    }),
    enabled: !!scheduleVersionId
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const workloadData = useMemo(() => {
    const teacherMap = new Map();

    teachers.forEach(t => {
      teacherMap.set(t.id, {
        teacher: t,
        totalPeriods: 0,
        subjects: new Set(),
        dayDistribution: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 },
        consecutivePeriods: []
      });
    });

    // Group slots by teacher and day
    const slotsByTeacherDay = {};
    slots.forEach(slot => {
      if (!slot.teacher_id) return;
      
      const key = `${slot.teacher_id}_${slot.day}`;
      if (!slotsByTeacherDay[key]) slotsByTeacherDay[key] = [];
      slotsByTeacherDay[key].push(slot);
    });

    // Calculate consecutive periods
    Object.entries(slotsByTeacherDay).forEach(([key, daySlots]) => {
      const [teacherId] = key.split('_');
      const data = teacherMap.get(teacherId);
      if (!data) return;

      const sortedSlots = daySlots.sort((a, b) => a.period - b.period);
      let consecutiveCount = 1;
      
      for (let i = 1; i < sortedSlots.length; i++) {
        if (sortedSlots[i].period === sortedSlots[i-1].period + 1) {
          consecutiveCount++;
        } else {
          data.consecutivePeriods.push(consecutiveCount);
          consecutiveCount = 1;
        }
      }
      if (consecutiveCount > 0) data.consecutivePeriods.push(consecutiveCount);
    });

    slots.forEach(slot => {
      if (!slot.teacher_id) return;

      const data = teacherMap.get(slot.teacher_id);
      if (data) {
        data.totalPeriods++;
        if (slot.subject_id) data.subjects.add(slot.subject_id);
        if (slot.day) data.dayDistribution[slot.day]++;
      }
    });

    return Array.from(teacherMap.values())
      .map(d => ({
        ...d,
        subjectCount: d.subjects.size,
        avgPeriodsPerDay: (d.totalPeriods / 5).toFixed(1),
        maxConsecutive: Math.max(...d.consecutivePeriods, 0),
        utilizationRate: ((d.totalPeriods / (d.teacher.max_hours_per_week || 25)) * 100).toFixed(0)
      }))
      .sort((a, b) => b.totalPeriods - a.totalPeriods);
  }, [slots, teachers]);

  const filteredData = workloadData.filter(d => 
    d.teacher.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCSV = () => {
    const csv = [
      ['Teacher', 'Total Periods', 'Avg/Day', 'Subjects', 'Max Consecutive', 'Utilization %'],
      ...filteredData.map(d => [
        d.teacher.full_name,
        d.totalPeriods,
        d.avgPeriodsPerDay,
        d.subjectCount,
        d.maxConsecutive,
        d.utilizationRate
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teacher-workload-report.csv';
    a.click();
  };

  const avgUtilization = (workloadData.reduce((sum, d) => sum + parseFloat(d.utilizationRate), 0) / Math.max(1, workloadData.length)).toFixed(0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teachers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgUtilization}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Overloaded Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {workloadData.filter(d => parseFloat(d.utilizationRate) > 100).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Teacher Workload Analysis</CardTitle>
              <CardDescription>Detailed breakdown of teaching assignments and load distribution</CardDescription>
            </div>
            <Button onClick={exportCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search teachers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredData.map(d => {
              const utilization = parseFloat(d.utilizationRate);
              const isOverloaded = utilization > 100;
              const isUnderutilized = utilization < 60;

              return (
                <div key={d.teacher.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{d.teacher.full_name}</h3>
                        {isOverloaded && (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Overloaded
                          </Badge>
                        )}
                        {isUnderutilized && (
                          <Badge variant="secondary">
                            Underutilized
                          </Badge>
                        )}
                        {!isOverloaded && !isUnderutilized && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Optimal
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Total Periods:</span>
                          <p className="font-semibold">{d.totalPeriods}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Avg/Day:</span>
                          <p className="font-semibold">{d.avgPeriodsPerDay}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Subjects:</span>
                          <p className="font-semibold">{d.subjectCount}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Max Consecutive:</span>
                          <p className="font-semibold">{d.maxConsecutive}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Utilization:</span>
                          <p className={`font-semibold ${isOverloaded ? 'text-red-600' : isUnderutilized ? 'text-yellow-600' : 'text-green-600'}`}>
                            {d.utilizationRate}%
                          </p>
                        </div>
                      </div>

                      {/* Day distribution bar */}
                      <div className="mt-3">
                        <div className="flex gap-1">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                            <div key={day} className="flex-1">
                              <div className="h-16 bg-gray-100 rounded relative overflow-hidden">
                                <div 
                                  className="absolute bottom-0 left-0 right-0 bg-blue-500 transition-all"
                                  style={{ height: `${(d.dayDistribution[day] / Math.max(...Object.values(d.dayDistribution), 1)) * 100}%` }}
                                />
                                <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                                  <span className="text-xs font-semibold">{d.dayDistribution[day]}</span>
                                  <span className="text-xs text-gray-500">{day.slice(0, 3)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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