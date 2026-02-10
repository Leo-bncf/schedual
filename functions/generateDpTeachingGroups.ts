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

    // Fetch school (for settings if needed later)
    const school = await withRetry(
      'fetch_school',
      { entity: 'School', filter: { id: school_id } },
      async () => (await base44.entities.School.filter({ id: school_id }))[0]
    );

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
        const key = `${choice.subject_id}_${choice.level}_${yearGroup}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            subject_id: choice.subject_id,
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
      
      // CRITICAL: Use minutes as primary source (OR-Tool requires minutesPerWeek)
      // Comprehensive fallback chain to ensure ALL groups get valid minutes
      let minutesPerWeek = 0;
      
      if (groupData.level === 'HL') {
        // HL priority: subject hl_minutes_per_week_default → subject hl_hours → IB standard (300min = 5h)
        minutesPerWeek = subject.hl_minutes_per_week_default 
          || (subject.hl_hours_per_week ? subject.hl_hours_per_week * 60 : 0)
          || 300;
      } else if (groupData.level === 'SL') {
        // SL priority: subject sl_minutes_per_week_default → subject sl_hours → IB standard (180min = 3h)
        minutesPerWeek = subject.sl_minutes_per_week_default 
          || (subject.sl_hours_per_week ? subject.sl_hours_per_week * 60 : 0)
          || 180;
      } else {
        // Fallback for unspecified level (shouldn't happen but defensive)
        minutesPerWeek = subject.sl_minutes_per_week_default || 180;
      }
      
      // FAIL-SAFE: Ensure non-zero minutes (should never happen with fallbacks above)
      if (!minutesPerWeek || minutesPerWeek <= 0) {
        console.warn(`[generateDpTeachingGroups] WARNING: Subject ${subject.id} (${subject.name}) has no valid minutes config, defaulting to ${groupData.level === 'HL' ? '300' : '180'} min`);
        minutesPerWeek = groupData.level === 'HL' ? 300 : 180;
      }
      
      // Compute periods assuming 60-min periods (override with school config if available)
      const periodDurationMinutes = school?.period_duration_minutes || 60;
      const periodsPerWeek = Math.ceil(minutesPerWeek / periodDurationMinutes);
      
      // Legacy hours field for backward compatibility
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
        minutes_per_week: minutesPerWeek,      // PRIMARY: OR-Tool requires this
        periods_per_week: periodsPerWeek,      // SECONDARY: Computed from minutes
        hours_per_week: hoursPerWeek,          // LEGACY: Kept for compatibility
        is_active: true,
      });
    }

    if (newGroups.length > 0) {
      await withRetry(
        'bulk_create_teaching_groups',
        { entity: 'TeachingGroup.bulkCreate', count: newGroups.length },
        async () => await base44.asServiceRole.entities.TeachingGroup.bulkCreate(newGroups)
      );
    }

    return Response.json({
      success: true,
      groups_created: newGroups.length,
      message: `Created ${newGroups.length} DP teaching groups`,
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