import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/*
MIGRATION: Backfill hoursPerWeekHL/SL for existing DP subjects
- Prevents breaking schedules after HL/SL validation deployment
- Only updates subjects that have active HL/SL teaching groups
- Preserves existing hours if already configured
- Logs detailed report per school_id
*/

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only migration
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to dry run for safety
    const targetSchoolId = body.school_id || null; // Optional: migrate specific school only
    
    console.log(`[migrateDPSubjectHours] Starting migration (dryRun=${dryRun}, targetSchool=${targetSchoolId || 'all'})`);
    
    // Fetch all schools (or specific school)
    const schoolFilter = targetSchoolId ? { id: targetSchoolId } : {};
    const allSchools = await base44.asServiceRole.entities.School.filter(schoolFilter);
    
    const migrationReport = {
      timestamp: new Date().toISOString(),
      dryRun,
      totalSchools: allSchools.length,
      schoolsProcessed: 0,
      schoolsWithIssues: 0,
      totalSubjectsAnalyzed: 0,
      totalSubjectsUpdated: 0,
      schoolReports: []
    };
    
    // Process each school
    for (const school of allSchools) {
      const schoolId = school.id;
      console.log(`[migrateDPSubjectHours] Processing school: ${school.name} (${schoolId})`);
      
      const schoolReport = {
        school_id: schoolId,
        school_name: school.name,
        subjectsAnalyzed: 0,
        subjectsNeedingUpdate: 0,
        subjectsUpdated: 0,
        subjectsSkipped: 0,
        details: []
      };
      
      try {
        // Fetch school's DP subjects and teaching groups
        const [dpSubjects, teachingGroups] = await Promise.all([
          base44.asServiceRole.entities.Subject.filter({ school_id: schoolId, ib_level: 'DP' }),
          base44.asServiceRole.entities.TeachingGroup.filter({ school_id: schoolId })
        ]);
        
        schoolReport.subjectsAnalyzed = dpSubjects.length;
        migrationReport.totalSubjectsAnalyzed += dpSubjects.length;
        
        // Process each DP subject
        for (const subject of dpSubjects) {
          const subjectDetail = {
            subject_id: subject.id,
            code: subject.code,
            name: subject.name,
            action: 'skipped',
            reason: null,
            before: {
              hoursPerWeekHL: subject.hoursPerWeekHL || null,
              hoursPerWeekSL: subject.hoursPerWeekSL || null
            },
            after: {
              hoursPerWeekHL: subject.hoursPerWeekHL || null,
              hoursPerWeekSL: subject.hoursPerWeekSL || null
            }
          };
          
          // Check if subject has HL/SL teaching groups
          const subjectTGs = teachingGroups.filter(tg => tg.subject_id === subject.id && tg.is_active !== false);
          const hasHLGroup = subjectTGs.some(tg => String(tg.level || '').toUpperCase() === 'HL');
          const hasSLGroup = subjectTGs.some(tg => String(tg.level || '').toUpperCase() === 'SL');
          
          // Skip if no HL/SL groups (e.g., core subjects with "Standard" level)
          if (!hasHLGroup && !hasSLGroup) {
            subjectDetail.reason = 'no_hl_sl_groups';
            schoolReport.subjectsSkipped++;
            schoolReport.details.push(subjectDetail);
            continue;
          }
          
          // Check if hours already configured
          const hasHL = typeof subject.hoursPerWeekHL === 'number' && subject.hoursPerWeekHL > 0;
          const hasSL = typeof subject.hoursPerWeekSL === 'number' && subject.hoursPerWeekSL > 0;
          
          // Determine what needs updating
          const needsHL = hasHLGroup && !hasHL;
          const needsSL = hasSLGroup && !hasSL;
          
          if (!needsHL && !needsSL) {
            subjectDetail.reason = 'already_configured';
            schoolReport.subjectsSkipped++;
            schoolReport.details.push(subjectDetail);
            continue;
          }
          
          // Calculate backfill values
          const updates = {};
          
          if (needsHL) {
            // Priority 1: Convert from deprecated hl_minutes_per_week_default
            if (typeof subject.hl_minutes_per_week_default === 'number' && subject.hl_minutes_per_week_default > 0) {
              updates.hoursPerWeekHL = Math.round(subject.hl_minutes_per_week_default / 60);
              subjectDetail.after.hoursPerWeekHL = updates.hoursPerWeekHL;
            } else {
              // Priority 2: Use IB standard (6h/week for HL)
              updates.hoursPerWeekHL = 6;
              subjectDetail.after.hoursPerWeekHL = 6;
            }
          }
          
          if (needsSL) {
            // Priority 1: Convert from deprecated sl_minutes_per_week_default
            if (typeof subject.sl_minutes_per_week_default === 'number' && subject.sl_minutes_per_week_default > 0) {
              updates.hoursPerWeekSL = Math.round(subject.sl_minutes_per_week_default / 60);
              subjectDetail.after.hoursPerWeekSL = updates.hoursPerWeekSL;
            } else {
              // Priority 2: Use IB standard (4h/week for SL)
              updates.hoursPerWeekSL = 4;
              subjectDetail.after.hoursPerWeekSL = 4;
            }
          }
          
          // Perform update (if not dry run)
          if (!dryRun && Object.keys(updates).length > 0) {
            await base44.asServiceRole.entities.Subject.update(subject.id, updates);
            subjectDetail.action = 'updated';
            subjectDetail.reason = 'backfilled_from_' + (
              (needsHL && subject.hl_minutes_per_week_default) || (needsSL && subject.sl_minutes_per_week_default)
                ? 'deprecated_fields'
                : 'ib_standards'
            );
            schoolReport.subjectsUpdated++;
            migrationReport.totalSubjectsUpdated++;
          } else {
            subjectDetail.action = dryRun ? 'would_update' : 'skipped';
            subjectDetail.reason = dryRun ? 'dry_run' : 'no_updates_needed';
          }
          
          if (needsHL || needsSL) {
            schoolReport.subjectsNeedingUpdate++;
          }
          
          schoolReport.details.push(subjectDetail);
        }
        
        if (schoolReport.subjectsNeedingUpdate > 0) {
          migrationReport.schoolsWithIssues++;
        }
        
      } catch (schoolError) {
        console.error(`[migrateDPSubjectHours] Error processing school ${schoolId}:`, schoolError);
        schoolReport.error = schoolError.message;
      }
      
      migrationReport.schoolsProcessed++;
      migrationReport.schoolReports.push(schoolReport);
      
      console.log(`[migrateDPSubjectHours] School ${school.name}: ${schoolReport.subjectsNeedingUpdate} subjects need update, ${schoolReport.subjectsUpdated} updated`);
    }
    
    // Summary
    console.log(`[migrateDPSubjectHours] Migration complete:`);
    console.log(`  - Schools processed: ${migrationReport.schoolsProcessed}`);
    console.log(`  - Schools with issues: ${migrationReport.schoolsWithIssues}`);
    console.log(`  - Subjects analyzed: ${migrationReport.totalSubjectsAnalyzed}`);
    console.log(`  - Subjects updated: ${migrationReport.totalSubjectsUpdated}`);
    
    return Response.json({
      success: true,
      migration: migrationReport,
      message: dryRun 
        ? `Dry run complete. ${migrationReport.totalSubjectsUpdated} subjects would be updated across ${migrationReport.schoolsWithIssues} schools.`
        : `Migration complete. ${migrationReport.totalSubjectsUpdated} subjects updated across ${migrationReport.schoolsWithIssues} schools.`
    }, { status: 200 });
    
  } catch (error) {
    console.error('[migrateDPSubjectHours] Fatal error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});