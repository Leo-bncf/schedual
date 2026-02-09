import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, Building2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function RoomUtilizationReport({ scheduleVersionId, schoolId }) {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: slots = [] } = useQuery({
    queryKey: ['scheduleSlots', scheduleVersionId],
    queryFn: () => base44.entities.ScheduleSlot.filter({ 
      schedule_version: scheduleVersionId,
      status: 'scheduled'
    }),
    enabled: !!scheduleVersionId
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', schoolId],
    queryFn: () => base44.entities.Room.filter({ school_id: schoolId }),
    enabled: !!schoolId
  });

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: async () => {
      const schools = await base44.entities.School.filter({ id: schoolId });
      return schools[0];
    },
    enabled: !!schoolId
  });

  const utilizationData = useMemo(() => {
    const totalPeriods = (school?.days_of_week?.length || 5) * (school?.periods_per_day || 10);
    
    const roomMap = new Map();
    rooms.forEach(r => {
      roomMap.set(r.id, {
        room: r,
        usedPeriods: 0,
        totalPeriods,
        subjectTypes: new Set(),
        peakDay: '',
        dayDistribution: { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 }
      });
    });

    slots.forEach(slot => {
      if (!slot.room_id) return;
      
      const data = roomMap.get(slot.room_id);
      if (data) {
        data.usedPeriods++;
        if (slot.subject_id) data.subjectTypes.add(slot.subject_id);
        if (slot.day) data.dayDistribution[slot.day]++;
      }
    });

    return Array.from(roomMap.values())
      .map(d => {
        const peakDay = Object.entries(d.dayDistribution).reduce((max, [day, count]) => 
          count > max.count ? { day, count } : max
        , { day: '', count: 0 }).day;

        return {
          ...d,
          peakDay,
          utilizationRate: ((d.usedPeriods / d.totalPeriods) * 100).toFixed(1),
          avgPeriodsPerDay: (d.usedPeriods / 5).toFixed(1)
        };
      })
      .sort((a, b) => parseFloat(b.utilizationRate) - parseFloat(a.utilizationRate));
  }, [slots, rooms, school]);

  const filteredData = utilizationData.filter(d =>
    d.room.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCSV = () => {
    const csv = [
      ['Room', 'Type', 'Capacity', 'Used Periods', 'Total Periods', 'Utilization %', 'Peak Day'],
      ...filteredData.map(d => [
        d.room.name,
        d.room.room_type,
        d.room.capacity,
        d.usedPeriods,
        d.totalPeriods,
        d.utilizationRate,
        d.peakDay
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'room-utilization-report.csv';
    a.click();
  };

  const avgUtilization = (utilizationData.reduce((sum, d) => sum + parseFloat(d.utilizationRate), 0) / Math.max(1, utilizationData.length)).toFixed(1);
  const underutilizedCount = utilizationData.filter(d => parseFloat(d.utilizationRate) < 50).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rooms.length}</div>
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
            <CardTitle className="text-sm font-medium text-gray-600">Underutilized Rooms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{underutilizedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter & Export */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Room Utilization Analysis</CardTitle>
              <CardDescription>Track room usage patterns and identify optimization opportunities</CardDescription>
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
                placeholder="Search rooms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredData.map(d => {
              const utilization = parseFloat(d.utilizationRate);
              const isUnderutilized = utilization < 50;
              const isOptimal = utilization >= 50 && utilization <= 90;

              return (
                <div key={d.room.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-gray-400" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{d.room.name}</h3>
                        <p className="text-sm text-gray-500">
                          {d.room.room_type || 'General'} • Capacity: {d.room.capacity}
                        </p>
                      </div>
                    </div>
                    <Badge variant={isUnderutilized ? 'secondary' : isOptimal ? 'default' : 'destructive'}>
                      {utilization}% Used
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-500">Used/Total:</span>
                      <p className="font-semibold">{d.usedPeriods}/{d.totalPeriods}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg/Day:</span>
                      <p className="font-semibold">{d.avgPeriodsPerDay}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Peak Day:</span>
                      <p className="font-semibold">{d.peakDay || 'None'}</p>
                    </div>
                  </div>

                  {/* Utilization bar */}
                  <div className="mb-3">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${isUnderutilized ? 'bg-yellow-500' : isOptimal ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Day distribution */}
                  <div className="flex gap-1">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                      <div key={day} className="flex-1">
                        <div className="h-12 bg-gray-100 rounded relative overflow-hidden">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-blue-500"
                            style={{ height: `${(d.dayDistribution[day] / Math.max(...Object.values(d.dayDistribution), 1)) * 100}%` }}
                          />
                          <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
                            <span className="text-xs font-semibold">{d.dayDistribution[day]}</span>
                          </div>
                        </div>
                        <p className="text-xs text-center text-gray-500 mt-1">{day.slice(0, 3)}</p>
                      </div>
                    ))}
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