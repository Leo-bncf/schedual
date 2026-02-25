import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SERVER-SIDE SOURCE OF TRUTH: Get schedule slots for a student
 * 
 * Performs server-side join: Student → assigned_groups → ScheduleSlot.teaching_group_id
 * Avoids fragile client-side joins and provides accurate slot loading
 */
Deno.serve(async (req) => {
  const FUNCTION_VERSION = '2026-02-16T12:00:00Z';
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
    
    // Step 1: Get student and their assigned teaching groups
    const [student] = await base44.entities.Student.filter({ id: student_id });
    
    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    
    const assignedGroupIds = Array.isArray(student.assigned_groups) ? student.assigned_groups : [];
    console.log('[getStudentScheduleSlots] 🎓 Student:', { 
      name: student.full_name, 
      year_group: student.year_group,
      assigned_groups_count: assignedGroupIds.length,
      assigned_groups: assignedGroupIds
    });
    
    if (assignedGroupIds.length === 0) {
      console.warn('[getStudentScheduleSlots] ⚠️ Student has no assigned_groups');
      return Response.json({
        ok: true,
        slots: [],
        diagnostics: {
          student_name: student.full_name,
          assigned_groups_count: 0,
          warning: 'Student has no assigned teaching groups - schedule will be empty'
        }
      });
    }
    
    // Step 2: Get all slots for this schedule version
    const allSlots = await base44.entities.ScheduleSlot.filter({ 
      school_id: user.school_id,
      schedule_version: schedule_version_id 
    });
    
    console.log('[getStudentScheduleSlots] 📊 Total slots in schedule:', allSlots.length);
    console.log('[getStudentScheduleSlots] 🔍 Filters applied:', { 
      school_id: user.school_id, 
      schedule_version: schedule_version_id 
    });
    
    // Step 3: Filter slots by student's assigned teaching groups
    const studentSlots = allSlots.filter(slot => {
      // PYP/MYP: match by classgroup_id
      if (slot.classgroup_id && student.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }
      
      // DP test slots: include DP1/DP2 test slots by year_group marker in notes
      if (slot?.notes?.includes('Test') && (slot?.notes?.includes('DP1') || slot?.notes?.includes('DP2'))) {
        return student?.year_group && slot.notes.includes(student.year_group);
      }
      
      // DP: Use student.assigned_groups
      if (slot.teaching_group_id) {
        return assignedGroupIds.includes(slot.teaching_group_id);
      }

      // Student-specific slots (e.g., individual lunch breaks)
      if (slot.student_id) {
        return slot.student_id === student.id;
      }
      
      return false;
    });
    
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
    
    // Step 5: Get teaching groups for diagnostics
    const teachingGroups = await base44.entities.TeachingGroup.filter({ school_id: user.school_id });
    const tgById = {};
    teachingGroups.forEach(tg => { tgById[tg.id] = tg; });
    
    // Step 6: Get subjects for diagnostics
    const subjects = await base44.entities.Subject.filter({ school_id: user.school_id });
    const subjectById = {};
    subjects.forEach(s => { subjectById[s.id] = s; });
    
    // Step 7: Analyze missing teaching groups (assigned but no slots)
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