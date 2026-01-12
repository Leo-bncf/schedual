import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 1: Delete ALL subjects to start fresh
    const existingSubjects = await base44.asServiceRole.entities.Subject.list();
    for (const subject of existingSubjects) {
      await base44.asServiceRole.entities.Subject.delete(subject.id);
    }

    // Step 2: Create a fresh subject
    const newSubject = await base44.asServiceRole.entities.Subject.create({
      school_id: user.school_id,
      name: "FRESH TEST SUBJECT",
      code: "FRESH",
      ib_level: "DP",
      ib_group: "1",
      ib_group_name: "Language & Literature",
      available_levels: ["HL"],
      hl_hours_per_week: 6,
      sl_hours_per_week: 4,
      is_active: true
    });

    // Step 3: Immediately query it back
    const afterCreate_allSubjects = await base44.asServiceRole.entities.Subject.list();
    const afterCreate_userSubjects = await base44.entities.Subject.list();
    
    // Step 4: Try to read the specific subject by ID
    let readById = null;
    try {
      readById = await base44.asServiceRole.entities.Subject.filter({ id: newSubject.id });
    } catch (e) {
      readById = { error: e.message };
    }

    return Response.json({
      step1_deleted: existingSubjects.length,
      step2_created: {
        id: newSubject.id,
        name: newSubject.name,
        school_id: newSubject.school_id
      },
      step3_afterCreate: {
        serviceRole_sees: afterCreate_allSubjects.length,
        user_sees: afterCreate_userSubjects.length,
        serviceRole_list: afterCreate_allSubjects,
        user_list: afterCreate_userSubjects
      },
      step4_readById: readById,
      diagnosis: afterCreate_allSubjects.length === 0 ? 
        "PROBLEM: Subject created but disappeared from DB!" : 
        afterCreate_userSubjects.length === 0 ? 
          "PROBLEM: RLS blocking read access" : 
          "SUCCESS: Everything works"
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});