import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Auto-generates DP teaching groups based on student subject choices
 * Adds detailed logging and light retries with exponential backoff
 */
Deno.serve(async (req) => {
  const startedAt = Date.now();
  const logs = {
    timestamp_utc: new Date().toISOString(),
    school_id: null,
    sdk_calls: [], // { step, attempt, query, started_at, ended_at, duration_ms, success, error }
    notes: []
  };

  // Small helper to sleep
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Wrap an SDK call with timing + retries
  async function withRetry(label, queryDesc, fn, maxAttempts = 3, baseDelay = 500) {
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const callStart = Date.now();
      const stepLog = {
        step: label,
        attempt,
        query: queryDesc,
        started_at: new Date(callStart).toISOString(),
        ended_at: null,
        duration_ms: null,
        success: false,
        error: null,
      };
      try {
        const res = await fn();
        stepLog.ended_at = new Date().toISOString();
        stepLog.duration_ms = Date.now() - callStart;
        stepLog.success = true;
        logs.sdk_calls.push(stepLog);
        console.log(`[generateDpTeachingGroups] ${label} succeeded in ${stepLog.duration_ms}ms (attempt ${attempt})`);
        return res;
      } catch (err) {
        stepLog.ended_at = new Date().toISOString();
        stepLog.duration_ms = Date.now() - callStart;
        stepLog.success = false;
        stepLog.error = String(err?.stack || err?.message || err);
        logs.sdk_calls.push(stepLog);
        lastErr = err;
        console.error(`[generateDpTeachingGroups] ${label} failed (attempt ${attempt}) in ${stepLog.duration_ms}ms`, err?.stack || err?.message || err);
        if (attempt < maxAttempts) {
          const backoff = baseDelay * Math.pow(3, attempt - 1); // 500ms, 1500ms, ...
          await sleep(backoff);
        }
      }
    }
    throw lastErr;
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const school_id = user.school_id;
    logs.school_id = school_id;

    // Fetch school (for period duration calculation)
    const school = await withRetry(
      'fetch_school',
      { entity: 'School', filter: { id: school_id } },
      async () => (await base44.entities.School.filter({ id: school_id }))[0]
    );
    
    const periodDurationMinutes = school?.period_duration_minutes || 60;
    console.log(`[generateDpTeachingGroups] School period_duration_minutes: ${periodDurationMinutes}`);

    // Fetch DP students with retries
    const studentsRaw = await withRetry(
      'fetch_dp_students',
      { entity: 'Student', filter: { school_id, ib_programme: 'DP' } },
      async () => await base44.entities.Student.filter({ school_id, ib_programme: 'DP' })
    );

    const students = studentsRaw.filter((s) => s.is_active !== false);

    // CRITICAL FIX: Don't rely on ib_level filter - many subjects may not have it set
    // Instead, collect all subject_ids from DP students' subject_choices
    const dpSubjectIds = new Set();
    for (const student of students) {
      const choices = student.subject_choices || [];
      for (const choice of choices) {
        if (choice.subject_id) dpSubjectIds.add(choice.subject_id);
      }
    }

    // Fetch all school subjects, then filter to only those used by DP students
    const allSubjectsRaw = await withRetry(
      'fetch_all_subjects',
      { entity: 'Subject', filter: { school_id } },
      async () => await base44.entities.Subject.filter({ school_id })
    );

    const dpSubjects = allSubjectsRaw
      .filter((s) => s.is_active !== false)
      .filter((s) => dpSubjectIds.has(s.id));

    console.log(`[generateDpTeachingGroups] Found ${students.length} DP students, ${dpSubjectIds.size} unique subject choices, ${dpSubjects.length} subjects matched`);

    if (students.length === 0) {
      return Response.json({
        success: true,
        message: 'No DP students found',
        groups_created: 0,
        logs,
        total_duration_ms: Date.now() - startedAt,
      });
    }

    // Build groups: subject + level combinations
    const groupMap = new Map(); // key: subjectId_level_yearGroup (or subjectId_level_combined)

    for (const student of students) {
      const subjectChoices = student.subject_choices || [];
      for (const choice of subjectChoices) {
        const subject = dpSubjects.find((s) => s.id === choice.subject_id);
        if (!subject) continue;
        const shouldCombine = subject?.combine_dp1_dp2 === true;
        const yearGroup = shouldCombine ? 'DP1+DP2' : student.year_group;
        
        // STABLE KEY: Include subject code for better stability
        const subjectCode = String(subject.code || subject.name || '').toUpperCase().replace(/\s+/g, '_');
        const key = `${choice.subject_id}_${choice.level}_${yearGroup}`;
        
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            subject_id: choice.subject_id,
            subject_code: subjectCode,
            level: choice.level,
            year_group: yearGroup,
            student_ids: [],
          });
        }
        groupMap.get(key).student_ids.push(student.id);
      }
    }

    // Delete existing auto-generated DP groups (DP1/DP2)
    const existingGroups = await withRetry(
      'fetch_existing_groups',
      { entity: 'TeachingGroup', filter: { school_id, year_group: { $in: ['DP1', 'DP2', 'DP1+DP2'] } } },
      async () => await base44.entities.TeachingGroup.filter({ school_id, year_group: { $in: ['DP1', 'DP2', 'DP1+DP2'] } })
    );

    // Delete in small batches with per-call timing
    for (const group of existingGroups) {
      await withRetry(
        'delete_teaching_group',
        { entity: 'TeachingGroup.delete', id: group.id },
        async () => await base44.asServiceRole.entities.TeachingGroup.delete(group.id),
        3,
        300
      );
    }

    // Create new groups (compute minutes, periods, and hours from subject settings)
    const newGroups = [];
    for (const [, groupData] of groupMap.entries()) {
      const subject = dpSubjects.find((s) => s.id === groupData.subject_id);
      if (!subject) continue;
      
      const subjectCode = groupData.subject_code || String(subject.code || subject.name || '').toUpperCase().replace(/\s+/g, '_');
      
      // EXPLICIT PERIODS FOR TOK/CAS/EE
      const isTOK = subjectCode === 'TOK' || subject.is_core === true && subject.name?.includes('TOK');
      const isCAS = subjectCode === 'CAS' || subject.is_core === true && subject.name?.includes('CAS');
      const isEE = subjectCode === 'EE' || subject.is_core === true && subject.name?.includes('EE');
      
      // STEP 1: Define hours_per_week as source of truth (IB standards 2026)
      // CRITICAL BUSINESS RULE: HL=6h/week, SL=4h/week (updated from 5h/3h)
      let hoursPerWeek = 0;
      
      if (isTOK) {
        hoursPerWeek = 2; // TOK: 2 hours/week
      } else if (isCAS) {
        hoursPerWeek = 1; // CAS: 1 hour/week (if timetabled)
      } else if (isEE) {
        hoursPerWeek = 0; // EE: Not timetabled
      } else if (groupData.level === 'HL') {
        hoursPerWeek = 6; // HL: 6 hours/week (NEW STANDARD)
      } else if (groupData.level === 'SL') {
        hoursPerWeek = 4; // SL: 4 hours/week (NEW STANDARD)
      } else {
        hoursPerWeek = 4; // Fallback: assume SL (4h/week)
      }
      
      console.log(`[generateDpTeachingGroups] 📊 ${subject.name} ${groupData.level || 'core'}: hours_per_week=${hoursPerWeek} (HL=6h, SL=4h, TOK=2h, CAS=1h, EE=0h)`);
      
      // STEP 2: Calculate minutes_per_week
      const minutesPerWeek = hoursPerWeek * 60;
      
      // STEP 3: Calculate periods_per_week dynamically based on period duration
      const periodsPerWeek = Math.ceil(minutesPerWeek / periodDurationMinutes);
      
      console.log(`[generateDpTeachingGroups] ${subject.name} ${groupData.level || 'core'}: ${hoursPerWeek}h/week → ${minutesPerWeek}min → ${periodsPerWeek} periods (${periodDurationMinutes}min each)`);
      
      // FAIL-SAFE: Skip EE groups (no timetabling needed)
      if (isEE && periodsPerWeek === 0) {
        console.log(`[generateDpTeachingGroups] Skipping EE group (not timetabled): ${subject.name}`);
        continue;
      }
      
      // Generate stable course_code with level and cohort
      const levelSuffix = groupData.level ? `_${groupData.level}` : '';
      const cohortSuffix = groupData.year_group ? `_${groupData.year_group.replace(/\+/g, '_')}` : '';
      const stableCourseCode = `${subjectCode}${levelSuffix}${cohortSuffix}`;

      newGroups.push({
        school_id,
        name: `${subject.name} ${groupData.level} - ${groupData.year_group}`,
        subject_id: groupData.subject_id,
        level: groupData.level,
        year_group: groupData.year_group,
        student_ids: groupData.student_ids,
        hours_per_week: hoursPerWeek,         // SOURCE OF TRUTH: 6 for HL, 4 for SL, 2 for TOK
        minutes_per_week: minutesPerWeek,     // DERIVED: hours * 60
        periods_per_week: periodsPerWeek,     // DERIVED: ceil(minutes / period_duration)
        course_code: stableCourseCode,        // STABLE: FILM_HL_DP2 format
        is_active: true,
      });
    }

    // STEP 4: Create teaching groups + CAPTURE IDs
    let createdGroupIds = [];
    if (newGroups.length > 0) {
      const createdRecords = await withRetry(
        'bulk_create_teaching_groups',
        { entity: 'TeachingGroup.bulkCreate', count: newGroups.length },
        async () => await base44.asServiceRole.entities.TeachingGroup.bulkCreate(newGroups)
      );
      
      // Extract IDs from created records
      if (Array.isArray(createdRecords)) {
        createdGroupIds = createdRecords.map(r => r?.id).filter(Boolean);
        console.log(`[generateDpTeachingGroups] ✅ Created ${createdGroupIds.length} teaching groups, IDs captured`);
      }
    }

    // STEP 5: Sync student assignments
    if (newGroups.length > 0) {
      try {
        console.log('[generateDpTeachingGroups] Syncing student teaching group assignments...');
        const syncResult = await withRetry(
          'sync_student_teaching_groups',
          { function: 'syncStudentTeachingGroups' },
          async () => await base44.functions.invoke('syncStudentTeachingGroups')
        );
        console.log('[generateDpTeachingGroups] Sync result:', syncResult?.data);
      } catch (syncError) {
        console.error('[generateDpTeachingGroups] Failed to sync student groups:', syncError);
        // Don't fail the entire request - groups are created, sync can be retried
      }
    }
    
    // STEP 6: FRESH FETCH of created groups (post-sync, stable state)
    console.log(`[generateDpTeachingGroups] Fresh fetching ${createdGroupIds.length} created groups...`);
    const createdGroups = [];
    
    if (createdGroupIds.length > 0) {
      try {
        const fetched = await withRetry(
          'fetch_created_groups',
          { entity: 'TeachingGroup', ids: createdGroupIds.slice(0, 10) },
          async () => {
            // Fetch all created groups by school_id + active filter
            // NOTE: Base44 filter may not support $in for IDs, so filter client-side
            const allGroups = await base44.entities.TeachingGroup.filter({ 
              school_id, 
              is_active: true 
            });
            
            // Filter to only created IDs
            const createdSet = new Set(createdGroupIds);
            return allGroups.filter(g => createdSet.has(g.id));
          }
        );
        
        createdGroups.push(...fetched);
        console.log(`[generateDpTeachingGroups] ✅ Fetched ${createdGroups.length}/${createdGroupIds.length} created groups`);
      } catch (fetchError) {
        console.error('[generateDpTeachingGroups] Failed to fetch created groups:', fetchError);
        // Continue anyway - IDs are captured
      }
    }

    return Response.json({
      success: true,
      groups_created: newGroups.length,
      created_group_ids: createdGroupIds, // EXPLICIT: IDs of created groups
      created_groups: createdGroups, // EXPLICIT: Full group objects (fresh fetch)
      message: `Created ${newGroups.length} DP teaching groups and synced student assignments`,
      logs,
      total_duration_ms: Date.now() - startedAt,
    });
  } catch (error) {
    // Capture error stack fully
    const errStack = String(error?.stack || error?.message || error);
    console.error('[generateDpTeachingGroups] ERROR:', errStack);
    logs.notes.push('Unhandled error in generateDpTeachingGroups');
    return Response.json({
      error: error?.message || 'Failed to generate DP teaching groups',
      stack: errStack,
      logs,
      total_duration_ms: Date.now() - startedAt,
    }, { status: 500 });
  }
});