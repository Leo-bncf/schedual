import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Starting debug - user school_id:', user.school_id);

    // Step 1: Check current state
    const before_allSubjects = await base44.asServiceRole.entities.Subject.list();
    console.log('📊 BEFORE: Total subjects in DB:', before_allSubjects.length);

    // Step 2: Delete ALL subjects
    for (const subject of before_allSubjects) {
      await base44.asServiceRole.entities.Subject.delete(subject.id);
      console.log('🗑️ Deleted subject:', subject.id);
    }

    // Step 3: Verify deletion
    const afterDelete = await base44.asServiceRole.entities.Subject.list();
    console.log('📊 AFTER DELETE: Total subjects:', afterDelete.length);

    // Step 4: Create a new subject with SERVICE ROLE (to bypass any RLS issues)
    console.log('➕ Creating subject with school_id:', user.school_id);
    const newSubject = await base44.asServiceRole.entities.Subject.create({
      school_id: user.school_id,
      name: "SERVICE ROLE TEST",
      code: "SRT",
      ib_level: "DP",
      ib_group: "1",
      ib_group_name: "Language & Literature",
      available_levels: ["HL"],
      hl_hours_per_week: 6,
      sl_hours_per_week: 4,
      is_active: true
    });
    console.log('✅ Subject created, returned ID:', newSubject.id);
    console.log('✅ Returned full object:', JSON.stringify(newSubject));

    // Step 5: Wait a moment (maybe async issue?)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 6: Query immediately after
    const afterCreate_service = await base44.asServiceRole.entities.Subject.list();
    const afterCreate_user = await base44.entities.Subject.list();
    console.log('📊 AFTER CREATE (service role):', afterCreate_service.length);
    console.log('📊 AFTER CREATE (user):', afterCreate_user.length);

    return Response.json({
      user_school_id: user.school_id,
      step1_before: before_allSubjects.length,
      step2_deleted: before_allSubjects.length,
      step3_afterDelete: afterDelete.length,
      step4_created: newSubject,
      step5_afterCreate_serviceRoleSees: afterCreate_service.length,
      step5_afterCreate_userSees: afterCreate_user.length,
      step6_serviceRoleList: afterCreate_service,
      step6_userList: afterCreate_user,
      diagnosis: afterCreate_service.length === 0 ? 
        "❌ CRITICAL: Subject returned from create() but NOT in database!" :
        afterCreate_user.length === 0 ?
          "⚠️ RLS ISSUE: Subject exists but user can't read it" :
          "✅ SUCCESS: Everything working!"
    });
  } catch (error) {
    console.error('❌ Debug function error:', error);
    return Response.json({ 
      error: error.message, 
      stack: error.stack,
      name: error.name 
    }, { status: 500 });
  }
});