import React from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const LUNCH_PERIOD = 6; // After period 6 (11:45), before period 7 (13:00)

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

export default function TimetableGrid({ slots = [], groups = [], rooms = [], subjects = [], teachers = [], classGroups = [], onSlotClick, periodsPerDay = 12, exportId = "timetable-grid" }) {
  const [selectedSlot, setSelectedSlot] = React.useState(null);

  const getSlotData = (day, period) => {
    return slots.filter(s => s.day === day && s.period === period);
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

  const getSlotSpan = (day, period, slotId) => {
    const currentSlots = getSlotData(day, period);
    const currentSlot = currentSlots.find(s => s.id === slotId);
    if (!currentSlot) return 1;

    let span = 1;
    let checkPeriod = period + 1;
    
    while (checkPeriod <= periodsPerDay) {
      const nextSlots = getSlotData(day, checkPeriod);
      if (nextSlots.some(s => s.teaching_group_id === currentSlot.teaching_group_id)) {
        span++;
        checkPeriod++;
      } else {
        break;
      }
    }
    
    return span;
  };

  const shouldSkipCell = (day, period, slotId) => {
    for (let p = period - 1; p >= 1; p--) {
      const prevSlots = getSlotData(day, p);
      const prevSlot = prevSlots.find(s => s.id === slotId);
      if (prevSlot) {
        const span = getSlotSpan(day, p, slotId);
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
              <React.Fragment key={period}>
                <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b border-slate-300">
                  <div className="p-4 bg-slate-50 border-r border-slate-300 flex flex-col justify-center min-h-[120px]">
                    <div className="text-sm font-semibold text-slate-700">Period {period}</div>
                    <div className="text-sm text-slate-500 mt-1">{periodTimes[period]}</div>
                  </div>
                {DAYS.map(day => {
                  const slotsInCell = getSlotData(day, period);
                  
                  if (slotsInCell.length === 0) {
                    return (
                      <div 
                        key={`${day}-${period}`} 
                        className="border-r border-slate-300 last:border-r-0 min-h-[120px]"
                      />
                    );
                  }

                  // Filter out slots that should be skipped due to spanning
                  const visibleSlots = slotsInCell.filter(slot => !shouldSkipCell(day, period, slot.id));

                  if (visibleSlots.length === 0) {
                    return null;
                  }

                  // Stack multiple slots vertically within the same cell
                  return (
                    <div 
                      key={`${day}-${period}`} 
                      className="border-r border-slate-300 last:border-r-0 p-2 space-y-2"
                    >
                      {visibleSlots.map(slot => {
                        const span = getSlotSpan(day, period, slot.id);
                        const room = getRoomInfo(slot.room_id);
                        
                        let subject = null;
                        let teacher = null;
                        let level = '';
                        let displayName = '';
                        
                        // PYP/MYP: subject_id and teacher_id are directly on the slot
                        if (slot.subject_id) {
                          subject = getSubjectInfo(slot.subject_id);
                          teacher = getTeacherInfo(slot.teacher_id);
                          const classGroup = classGroups.find(cg => cg.id === slot.classgroup_id);
                          level = classGroup?.ib_programme || '';
                          displayName = classGroup?.name || '';
                        } else {
                          // DP: get from teaching group
                          const group = getGroupInfo(slot.teaching_group_id);
                          if (group) {
                            subject = getSubjectInfo(group.subject_id);
                            teacher = getTeacherInfo(group.teacher_id);
                            level = group.level;
                            displayName = group.name;
                          }
                        }
                        
                        const colorClass = subject ? subjectColors[subject.ib_group || 1] : '';

                        return (
                          <div 
                            key={slot.id}
                            className="cursor-pointer hover:shadow-md transition-all rounded-lg overflow-hidden"
                            onClick={() => handleSlotClick(slot)}
                          >
                            {subject ? (
                              <div className={`p-3 border-l-4 ${colorClass} border border-slate-200`}>
                                <div className="font-bold text-sm text-slate-900 leading-tight mb-1.5">
                                  {subject.name}
                                </div>
                                <Badge variant="outline" className="w-fit mb-2 bg-white/70 font-semibold text-xs">
                                  {level}
                                </Badge>
                                <div className="text-xs text-slate-700 space-y-1">
                                  {teacher ? (
                                    <div className="font-medium">👤 {teacher.full_name}</div>
                                  ) : (
                                    <div className="font-medium text-amber-600">👤 No teacher assigned</div>
                                  )}
                                  <div className="font-medium">📍 {room?.name || 'TBD'}</div>
                                </div>
                                {span > 1 && (
                                  <div className="mt-2 text-xs text-slate-500 font-medium">
                                    {span} periods
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 border-l-4 border-slate-300 bg-slate-50 border border-slate-200">
                                <div className="font-bold text-sm text-slate-600 leading-tight mb-1.5">
                                  Unassigned Class
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                  {teacher ? (
                                    <div className="font-medium">👤 {teacher.full_name}</div>
                                  ) : (
                                    <div className="font-medium text-amber-600">👤 No teacher assigned</div>
                                  )}
                                  <div className="font-medium">📍 {room?.name || 'TBD'}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                </div>
                
                {/* Lunch Break Row */}
                {period === LUNCH_PERIOD && (
                  <div className="grid grid-cols-[100px_repeat(5,1fr)] border-b-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
                    <div className="p-4 bg-amber-100 border-r border-amber-300 flex flex-col justify-center">
                      <div className="text-sm font-bold text-amber-900">🍽️ Lunch</div>
                      <div className="text-sm text-amber-700 mt-1">12:30 - 13:00</div>
                    </div>
                    {DAYS.map(day => (
                      <div key={`${day}-lunch`} className="p-4 border-r border-amber-200 last:border-r-0 flex items-center justify-center">
                        <span className="text-amber-700 font-medium text-sm">Lunch Break</span>
                      </div>
                    ))}
                  </div>
                )}
              </React.Fragment>
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