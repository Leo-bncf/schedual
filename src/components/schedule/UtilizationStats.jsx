import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Users, Building2, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function UtilizationStats({ slots, teachers, rooms, schoolConfig }) {
  const totalPeriodsPerWeek = schoolConfig.periods_per_day * schoolConfig.days_per_week;

  // Calculate teacher utilization
  const teacherStats = teachers.map(teacher => {
    const teacherSlots = slots.filter(s => s.teacher_id === teacher.id);
    const hoursUsed = teacherSlots.length;
    const maxHours = teacher.max_hours_per_week || 25;
    const utilization = Math.round((hoursUsed / maxHours) * 100);
    
    return {
      id: teacher.id,
      name: teacher.full_name,
      hoursUsed,
      maxHours,
      utilization,
      status: utilization > 90 ? 'overloaded' : utilization < 40 ? 'underused' : 'balanced'
    };
  }).sort((a, b) => b.utilization - a.utilization);

  // Calculate room utilization
  const roomStats = rooms.map(room => {
    const roomSlots = slots.filter(s => s.room_id === room.id);
    const periodsUsed = roomSlots.length;
    const utilization = Math.round((periodsUsed / totalPeriodsPerWeek) * 100);
    
    return {
      id: room.id,
      name: room.name,
      periodsUsed,
      totalPeriods: totalPeriodsPerWeek,
      utilization,
      status: utilization > 80 ? 'high' : utilization < 30 ? 'low' : 'medium'
    };
  }).sort((a, b) => b.utilization - a.utilization);

  const avgTeacherUtil = Math.round(teacherStats.reduce((sum, t) => sum + t.utilization, 0) / teacherStats.length);
  const avgRoomUtil = Math.round(roomStats.reduce((sum, r) => sum + r.utilization, 0) / roomStats.length);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Teacher Utilization */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Teacher Workload
            </CardTitle>
            <div className="text-right">
              <p className="text-2xl font-bold text-indigo-600">{avgTeacherUtil}%</p>
              <p className="text-xs text-slate-500">Average</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {teacherStats.map(teacher => (
            <div key={teacher.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{teacher.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{teacher.hoursUsed}/{teacher.maxHours}h</span>
                  <Badge 
                    variant={teacher.status === 'overloaded' ? 'destructive' : teacher.status === 'underused' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {teacher.utilization}%
                  </Badge>
                </div>
              </div>
              <Progress value={teacher.utilization} className={`h-2 ${
                teacher.status === 'overloaded' ? 'bg-rose-100' : 
                teacher.status === 'underused' ? 'bg-amber-100' : 
                'bg-emerald-100'
              }`} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Room Utilization */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Room Utilization
            </CardTitle>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{avgRoomUtil}%</p>
              <p className="text-xs text-slate-500">Average</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {roomStats.map(room => (
            <div key={room.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{room.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">{room.periodsUsed}/{room.totalPeriods}</span>
                  <Badge 
                    variant={room.status === 'high' ? 'default' : room.status === 'low' ? 'secondary' : 'outline'}
                    className="text-xs"
                  >
                    {room.utilization}%
                  </Badge>
                </div>
              </div>
              <Progress value={room.utilization} className={`h-2 ${
                room.status === 'high' ? 'bg-blue-100' : 
                room.status === 'low' ? 'bg-amber-100' : 
                'bg-emerald-100'
              }`} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}