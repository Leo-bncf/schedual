import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Get schedule slots for a student.
 * 
 * PRIMARY MATCH: slot.subject_id ∈ student.subject_choices[].subject_id
 * This is the only reliable field — teaching_group_id on slots may be a
 * synthetic/solver-generated ID that doesn't exist in the TeachingGroup table.
 * 
 * LEVEL GUARD (DP only): if the slot's TG has a level, it must match the
 * student's chosen level for that subject, to avoid giving SL students HL slots.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { student_id, schedule_version_id } = body;

    if (!student_id || !schedule_version_id) {
      return Response.json({ error: 'Missing required parameters: student_id, schedule_version_id' }, { status: 400 });
    }

    // Fetch in parallel
    const [[student], allSlots, teachingGroups] = await Promise.all([
      base44.entities.Student.filter({ id: student_id }),
      base44.entities.ScheduleSlot.filter({
        school_id: user.school_id,
        schedule_version: schedule_version_id,
      }),
      base44.entities.TeachingGroup.filter({ school_id: user.school_id }),
    ]);

    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const subjectChoices = Array.isArray(student.subject_choices) ? student.subject_choices : [];

    // Build a map: subject_id → chosen level (uppercase), for fast lookup
    const choiceBySubjectId = {};
    for (const c of subjectChoices) {
      if (c.subject_id) {
        choiceBySubjectId[c.subject_id] = (c.level || '').toUpperCase().trim();
      }
    }

    // Build TG map for level lookup
    const tgById = {};
    for (const tg of teachingGroups) {
      tgById[tg.id] = tg;
    }

    console.log(`[getStudentScheduleSlots] Student: ${student.full_name} (${student.year_group}), choices: ${Object.keys(choiceBySubjectId).join(', ')}, total slots in schedule: ${allSlots.length}`);

    const studentSlots = allSlots.filter(slot => {
      // PYP/MYP class-group based
      if (slot.classgroup_id && student.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }

      // Individual slot assignment
      if (slot.student_id) {
        return slot.student_id === student.id;
      }

      // Primary match: subject_id on the slot
      if (slot.subject_id && choiceBySubjectId.hasOwnProperty(slot.subject_id)) {
        const chosenLevel = choiceBySubjectId[slot.subject_id];
        // If no level on the choice (non-DP), accept
        if (!chosenLevel) return true;

        // Level guard: check slot TG level if available
        const slotTg = tgById[slot.teaching_group_id];
        const slotLevel = slotTg ? (slotTg.level || '').toUpperCase().trim() : '';
        // If slot TG has no level, accept (can't discriminate)
        if (!slotLevel) return true;
        return slotLevel === chosenLevel;
      }

      return false;
    });

    // Deduplicate by id
    const seen = new Set();
    const dedupedSlots = studentSlots.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });

    // Diagnostics
    const slotsBySubjectId = {};
    for (const slot of dedupedSlots) {
      const sid = slot.subject_id || 'unknown';
      slotsBySubjectId[sid] = (slotsBySubjectId[sid] || 0) + 1;
    }

    console.log(`[getStudentScheduleSlots] Returned ${dedupedSlots.length} slots. By subject_id:`, slotsBySubjectId);

    return Response.json({
      ok: true,
      slots: dedupedSlots,
      diagnostics: {
        student_name: student.full_name,
        year_group: student.year_group,
        subject_choices_count: subjectChoices.length,
        total_slots_in_schedule: allSlots.length,
        student_slots_returned: dedupedSlots.length,
        slots_by_subject_id: slotsBySubjectId,
      },
    });

  } catch (error) {
    console.error('[getStudentScheduleSlots] ERROR:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});