import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TEST: Try to create a test subject right now
    let createResult = null;
    try {
      createResult = await base44.entities.Subject.create({
        school_id: user.school_id,
        name: "DEBUG TEST SUBJECT",
        code: "DEBUG",
        ib_level: "DP",
        ib_group: "1",
        ib_group_name: "Language & Literature",
        available_levels: ["HL"],
        hl_hours_per_week: 6,
        sl_hours_per_week: 4,
        is_active: true
      });
    } catch (createError) {
      createResult = { error: createError.message };
    }

    // Use service role to bypass RLS and see ALL subjects
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    
    // Try to read with normal user permissions
    const userSubjects = await base44.entities.Subject.list();

    // Try filter explicitly by school_id
    const filteredSubjects = await base44.asServiceRole.entities.Subject.filter({
      school_id: user.school_id
    });

    return Response.json({
      user: {
        email: user.email,
        school_id: user.school_id,
        school_id_type: typeof user.school_id
      },
      createTest: createResult,
      allSubjectsInDB: allSubjects.length,
      allSubjects: allSubjects.map(s => ({
        id: s.id,
        name: s.name,
        school_id: s.school_id,
        school_id_type: typeof s.school_id,
        matches: s.school_id === user.school_id,
        strictMatch: s.school_id === user.school_id && typeof s.school_id === typeof user.school_id
      })),
      userCanSee: userSubjects.length,
      filteredBySchoolId: filteredSubjects.length
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});