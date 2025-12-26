import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const schoolId = user.school_id;

    // Get all students, subjects, and teaching groups
    const [allStudents, allSubjects, existingGroups] = await Promise.all([
      base44.entities.Student.filter({ school_id: schoolId }),
      base44.entities.Subject.filter({ school_id: schoolId }),
      base44.entities.TeachingGroup.filter({ school_id: schoolId })
    ]);

    const pypMypStudents = allStudents.filter(s => 
      (s.ib_programme === 'PYP' || s.ib_programme === 'MYP') && 
      s.is_active !== false &&
      s.year_group
    );

    if (pypMypStudents.length === 0) {
      return Response.json({ 
        success: true,
        message: 'No PYP/MYP students found',
        groupsCreated: 0,
        studentsAssigned: 0
      });
    }

    // Group students by programme and year_group
    const studentsByProgrammeYear = {};
    pypMypStudents.forEach(student => {
      const key = `${student.ib_programme}-${student.year_group}`;
      if (!studentsByProgrammeYear[key]) {
        studentsByProgrammeYear[key] = [];
      }
      studentsByProgrammeYear[key].push(student);
    });

    const groupsToCreate = [];
    const studentAssignments = {}; // Maps student ID to teaching group IDs

    // For each programme-year combination
    for (const [key, students] of Object.entries(studentsByProgrammeYear)) {
      const [programme, yearGroup] = key.split('-');
      
      // Get subjects for this programme
      const programmeSubjects = allSubjects.filter(s => 
        s.ib_level === programme && s.is_active !== false
      );

      // Create one teaching group per subject for this year group
      for (const subject of programmeSubjects) {
        const groupName = `${programme} ${yearGroup} - ${subject.name}`;
        
        // Check if group already exists
        const existingGroup = existingGroups.find(g => 
          g.name === groupName && 
          g.school_id === schoolId
        );

        let groupId;
        if (existingGroup) {
          groupId = existingGroup.id;
          // Update existing group with students
          const updatedStudentIds = [...new Set([...(existingGroup.student_ids || []), ...students.map(s => s.id)])];
          await base44.asServiceRole.entities.TeachingGroup.update(existingGroup.id, {
            student_ids: updatedStudentIds
          });
        } else {
          // Create new group
          const newGroup = {
            school_id: schoolId,
            name: groupName,
            subject_id: subject.id,
            level: 'Standard',
            year_group: yearGroup,
            student_ids: students.map(s => s.id),
            hours_per_week: 4,
            max_students: 30,
            is_active: true
          };
          groupsToCreate.push(newGroup);
        }

        // Track which groups each student should be in
        students.forEach(student => {
          if (!studentAssignments[student.id]) {
            studentAssignments[student.id] = [];
          }
          if (groupId) {
            studentAssignments[student.id].push(groupId);
          }
        });
      }
    }

    // Bulk create new groups
    let createdGroups = [];
    if (groupsToCreate.length > 0) {
      createdGroups = await base44.asServiceRole.entities.TeachingGroup.bulkCreate(groupsToCreate);
      
      // Add created group IDs to student assignments
      createdGroups.forEach(group => {
        group.student_ids.forEach(studentId => {
          if (!studentAssignments[studentId]) {
            studentAssignments[studentId] = [];
          }
          studentAssignments[studentId].push(group.id);
        });
      });
    }

    // Update all students with their assigned groups
    let studentsUpdated = 0;
    for (const [studentId, groupIds] of Object.entries(studentAssignments)) {
      try {
        await base44.asServiceRole.entities.Student.update(studentId, {
          assigned_groups: groupIds
        });
        studentsUpdated++;
      } catch (error) {
        console.error(`Failed to update student ${studentId}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: `Created/updated teaching groups for ${studentsUpdated} PYP/MYP students`,
      groupsCreated: createdGroups.length,
      groupsUpdated: Object.keys(studentsByProgrammeYear).length * allSubjects.filter(s => s.ib_level === 'PYP' || s.ib_level === 'MYP').length - createdGroups.length,
      studentsAssigned: studentsUpdated,
      breakdown: studentsByProgrammeYear
    });

  } catch (error) {
    console.error('Error in autoAssignPYPMYPGroups:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});