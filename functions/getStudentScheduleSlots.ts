import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SERVER-SIDE SOURCE OF TRUTH: Get schedule slots for a student
 * 
 * Performs server-side join: Student → assigned_groups → ScheduleSlot.teaching_group_id
 * Avoids fragile client-side joins and provides accurate slot loading
 */
function normalizeLevel(raw) {
  if (!raw) return '';
  return String(raw).toUpperCase().trim();
}

Deno.serve(async (req) => {
  const FUNCTION_VERSION = '2026-03-15T20:00:00Z';
  console.log('[getStudentScheduleSlots] 🚀 VERSION:', FUNCTION_VERSION);
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json();
    const { student_id, schedule_version_id } = body;
    
    if (!student_id || !schedule_version_id) {
      return Response.json({ 
        error: 'Missing required parameters', 
        required: ['student_id', 'schedule_version_id'] 
      }, { status: 400 });
    }
    
    console.log('[getStudentScheduleSlots] 📋 Request:', { student_id, schedule_version_id, school_id: user.school_id });
    
    // Step 1: Get student, schedule slots, groups and subjects
    const [student] = await base44.entities.Student.filter({ id: student_id });
    
    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const assignedGroupIds = Array.isArray(student.assigned_groups) ? student.assigned_groups : [];
    const subjectChoices = Array.isArray(student.subject_choices) ? student.subject_choices : [];

    const [allSlots, teachingGroups, subjects] = await Promise.all([
      base44.entities.ScheduleSlot.filter({ 
        school_id: user.school_id,
        schedule_version: schedule_version_id 
      }),
      base44.entities.TeachingGroup.filter({ school_id: user.school_id }),
      base44.entities.Subject.filter({ school_id: user.school_id })
    ]);

    const tgById = {};
    teachingGroups.forEach(tg => { tgById[tg.id] = tg; });

    const subjectById = {};
    subjects.forEach(s => { subjectById[s.id] = s; });

    console.log('[getStudentScheduleSlots] 🎓 Student:', { 
      name: student.full_name, 
      year_group: student.year_group,
      assigned_groups_count: assignedGroupIds.length,
      assigned_groups: assignedGroupIds,
      subject_choices_count: subjectChoices.length
    });

    if (assignedGroupIds.length === 0 && subjectChoices.length === 0) {
      console.warn('[getStudentScheduleSlots] ⚠️ Student has no assigned_groups and no subject_choices');
      return Response.json({
        ok: true,
        slots: [],
        diagnostics: {
          student_name: student.full_name,
          assigned_groups_count: 0,
          subject_choices_count: 0,
          warning: 'Student has no assigned teaching groups or subject choices - schedule will be empty'
        }
      });
    }
    
    console.log('[getStudentScheduleSlots] 📊 Total slots in schedule:', allSlots.length);
    console.log('[getStudentScheduleSlots] 🔍 Filters applied:', { 
      school_id: user.school_id, 
      schedule_version: schedule_version_id 
    });
    
    // Step 3: Filter slots by exact group membership plus merged-DP subject fallback
    const studentSlots = allSlots.filter(slot => {
      if (slot.classgroup_id && student.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }
      
      if (slot?.notes?.includes('Test') && (slot?.notes?.includes('DP1') || slot?.notes?.includes('DP2'))) {
        return student?.year_group && slot.notes.includes(student.year_group);
      }

      if (slot.student_id) {
        return slot.student_id === student.id;
      }

      if (!slot.teaching_group_id) {
        return false;
      }

      if (assignedGroupIds.includes(slot.teaching_group_id)) {
        return true;
      }

      // Check if student is directly listed in the teaching group's student_ids
      // (handles repTg merging where slot TG ID != student's assigned_groups entry)
      const slotGroup = tgById[slot.teaching_group_id];
      if (slotGroup && Array.isArray(slotGroup.student_ids) && slotGroup.student_ids.includes(student.id)) {
        return true;
      }

      // Sibling-TG fallback: handles combine_dp1_dp2 merging where the solver uses the
      // DP1 repTg ID for all slots, but the student is only assigned to the DP2 group.
      // If the student has an assigned TG for the same subject+level → accept this slot.
      if (slotGroup) {
        const slotSubjectId = slotGroup.subject_id;
        const slotLevel = normalizeLevel(slotGroup.level);
        const hasSiblingAssigned = assignedGroupIds.some(assignedTgId => {
          const assignedTg = tgById[assignedTgId];
          return assignedTg &&
            assignedTg.subject_id === slotSubjectId &&
            normalizeLevel(assignedTg.level) === slotLevel;
        });
        if (hasSiblingAssigned) return true;
      }

      return false;
    }).filter((slot, index, self) => index === self.findIndex(s => s.id === slot.id));
    
    console.log('[getStudentScheduleSlots] ✅ Filtered slots for student:', studentSlots.length);
    
    // Step 4: Analyze slot distribution
    const slotsByTG = {};
    const uniqueTGIds = new Set();
    let slotsWithNullTG = 0;
    let slotsWithUnknownTG = 0;
    
    for (const slot of studentSlots) {
      if (slot.teaching_group_id) {
        uniqueTGIds.add(slot.teaching_group_id);
        slotsByTG[slot.teaching_group_id] = (slotsByTG[slot.teaching_group_id] || 0) + 1;
        
        if (!assignedGroupIds.includes(slot.teaching_group_id)) {
          slotsWithUnknownTG++;
        }
      } else {
        slotsWithNullTG++;
      }
    }
    
    console.log('[getStudentScheduleSlots] 🔍 Slot distribution:', {
      total_slots: studentSlots.length,
      unique_teaching_groups: uniqueTGIds.size,
      slots_with_null_tg: slotsWithNullTG,
      slots_with_unknown_tg: slotsWithUnknownTG
    });
    
    // Step 5: Analyze missing teaching groups (assigned but no slots)
    const missingTGIds = assignedGroupIds.filter(tgId => !uniqueTGIds.has(tgId));
    const missingTGDetails = missingTGIds.map(tgId => {
      const tg = tgById[tgId];
      const subject = tg?.subject_id ? subjectById[tg.subject_id] : null;
      return {
        tg_id: tgId,
        tg_name: tg?.name || 'Unknown',
        subject_name: subject?.name || 'Unknown',
        subject_code: subject?.code || 'Unknown',
        level: tg?.level || null,
        periods_per_week: tg?.periods_per_week || 0
      };
    });
    
    if (missingTGDetails.length > 0) {
      console.error('[getStudentScheduleSlots] ❌ Teaching groups with NO SLOTS:', missingTGDetails.length);
      console.error('[getStudentScheduleSlots] Missing TGs:', missingTGDetails);
    }
    
    // Step 8: Count slots by subject for diagnostics
    const slotsBySubject = {};
    for (const slot of studentSlots) {
      const tg = slot.teaching_group_id ? tgById[slot.teaching_group_id] : null;
      const subject = tg?.subject_id ? subjectById[tg.subject_id] : 
                      slot.subject_id ? subjectById[slot.subject_id] : null;
      const subjectCode = subject?.code || subject?.name || 'Unknown';
      
      slotsBySubject[subjectCode] = (slotsBySubject[subjectCode] || 0) + 1;
    }
    
    console.log('[getStudentScheduleSlots] 📚 Slots by subject:', slotsBySubject);
    
    return Response.json({
      ok: true,
      slots: studentSlots,
      diagnostics: {
        filters_applied: { 
          school_id: user.school_id, 
          schedule_version: schedule_version_id 
        },
        schedule_version_id_used: schedule_version_id,
        total_slots_in_schedule: allSlots.length,
        student_slots_returned: studentSlots.length,
        student_name: student.full_name,
        year_group: student.year_group,
        assigned_groups_count: assignedGroupIds.length,
        assigned_groups: assignedGroupIds,
        unique_teaching_groups: uniqueTGIds.size,
        slots_with_null_tg: slotsWithNullTG,
        slots_with_unknown_tg: slotsWithUnknownTG,
        missing_teaching_groups: missingTGDetails,
        slots_by_subject: slotsBySubject,
        slots_by_tg: Object.entries(slotsByTG).map(([tgId, count]) => {
          const tg = tgById[tgId];
          const subject = tg?.subject_id ? subjectById[tg.subject_id] : null;
          return {
            tg_id: tgId,
            tg_name: tg?.name || 'Unknown',
            subject_code: subject?.code || 'Unknown',
            slot_count: count
          };
        })
      }
    });
    
  } catch (error) {
    console.error('[getStudentScheduleSlots] ERROR:', error);
    return Response.json({ 
      error: error.message || 'Internal error',
      stack: error.stack
    }, { status: 500 });
  }
});