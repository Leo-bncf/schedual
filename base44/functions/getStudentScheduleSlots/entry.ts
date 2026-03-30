import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function normalizeLevel(raw) {
  if (!raw) return '';
  return String(raw).toUpperCase().trim();
}

function makeSubjectLevelKey(subjectId, level) {
  if (!subjectId || !level) return '';
  return `${subjectId}__${normalizeLevel(level)}`;
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function isExamTimeSubject(subject, slot) {
  const subjectCode = normalizeCode(subject?.code);
  const subjectName = normalizeCode(subject?.name);
  const notes = normalizeCode(slot?.notes);
  return subjectCode === 'TEST' || subjectName === 'EXAM TIME' || notes.includes('TEST') || notes.includes('ASSESSMENT') || notes.includes('EXAM');
}

function extractYearGroupScope(slot, slotGroup) {
  const explicitScope = String(slot?.year_group_scope || '').trim();
  if (explicitScope) return explicitScope;

  const groupYear = String(slotGroup?.year_group || '').trim();
  if (groupYear) return groupYear;

  const raw = String(slot?.solver_teaching_group_id || slot?.teaching_group_id || '').toUpperCase();
  if (raw.includes('DP1_DP2')) return 'DP1_DP2';
  if (raw.includes('DP2')) return 'DP2';
  if (raw.includes('DP1')) return 'DP1';
  return '';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { student_id, schedule_version_id } = body;

    if (!student_id || !schedule_version_id) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const [student] = await base44.entities.Student.filter({ id: student_id });
    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const [allSlots, teachingGroups, subjects] = await Promise.all([
      base44.entities.ScheduleSlot.filter({
        school_id: user.school_id,
        schedule_version: schedule_version_id,
      }, '-created_date', 1000),
      base44.entities.TeachingGroup.filter({ school_id: user.school_id }, '-created_date', 500),
      base44.entities.Subject.filter({ school_id: user.school_id }, '-created_date', 500),
    ]);

    const tgById = {};
    teachingGroups.forEach((group) => {
      tgById[group.id] = group;
    });

    const subjectById = {};
    subjects.forEach((subject) => {
      subjectById[subject.id] = subject;
    });

    const assignedGroupIds = Array.isArray(student.assigned_groups) ? student.assigned_groups : [];
    const subjectChoices = Array.isArray(student.subject_choices) ? student.subject_choices : [];
    const assignedGroups = assignedGroupIds.map((id) => tgById[id]).filter(Boolean);
    const assignedGroupIdSet = new Set(assignedGroupIds);
    const studentYearGroup = String(student.year_group || '').trim();

    const studentLevelsBySubjectId = {};
    assignedGroups.forEach((group) => {
      if (!group?.subject_id || !group?.level) return;
      if (!studentLevelsBySubjectId[group.subject_id]) studentLevelsBySubjectId[group.subject_id] = new Set();
      studentLevelsBySubjectId[group.subject_id].add(normalizeLevel(group.level));
    });
    subjectChoices.forEach((choice) => {
      const level = normalizeLevel(choice?.level);
      if (!choice?.subject_id || !level) return;
      if (!studentLevelsBySubjectId[choice.subject_id]) studentLevelsBySubjectId[choice.subject_id] = new Set();
      studentLevelsBySubjectId[choice.subject_id].add(level);
    });

    const allowedSubjectLevelKeys = new Set();
    assignedGroups.forEach((group) => {
      const key = makeSubjectLevelKey(group.subject_id, group.level);
      if (key) allowedSubjectLevelKeys.add(key);
    });
    subjectChoices.forEach((choice) => {
      const key = makeSubjectLevelKey(choice?.subject_id, choice?.level);
      if (key) allowedSubjectLevelKeys.add(key);
    });

    const getStudentLevelForSubject = (subjectId) => {
      const levels = subjectId ? studentLevelsBySubjectId[subjectId] : null;
      return levels?.size === 1 ? Array.from(levels)[0] : '';
    };

    const slots = allSlots.filter((slot) => {
      if (slot.classgroup_id && student.classgroup_id) {
        return slot.classgroup_id === student.classgroup_id;
      }

      if (slot.student_id) {
        return slot.student_id === student.id;
      }

      const slotGroup = slot.teaching_group_id ? tgById[slot.teaching_group_id] : null;
      const subjectId = slot.subject_id || slotGroup?.subject_id;
      const subject = subjectById[subjectId];
      const slotNotes = String(slot?.notes || '');
      const normalizedNotes = normalizeCode(slotNotes);
      const isExamSlot = isExamTimeSubject(subject, slot);
      const isNamedYearExamSlot = isExamSlot && (normalizedNotes.includes('DP1') || normalizedNotes.includes('DP2'));

      if (isNamedYearExamSlot) {
        return studentYearGroup && normalizedNotes.includes(normalizeCode(studentYearGroup));
      }

      if (isExamSlot) {
        const scope = extractYearGroupScope(slot, slotGroup);
        return !scope || scope === 'DP1_DP2' || scope === studentYearGroup;
      }

      if (slotGroup?.id && assignedGroupIdSet.has(slotGroup.id)) {
        return true;
      }

      if (slotGroup && Array.isArray(slotGroup.student_ids) && slotGroup.student_ids.includes(student.id)) {
        return true;
      }

      const subjectCode = normalizeCode(subject?.code);
      const subjectName = normalizeCode(subject?.name);
      const level = normalizeLevel(slot.display_level_override || slotGroup?.level || getStudentLevelForSubject(subjectId));
      const scope = extractYearGroupScope(slot, slotGroup);
      const isExamTimeSlot = isExamTimeSubject(subject, slot);
      const isCoreDpSubject = student.ib_programme === 'DP' && (
        subject?.is_core === true || subjectCode === 'TOK' || subjectName === 'THEORY OF KNOWLEDGE' || subjectName === 'TOK'
      );
      const isSharedCoreSlot = student.ib_programme === 'DP' && (
        normalizeLevel(slot.display_level_override || slotGroup?.level) === 'STANDARD' || isExamTimeSlot || isCoreDpSubject
      );

      if (isSharedCoreSlot) {
        const studentListedOnGroup = Array.isArray(slotGroup?.student_ids) && slotGroup.student_ids.includes(student.id);
        const hasMatchingAssignedGroup = assignedGroups.some((group) =>
          group?.subject_id === subjectId &&
          (group.id === slotGroup?.id || extractYearGroupScope(slot, group) === scope || extractYearGroupScope(slot, group) === studentYearGroup)
        );
        return (studentListedOnGroup || hasMatchingAssignedGroup) && (scope === 'DP1_DP2' || scope === studentYearGroup);
      }

      const key = makeSubjectLevelKey(subjectId, level);
      if (!key || !allowedSubjectLevelKeys.has(key)) {
        return false;
      }

      if (student.ib_programme !== 'DP') {
        return true;
      }

      return scope === 'DP1_DP2' || scope === studentYearGroup;
    }).filter((slot, index, self) => index === self.findIndex((item) => item.id === slot.id));

    return Response.json({
      ok: true,
      slots,
      diagnostics: {
        student_name: student.full_name,
        student_slots_returned: slots.length,
        assigned_groups_count: assignedGroupIds.length,
      },
    });
  } catch (error) {
    console.error('[getStudentScheduleSlots] ERROR:', error);
    return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
});