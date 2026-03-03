import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // bypass auth for testing, use asServiceRole
    const user = { school_id: '696e113f47bd4dd652e12917' };
    const schedule_version_id = '69a6185adc65bc2b8a116442';
    
    const [scheduleVersion, teachers, students, rooms, teachingGroups, subjects, school] = await Promise.all([
      base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version_id }),
      base44.asServiceRole.entities.Teacher.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Student.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Room.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.TeachingGroup.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.Subject.filter({ school_id: user.school_id, is_active: true }),
      base44.asServiceRole.entities.School.filter({ id: user.school_id })
    ]);

    // return the entities directly to see their properties
    return Response.json({
      subjects: subjects.length,
      teachingGroups: teachingGroups.length,
      sampleSubject: subjects[0]
    });
  } catch (e) {
    return Response.json({ error: e.message });
  }
});