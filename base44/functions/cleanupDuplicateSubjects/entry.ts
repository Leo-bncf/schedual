import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const schoolId = user.school_id || user.data?.school_id;
    if (!schoolId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const students = await base44.entities.Student.filter({ school_id: schoolId, ib_programme: 'DP' });

    let fixed = 0;
    const issues = [];

    for (const student of students) {
      if (!student.subject_choices || !Array.isArray(student.subject_choices)) continue;

      // Find duplicates (same subject_id, different or same level)
      const seen = new Map();
      const cleaned = [];
      let hasDuplicates = false;

      for (const choice of student.subject_choices) {
        const subjectId = choice.subject_id;
        
        if (!seen.has(subjectId)) {
          // First occurrence - keep it
          seen.set(subjectId, choice);
          cleaned.push(choice);
        } else {
          // Duplicate found!
          hasDuplicates = true;
          const existing = seen.get(subjectId);
          
          issues.push({
            student: student.full_name,
            subject_id: subjectId,
            duplicate_levels: [existing.level, choice.level].filter(Boolean)
          });

          // Keep the HL version if there's a conflict between HL and SL
          if (choice.level === 'HL' && existing.level === 'SL') {
            // Replace with HL version
            const index = cleaned.findIndex(c => c.subject_id === subjectId);
            cleaned[index] = choice;
            seen.set(subjectId, choice);
          }
          // Otherwise keep the first occurrence (already in cleaned array)
        }
      }

      if (hasDuplicates) {
        await base44.entities.Student.update(student.id, {
          subject_choices: cleaned
        });
        fixed++;
      }
    }

    return Response.json({
      success: true,
      students_fixed: fixed,
      issues_found: issues
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});