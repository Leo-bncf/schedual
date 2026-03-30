import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GraduationCap, Loader2, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import TimetableGrid from '@/components/schedule/TimetableGrid';
import ExportTimetableButton from '@/components/schedule/ExportTimetableButton';
import SearchableEntitySelect from '@/components/schedule/SearchableEntitySelect';

export default function StudentScheduleView({
  students = [],
  groups = [],
  subjects = [],
  teachers = [],
  rooms = [],
  selectedStudentId,
  onStudentChange,
  exportId = 'student-schedule',
  timeslots = [],
  scheduleSettings,
  scheduleVersionId,
}) {
  const selectedStudent = students.find((student) => student.id === selectedStudentId);
  const [slots, setSlots] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  React.useEffect(() => {
    if (!selectedStudentId || !scheduleVersionId) {
      setSlots([]);
      setError('');
      return;
    }

    let isActive = true;

    const loadStudentSlots = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await base44.functions.invoke('getStudentScheduleSlots', {
          student_id: selectedStudentId,
          schedule_version_id: scheduleVersionId,
        });

        if (!isActive) return;

        if (response.data?.ok) {
          setSlots(Array.isArray(response.data.slots) ? response.data.slots : []);
          return;
        }

        setSlots([]);
        setError(response.data?.error || 'Could not load this timetable.');
      } catch (err) {
        if (!isActive) return;
        setSlots([]);
        setError(err?.message || 'Could not load this timetable.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    loadStudentSlots();

    return () => {
      isActive = false;
    };
  }, [selectedStudentId, scheduleVersionId]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-medium text-slate-700">Select Student</span>
          {selectedStudent && <Badge variant="outline">{slots.length} lessons</Badge>}
          {isLoading && <Badge variant="outline">Loading...</Badge>}
        </div>

        <SearchableEntitySelect
          items={students}
          value={selectedStudentId || ''}
          onChange={onStudentChange}
          placeholder="Search and choose a student..."
          emptyText="No students found"
          renderSubtitle={(student) => student.year_group ? `${student.year_group}` : 'Student'}
        />
      </div>

      {!selectedStudent && (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-sm text-slate-500">Select a student to view their timetable</p>
        </div>
      )}

      {selectedStudent && (
        <>
          <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 truncate">{selectedStudent.full_name}</h3>
                <p className="text-xs text-slate-500 truncate">
                  {selectedStudent.year_group} • {selectedStudent.ib_programme || 'IB'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ExportTimetableButton
                  type="student"
                  entityId={selectedStudent.id}
                  scheduleVersionId={scheduleVersionId}
                />
                <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="bg-white">
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 text-sm text-red-700">{error}</CardContent>
            </Card>
          )}

          {isLoading ? (
            <Card className="border border-slate-200">
              <CardContent className="p-10 flex items-center justify-center gap-3 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading timetable...
              </CardContent>
            </Card>
          ) : slots.length === 0 && !error ? (
            <Card className="border border-slate-200">
              <CardContent className="p-10 text-center text-slate-500">
                No lessons found for this student in the selected version.
              </CardContent>
            </Card>
          ) : (
            <Card
              className={cn(
                'overflow-hidden border-blue-200 shadow-sm transition-all duration-300 bg-white',
                isFullscreen ? 'fixed inset-4 z-[100] flex flex-col shadow-2xl overflow-hidden' : ''
              )}
              id={exportId}
            >
              <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-20">
                <div className="pl-2">
                  <div className="text-sm font-semibold text-slate-700">
                    Timetable: {selectedStudent.full_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    Short lessons are shown as half-height blocks for easier reading.
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsFullscreen(!isFullscreen)} className="bg-white">
                  {isFullscreen ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
                  <span className="hidden sm:inline">{isFullscreen ? 'Exit full screen' : 'Full screen'}</span>
                </Button>
              </div>
              <div className="h-1 bg-blue-500" />
              <div className={cn('overflow-auto', isFullscreen ? 'flex-1' : 'overflow-x-auto')}>
                <TimetableGrid
                  slots={slots}
                  groups={groups}
                  rooms={rooms}
                  subjects={subjects}
                  teachers={teachers}
                  periodsPerDay={scheduleSettings?.periods_per_day || 10}
                  dayStartTime={scheduleSettings?.day_start_time || '08:00'}
                  dayEndTime={scheduleSettings?.day_end_time || '18:00'}
                  periodDurationMinutes={scheduleSettings?.period_duration_minutes || 60}
                  scheduleSettings={scheduleSettings}
                  globalView={false}
                  exportId={exportId}
                  timeslots={timeslots}
                />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}