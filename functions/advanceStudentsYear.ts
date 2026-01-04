import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user?.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all students for this school
    const students = await base44.entities.Student.filter({ school_id: user.school_id });
    
    const yearProgressionMap = {
      // DP progression
      'DP1': 'DP2',
      'DP2': null, // Graduates
      // MYP progression
      'MYP1': 'MYP2',
      'MYP2': 'MYP3',
      'MYP3': 'MYP4',
      'MYP4': 'MYP5',
      'MYP5': 'DP1', // Moves to DP
      // PYP progression
      'PYP-A': 'PYP-B',
      'PYP-B': 'PYP-C',
      'PYP-C': 'PYP-D',
      'PYP-D': 'PYP-E',
      'PYP-E': 'PYP-F',
      'PYP-F': 'MYP1', // Moves to MYP
    };

    let advanced = 0;
    let graduated = 0;
    const updates = [];

    for (const student of students) {
      const currentYear = student.year_group;
      const nextYear = yearProgressionMap[currentYear];

      if (nextYear === undefined) {
        continue; // Unknown year group
      }

      if (nextYear === null) {
        // DP2 students graduate - mark inactive
        updates.push({
          id: student.id,
          data: { is_active: false, year_group: 'DP2 (Graduated)' }
        });
        graduated++;
      } else {
        // Advance to next year
        const updateData = { year_group: nextYear };
        
        // If moving from MYP5 to DP1, update programme
        if (currentYear === 'MYP5' && nextYear === 'DP1') {
          updateData.ib_programme = 'DP';
          updateData.subject_choices = []; // Clear MYP subjects, will choose DP subjects
        }
        
        // If moving from PYP-F to MYP1, update programme
        if (currentYear === 'PYP-F' && nextYear === 'MYP1') {
          updateData.ib_programme = 'MYP';
          updateData.subject_choices = []; // Clear PYP subjects
        }
        
        updates.push({ id: student.id, data: updateData });
        advanced++;
      }
    }

    // Apply updates in batches
    const batchSize = 10;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await Promise.all(
        batch.map(({ id, data }) => base44.entities.Student.update(id, data))
      );
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return Response.json({
      success: true,
      advanced,
      graduated,
      message: `Advanced ${advanced} students, ${graduated} graduated`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});