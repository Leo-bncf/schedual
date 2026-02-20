import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Run DP Group Generation Async (Background Executor)
 * 
 * Executes generateDpTeachingGroups logic in background.
 * Updates DpGenerationJob with progress and results.
 */

Deno.serve(async (req) => {
  console.log('[runDpGroupGenerationAsync] 🚀 Background execution started');
  
  const startTime = Date.now();
  let job_id = null;
  let schedule_version_id = null;
  let schoolId = null;
  
  try {
    const base44 = createClientFromRequest(req);
    
    const body = await req.json();
    job_id = body?.job_id;
    schedule_version_id = body?.schedule_version_id;
    schoolId = body?.school_id;
    
    if (!job_id || !schedule_version_id || !schoolId) {
      console.error('[runDpGroupGenerationAsync] ❌ Missing required params');
      return Response.json({ ok: false, error: 'Missing params' }, { status: 400 });
    }
    
    console.log(`[runDpGroupGenerationAsync] Job ${job_id}: Starting DP group generation...`);
    
    // Update: running
    await base44.asServiceRole.entities.DpGenerationJob.update(job_id, {
      status: 'running',
      stage: 'loading_data',
      progress_percent: 10
    });
    
    // Load data
    const [school, allSubjects, allStudents, allTeachers] = await Promise.all([
      base44.asServiceRole.entities.School.filter({ id: schoolId }).then(r => r?.[0] || null),
      base44.asServiceRole.entities.Subject.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Student.filter({ school_id: schoolId }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: schoolId })
    ]);
    
    if (!school) {
      await base44.asServiceRole.entities.DpGenerationJob.update(job_id, {
        status: 'failed',
        stage: 'loading_data',
        error: { message: 'School not found' },
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime
      });
      return Response.json({ ok: false, error: 'School not found' });
    }
    
    const dpSubjects = allSubjects.filter(s => s.ib_level === 'DP');
    const dpStudents = allStudents.filter(s => s.ib_programme === 'DP');
    
    console.log(`[runDpGroupGenerationAsync] Loaded: ${dpSubjects.length} DP subjects, ${dpStudents.length} DP students`);
    
    // Update: generating groups
    await base44.asServiceRole.entities.DpGenerationJob.update(job_id, {
      stage: 'generating_groups',
      progress_percent: 30
    });
    
    // Generate groups (copy logic from generateDpTeachingGroups)
    const groupsToCreate = [];
    const subjectsByGroup = {};
    
    // Group students by subject choices
    for (const student of dpStudents) {
      if (!Array.isArray(student.subject_choices)) continue;
      
      for (const choice of student.subject_choices) {
        const subj = dpSubjects.find(s => s.id === choice.subject_id);
        if (!subj) continue;
        
        const level = choice.level || 'SL';
        const key = `${subj.id}_${level}_${student.year_group}`;
        
        if (!subjectsByGroup[key]) {
          subjectsByGroup[key] = {
            subject_id: subj.id,
            level,
            year_group: student.year_group,
            students: []
          };
        }
        
        subjectsByGroup[key].students.push(student.id);
      }
    }
    
    // Create teaching groups
    for (const [key, data] of Object.entries(subjectsByGroup)) {
      const subj = dpSubjects.find(s => s.id === data.subject_id);
      if (!subj) continue;
      
      const hoursPerWeek = data.level === 'HL' ? (subj.hoursPerWeekHL || 6) : (subj.hoursPerWeekSL || 4);
      const minutesPerWeek = hoursPerWeek * 60;
      
      groupsToCreate.push({
        school_id: schoolId,
        name: `${subj.name} ${data.level} - ${data.year_group}`,
        subject_id: data.subject_id,
        level: data.level,
        year_group: data.year_group,
        student_ids: data.students,
        minutes_per_week: minutesPerWeek,
        periods_per_week: Math.ceil(minutesPerWeek / (school.period_duration_minutes || 60)),
        is_active: true
      });
    }
    
    console.log(`[runDpGroupGenerationAsync] Generated ${groupsToCreate.length} teaching groups`);
    
    // Update: saving
    await base44.asServiceRole.entities.DpGenerationJob.update(job_id, {
      stage: 'saving_groups',
      progress_percent: 70
    });
    
    // Delete existing DP groups
    const existingDpGroups = await base44.asServiceRole.entities.TeachingGroup.filter({ 
      school_id: schoolId 
    });
    
    const dpGroupsToDelete = existingDpGroups.filter(g => {
      const subj = dpSubjects.find(s => s.id === g.subject_id);
      return subj && subj.ib_level === 'DP';
    });
    
    for (const g of dpGroupsToDelete) {
      await base44.asServiceRole.entities.TeachingGroup.delete(g.id);
    }
    
    console.log(`[runDpGroupGenerationAsync] Deleted ${dpGroupsToDelete.length} existing DP groups`);
    
    // Create new groups
    const createdGroups = [];
    for (const groupData of groupsToCreate) {
      const created = await base44.asServiceRole.entities.TeachingGroup.create(groupData);
      createdGroups.push(created);
    }
    
    console.log(`[runDpGroupGenerationAsync] Created ${createdGroups.length} new DP groups`);
    
    // Success!
    await base44.asServiceRole.entities.DpGenerationJob.update(job_id, {
      status: 'completed',
      stage: 'complete',
      progress_percent: 100,
      result: {
        groupsCreated: createdGroups.length,
        groupsDeleted: dpGroupsToDelete.length,
        dpStudentsProcessed: dpStudents.length,
        dpSubjectsProcessed: dpSubjects.length
      },
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });
    
    return Response.json({ ok: true, job_id });
    
  } catch (error) {
    console.error('[runDpGroupGenerationAsync] ❌ FATAL ERROR:', error);
    
    if (job_id) {
      try {
        await base44.asServiceRole.entities.DpGenerationJob.update(job_id, {
          status: 'failed',
          stage: 'error',
          error: {
            message: String(error?.message || error),
            stack: String(error?.stack || '')
          },
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
      } catch (updateError) {
        console.error('[runDpGroupGenerationAsync] ❌ Failed to update job:', updateError);
      }
    }
    
    return Response.json({ 
      ok: false, 
      error: String(error?.message || error) 
    }, { status: 500 });
  }
});