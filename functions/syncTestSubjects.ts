import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Syncs test/assessment subjects from school config to Subject entity
 * Creates or updates test subjects for PYP, MYP, DP1, DP2 based on test_config
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const school_id = user.school_id;

    // Fetch school with test config
    const schools = await base44.entities.School.filter({ id: school_id });
    const school = schools[0];

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    const testConfig = school.settings?.test_config || {};
    const levels = ['PYP', 'MYP', 'DP1', 'DP2'];
    
    // Fetch existing test subjects
    const existingSubjects = await base44.entities.Subject.filter({ 
      school_id,
      is_active: true 
    });

    const synced = [];

    for (const level of levels) {
      const config = testConfig[level];
      if (!config || config.tests_per_week === 0) {
        // Delete test subject if exists and tests_per_week is 0
        const existing = existingSubjects.find(s => 
          s.code === `TEST_${level}` && s.is_core === false
        );
        if (existing) {
          await base44.entities.Subject.update(existing.id, { is_active: false });
          synced.push({ level, action: 'deactivated' });
        }
        continue;
      }

      const subjectData = {
        school_id,
        name: `${level} Test/Assessment`,
        code: `TEST_${level}`,
        ib_level: level.startsWith('DP') ? 'DP' : level,
        ib_group: '1',
        ib_group_name: 'Language & Literature',
        pyp_myp_hours_per_week: config.tests_per_week || 1,
        supervisor_teacher_id: config.supervisor_id || null,
        is_core: false,
        is_active: true
      };

      // Check if test subject already exists
      const existing = existingSubjects.find(s => s.code === `TEST_${level}`);

      if (existing) {
        // Update existing
        await base44.entities.Subject.update(existing.id, subjectData);
        synced.push({ level, action: 'updated', id: existing.id });
      } else {
        // Create new
        const created = await base44.entities.Subject.create(subjectData);
        synced.push({ level, action: 'created', id: created.id });
      }
    }

    return Response.json({ 
      success: true,
      synced,
      message: `Synced ${synced.length} test subjects`
    });

  } catch (error) {
    console.error('Sync test subjects error:', error);
    return Response.json({ 
      error: error.message || 'Failed to sync test subjects' 
    }, { status: 500 });
  }
});