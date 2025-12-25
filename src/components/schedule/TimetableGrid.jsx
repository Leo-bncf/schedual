import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const periodTimes = {
  1: '08:00',
  2: '08:45',
  3: '09:30',
  4: '10:15',
  5: '11:00',
  6: '11:45',
  7: '13:00',
  8: '13:45',
  9: '14:30',
  10: '15:15',
  11: '16:00',
  12: '16:45',
};

const subjectColors = {
  1: 'bg-blue-100 border-blue-300',
  2: 'bg-emerald-100 border-emerald-300',
  3: 'bg-amber-100 border-amber-300',
  4: 'bg-rose-100 border-rose-300',
  5: 'bg-violet-100 border-violet-300',
  6: 'bg-cyan-100 border-cyan-300',
};

export default function TimetableGrid({ slots = [], groups = [], rooms = [], subjects = [], teachers = [], onSlotClick, periodsPerDay = 12, exportId = "timetable-grid" }) {
  const [selectedSlot, setSelectedSlot] = React.useState(null);

  const getSlotData = (day, period) => {
    return slots.find(s => s.day === day && s.period === period);
  };

  const getGroupInfo = (groupId) => {
    return groups.find(g => g.id === groupId);
  };

  const getRoomInfo = (roomId) => {
    return rooms.find(r => r.id === roomId);
  };

  const getSubjectInfo = (subjectId) => {
    return subjects.find(s => s.id === subjectId);
  };

  const getTeacherInfo = (teacherId) => {
    return teachers.find(t => t.id === teacherId);
  };

  const activePeriods = PERIODS.slice(0, periodsPerDay);

  const getSlotSpan = (day, period) => {
    const currentSlot = getSlotData(day, period);
    if (!currentSlot) return 1;

    let span = 1;
    let checkPeriod = period + 1;
    
    while (checkPeriod <= periodsPerDay) {
      const nextSlot = getSlotData(day, checkPeriod);
      if (nextSlot && nextSlot.teaching_group_id === currentSlot.teaching_group_id) {
        span++;
        checkPeriod++;
      } else {
        break;
      }
    }
    
    return span;
  };

  const shouldSkipCell = (day, period) => {
    for (let p = period - 1; p >= 1; p--) {
      const slot = getSlotData(day, p);
      if (slot) {
        const span = getSlotSpan(day, p);
        if (p + span > period) {
          return true;
        }
      }
    }
    return false;
  };

  const handleSlotClick = (slot) => {
    if (!slot) return;
    const group = getGroupInfo(slot.teaching_group_id);
    const room = getRoomInfo(slot.room_id);
    const subject = group ? getSubjectInfo(group.subject_id) : null;
    const teacher = group ? getTeacherInfo(group.teacher_id) : null;
    
    setSelectedSlot({ slot, group, room, subject, teacher });
  };

  return (
    <>
      <Card className="overflow-hidden border-0 shadow-sm" id={exportId}>
        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            {/* Header Row */}
            <div className="grid grid-cols-[100px_repeat(5,1fr)] bg-slate-100 border-b-2 border-slate-300">
              <div className="p-4 font-bold text-slate-700 text-base border-r border-slate-300">Time</div>
              {DAYS.map(day => (
                <div key={day} className="p-4 font-bold text-slate-700 text-center text-base border-r border-slate-300 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Period Rows */}
            {activePeriods.map(period => (
              <div key={period} className="grid grid-cols-[100px_repeat(5,1fr)] border-b border-slate-200 last:border-0" style={{ minHeight: '100px' }}>
                <div className="p-4 bg-slate-50 border-r border-slate-300 flex flex-col justify-center">
                  <div className="text-sm font-semibold text-slate-700">Period {period}</div>
                  <div className="text-sm text-slate-500 mt-1">{periodTimes[period]}</div>
                </div>
                {DAYS.map(day => {
                  if (shouldSkipCell(day, period)) {
                    return null;
                  }

                  const slot = getSlotData(day, period);
                  const span = slot ? getSlotSpan(day, period) : 1;
                  const group = slot ? getGroupInfo(slot.teaching_group_id) : null;
                  const room = slot ? getRoomInfo(slot.room_id) : null;
                  const subject = group ? getSubjectInfo(group.subject_id) : null;
                  const teacher = group ? getTeacherInfo(group.teacher_id) : null;
                  const colorClass = subject ? subjectColors[subject.ib_group || 1] : '';

                  return (
                    <div 
                      key={`${day}-${period}`} 
                      className={`border-r border-slate-200 last:border-r-0 transition-all relative ${slot ? 'cursor-pointer hover:brightness-95' : ''}`}
                      style={{ 
                        gridRow: span > 1 ? `span ${span}` : undefined,
                      }}
                      onClick={() => slot && handleSlotClick(slot)}
                    >
                      {slot && group && (
                        <div className={`h-full p-4 border-l-4 ${colorClass} flex flex-col justify-center`}>
                          <div className="font-bold text-base text-slate-900 leading-tight mb-2">
                            {subject?.name || group.name}
                          </div>
                          <Badge variant="outline" className="w-fit mb-2 bg-white/60 font-semibold">
                            {group.level}
                          </Badge>
                          <div className="text-sm text-slate-700 space-y-1">
                            <div className="font-medium">📍 {room?.name || 'TBD'}</div>
                            {teacher && (
                              <div className="font-medium">👤 {teacher.full_name}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Slot Details Modal */}
      {selectedSlot && (
        <div 
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSlot(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-slate-900 mb-2">{selectedSlot.subject?.name}</h3>
                <p className="text-slate-500 text-lg">{selectedSlot.slot.day}, Period {selectedSlot.slot.period}</p>
              </div>
              <button 
                onClick={() => setSelectedSlot(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-5 border border-slate-200">
                <div className="text-sm font-semibold text-slate-600 mb-2">Level</div>
                <div className="text-xl font-bold text-slate-900">{selectedSlot.group?.level}</div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <div className="text-sm font-semibold text-blue-600 mb-2">Teacher</div>
                <div className="text-xl font-bold text-blue-900">
                  {selectedSlot.teacher?.full_name || 'Not assigned'}
                </div>
                {selectedSlot.teacher?.email && (
                  <div className="text-sm text-blue-700 mt-2">{selectedSlot.teacher.email}</div>
                )}
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-5 border border-emerald-200">
                <div className="text-sm font-semibold text-emerald-600 mb-2">Room</div>
                <div className="text-xl font-bold text-emerald-900">
                  {selectedSlot.room?.name || 'Not assigned'}
                </div>
                {selectedSlot.room?.building && (
                  <div className="text-sm text-emerald-700 mt-2">
                    Building {selectedSlot.room.building}
                    {selectedSlot.room.floor && `, Floor ${selectedSlot.room.floor}`}
                  </div>
                )}
                {selectedSlot.room?.capacity && (
                  <div className="text-sm text-emerald-700 mt-1">
                    Capacity: {selectedSlot.room.capacity} students
                  </div>
                )}
              </div>

              <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-5 border border-violet-200">
                <div className="text-sm font-semibold text-violet-600 mb-2">Group Details</div>
                <div className="text-lg font-bold text-violet-900">{selectedSlot.group?.name}</div>
                {selectedSlot.group?.student_ids?.length > 0 && (
                  <div className="text-sm text-violet-700 mt-2">
                    {selectedSlot.group.student_ids.length} students enrolled
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedSlot(null)}
              className="w-full mt-6 px-6 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors shadow-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}