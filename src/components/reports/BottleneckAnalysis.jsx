import React, { useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Users, Building2, Clock, TrendingDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function BottleneckAnalysis({ scheduleVersionId, schoolId }) {
  const { data: slots = [] } = useQuery({
    queryKey: ['scheduleSlots', scheduleVersionId],
    queryFn: () => base44.entities.ScheduleSlot.filter({ 
      schedule_version: scheduleVersionId
    }),
    enabled: !!scheduleVersionId
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const { data: conflicts = [] } = useQuery({
    queryKey: ['conflicts', scheduleVersionId],
    queryFn: () => base44.entities.ConflictReport.filter({ 
      schedule_version_id: scheduleVersionId,
      status: 'unresolved'
    }),
    enabled: !!scheduleVersionId
  });

  const bottlenecks = useMemo(() => {
    const issues = [];

    // 1. Overloaded teachers
    const teacherLoad = new Map();
    slots.forEach(slot => {
      if (slot.teacher_id && slot.status === 'scheduled') {
        teacherLoad.set(slot.teacher_id, (teacherLoad.get(slot.teacher_id) || 0) + 1);
      }
    });

    teacherLoad.forEach((periods, teacherId) => {
      const teacher = teachers.find(t => t.id === teacherId);
      const maxHours = teacher?.max_hours_per_week || 25;
      const utilization = (periods / maxHours) * 100;
      
      if (utilization > 100) {
        issues.push({
          type: 'teacher_overload',
          severity: 'high',
          icon: Users,
          title: 'Teacher Overloaded',
          description: `${teacher?.full_name || 'Unknown'} is scheduled for ${periods} periods (${utilization.toFixed(0)}% utilization)`,
          recommendation: 'Reduce teaching load or hire additional staff',
          affectedEntity: teacher?.full_name
        });
      }
    });

    // 2. Room shortages
    const roomUsage = new Map();
    slots.forEach(slot => {
      if (slot.room_id && slot.status === 'scheduled') {
        const key = `${slot.day}_${slot.period}`;
        if (!roomUsage.has(key)) roomUsage.set(key, new Set());
        roomUsage.get(key).add(slot.room_id);
      }
    });

    const maxRoomsUsed = Math.max(...Array.from(roomUsage.values()).map(s => s.size), 0);
    const roomShortage = maxRoomsUsed - rooms.length;
    
    if (roomShortage > 0) {
      issues.push({
        type: 'room_shortage',
        severity: 'high',
        icon: Building2,
        title: 'Room Shortage',
        description: `Peak demand requires ${maxRoomsUsed} rooms, but only ${rooms.length} available`,
        recommendation: 'Add more rooms or stagger schedules to reduce peak demand',
        affectedEntity: `${roomShortage} rooms needed`
      });
    }

    // 3. Consecutive period violations
    const teacherSlots = new Map();
    slots.forEach(slot => {
      if (slot.teacher_id && slot.status === 'scheduled') {
        const key = `${slot.teacher_id}_${slot.day}`;
        if (!teacherSlots.has(key)) teacherSlots.set(key, []);
        teacherSlots.get(key).push(slot.period);
      }
    });

    teacherSlots.forEach((periods, key) => {
      const [teacherId] = key.split('_');
      const teacher = teachers.find(t => t.id === teacherId);
      const maxConsecutive = teacher?.max_consecutive_periods || 4;
      
      const sorted = periods.sort((a, b) => a - b);
      let consecutive = 1;
      let maxFound = 1;
      
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) {
          consecutive++;
          maxFound = Math.max(maxFound, consecutive);
        } else {
          consecutive = 1;
        }
      }

      if (maxFound > maxConsecutive) {
        issues.push({
          type: 'consecutive_violation',
          severity: 'medium',
          icon: Clock,
          title: 'Consecutive Period Violation',
          description: `${teacher?.full_name || 'Teacher'} has ${maxFound} consecutive periods (max: ${maxConsecutive})`,
          recommendation: 'Add breaks between teaching sessions',
          affectedEntity: teacher?.full_name
        });
      }
    });

    // 4. Unassigned lessons
    const unassignedCount = slots.filter(s => s.status === 'unscheduled').length;
    if (unassignedCount > 0) {
      issues.push({
        type: 'unassigned',
        severity: 'high',
        icon: TrendingDown,
        title: 'Unassigned Lessons',
        description: `${unassignedCount} lessons could not be scheduled`,
        recommendation: 'Review constraints and resource availability',
        affectedEntity: `${unassignedCount} lessons`
      });
    }

    // 5. Conflict reports
    const criticalConflicts = conflicts.filter(c => c.severity === 'critical').length;
    if (criticalConflicts > 0) {
      issues.push({
        type: 'conflicts',
        severity: 'high',
        icon: AlertTriangle,
        title: 'Critical Conflicts',
        description: `${criticalConflicts} critical conflicts detected`,
        recommendation: 'Review and resolve conflicts before publishing',
        affectedEntity: `${criticalConflicts} conflicts`
      });
    }

    return issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [slots, teachers, rooms, conflicts]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Bottleneck Summary</CardTitle>
          <CardDescription>
            {bottlenecks.length === 0 ? 'No major bottlenecks detected' : `${bottlenecks.length} potential issues identified`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">
                {bottlenecks.filter(b => b.severity === 'high').length}
              </div>
              <p className="text-sm text-gray-600 mt-1">High Priority</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">
                {bottlenecks.filter(b => b.severity === 'medium').length}
              </div>
              <p className="text-sm text-gray-600 mt-1">Medium Priority</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">
                {bottlenecks.filter(b => b.severity === 'low').length}
              </div>
              <p className="text-sm text-gray-600 mt-1">Low Priority</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottleneck Details */}
      <Card>
        <CardHeader>
          <CardTitle>Identified Issues</CardTitle>
          <CardDescription>Potential bottlenecks and recommended actions</CardDescription>
        </CardHeader>
        <CardContent>
          {bottlenecks.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bottlenecks Detected</h3>
              <p className="text-gray-600">Your schedule is running smoothly!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {bottlenecks.map((issue, idx) => {
                const Icon = issue.icon;
                const severityColors = {
                  high: 'border-red-300 bg-red-50',
                  medium: 'border-yellow-300 bg-yellow-50',
                  low: 'border-blue-300 bg-blue-50'
                };

                return (
                  <div key={idx} className={`border-l-4 rounded-lg p-4 ${severityColors[issue.severity]}`}>
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${
                        issue.severity === 'high' ? 'bg-red-100' :
                        issue.severity === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                      }`}>
                        <Icon className={`w-5 h-5 ${
                          issue.severity === 'high' ? 'text-red-600' :
                          issue.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                          <Badge variant={
                            issue.severity === 'high' ? 'destructive' :
                            issue.severity === 'medium' ? 'secondary' : 'default'
                          }>
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                        <div className="bg-white rounded-md p-3 border">
                          <p className="text-sm font-medium text-gray-600 mb-1">Recommendation:</p>
                          <p className="text-sm text-gray-900">{issue.recommendation}</p>
                        </div>
                        {issue.affectedEntity && (
                          <p className="text-xs text-gray-500 mt-2">
                            Affected: {issue.affectedEntity}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}