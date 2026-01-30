import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Build scheduling problem exclusively from subjectRequirements
// Input JSON:
// {
//   schedule_version_id: string,
//   subjectRequirements: Array<{
//     subject_id?: string,      // Base44 subject id (preferred)
//     subject_code?: string,    // Fallback: raw code or name to normalize
//     teaching_group_id?: string,
//     classgroup_id?: string,
//     student_group?: string,   // Free label if not using ids
//     weeklyCount: number,      // REQUIRED: number of weekly sessions
//     requiredCapacity?: number,
//     teacher_id?: string,
//     room_id?: string
//   }>
// }
// Output: { success, problem: { timeslots, rooms, teachers, lessons }, stats }
// Notes:
// - lessons[] is created by duplicating a single entry weeklyCount times with unique IDs
// - subjects sent to solver are Base44-normalized codes (e.g., "AN A" -> "AN_A")
// - reverse mapping to subject_id is handled downstream (callORToolScheduler) using DB subjects
// - We DO NOT derive lessons from ScheduleSlots or any other logic

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const schedule_version_id = body?.schedule_version_id;
    const subjectRequirements = body?.subjectRequirements;

    if (!schedule_version_id) {
      return Response.json({ error: 'schedule_version_id required' }, { status: 400 });
    }
    if (!Array.isArray(subjectRequirements) || subjectRequirements.length === 0) {
      return Response.json({ error: 'subjectRequirements[] required' }, { status: 400 });
    }

    const school_id = user.school_id;

    // Fetch school + resources for mapping (rooms/teachers for numeric IDs, subjects for code normalization)
    const [school, roomsDb, teachersDb, subjectsDb] = await Promise.all([
      base44.entities.School.filter({ id: school_id }).then((r) => r[0]),
      base44.entities.Room.filter({ school_id, is_active: true }),
      base44.entities.Teacher.filter({ school_id, is_active: true }),
      base44.entities.Subject.filter({ school_id, is_active: true }),
    ]);

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    // Helpers
    const normalizeSubjectCode = (raw) => {
      if (!raw) return null;
      const s = String(raw)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      return s || null;
    };

    // Build subject id -> normalized code map
    const subjectIdToCode = {};
    subjectsDb.forEach((subj) => {
      const base = subj.code || subj.name || subj.id;
      subjectIdToCode[subj.id] = normalizeSubjectCode(base);
    });

    // Build timeslots up to 18:00 using school config
    const period_duration = school.period_duration_minutes || 60;
    const school_start = school.school_start_time || '08:00';
    const school_end = '18:00';

    const [startHour, startMin] = school_start.split(':').map(Number);
    const [endHour, endMin] = school_end.split(':').map(Number);
    const schoolStartMinutes = startHour * 60 + startMin;
    const schoolEndMinutes = endHour * 60 + endMin;

    const totalMinutes = schoolEndMinutes - schoolStartMinutes;
    const periods_per_day = Math.max(1, Math.ceil(totalMinutes / period_duration));

    const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const timeslots = [];
    let timeslotId = 1;
    for (const day of DAYS) {
      for (let p = 0; p < periods_per_day; p++) {
        const periodStart = schoolStartMinutes + p * period_duration;
        const periodEnd = periodStart + period_duration;
        const startTime = `${String(Math.floor(periodStart / 60)).padStart(2, '0')}:${String(periodStart % 60).padStart(2, '0')}`;
        const endTime = `${String(Math.floor(periodEnd / 60)).padStart(2, '0')}:${String(periodEnd % 60).padStart(2, '0')}`;
        timeslots.push({ id: timeslotId++, dayOfWeek: day, startTime, endTime });
      }
    }

    // Rooms/Teachers in numeric-id format (keep order stable for downstream mapping by index)
    const rooms = roomsDb.map((r, idx) => ({ id: idx + 1, name: r.name || `Room ${idx + 1}`, capacity: r.capacity || 0 }));
    const teachers = teachersDb.map((t, idx) => ({ id: idx + 1, name: t.full_name || `Teacher ${idx + 1}` }));

    // Build id -> numeric maps for teacher/room
    const teacherIdToNumeric = teachersDb.reduce((acc, t, idx) => {
      acc[t.id] = idx + 1;
      return acc;
    }, {});
    const roomIdToNumeric = roomsDb.reduce((acc, r, idx) => {
      acc[r.id] = idx + 1;
      return acc;
    }, {});

    // Build lessons exclusively from subjectRequirements
    const lessons = [];
    let lessonId = 1;
    const perSubjectCount = {};

    for (let i = 0; i < subjectRequirements.length; i++) {
      const reqItem = subjectRequirements[i] || {};
      const weeklyCount = Number(reqItem.weeklyCount ?? reqItem.weekly_count);
      if (!Number.isFinite(weeklyCount) || weeklyCount <= 0) {
        continue; // skip invalid entries
      }

      let subjectCode = null;
      if (reqItem.subject_id) {
        subjectCode = subjectIdToCode[reqItem.subject_id] || null;
      }
      if (!subjectCode) {
        subjectCode = normalizeSubjectCode(reqItem.subject_code || reqItem.subject || null);
      }
      if (!subjectCode) {
        continue; // cannot proceed without a subject code
      }

      const teacherNumericId = reqItem.teacher_id ? (teacherIdToNumeric[reqItem.teacher_id] || null) : null;
      const roomNumericId = reqItem.room_id ? (roomIdToNumeric[reqItem.room_id] || null) : null;

      const studentGroup = reqItem.student_group
        || (reqItem.teaching_group_id ? `TG_${reqItem.teaching_group_id}`
        : (reqItem.classgroup_id ? `CG_${reqItem.classgroup_id}` : `GROUP_${i + 1}`));

      const requiredCapacity = Number(reqItem.requiredCapacity ?? reqItem.capacity);
      const capacity = Number.isFinite(requiredCapacity) && requiredCapacity > 0 ? requiredCapacity : 20;

      for (let k = 0; k < weeklyCount; k++) {
        lessons.push({
          id: lessonId++,
          subject: subjectCode,       // normalized code only
          studentGroup,
          requiredCapacity: capacity,
          timeslotId: null,
          roomId: roomNumericId || null,
          teacherId: teacherNumericId || null,
        });
      }

      perSubjectCount[subjectCode] = (perSubjectCount[subjectCode] || 0) + weeklyCount;
    }

    // Logs required: total lessons + count by subject code (before POST /solve)
    console.log('[buildSchedulingProblem] lessons total =', lessons.length);
    console.log('[buildSchedulingProblem] lessons per subject =', perSubjectCount);

    const problem = { timeslots, rooms, teachers, lessons };

    return Response.json({
      success: true,
      problem,
      stats: {
        timeslots: timeslots.length,
        rooms: rooms.length,
        teachers: teachers.length,
        lessons: lessons.length,
        perSubjectCount,
        periods_per_day,
      },
    });
  } catch (error) {
    console.error('buildSchedulingProblem error:', error);
    return Response.json({ error: error.message || 'Failed to build scheduling problem' }, { status: 500 });
  }
});