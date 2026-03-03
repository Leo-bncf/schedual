import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const payload = await req.json();
        const school_id = payload.school_id;
        const schedule_version_id = payload.schedule_version_id;
        
        // Fetch all data as service role
        const scheduleVersion = await base44.asServiceRole.entities.ScheduleVersion.filter({ id: schedule_version_id });
        const schoolQuery = await base44.asServiceRole.entities.School.filter({ id: school_id });
        const schoolData = schoolQuery[0] || {};
        
        const teachers = await base44.asServiceRole.entities.Teacher.filter({ school_id, is_active: true });
        const subjects = await base44.asServiceRole.entities.Subject.filter({ school_id, is_active: true });
        const rooms = await base44.asServiceRole.entities.Room.filter({ school_id, is_active: true });
        const students = await base44.asServiceRole.entities.Student.filter({ school_id, is_active: true });
        const teachingGroups = await base44.asServiceRole.entities.TeachingGroup.filter({ school_id, is_active: true });
        
        const constraintsData = await base44.asServiceRole.entities.Constraint.filter({ school_id, is_active: true });
        
        // Simplistic recreation for demonstration purposes
        let numericIdCounter = 1;
        const generateNumericId = () => numericIdCounter++;
        
        const teacherNumericMap = {};
        const mappedTeachers = teachers.map(t => {
          const numId = generateNumericId();
          teacherNumericMap[t.id] = numId;
          return {
            id: numId,
            externalId: String(t.id),
            name: String(t.full_name || "Teacher"),
            maxPeriodsPerWeek: Number(t.max_hours_per_week || 40),
            unavailableSlotIds: [],
            unavailableDays: [],
            preferredDays: [],
            avoidDays: []
          };
        });
        
        const optaPlannerPayload = {
            schoolId: String(school_id),
            scheduleVersion: scheduleVersion[0]?.name || "Draft",
            scheduleVersionId: String(schedule_version_id),
            scheduleSettings: {
                periodDurationMinutes: Number(schoolData.period_duration_minutes || 60),
                dayStartTime: String(schoolData.day_start_time || "08:00"),
                dayEndTime: String(schoolData.day_end_time || "18:00"),
                daysOfWeek: schoolData.days_of_week || ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
                breaks: schoolData.breaks || []
            },
            teachers: mappedTeachers,
            // Only returning a part of it so we don't blow up the chat size
            roomsCount: rooms.length,
            subjectsCount: subjects.length,
            teachingGroupsCount: teachingGroups.length
        };
        
        return Response.json(optaPlannerPayload);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});