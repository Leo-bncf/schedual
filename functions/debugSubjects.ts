import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Starting debug - user school_id:', user.school_id);

    const results = {
      user_school_id: user.school_id,
      steps: []
    };

    // Step 1: Check current state with service role
    try {
      const before = await base44.asServiceRole.entities.Subject.list();
      results.steps.push({ step: 1, action: 'list_before', success: true, count: before.length, data: before });
      console.log('✅ Step 1: Found', before.length, 'subjects');
    } catch (error) {
      results.steps.push({ step: 1, action: 'list_before', success: false, error: error.message });
      console.error('❌ Step 1 failed:', error.message);
    }

    // Step 2: Create a test subject
    let createdId = null;
    try {
      const newSubject = await base44.asServiceRole.entities.Subject.create({
        school_id: user.school_id,
        name: "DEBUG TEST " + Date.now(),
        code: "DBG" + Date.now(),
        ib_level: "DP",
        ib_group: "1",
        ib_group_name: "Language & Literature",
        available_levels: ["HL"],
        hl_hours_per_week: 6,
        sl_hours_per_week: 4,
        is_active: true
      });
      createdId = newSubject?.id;
      results.steps.push({ step: 2, action: 'create', success: true, id: createdId, returned: newSubject });
      console.log('✅ Step 2: Created subject', createdId, 'Full object:', JSON.stringify(newSubject));
    } catch (error) {
      results.steps.push({ step: 2, action: 'create', success: false, error: error.message, stack: error.stack });
      console.error('❌ Step 2 failed:', error.message);
    }

    // Step 3: Try to fetch by ID immediately
    if (createdId) {
      try {
        const fetchedById = await base44.asServiceRole.entities.Subject.filter({ id: createdId });
        results.steps.push({ step: 3, action: 'fetch_by_id', success: true, found: fetchedById.length, data: fetchedById });
        console.log('✅ Step 3: Fetch by ID found', fetchedById.length, 'subjects');
      } catch (error) {
        results.steps.push({ step: 3, action: 'fetch_by_id', success: false, error: error.message });
        console.error('❌ Step 3 failed:', error.message);
      }
    }

    // Step 3: Wait a moment
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: List with service role
    try {
      const afterServiceRole = await base44.asServiceRole.entities.Subject.list();
      results.steps.push({ step: 4, action: 'list_service_role', success: true, count: afterServiceRole.length, data: afterServiceRole });
      console.log('✅ Step 4: Service role sees', afterServiceRole.length, 'subjects');
    } catch (error) {
      results.steps.push({ step: 4, action: 'list_service_role', success: false, error: error.message });
      console.error('❌ Step 4 failed:', error.message);
    }

    // Step 5: List with user context
    try {
      const afterUser = await base44.entities.Subject.list();
      results.steps.push({ step: 5, action: 'list_user', success: true, count: afterUser.length, data: afterUser });
      console.log('✅ Step 5: User sees', afterUser.length, 'subjects');
    } catch (error) {
      results.steps.push({ step: 5, action: 'list_user', success: false, error: error.message });
      console.error('❌ Step 5 failed:', error.message);
    }

    // Diagnosis
    const serviceRoleCount = results.steps.find(s => s.step === 4)?.count || 0;
    const userCount = results.steps.find(s => s.step === 5)?.count || 0;
    
    results.diagnosis = serviceRoleCount === 0 ? 
      "❌ CRITICAL: Subject creation failing - nothing in database!" :
      userCount === 0 ?
        "⚠️ RLS ISSUE: Subjects exist but user can't read them" :
        "✅ SUCCESS: Everything working!";

    return Response.json(results);
  } catch (error) {
    console.error('❌ Debug function error:', error);
    return Response.json({ 
      error: error.message, 
      stack: error.stack,
      name: error.name 
    }, { status: 500 });
  }
});