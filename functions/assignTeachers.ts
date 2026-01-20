import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getUserSchoolId } from './securityHelper.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const schoolId = await getUserSchoolId(base44);

    // Fetch all teaching groups, teachers, and subjects
    const teachingGroups = await base44.asServiceRole.entities.TeachingGroup.filter({
      school_id: schoolId,
      is_active: true
    });

    const teachers = await base44.asServiceRole.entities.Teacher.filter({
      school_id: schoolId,
      is_active: true
    });

    const subjects = await base44.asServiceRole.entities.Subject.filter({
      school_id: schoolId
    });

    // Helper to get IB level from year_group
    const getIBLevel = (year_group) => {
      if (!year_group) return null;
      if (year_group.startsWith('DP')) return 'DP';
      if (year_group.startsWith('MYP')) return 'MYP';
      if (year_group.startsWith('PYP')) return 'PYP';
      return null;
    };

    // Track teacher workload (number of groups assigned)
    const teacherWorkload = {};
    teachers.forEach(t => { teacherWorkload[t.id] = 0; });

    const assignments = [];
    const unassignedGroups = [];

    for (const group of teachingGroups) {
      // Skip if already has a teacher
      if (group.teacher_id) {
        const existingTeacher = teachers.find(t => t.id === group.teacher_id);
        if (existingTeacher) {
          teacherWorkload[group.teacher_id] = (teacherWorkload[group.teacher_id] || 0) + 1;
          continue;
        }
      }

      const subject = subjects.find(s => s.id === group.subject_id);
      const ibLevel = getIBLevel(group.year_group);
      const hoursNeeded = group.hours_per_week || 4;

      // Find qualified teachers
      const qualifiedTeachers = teachers.filter(t => {
        const subjectsArray = Array.isArray(t.subjects) ? t.subjects : [];
        const qualsArray = Array.isArray(t.qualifications) ? t.qualifications : [];

        // Qualified if the subject appears either in subjects or in qualifications
        const hasSubject = subjectsArray.includes(group.subject_id) ||
          qualsArray.some(q => q.subject_id === group.subject_id);
        if (!hasSubject) return false;

        // If there is a qualification record for this subject and IB level is known, enforce level match
        const qualification = qualsArray.find(q => q.subject_id === group.subject_id);
        if (qualification && ibLevel && Array.isArray(qualification.ib_levels) && !qualification.ib_levels.includes(ibLevel)) {
          return false;
        }

        // Check max hours capacity
        const currentLoad = teacherWorkload[t.id] || 0;
        const maxGroups = Math.floor((t.max_hours_per_week || 25) / hoursNeeded);
        return currentLoad < maxGroups;
      });

      if (qualifiedTeachers.length === 0) {
        unassignedGroups.push({
          group_id: group.id,
          group_name: group.name,
          subject_name: subject?.name,
          reason: 'No qualified teachers available'
        });
        continue;
      }

      // Sort by workload (assign to teacher with least groups)
      qualifiedTeachers.sort((a, b) => {
        return (teacherWorkload[a.id] || 0) - (teacherWorkload[b.id] || 0);
      });

      const assignedTeacher = qualifiedTeachers[0];
      teacherWorkload[assignedTeacher.id] = (teacherWorkload[assignedTeacher.id] || 0) + 1;

      // Update teaching group with teacher assignment
      await base44.asServiceRole.entities.TeachingGroup.update(group.id, {
        teacher_id: assignedTeacher.id
      });

      assignments.push({
        group_id: group.id,
        group_name: group.name,
        teacher_id: assignedTeacher.id,
        teacher_name: assignedTeacher.full_name,
        subject_name: subject?.name
      });
    }

    return Response.json({
      success: true,
      assigned: assignments.length,
      unassigned: unassignedGroups.length,
      assignments,
      unassignedGroups,
      teacherWorkload
    });

  } catch (error) {
    console.error('Teacher assignment error:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      success: false,
      error: error.message,
      details: error.toString()
    }, { status: 500 });
  }
});