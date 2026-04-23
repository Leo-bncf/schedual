import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all PYP students
    const allStudents = await base44.asServiceRole.entities.Student.filter(
      { school_id: user.school_id, ib_programme: 'PYP' },
      '-created_date',
      500
    );

    console.log(`Found ${allStudents.length} PYP students`);

    let updated = 0;
    const updates = [];

    for (const student of allStudents) {
      const oldYearGroup = student.year_group;
      
      // Extract class letter from various formats
      let classLetter = null;
      const lowerYearGroup = oldYearGroup.toLowerCase();
      
      // Try patterns: "PYP_Class_A", "class a", "Class B", etc.
      const patterns = [
        /class[_\s-]*([a-f])/i,     // "Class_A", "class A", "Class-A"
        /pyp[_\s-]+class[_\s-]*([a-f])/i,  // "PYP_Class_A"
        /pyp[_\s-]+([a-f])/i,       // "PYP_A" or "PYP A"
        /[_-]([a-f])$/i,            // ends with "_A" or "-A"
        /\b([a-f])\b/i              // standalone letter
      ];

      for (const pattern of patterns) {
        const match = lowerYearGroup.match(pattern);
        if (match) {
          classLetter = match[match.length - 1]; // Get last capture group
          break;
        }
      }

      if (classLetter) {
        const newYearGroup = `PYP-${classLetter.toUpperCase()}`;
        
        if (oldYearGroup !== newYearGroup) {
          updates.push({
            id: student.id,
            name: student.full_name,
            old: oldYearGroup,
            new: newYearGroup
          });

          await base44.asServiceRole.entities.Student.update(student.id, {
            year_group: newYearGroup
          });

          updated++;
          console.log(`Updated ${student.full_name}: ${oldYearGroup} → ${newYearGroup}`);
        }
      } else {
        console.log(`Could not extract class letter from: ${oldYearGroup}`);
      }
    }

    return Response.json({
      success: true,
      total: allStudents.length,
      updated,
      updates
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});