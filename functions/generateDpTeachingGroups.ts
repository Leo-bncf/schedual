import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auto-generates DP teaching groups based on student subject choices
 * Groups students by subject + level (HL/SL)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const school_id = user.school_id;

    // Fetch DP students and DP subjects with server-side filtering to reduce payload
    const [dpStudentsRaw, dpSubjectsRaw] = await Promise.all([
      base44.entities.Student.filter({ school_id, ib_programme: 'DP' }),
      base44.entities.Subject.filter({ school_id, ib_level: 'DP' })
    ]);

    // Final client-side filter keeps semantics: exclude only when is_active === false
    const students = dpStudentsRaw.filter(s => s.is_active !== false);
    const dpSubjects = dpSubjectsRaw.filter(s => s.is_active !== false);

    console.log(`Found ${students.length} DP students and ${dpSubjects.length} DP subjects`);

    if (students.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No DP students found',
        groups_created: 0 
      });
    }

    // Build groups: subject + level combinations
    const groupMap = new Map(); // key: subjectId_level_yearGroup (or subjectId_level_combined)

    for (const student of students) {
      const subjectChoices = student.subject_choices || [];
      
      for (const choice of subjectChoices) {
        // Check if this subject should combine DP1/DP2 (from subject settings)
        const subject = dpSubjects.find(s => s.id === choice.subject_id);
        const shouldCombine = subject?.combine_dp1_dp2 === true;
        const yearGroup = shouldCombine ? 'DP1+DP2' : student.year_group;
        const key = `${choice.subject_id}_${choice.level}_${yearGroup}`;
        
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            subject_id: choice.subject_id,
            level: choice.level,
            year_group: yearGroup,
            student_ids: []
          });
        }
        
        groupMap.get(key).student_ids.push(student.id);
      }
    }

    // Delete existing auto-generated DP groups
    const existingGroups = await base44.entities.TeachingGroup.filter({ 
      school_id,
      year_group: { $in: ['DP1', 'DP2'] }
    });
    
    for (const group of existingGroups) {
      await base44.asServiceRole.entities.TeachingGroup.delete(group.id);
    }

    // Create new groups
    const newGroups = [];
    for (const [key, groupData] of groupMap.entries()) {
      const subject = dpSubjects.find(s => s.id === groupData.subject_id);
      if (!subject) continue;

      const hoursPerWeek = groupData.level === 'HL' 
        ? (subject.hl_hours_per_week || 6)
        : (subject.sl_hours_per_week || 4);

      newGroups.push({
        school_id,
        name: `${subject.name} ${groupData.level} - ${groupData.year_group}`,
        subject_id: groupData.subject_id,
        level: groupData.level,
        year_group: groupData.year_group,
        student_ids: groupData.student_ids,
        hours_per_week: hoursPerWeek,
        is_active: true
      });
    }

    if (newGroups.length > 0) {
      await base44.asServiceRole.entities.TeachingGroup.bulkCreate(newGroups);
    }

    return Response.json({ 
      success: true,
      groups_created: newGroups.length,
      message: `Created ${newGroups.length} DP teaching groups`
    });

  } catch (error) {
    console.error('Generate DP teaching groups error:', error);
    return Response.json({ 
      error: error.message || 'Failed to generate DP teaching groups' 
    }, { status: 500 });
  }
});