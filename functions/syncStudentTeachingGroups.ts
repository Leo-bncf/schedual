import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Syncs student membership in TeachingGroups
 * 
 * For each active student:
 * - Find all TeachingGroups matching their subject_choices
 * - Update Student.assigned_groups with matching TG IDs
 * - Update TeachingGroup.student_ids to include the student
 * 
 * This ensures Student timetable view shows all scheduled subjects
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const school_id = user.school_id;
    
    console.log('[syncStudentTeachingGroups] Fetching students and teaching groups...');
    
    // Fetch all active students and teaching groups
    const [students, teachingGroups, subjects] = await Promise.all([
      base44.entities.Student.filter({ school_id, is_active: true }),
      base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
      base44.entities.Subject.filter({ school_id, is_active: true })
    ]);
    
    console.log(`[syncStudentTeachingGroups] Found ${students.length} students, ${teachingGroups.length} teaching groups`);
    
    // Build subject lookup
    const subjectById = {};
    subjects.forEach(s => { subjectById[s.id] = s; });
    
    let studentsUpdated = 0;
    let teachingGroupsUpdated = 0;
    const errors = [];
    
    for (const student of students) {
      try {
        const studentSubjectChoices = student.subject_choices || [];
        const studentYearGroup = student.year_group || '';
        const studentIbProgramme = student.ib_programme || '';
        
        // Find matching teaching groups for this student
        const matchingTgIds = [];
        
        for (const tg of teachingGroups) {
          const tgSubject = subjectById[tg.subject_id];
          if (!tgSubject) continue;
          
          // Match by year group and subject
          const yearGroupMatch = tg.year_group === studentYearGroup;
          
          // Check if student has chosen this subject
          const subjectMatch = studentSubjectChoices.some(choice => {
            if (choice.subject_id === tg.subject_id) {
              // For DP subjects, also match level (HL/SL)
              if (studentIbProgramme === 'DP' && tg.level) {
                return choice.level === tg.level;
              }
              return true;
            }
            return false;
          });
          
          if (yearGroupMatch && subjectMatch) {
            matchingTgIds.push(tg.id);
            
            // Update TeachingGroup.student_ids if student not already included
            const tgStudentIds = tg.student_ids || [];
            if (!tgStudentIds.includes(student.id)) {
              await base44.entities.TeachingGroup.update(tg.id, {
                student_ids: [...tgStudentIds, student.id]
              });
              teachingGroupsUpdated++;
            }
          }
        }
        
        // Update Student.assigned_groups
        if (matchingTgIds.length > 0) {
          await base44.entities.Student.update(student.id, {
            assigned_groups: matchingTgIds
          });
          studentsUpdated++;
          console.log(`[syncStudentTeachingGroups] Student ${student.full_name}: assigned to ${matchingTgIds.length} groups`);
        }
        
      } catch (e) {
        console.error(`[syncStudentTeachingGroups] Error processing student ${student.id}:`, e);
        errors.push({ student_id: student.id, error: e.message });
      }
    }
    
    console.log('[syncStudentTeachingGroups] Sync complete:', {
      studentsUpdated,
      teachingGroupsUpdated,
      errors: errors.length
    });
    
    return Response.json({
      success: true,
      studentsUpdated,
      teachingGroupsUpdated,
      totalStudents: students.length,
      totalTeachingGroups: teachingGroups.length,
      errors
    });
    
  } catch (error) {
    console.error('[syncStudentTeachingGroups] Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});