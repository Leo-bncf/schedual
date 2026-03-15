import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@2.5.2';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function normalizeDay(day) {
  if (!day) return '';
  const up = String(day).toUpperCase();
  const dayMap = {
    MONDAY: 'Monday',
    TUESDAY: 'Tuesday',
    WEDNESDAY: 'Wednesday',
    THURSDAY: 'Thursday',
    FRIDAY: 'Friday',
  };
  return dayMap[up] || String(day);
}

function getVersionTimeslots(scheduleVersion, school) {
  const params = typeof scheduleVersion?.generation_params === 'string'
    ? JSON.parse(scheduleVersion.generation_params)
    : (scheduleVersion?.generation_params || {});

  if (Array.isArray(params?.solverTimeslots) && params.solverTimeslots.length > 0) {
    return params.solverTimeslots;
  }

  const daysOfWeek = school?.days_of_week || ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const startTime = school?.day_start_time || '08:00';
  const endTime = school?.day_end_time || '18:00';
  const periodDuration = Number(school?.period_duration_minutes || 60);
  const breaks = Array.isArray(school?.breaks) ? school.breaks : [];

  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;

  const timeslots = [];
  let id = 1;

  for (const dayOfWeek of daysOfWeek) {
    let current = startTotal;
    while (current < endTotal) {
      const next = current + periodDuration;
      const overlapsBreak = breaks.some((brk) => {
        const [brkStartHour, brkStartMinute] = brk.start.split(':').map(Number);
        const [brkEndHour, brkEndMinute] = brk.end.split(':').map(Number);
        const brkStart = brkStartHour * 60 + brkStartMinute;
        const brkEnd = brkEndHour * 60 + brkEndMinute;
        return current < brkEnd && next > brkStart;
      });

      if (!overlapsBreak) {
        const startH = Math.floor(current / 60);
        const startM = current % 60;
        const endH = Math.floor(next / 60);
        const endM = next % 60;
        timeslots.push({
          id: id++,
          dayOfWeek,
          startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
          endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
        });
      }

      current = next;
    }
  }

  return timeslots;
}

function buildTimeslotPositionMap(timeslots) {
  const byDay = {};
  for (const day of DAYS) byDay[day] = [];

  (timeslots || []).forEach((ts) => {
    const day = normalizeDay(ts.dayOfWeek);
    if (byDay[day]) byDay[day].push(ts);
  });

  Object.keys(byDay).forEach((day) => {
    byDay[day].sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  });

  const positionMap = {};
  const timeLabels = {};
  let maxPeriods = 0;

  Object.entries(byDay).forEach(([day, daySlots]) => {
    maxPeriods = Math.max(maxPeriods, daySlots.length);
    daySlots.forEach((ts, idx) => {
      const row = idx + 1;
      positionMap[String(ts.id)] = row;
      if (!timeLabels[row]) {
        timeLabels[row] = `${String(ts.startTime).slice(0, 5)}-${String(ts.endTime).slice(0, 5)}`;
      }
    });
  });

  return { positionMap, timeLabels, maxPeriods };
}

function buildGrid(slots, timeslots) {
  const { positionMap, timeLabels, maxPeriods } = buildTimeslotPositionMap(timeslots);
  const grid = new Map();

  (slots || []).forEach((slot) => {
    const day = normalizeDay(slot.day);
    const row = slot.timeslot_id ? positionMap[String(slot.timeslot_id)] : slot.period;
    if (!day || !row) return;
    const key = `${day}__${row}`;
    const current = grid.get(key) || [];
    current.push(slot);
    grid.set(key, current);
  });

  return { grid, timeLabels, maxPeriods };
}

function getSubjectColors(subject) {
  const colors = {
    '1': [232, 239, 255],
    '2': [227, 244, 240],
    '3': [244, 234, 255],
    '4': [235, 243, 255],
    '5': [255, 239, 228],
    '6': [252, 233, 243],
  };
  const group = String(subject?.ib_group || '0');
  return colors[group] || [241, 245, 249];
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function drawCellText(doc, lines, x, y, w, h) {
  const top = y + 3;
  const maxLines = Math.max(1, Math.floor((h - 4) / 3.5));
  lines.slice(0, maxLines).forEach((line, index) => {
    const safe = doc.splitTextToSize(String(line), Math.max(10, w - 4));
    const text = Array.isArray(safe) ? safe[0] : safe;
    doc.text(text, x + 2, top + (index * 3.5));
  });
}

function createTimetablePdf({ title, subtitle, school, scheduleVersion, slots, timeslots, subjects, teachers, rooms, groups }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const subjectMap = new Map((subjects || []).map((subject) => [subject.id, subject]));
  const teacherMap = new Map((teachers || []).map((teacher) => [teacher.id, teacher]));
  const roomMap = new Map((rooms || []).map((room) => [room.id, room]));
  const groupMap = new Map((groups || []).map((group) => [group.id, group]));

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Schedual', 12, 14);
  doc.setFontSize(11);
  doc.text(title, pageWidth - 12, 10, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(subtitle, pageWidth - 12, 16, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 12, 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${school?.name || 'School'} • ${scheduleVersion?.name || 'Schedule'} • Generated ${new Date().toLocaleDateString('en-GB')}`, 12, 37);

  const { grid, timeLabels, maxPeriods } = buildGrid(slots, timeslots);
  const rows = Math.max(1, maxPeriods || 10);
  const gridX = 10;
  const gridY = 44;
  const timeColWidth = 20;
  const dayColWidth = (pageWidth - gridX * 2 - timeColWidth) / 5;
  const rowHeight = Math.max(12, Math.min(18, (pageHeight - gridY - 12) / (rows + 1)));

  doc.setFillColor(241, 245, 249);
  doc.rect(gridX, gridY, timeColWidth, rowHeight, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Time', gridX + 4, gridY + 6);

  DAYS.forEach((day, index) => {
    const x = gridX + timeColWidth + (index * dayColWidth);
    doc.setFillColor(241, 245, 249);
    doc.rect(x, gridY, dayColWidth, rowHeight, 'F');
    doc.text(day, x + dayColWidth / 2, gridY + 6, { align: 'center' });
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (let row = 1; row <= rows; row++) {
    const y = gridY + rowHeight + ((row - 1) * rowHeight);
    doc.setDrawColor(203, 213, 225);
    doc.rect(gridX, y, timeColWidth, rowHeight);
    doc.text(String(row), gridX + 4, y + 4);
    doc.text(timeLabels[row] || '', gridX + 4, y + 8);

    DAYS.forEach((day, index) => {
      const x = gridX + timeColWidth + (index * dayColWidth);
      const cellSlots = grid.get(`${day}__${row}`) || [];
      doc.setDrawColor(226, 232, 240);
      doc.rect(x, y, dayColWidth, rowHeight);

      if (cellSlots.length === 0) return;

      const cellHeight = rowHeight / cellSlots.length;
      cellSlots.forEach((slot, slotIndex) => {
        const slotY = y + (slotIndex * cellHeight);
        const group = slot.teaching_group_id ? groupMap.get(slot.teaching_group_id) : null;
        const subject = slot.subject_id ? subjectMap.get(slot.subject_id) : (group ? subjectMap.get(group.subject_id) : null);
        const teacher = slot.teacher_id ? teacherMap.get(slot.teacher_id) : (group ? teacherMap.get(group.teacher_id) : null);
        const room = slot.room_id ? roomMap.get(slot.room_id) : null;
        const [r, g, b] = getSubjectColors(subject);

        doc.setFillColor(r, g, b);
        doc.rect(x + 0.7, slotY + 0.7, dayColWidth - 1.4, cellHeight - 1.4, 'F');
        doc.setFont('helvetica', 'bold');
        drawCellText(doc, [subject?.name || 'Lesson'], x + 1, slotY + 1, dayColWidth - 2, cellHeight - 2);
        doc.setFont('helvetica', 'normal');
        drawCellText(
          doc,
          [slot.display_level_override || group?.level || '', teacher?.full_name || '', room?.name || ''],
          x + 1,
          slotY + 5,
          dayColWidth - 2,
          cellHeight - 4
        );
      });
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Generated by Schedual • Printable timetable export', pageWidth / 2, pageHeight - 5, { align: 'center' });

  return doc;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { type, student_id, teacher_id, schedule_version_id } = body;

    if (!schedule_version_id || !type || (!student_id && !teacher_id)) {
      return Response.json({ error: 'type, schedule_version_id and target id are required' }, { status: 400 });
    }

    const schoolId = user.school_id;

    const [schools, scheduleVersions, subjects, teachers, rooms, groups] = await Promise.all([
      base44.entities.School.filter({ id: schoolId }),
      base44.entities.ScheduleVersion.filter({ id: schedule_version_id }),
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.Teacher.filter({ school_id: schoolId }),
      base44.entities.Room.filter({ school_id: schoolId }),
      base44.entities.TeachingGroup.filter({ school_id: schoolId }),
    ]);

    const school = schools[0];
    const scheduleVersion = scheduleVersions[0];

    if (!school || !scheduleVersion) {
      return Response.json({ error: 'School or schedule version not found' }, { status: 404 });
    }

    const timeslots = getVersionTimeslots(scheduleVersion, school);

    let slots = [];
    let title = 'Timetable';
    let subtitle = scheduleVersion.name || 'Schedule';
    let filename = `timetable-${schedule_version_id}.pdf`;

    if (type === 'student') {
      const [student] = await base44.entities.Student.filter({ id: student_id });
      if (!student) {
        return Response.json({ error: 'Student not found' }, { status: 404 });
      }

      const response = await base44.functions.invoke('getStudentScheduleSlots', {
        student_id,
        schedule_version_id,
      });
      slots = response?.data?.slots || [];
      title = `Student Timetable`;
      subtitle = `${student.full_name} • ${student.year_group}`;
      filename = `student-${student.full_name?.replace(/\s+/g, '-').toLowerCase() || student_id}.pdf`;
    }

    if (type === 'teacher') {
      const [teacher] = await base44.entities.Teacher.filter({ id: teacher_id });
      if (!teacher) {
        return Response.json({ error: 'Teacher not found' }, { status: 404 });
      }

      slots = await base44.entities.ScheduleSlot.filter({
        school_id: schoolId,
        schedule_version: schedule_version_id,
        teacher_id,
      });
      title = `Teacher Timetable`;
      subtitle = teacher.full_name;
      filename = `teacher-${teacher.full_name?.replace(/\s+/g, '-').toLowerCase() || teacher_id}.pdf`;
    }

    const pdf = createTimetablePdf({
      title,
      subtitle,
      school,
      scheduleVersion,
      slots,
      timeslots,
      subjects,
      teachers,
      rooms,
      groups,
    });

    const pdfBuffer = pdf.output('arraybuffer');
    const base64 = arrayBufferToBase64(pdfBuffer);

    return Response.json({
      ok: true,
      filename,
      mimeType: 'application/pdf',
      base64,
    });
  } catch (error) {
    console.error('[exportTimetablePdf] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});