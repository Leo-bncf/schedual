import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function normalizeDay(value) {
  const map = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
  };
  const upper = String(value || '').toUpperCase();
  return map[upper] || value;
}

function sameTime(a, b) {
  if (a?.timeslot_id != null && b?.timeslot_id != null) {
    return String(a.timeslot_id) === String(b.timeslot_id);
  }
  return a?.day === b?.day && Number(a?.period) === Number(b?.period);
}

function intersects(a = [], b = []) {
  if (!a.length || !b.length) return false;
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
    const {
      schedule_version,
      day,
      period,
      timeslot_id,
      subject_id,
      teacher_id,
      room_id,
      classgroup_id,
      teaching_group_id,
      notes,
    } = body;

    if (!schedule_version || !day || !period || !subject_id) {
      return Response.json({ error: 'Schedule version, day, period, and subject are required' }, { status: 400 });
    }

    if (!classgroup_id && !teaching_group_id) {
      return Response.json({ error: 'Choose a class or teaching group' }, { status: 400 });
    }

    const [version] = await base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version });
    if (!version || version.school_id !== user.school_id) {
      return Response.json({ error: 'Schedule version not found' }, { status: 404 });
    }

    const [groups, classGroups, students, teachers, rooms, subjects, allSlots] = await Promise.all([
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id }, '-created_date', 1000),
      base44.asServiceRole.entities.ClassGroup.filter({ school_id: user.school_id }, '-created_date', 500),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id }, '-created_date', 1000),
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id }, '-created_date', 500),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id }, '-created_date', 500),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id }, '-created_date', 500),
      base44.asServiceRole.entities.ScheduleSlot.filter({ school_id: user.school_id, schedule_version }, '-created_date', 2000),
    ]);

    const subject = subjects.find((item) => item.id === subject_id);
    if (!subject) {
      return Response.json({ error: 'Subject not found' }, { status: 400 });
    }

    const groupMap = new Map(groups.map((group) => [group.id, group]));
    const classGroupMap = new Map(classGroups.map((group) => [group.id, group]));
    const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    const roomMap = new Map(rooms.map((room) => [room.id, room]));
    const studentMap = new Map(students.map((student) => [student.id, student]));

    const teachingGroup = teaching_group_id ? groupMap.get(teaching_group_id) : null;
    const classGroup = classgroup_id ? classGroupMap.get(classgroup_id) : null;

    if (teaching_group_id && !teachingGroup) {
      return Response.json({ error: 'Teaching group not found' }, { status: 400 });
    }

    if (classgroup_id && !classGroup) {
      return Response.json({ error: 'Class not found' }, { status: 400 });
    }

    const finalStudentIds = teachingGroup?.student_ids?.length
      ? teachingGroup.student_ids
      : (classGroup?.student_ids || []).filter((id) => studentMap.has(id));

    if (!finalStudentIds.length) {
      return Response.json({ error: 'The selected class/group has no students assigned' }, { status: 400 });
    }

    if (teacher_id) {
      const teacher = teacherMap.get(teacher_id);
      const canTeach = teacher?.subjects?.includes(subject_id) || teacher?.qualifications?.some((q) => q.subject_id === subject_id);
      if (!teacher || !canTeach) {
        return Response.json({ error: 'Selected teacher cannot teach this subject' }, { status: 400 });
      }
    }

    if (room_id) {
      const room = roomMap.get(room_id);
      if (!room) {
        return Response.json({ error: 'Selected room not found' }, { status: 400 });
      }
      if (finalStudentIds.length > Number(room.capacity || 0)) {
        return Response.json({ error: 'Selected room is too small for this lesson' }, { status: 400 });
      }
    }

    const finalSlot = {
      school_id: user.school_id,
      schedule_version,
      day: normalizeDay(day),
      period: Number(period),
      timeslot_id: timeslot_id ?? null,
      subject_id,
      teacher_id: teacher_id || null,
      room_id: room_id || null,
      classgroup_id: classgroup_id || null,
      teaching_group_id: teaching_group_id || null,
      status: 'scheduled',
      notes: notes || '',
    };

    const conflicts = [];

    for (const other of allSlots) {
      if (!sameTime(finalSlot, other)) continue;

      if (finalSlot.teacher_id && other.teacher_id && finalSlot.teacher_id === other.teacher_id) {
        conflicts.push('Teacher already has another lesson in that timeslot');
      }

      if (finalSlot.room_id && other.room_id && finalSlot.room_id === other.room_id) {
        conflicts.push('Room is already occupied in that timeslot');
      }

      const otherStudentIds = getSlotStudentIds(other, groupMap).length
        ? getSlotStudentIds(other, groupMap)
        : ((other.classgroup_id && classGroupMap.get(other.classgroup_id)?.student_ids) || []);

      if (intersects(finalStudentIds, otherStudentIds)) {
        conflicts.push('One or more students already have another lesson in that timeslot');
      }
    }

    if (conflicts.length > 0) {
      return Response.json({ error: conflicts[0], conflicts: [...new Set(conflicts)] }, { status: 400 });
    }

    const created = await base44.asServiceRole.entities.ScheduleSlot.create(finalSlot);
    return Response.json({ ok: true, slot: created });
  } catch (error) {
    console.error('[createManualScheduleSlot] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});