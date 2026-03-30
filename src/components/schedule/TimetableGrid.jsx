import React from 'react';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import TimetableCell from '@/components/schedule/TimetableCell';
import { DAYS, calculatePeriodTimes, formatClockTime, SlotCard } from '@/components/schedule/timetableGridUtils';

export default function TimetableGrid({
  slots = [],
  groups = [],
  rooms = [],
  subjects = [],
  teachers = [],
  classGroups = [],
  periodsPerDay = 8,
  onSlotClick,
  onUpdateSlot,
  exportId = 'timetable-grid',
  dayStartTime = '08:00',
  periodDurationMinutes = 60,
  timeslots = [],
  scheduleSettings = {},
  globalView = false,
}) {
  const [selectedSlot, setSelectedSlot] = React.useState(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({});

  const dayMap = { MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday', THURSDAY: 'Thursday', FRIDAY: 'Friday' };
  const normalizeDay = (value) => {
    if (!value) return '';
    const upper = String(value).toUpperCase();
    return dayMap[upper] || `${String(value).charAt(0).toUpperCase()}${String(value).slice(1).toLowerCase()}`;
  };

  const timeslotListByDay = React.useMemo(() => {
    const grouped = {};
    DAYS.forEach((day) => {
      grouped[day] = (timeslots || [])
        .filter((ts) => normalizeDay(ts.dayOfWeek) === day)
        .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
    });
    return grouped;
  }, [timeslots]);

  const timeslotToPosition = React.useMemo(() => {
    const map = {};
    Object.entries(timeslotListByDay).forEach(([, daySlots]) => {
      daySlots.forEach((ts, idx) => {
        map[String(ts.id)] = idx + 1;
      });
    });
    return map;
  }, [timeslotListByDay]);

  const periodTimes = React.useMemo(() => {
    if (!timeslots.length) {
      return calculatePeriodTimes(dayStartTime, periodDurationMinutes, periodsPerDay, Array.isArray(scheduleSettings?.breaks) ? scheduleSettings.breaks : []);
    }
    const times = {};
    Object.values(timeslotListByDay).forEach((daySlots) => {
      daySlots.forEach((ts, idx) => {
        const row = idx + 1;
        if (!times[row]) times[row] = `${formatClockTime(ts.startTime)} - ${formatClockTime(ts.endTime)}`;
      });
    });
    return times;
  }, [timeslots, timeslotListByDay, dayStartTime, periodDurationMinutes, periodsPerDay, scheduleSettings]);

  const normalizedSlots = React.useMemo(() => {
    return (slots || []).map((slot) => {
      const uiRow = slot.timeslot_id ? timeslotToPosition[String(slot.timeslot_id)] : slot.period;
      const currentTimeslot = (timeslots || []).find((ts) => String(ts.id) === String(slot.timeslot_id));
      const start = currentTimeslot?.startTime ? formatClockTime(currentTimeslot.startTime) : null;
      const end = currentTimeslot?.endTime ? formatClockTime(currentTimeslot.endTime) : null;
      const durationMinutes = start && end
        ? (((Number(end.split(':')[0]) * 60) + Number(end.split(':')[1])) - ((Number(start.split(':')[0]) * 60) + Number(start.split(':')[1])))
        : Number(periodDurationMinutes || 60);
      const spillsIntoNextRow = durationMinutes > Number(periodDurationMinutes || 60) && durationMinutes < (Number(periodDurationMinutes || 60) * 2);

      return {
        ...slot,
        day: normalizeDay(slot.day || slot.dayOfWeek || slot.day_of_week),
        uiRow,
        __timing: { start, end },
        __durationMinutes: durationMinutes,
        __spillsIntoNextRow: spillsIntoNextRow,
      };
    }).filter((slot) => slot.day && slot.uiRow);
  }, [slots, timeslots, timeslotToPosition, periodDurationMinutes]);

  const computedPeriodsPerDay = React.useMemo(() => {
    const maxFromTimeslots = Math.max(...Object.values(timeslotListByDay).map((daySlots) => daySlots.length), 0);
    const maxFromSlots = normalizedSlots.reduce((max, slot) => Math.max(max, slot.uiRow || 0), 0);
    return Math.max(periodsPerDay, maxFromTimeslots, maxFromSlots);
  }, [timeslotListByDay, normalizedSlots, periodsPerDay]);

  const activePeriods = Array.from({ length: computedPeriodsPerDay }, (_, idx) => idx + 1);

  const getGroupInfo = (groupId) => groups.find((group) => group.id === groupId);
  const getRoomInfo = (roomId) => rooms.find((room) => room.id === roomId);
  const getSubjectInfo = (subjectId) => subjects.find((subject) => subject.id === subjectId);
  const getTeacherInfo = (teacherId) => teachers.find((teacher) => teacher.id === teacherId);
  const isStudentView = !globalView && !onUpdateSlot;

  const buildSlotPresentation = React.useCallback((slot) => {
    let subject = null;
    let teacher = null;
    let level = '';
    let group = null;

    if (slot?.teaching_group_id) {
      group = getGroupInfo(slot.teaching_group_id);
      if (group) {
        subject = getSubjectInfo(group.subject_id);
        teacher = getTeacherInfo(group.teacher_id);
        level = slot.display_level_override || group.level || '';
      }
    }

    if (!subject && slot?.subject_id) subject = getSubjectInfo(slot.subject_id);
    if (!teacher && slot?.teacher_id) teacher = getTeacherInfo(slot.teacher_id);
    if (!group && slot?.classgroup_id) group = classGroups.find((item) => item.id === slot.classgroup_id) || null;

    return {
      slot,
      subject,
      teacher,
      room: getRoomInfo(slot?.room_id),
      level,
      group,
      isStudentView,
      isGlobalView: globalView,
      durationMinutes: slot?.__durationMinutes || Number(periodDurationMinutes || 60),
    };
  }, [groups, rooms, subjects, teachers, classGroups, isStudentView, globalView, periodDurationMinutes]);

  const rowMatrix = React.useMemo(() => {
    const matrix = {};
    DAYS.forEach((day) => {
      matrix[day] = {};
      activePeriods.forEach((row) => {
        const rowSlots = normalizedSlots.filter((slot) => slot.day === day && slot.uiRow === row && !slot.is_break);
        const carryOverSlot = normalizedSlots.find((slot) => slot.day === day && slot.uiRow === row - 1 && slot.__spillsIntoNextRow);
        const primarySlot = rowSlots.find((slot) => !slot.__consumed);
        const nextStartingSlot = carryOverSlot ? rowSlots[0] || null : null;
        matrix[day][row] = {
          carryOverSlot: carryOverSlot || null,
          primarySlot: carryOverSlot ? null : (primarySlot || rowSlots[0] || null),
          nextStartingSlot,
          hasContent: !!carryOverSlot || rowSlots.length > 0,
        };
      });
    });
    return matrix;
  }, [normalizedSlots, activePeriods]);

  const handleOpenSlot = (slot) => {
    if (!slot) return;
    const data = buildSlotPresentation(slot);
    setSelectedSlot(data);
    setIsEditing(false);
  };

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-sm" id={exportId}>
        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b-2 border-slate-300 bg-slate-100">
              <div className="border-r border-slate-300 p-4 text-base font-bold text-slate-700">Time</div>
              {DAYS.map((day) => (
                <div key={day} className="border-r border-slate-300 p-4 text-center text-base font-bold text-slate-700 last:border-r-0">{day}</div>
              ))}
            </div>

            {activePeriods.map((uiRow) => (
              <div key={uiRow} className="grid grid-cols-[100px_repeat(5,1fr)] border-b border-slate-300">
                <div className="flex min-h-[116px] flex-col items-center justify-center border-r border-slate-300 bg-slate-50 p-4 text-center">
                  <div className="text-sm font-bold text-slate-800">{uiRow}</div>
                  <div className="mt-1 whitespace-nowrap text-[10px] text-slate-500">{periodTimes[uiRow] || `Period ${uiRow}`}</div>
                </div>
                {DAYS.map((day) => {
                  const cell = rowMatrix[day][uiRow];
                  return (
                    <TimetableCell
                      key={`${day}-${uiRow}`}
                      day={day}
                      uiRow={uiRow}
                      primarySlot={cell.primarySlot}
                      carryOverSlot={cell.carryOverSlot}
                      nextStartingSlot={cell.nextStartingSlot}
                      empty={!cell.hasContent}
                      renderSlotData={buildSlotPresentation}
                      onSlotClick={handleOpenSlot}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedSlot(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-3">
                  <h3 className="text-3xl font-bold text-slate-900">{selectedSlot.subject?.name || selectedSlot.slot?.notes || 'Slot'}</h3>
                  {!isEditing && onUpdateSlot && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setIsEditing(true);
                      setEditForm({
                        teacher_id: selectedSlot.slot?.teacher_id || 'unassigned',
                        room_id: selectedSlot.slot?.room_id || 'unassigned',
                      });
                    }}>Edit</Button>
                  )}
                </div>
                <p className="text-lg text-slate-500">{selectedSlot.slot?.day}, Period {selectedSlot.slot?.uiRow || selectedSlot.slot?.period}</p>
              </div>
              <button onClick={() => { setSelectedSlot(null); setIsEditing(false); }} className="p-1 text-slate-400 transition-colors hover:text-slate-600">×</button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-5">
                <div className="mb-2 text-sm font-semibold text-slate-600">Level</div>
                <div className="text-xl font-bold text-slate-900">{selectedSlot.slot?.display_level_override || selectedSlot.level || '—'}</div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-5">
                <div className="mb-2 text-sm font-semibold text-blue-600">Teacher</div>
                {isEditing ? (
                  <Select value={editForm.teacher_id} onValueChange={(value) => setEditForm((prev) => ({ ...prev, teacher_id: value }))}>
                    <SelectTrigger className="h-12 w-full bg-white text-lg"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xl font-bold text-blue-900">{selectedSlot.teacher?.full_name || 'Not assigned'}</div>
                )}
              </div>

              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 p-5">
                <div className="mb-2 text-sm font-semibold text-emerald-600">Room</div>
                {isEditing ? (
                  <Select value={editForm.room_id} onValueChange={(value) => setEditForm((prev) => ({ ...prev, room_id: value }))}>
                    <SelectTrigger className="h-12 w-full bg-white text-lg"><SelectValue placeholder="Select room" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {rooms.map((room) => <SelectItem key={room.id} value={room.id}>{room.name} ({room.capacity} cap)</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-xl font-bold text-emerald-900">{selectedSlot.room?.name || 'Not assigned'}</div>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="flex items-center gap-3 pt-6">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => {
                  const newTeacherId = editForm.teacher_id === 'unassigned' ? null : editForm.teacher_id;
                  const newRoomId = editForm.room_id === 'unassigned' ? null : editForm.room_id;
                  onUpdateSlot?.(selectedSlot.slot.id, { teacher_id: newTeacherId, room_id: newRoomId });
                  setIsEditing(false);
                  setSelectedSlot((prev) => ({
                    ...prev,
                    slot: { ...prev.slot, teacher_id: newTeacherId, room_id: newRoomId },
                    teacher: teachers.find((teacher) => teacher.id === newTeacherId) || null,
                    room: rooms.find((room) => room.id === newRoomId) || null,
                  }));
                }}>Save Changes</Button>
                <Button size="lg" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}