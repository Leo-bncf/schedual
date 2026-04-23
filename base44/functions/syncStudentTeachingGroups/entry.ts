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
  const startTime = Date.now();
  let school_id = null;
  let stage = 'init';
  
  try {
    stage = 'auth';
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ 
        success: false,
        error: 'Unauthorized',
        stage: 'auth',
        details: 'User not authenticated or missing school_id'
      }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({
        success: false,
        error: 'Forbidden: Admin access required',
        stage: 'auth'
      }, { status: 403 });
    }

    school_id = user.school_id;
    
    stage = 'fetch_data';
    console.log(`[syncStudentTeachingGroups] Starting sync for school_id=${school_id}`);
    
    // Fetch all active students and teaching groups
    let students, teachingGroups, subjects;
    try {
      [students, teachingGroups, subjects] = await Promise.all([
        base44.entities.Student.filter({ school_id, is_active: true }),
        base44.entities.TeachingGroup.filter({ school_id, is_active: true }),
        base44.entities.Subject.filter({ school_id, is_active: true })
      ]);
    } catch (fetchError) {
      console.error('[syncStudentTeachingGroups] Data fetch error:', fetchError);
      return Response.json({
        success: false,
        error: 'Failed to fetch data',
        stage: 'fetch_data',
        details: String(fetchError?.message || fetchError),
        school_id
      }, { status: 200 });
    }
    
    console.log(`[syncStudentTeachingGroups] Fetched data: ${students.length} students, ${teachingGroups.length} teaching groups, ${subjects.length} subjects`);
    
    // Build subject lookup
    const subjectById = {};
    subjects.forEach(s => { subjectById[s.id] = s; });
    
    stage = 'process_students';
    let studentsUpdated = 0;
    let teachingGroupsUpdated = 0;
    const errors = [];
    
    // INTEGRITY AUDIT TRACKING
    const integrityReport = {
      duplicateAssignments: [], // Students assigned to multiple TGs for same subject/level
      missingAssignments: [],    // Students with subject choices but no matching TG
      orphanedTGs: [],           // TGs with 0 students
      conflictDetails: []
    };
    
    // Helper: normalize year group for matching (DP1+DP2, DP1,DP2, etc.)
    const normalizeYearGroup = (raw) => {
      if (!raw) return '';
      return String(raw).toUpperCase().trim().replace(/\s+/g, '');
    };
    
    // Helper: check if composite year group matches student year group
    const yearGroupMatches = (tgYearGroup, studentYearGroup) => {
      const tgNorm = normalizeYearGroup(tgYearGroup);
      const studentNorm = normalizeYearGroup(studentYearGroup);
      
      // Exact match
      if (tgNorm === studentNorm) return true;
      
      // Parse composite groups: DP1+DP2, DP1,DP2 → [DP1, DP2]
      const tgTokens = tgNorm.split(/[+,]/).map(t => t.trim()).filter(Boolean);
      
      // If TG contains student's year group
      if (tgTokens.includes(studentNorm)) return true;
      
      return false;
    };
    
    // Helper: normalize level (HL/SL) to avoid "HL " vs "HL" issues
    const normalizeLevel = (raw) => {
      if (!raw) return '';
      return String(raw).toUpperCase().trim();
    };
    
    // Helper: create unique key for subject choice (for deduplication)
    const choiceKey = (subjectId, level, yearGroup) => {
      return `${subjectId}|${normalizeLevel(level)}|${normalizeYearGroup(yearGroup)}`;
    };
    
    for (const student of students) {
      try {
        const studentSubjectChoices = student.subject_choices || [];
        const studentYearGroup = student.year_group || '';
        const studentIbProgramme = student.ib_programme || '';
        
        // CRITICAL: Enforce uniqueness - one TG per (subject_id, level, year_group)
        const assignmentsByChoice = {}; // key = choiceKey, value = [tg_ids]
        
        for (const tg of teachingGroups) {
          const tgSubject = subjectById[tg.subject_id];
          if (!tgSubject) continue;
          
          // Match by year group (with composite support: DP1+DP2 matches DP1 and DP2)
          const yearGroupMatch = yearGroupMatches(tg.year_group, studentYearGroup);
          
          // Check if student has chosen this subject
          const matchingChoice = studentSubjectChoices.find(choice => {
            if (choice.subject_id === tg.subject_id) {
              // For DP subjects, also match level (HL/SL) with normalization
              if (studentIbProgramme === 'DP' && tg.level) {
                return normalizeLevel(choice.level) === normalizeLevel(tg.level);
              }
              return true;
            }
            return false;
          });
          
          if (yearGroupMatch && matchingChoice) {
            const key = choiceKey(tg.subject_id, tg.level || matchingChoice.level, studentYearGroup);
            if (!assignmentsByChoice[key]) assignmentsByChoice[key] = [];
            assignmentsByChoice[key].push({
              tg_id: tg.id,
              tg_name: tg.name,
              subject_name: tgSubject.name
            });
          }
        }
        
        // INTEGRITY CHECK: Detect duplicate assignments
        const finalTgIds = [];
        for (const [key, matches] of Object.entries(assignmentsByChoice)) {
          if (matches.length > 1) {
            // DUPLICATE: Student assigned to multiple TGs for same subject/level
            integrityReport.duplicateAssignments.push({
              student_id: student.id,
              student_name: student.full_name,
              choice_key: key,
              teaching_groups: matches,
              resolution: 'assigned_to_first_match'
            });
            console.warn(`[DUPLICATE] Student ${student.full_name} has ${matches.length} TGs for ${key}`);
          }
          
          // ENFORCE UNIQUENESS: Take first match only
          const selectedTg = matches[0];
          finalTgIds.push(selectedTg.tg_id);
          
          // Update TeachingGroup.student_ids
          const tg = teachingGroups.find(t => t.id === selectedTg.tg_id);
          if (tg) {
            const tgStudentIds = tg.student_ids || [];
            if (!tgStudentIds.includes(student.id)) {
              await base44.entities.TeachingGroup.update(tg.id, {
                student_ids: [...tgStudentIds, student.id]
              });
              teachingGroupsUpdated++;
            }
          }
        }
        
        // INTEGRITY CHECK: Missing assignments
        const expectedChoices = studentSubjectChoices.filter(c => c.subject_id);
        const assignedChoices = Object.keys(assignmentsByChoice);
        if (expectedChoices.length > assignedChoices.length) {
          integrityReport.missingAssignments.push({
            student_id: student.id,
            student_name: student.full_name,
            expected_count: expectedChoices.length,
            assigned_count: assignedChoices.length,
            missing_subjects: expectedChoices.filter(choice => {
              const key = choiceKey(choice.subject_id, choice.level, studentYearGroup);
              return !assignmentsByChoice[key];
            }).map(c => ({
              subject_id: c.subject_id,
              subject_name: subjectById[c.subject_id]?.name || 'Unknown',
              level: c.level
            }))
          });
        }
        
        // Update Student.assigned_groups with deduplicated list
        if (finalTgIds.length > 0) {
          await base44.entities.Student.update(student.id, {
            assigned_groups: finalTgIds
          });
          studentsUpdated++;
          console.log(`[syncStudentTeachingGroups] Student ${student.full_name}: assigned to ${finalTgIds.length} unique groups`);
        }
        
      } catch (e) {
        console.error(`[syncStudentTeachingGroups] Error processing student ${student.id}:`, e);
        errors.push({ student_id: student.id, error: e.message });
      }
    }
    
    // INTEGRITY CHECK: Find orphaned TGs (no students)
    for (const tg of teachingGroups) {
      const studentCount = (tg.student_ids || []).length;
      if (studentCount === 0) {
        const subj = subjectById[tg.subject_id];
        integrityReport.orphanedTGs.push({
          tg_id: tg.id,
          tg_name: tg.name,
          subject_name: subj?.name || 'Unknown',
          year_group: tg.year_group,
          level: tg.level
        });
      }
    }
    
    // Generate summary statistics
    const summary = {
      totalDuplicates: integrityReport.duplicateAssignments.length,
      totalMissingAssignments: integrityReport.missingAssignments.length,
      totalOrphanedTGs: integrityReport.orphanedTGs.length,
      studentsAffectedByDuplicates: new Set(integrityReport.duplicateAssignments.map(d => d.student_id)).size,
      studentsWithMissingAssignments: integrityReport.missingAssignments.length
    };
    
    const durationMs = Date.now() - startTime;
    
    console.log('[syncStudentTeachingGroups] ✅ Sync complete:', {
      school_id,
      duration_ms: durationMs,
      students_count: students.length,
      students_updated: studentsUpdated,
      teaching_groups_updated: teachingGroupsUpdated,
      errors_count: errors.length,
      integrity_issues: summary
    });
    
    return Response.json({
      success: true,
      stage: 'complete',
      school_id,
      duration_ms: durationMs,
      studentsUpdated,
      teachingGroupsUpdated,
      totalStudents: students.length,
      totalTeachingGroups: teachingGroups.length,
      assigned_groups_count: students.filter(s => s.assigned_groups?.length > 0).length,
      errors,
      integrityReport,
      summary
    });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    
    console.error('[syncStudentTeachingGroups] ❌ ERROR at stage:', stage);
    console.error('[syncStudentTeachingGroups] Error message:', error?.message);
    console.error('[syncStudentTeachingGroups] Error stack:', error?.stack);
    console.error('[syncStudentTeachingGroups] Context:', {
      school_id,
      stage,
      duration_ms: durationMs
    });
    
    return Response.json({
      success: false,
      error: String(error?.message || error),
      stage,
      details: {
        errorStack: String(error?.stack || ''),
        school_id,
        duration_ms: durationMs
      }
    }, { status: 200 }); // Return 200 with success:false for UI parsing
  }
});