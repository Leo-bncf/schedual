import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import SearchableEntitySelect from '@/components/schedule/SearchableEntitySelect';
import { GraduationCap } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_MAP = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };

const normalizeLevel = (value) => String(value || '').toUpperCase().trim();
const makeSubjectLevelKey = (subjectId, level) => subjectId ? `${subjectId}__${normalizeLevel(level)}` : '';

function extractYearGroupScope(slot, slotGroup) {
  const explicitScope = String(slot?.year_group_scope || '').trim();
  if (explicitScope) return explicitScope;

  const groupYear = String(slotGroup?.year_group || '').trim();
  if (groupYear) return groupYear;

  const raw = String(slot?.solver_teaching_group_id || slot?.teaching_group_id || '').toUpperCase();
  if (raw.includes('DP1_DP2')) return 'DP1_DP2';
  if (raw.includes('DP2')) return 'DP2';
  if (raw.includes('DP1')) return 'DP1';
  return '';
}

export default function StudentScheduleView({
  students = [],
  groups = [],
  subjects = [],
  selectedStudentId,
  onStudentChange,
  timeslots = [],
  scheduleSettings,
  scheduleVersionId,
  exportId = 'student-schedule',
}) {
  const [serverSlots, setServerSlots] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const selectedStudent = students.find((student) => student.id === selectedStudentId);

  const groupsById = React.useMemo(
    () => Object.fromEntries((groups || []).map((group) => [group.id, group])),
    [groups]
  );

  const subjectsById = React.useMemo(
    () => Object.fromEntries((subjects || []).map((subject) => [subject.id, subject])),
    [subjects]
  );

  const studentLevelsBySubjectId = React.useMemo(() => {
    const levelMap = {};

    (selectedStudent?.assigned_groups || []).forEach((groupId) => {
      const group = groupsById[groupId];
      if (!group?.subject_id || !group?.level) return;
      if (!levelMap[group.subject_id]) levelMap[group.subject_id] = new Set();
      levelMap[group.subject_id].add(normalizeLevel(group.level));
    });

    (selectedStudent?.subject_choices || []).forEach((choice) => {
      const level = normalizeLevel(choice?.level);
      if (!choice?.subject_id || !level) return;
      if (!levelMap[choice.subject_id]) levelMap[choice.subject_id] = new Set();
      levelMap[choice.subject_id].add(level);
    });

    return levelMap;
  }, [selectedStudent, groupsById]);

  const allowedSubjectKeys = React.useMemo(() => {
    const keys = new Set();

    (selectedStudent?.assigned_groups || []).forEach((groupId) => {
      const group = groupsById[groupId];
      const key = makeSubjectLevelKey(group?.subject_id, group?.level);
      if (key) keys.add(key);
    });

    (selectedStudent?.subject_choices || []).forEach((choice) => {
      const key = makeSubjectLevelKey(choice?.subject_id, choice?.level);
      if (key) keys.add(key);
    });

    return keys;
  }, [selectedStudent, groupsById]);

  React.useEffect(() => {
    if (!selectedStudent?.id || !scheduleVersionId) {
      setServerSlots([]);
      return;
    }

    const loadSlots = async () => {
      setLoading(true);
      try {
        const response = await base44.functions.invoke('getStudentScheduleSlots', {
          student_id: selectedStudent.id,
          schedule_version_id: scheduleVersionId,
        });
        setServerSlots(response?.data?.slots || []);
      } finally {
        setLoading(false);
      }
    };

    loadSlots();
  }, [selectedStudent?.id, scheduleVersionId]);

  const resolveSlotMeta = React.useCallback((slot) => {
    const group = slot?.teaching_group_id ? groupsById[slot.teaching_group_id] : null;
    const subjectId = slot?.subject_id || group?.subject_id;
    const subject = subjectId ? subjectsById[subjectId] : null;
    const subjectLevels = subjectId ? studentLevelsBySubjectId[subjectId] : null;
    const inferredLevel = subjectLevels?.size === 1 ? Array.from(subjectLevels)[0] : '';
    const level = normalizeLevel(slot?.display_level_override || group?.level || inferredLevel);
    const scope = extractYearGroupScope(slot, group);

    return { subject, level, scope };
  }, [groupsById, subjectsById, studentLevelsBySubjectId]);

  const visibleSlots = React.useMemo(() => {
    return (serverSlots || []).filter((slot) => {
      if (slot?.is_break) return true;

      const { subject, level, scope } = resolveSlotMeta(slot);
      const subjectKey = makeSubjectLevelKey(subject?.id, level);
      if (!subjectKey || !allowedSubjectKeys.has(subjectKey)) return false;
      if (!selectedStudent?.year_group || !scope || scope === 'DP1_DP2') return true;
      return scope === selectedStudent.year_group;
    });
  }, [serverSlots, resolveSlotMeta, allowedSubjectKeys, selectedStudent?.year_group]);

  const filteredStudents = React.useMemo(
    () => students.filter((student) => student?.is_active !== false),
    [students]
  );

  const timeslotToRow = React.useMemo(() => {
    const map = {};

    DAYS.forEach((day) => {
      const daySlots = (timeslots || [])
        .filter((slot) => slot.dayOfWeek === day.toUpperCase())
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

      daySlots.forEach((slot, index) => {
        map[String(slot.id)] = index + 1;
      });
    });

    return map;
  }, [timeslots]);

  const periodTimes = React.useMemo(() => {
    const labels = {};

    DAYS.forEach((day) => {
      const daySlots = (timeslots || [])
        .filter((slot) => slot.dayOfWeek === day.toUpperCase())
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

      daySlots.forEach((slot, index) => {
        const row = index + 1;
        if (!labels[row]) {
          labels[row] = `${String(slot.startTime || '').slice(0, 5)} - ${String(slot.endTime || '').slice(0, 5)}`;
        }
      });
    });

    if (Object.keys(labels).length === 0) {
      const periods = scheduleSettings?.periods_per_day || 10;
      const start = String(scheduleSettings?.day_start_time || '08:00').split(':').map(Number);
      const duration = scheduleSettings?.period_duration_minutes || 60;
      let currentMinutes = (start[0] * 60) + start[1];

      for (let i = 1; i <= periods; i++) {
        const startHour = Math.floor(currentMinutes / 60);
        const startMinute = currentMinutes % 60;
        currentMinutes += duration;
        const endHour = Math.floor(currentMinutes / 60);
        const endMinute = currentMinutes % 60;
        labels[i] = `${String(startHour).padStart(2, '0')}:${String(startMinute).padStart(2, '0')} - ${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
      }
    }

    return labels;
  }, [timeslots, scheduleSettings]);

  const maxPeriods = React.useMemo(() => {
    const fromTimeslots = Object.keys(periodTimes).length;
    return Math.max(fromTimeslots, scheduleSettings?.periods_per_day || 10);
  }, [periodTimes, scheduleSettings]);

  const slotMap = React.useMemo(() => {
    const map = new Map();

    visibleSlots.forEach((slot) => {
      const day = DAY_MAP[String(slot.day || '').toUpperCase()] || slot.day;
      const row = slot?.timeslot_id ? timeslotToRow[String(slot.timeslot_id)] : slot?.period;
      if (!day || !row) return;

      const key = `${day}__${row}`;
      const existing = map.get(key) || [];
      existing.push(slot);
      map.set(key, existing);
    });

    return map;
  }, [visibleSlots, timeslotToRow]);

  if (!selectedStudentId) {
    return (
      <div className="space-y-4">
        <SearchableEntitySelect
          items={filteredStudents}
          value={selectedStudentId || ''}
          onChange={onStudentChange}
          placeholder="Search and choose a student..."
          emptyText="No students found"
          renderSubtitle={(student) => student.year_group || 'Student'}
        />
        <div className="py-12 text-center text-sm text-slate-500">Select a student to view their timetable.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SearchableEntitySelect
        items={filteredStudents}
        value={selectedStudentId || ''}
        onChange={onStudentChange}
        placeholder="Search and choose a student..."
        emptyText="No students found"
        renderSubtitle={(student) => student.year_group || 'Student'}
      />

      {selectedStudent && (
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{selectedStudent.full_name}</div>
            <div className="text-xs text-slate-500">{selectedStudent.year_group}</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading timetable...</div>
      ) : (
        <Card className="overflow-hidden border-blue-200 shadow-sm bg-white" id={exportId}>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[90px_repeat(5,1fr)] border-b-2 border-slate-300 bg-white">
                  <div className="border-r border-slate-200 p-3"></div>
                  {DAYS.map((day) => (
                    <div key={day} className="border-r border-slate-200 p-3 text-center text-sm font-semibold text-slate-700 last:border-r-0">
                      {day}
                    </div>
                  ))}
                </div>

                {Array.from({ length: maxPeriods }, (_, index) => index + 1).map((row) => (
                  <div key={row} className="grid grid-cols-[90px_repeat(5,1fr)] border-b border-slate-200 min-h-[72px]">
                    <div className="border-r border-slate-200 bg-slate-50 p-2 text-center">
                      <div className="text-sm font-bold text-slate-800">{row}</div>
                      <div className="mt-1 text-[10px] text-slate-500">{periodTimes[row] || `Period ${row}`}</div>
                    </div>

                    {DAYS.map((day) => {
                      const cellSlots = slotMap.get(`${day}__${row}`) || [];

                      return (
                        <div key={`${day}-${row}`} className="border-r border-slate-200 p-2 last:border-r-0">
                          <div className="space-y-1">
                            {cellSlots.map((slot) => {
                              const { subject } = resolveSlotMeta(slot);
                              return subject ? (
                                <div key={slot.id} className="rounded-md border border-blue-200 bg-blue-50 px-2 py-2 text-xs font-semibold text-slate-900">
                                  {subject.name}
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}