import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function sameTime(a, b) {
  if (a?.timeslot_id != null && b?.timeslot_id != null) {
    return String(a.timeslot_id) === String(b.timeslot_id);
  }
  return a?.day === b?.day && Number(a?.period) === Number(b?.period);
}

function intersects(a = [], b = []) {
  if (a.length === 0 || b.length === 0) return false;
  const set = new Set(a.map(String));
  return b.some((item) => set.has(String(item)));
}

function getSlotStudentIds(slot, groupMap) {
  if (slot?.student_id) return [slot.student_id];
  if (slot?.teaching_group_id) return groupMap.get(slot.teaching_group_id)?.student_ids || [];
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { slot_id, updates = {} } = body;

    if (!slot_id) {
      return Response.json({ error: 'slot_id is required' }, { status: 400 });
    }

    const [slot] = await base44.asServiceRole.entities.ScheduleSlot.filter({ id: slot_id });
    if (!slot || slot.school_id !== user.school_id) {
      return Response.json({ error: 'Schedule slot not found' }, { status: 404 });
    }

    const [allSlots, groups, teachers, rooms] = await Promise.all([
      base44.asServiceRole.entities.ScheduleSlot.filter({
        school_id: user.school_id,
        schedule_version: slot.schedule_version,
      }, '-created_date', 1000),
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id }),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id }),
    ]);

    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    const roomMap = new Map(rooms.map((room) => [room.id, room]));

    const finalSlot = { ...slot, ...updates };
    const finalGroup = finalSlot.teaching_group_id ? groupMap.get(finalSlot.teaching_group_id) : null;
    const finalStudentIds = getSlotStudentIds(finalSlot, groupMap);
    const finalSubjectId = finalSlot.subject_id || finalGroup?.subject_id || null;

    if (finalSlot.teacher_id) {
      const teacher = teacherMap.get(finalSlot.teacher_id);
      const canTeach = teacher?.subjects?.includes(finalSubjectId) || teacher?.qualifications?.some((q) => q.subject_id === finalSubjectId);
      if (!teacher || !canTeach) {
        return Response.json({ error: 'Selected teacher cannot teach this subject' }, { status: 400 });
      }
    }

    if (finalSlot.room_id) {
      const room = roomMap.get(finalSlot.room_id);
      if (!room) {
        return Response.json({ error: 'Selected room not found' }, { status: 400 });
      }
      if (finalStudentIds.length > Number(room.capacity || 0)) {
        return Response.json({ error: 'Selected room is too small for this lesson' }, { status: 400 });
      }
    }

    const conflicts = [];

    for (const other of allSlots) {
      if (other.id === slot_id) continue;
      if (!sameTime(finalSlot, other)) continue;

      if (finalSlot.teacher_id && other.teacher_id && finalSlot.teacher_id === other.teacher_id) {
        conflicts.push('Teacher already has another lesson in that timeslot');
      }

      if (finalSlot.room_id && other.room_id && finalSlot.room_id === other.room_id) {
        conflicts.push('Room is already occupied in that timeslot');
      }

      const otherStudentIds = getSlotStudentIds(other, groupMap);
      if (intersects(finalStudentIds, otherStudentIds)) {
        conflicts.push('One or more students already have another lesson in that timeslot');
      }
    }

    if (conflicts.length > 0) {
      return Response.json({ error: conflicts[0], conflicts: [...new Set(conflicts)] }, { status: 400 });
    }

    const allowedKeys = ['day', 'period', 'timeslot_id', 'teacher_id', 'room_id', 'status', 'notes'];
    const updateData = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowedKeys.includes(key))
    );

    const updatedSlot = await base44.asServiceRole.entities.ScheduleSlot.update(slot_id, updateData);
    return Response.json({ ok: true, slot: updatedSlot });
  } catch (error) {
    console.error('[updateScheduleSlotValidated] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});