import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  AlertCircle, 
  Clock, 
  Users, 
  Building2,
  User,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const CONFLICT_ICONS = {
  teacher_double_booking: Users,
  student_double_booking: User,
  room_double_booking: Building2,
  teacher_unavailable: Clock,
  room_capacity_exceeded: AlertTriangle,
  insufficient_hours: Clock,
  ib_requirement_violation: AlertCircle,
  consecutive_periods_exceeded: Clock,
  unassigned_teaching_unit: XCircle,
};

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    icon: XCircle,
    badgeClass: 'bg-rose-100 text-rose-700'
  },
  high: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    icon: AlertTriangle,
    badgeClass: 'bg-orange-100 text-orange-700'
  },
  medium: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    icon: AlertCircle,
    badgeClass: 'bg-amber-100 text-amber-700'
  },
  low: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: AlertCircle,
    badgeClass: 'bg-blue-100 text-blue-700'
  }
};

export default function ConflictViewer({ scheduleVersionId }) {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });
  const schoolId = user?.school_id;

  const queryClient = useQueryClient();

  const { data: conflicts = [], isLoading } = useQuery({
    queryKey: ['conflicts', scheduleVersionId],
    queryFn: () => base44.entities.ConflictReport.filter({
      schedule_version_id: scheduleVersionId,
      status: { $nin: ['resolved', 'ignored'] }
    }),
    enabled: !!scheduleVersionId,
    staleTime: 30000,
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.ConflictReport.update(id, { status: 'resolved' }),
    onSuccess: () => {
      toast.success('Conflict marked as resolved');
      queryClient.invalidateQueries({ queryKey: ['conflicts', scheduleVersionId] });
    },
    onError: (error) => toast.error(error?.message || 'Failed to resolve conflict'),
  });

  const ignoreMutation = useMutation({
    mutationFn: (id) => base44.entities.ConflictReport.update(id, { status: 'ignored' }),
    onSuccess: () => {
      toast.success('Conflict ignored');
      queryClient.invalidateQueries({ queryKey: ['conflicts', scheduleVersionId] });
    },
    onError: (error) => toast.error(error?.message || 'Failed to ignore conflict'),
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => base44.entities.Teacher.filter({ school_id: schoolId }),
    enabled: !!schoolId,
    staleTime: 60000,
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', schoolId],
    queryFn: () => base44.entities.Student.filter({ school_id: schoolId }),
    enabled: !!schoolId,
    staleTime: 60000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }),
    enabled: !!schoolId,
    staleTime: 60000,
  });

  const { data: scheduleSlots = [] } = useQuery({
    queryKey: ['scheduleSlots', scheduleVersionId],
    queryFn: () => base44.entities.ScheduleSlot.filter({ schedule_version: scheduleVersionId }),
    enabled: !!scheduleVersionId,
    staleTime: 30000,
  });

  const { data: teachingGroups = [] } = useQuery({
    queryKey: ['teachingGroups', schoolId],
    queryFn: () => base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    enabled: !!schoolId,
    staleTime: 60000,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', schoolId],
    queryFn: () => base44.entities.Subject.filter({ school_id: schoolId }),
    enabled: !!schoolId,
    staleTime: 60000,
  });

  const getEntityName = (entityType, entityId) => {
    if (entityType === 'teacher') {
      return teachers.find(t => t.id === entityId)?.full_name || 'Unknown Teacher';
    }
    if (entityType === 'student') {
      return students.find(s => s.id === entityId)?.full_name || 'Unknown Student';
    }
    if (entityType === 'room') {
      return rooms.find(r => r.id === entityId)?.name || 'Unknown Room';
    }
    if (entityType === 'teaching_group') {
      const group = teachingGroups.find(g => g.id === entityId);
      return group?.name || 'Unknown Teaching Group';
    }
    if (entityType === 'subject') {
      return subjects.find(s => s.id === entityId)?.name || 'Unknown Subject';
    }
    return 'Unknown';
  };

  const getSlotInfo = (slotId) => {
    const slot = scheduleSlots.find(s => s.id === slotId);
    if (!slot) return 'Unknown slot';
    return `${slot.day} Period ${slot.period}`;
  };

  const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
  const highConflicts = conflicts.filter(c => c.severity === 'high');
  const mediumConflicts = conflicts.filter(c => c.severity === 'medium');
  const lowConflicts = conflicts.filter(c => c.severity === 'low');

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (conflicts.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
            <p className="font-medium">No conflicts found - schedule looks good!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const renderConflictGroup = (conflictList, title) => {
    if (conflictList.length === 0) return null;

    return (
      <div className="space-y-2">
        <h4 className="font-medium text-slate-900 text-sm">{title} ({conflictList.length})</h4>
        <Accordion type="single" collapsible className="space-y-2">
          {conflictList.map((conflict) => {
            const Icon = CONFLICT_ICONS[conflict.conflict_type] || AlertCircle;
            const config = SEVERITY_CONFIG[conflict.severity];
            const SeverityIcon = config.icon;

            return (
              <AccordionItem 
                key={conflict.id} 
                value={conflict.id}
                className={`${config.bg} ${config.border} border rounded-lg`}
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-3 w-full">
                    <SeverityIcon className={`w-5 h-5 ${config.text}`} />
                    <div className="flex-1 text-left">
                      <p className={`font-medium ${config.text}`}>
                        {conflict.conflict_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </p>
                    </div>
                    <Badge className={`${config.badgeClass} border-0`}>
                      {conflict.severity}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">{conflict.description}</p>
                    
                    {conflict.affected_entities && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-500 uppercase">Affected:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(conflict.affected_entities).map(([entityType, entityIds]) => {
                            const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
                            return ids.map((id, idx) => (
                              <Badge key={`${entityType}-${idx}`} variant="outline" className="text-xs">
                                {entityType}: {getEntityName(entityType, id)}
                              </Badge>
                            ));
                          })}
                        </div>
                      </div>
                    )}

                    {conflict.slot_references && conflict.slot_references.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-500 uppercase">Time Slots:</p>
                        <div className="flex flex-wrap gap-2">
                          {conflict.slot_references.map((slotId, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {getSlotInfo(slotId)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {conflict.suggested_resolution && (
                      <div className={`p-3 rounded-lg bg-white/50 border ${config.border}`}>
                        <p className="text-xs font-medium text-slate-600 mb-1">Suggested Resolution:</p>
                        <p className="text-sm text-slate-700">{conflict.suggested_resolution}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolveMutation.isPending || ignoreMutation.isPending}
                        onClick={() => resolveMutation.mutate(conflict.id)}
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark Resolved
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolveMutation.isPending || ignoreMutation.isPending}
                        onClick={() => ignoreMutation.mutate(conflict.id)}
                      >
                        Ignore
                      </Button>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Conflicts & Warnings</span>
          <Badge variant="outline" className="ml-2">
            {conflicts.length} total
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderConflictGroup(criticalConflicts, 'Critical Issues')}
        {renderConflictGroup(highConflicts, 'High Priority')}
        {renderConflictGroup(mediumConflicts, 'Medium Priority')}
        {renderConflictGroup(lowConflicts, 'Low Priority')}
      </CardContent>
    </Card>
  );
}