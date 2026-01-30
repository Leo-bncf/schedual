import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Webhook to append ScheduleSlot records
// Auth: Authorization: Bearer <token> where token === WEBHOOK_BEARER_TOKEN
// Payload: array of slots [{ school_id, schedule_version, day, period, subject_id, teacher_id, room_id }]
// Behavior: append-only (no deletion). Returns { insertedCount, deletedCount: 0, errors }
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const expected = Deno.env.get('WEBHOOK_BEARER_TOKEN') || '';

    if (!expected) {
      return Response.json({ error: 'Server not configured: WEBHOOK_BEARER_TOKEN missing' }, { status: 503 });
    }
    if (!token || token !== expected) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const slots = Array.isArray(payload) ? payload : (Array.isArray(payload?.slots) ? payload.slots : null);
    if (!Array.isArray(slots)) {
      return Response.json({ error: 'Invalid payload: expected an array of slots' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const validDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    const normalizeDay = (d) => {
      if (!d) return null;
      const up = String(d).toLowerCase();
      const title = up.charAt(0).toUpperCase() + up.slice(1);
      return validDays.has(title) ? title : null;
    };

    const toNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const records = [];
    const errors = [];

    slots.forEach((s, idx) => {
      const day = normalizeDay(s.day);
      const period = toNumber(s.period);
      const school_id = s.school_id || null;
      const schedule_version = s.schedule_version || null;

      if (!school_id || !schedule_version || !day || !period) {
        errors.push({ index: idx, error: 'Missing or invalid field(s)', details: { school_id, schedule_version, day: s.day, period: s.period } });
        return;
      }

      records.push({
        school_id,
        schedule_version,
        day,
        period,
        subject_id: s.subject_id || null,
        teacher_id: s.teacher_id || null,
        room_id: s.room_id || null,
        is_double_period: Boolean(s.is_double_period) || false,
        status: s.status || 'scheduled',
        notes: s.notes || undefined,
        teaching_group_id: s.teaching_group_id || null,
        classgroup_id: s.classgroup_id || null,
      });
    });

    let insertedCount = 0;
    if (records.length > 0) {
      const created = await base44.asServiceRole.entities.ScheduleSlot.bulkCreate(records);
      insertedCount = Array.isArray(created) ? created.length : 0;
    }

    return Response.json({ insertedCount, deletedCount: 0, errors });
  } catch (error) {
    console.error('scheduleSlots webhook error:', error);
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
});