import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Authenticate user
    const user = await base44.auth.me();
    if (!user || !user.school_id) {
      return Response.json({ error: 'Unauthorized or missing school_id' }, { status: 401 });
    }

    const { fileUrl } = await req.json();
    
    if (!fileUrl) {
      return Response.json({ error: 'Missing fileUrl' }, { status: 400 });
    }

    console.log('=== IMPORT DEBUG START ===');
    console.log('Authenticated User:', JSON.stringify(user, null, 2));
    console.log('School ID from user:', user.school_id);
    console.log('File URL:', fileUrl);

    // Verify school exists
    const schools = await base44.asServiceRole.entities.School.filter({ id: user.school_id });
    console.log('School exists?', schools.length > 0);
    console.log('School data:', schools[0]);

    // Verify user's school_id one more time
    if (!user.school_id) {
      console.error('CRITICAL: User has no school_id!');
      return Response.json({ 
        success: false,
        error: 'User account does not have a school_id. Please contact support.' 
      }, { status: 400 });
    }

    // Use LLM to extract structured data from the file
    console.log('Calling InvokeLLM...');
    const extractionResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract school data from this file and structure it as JSON.
      
Extract:
- Subjects: name, code, ib_level (PYP/MYP/DP), ib_group (1-6 as string), ib_group_name
- Rooms: name, capacity, room_type
- Teachers: full_name, email
- Students: full_name, email, ib_programme (PYP/MYP/DP), year_group
- Teaching Groups: name, subject reference, level (HL/SL), year_group (DP1/DP2)

Return all data you can find. Make reasonable assumptions for missing fields.`,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          subjects: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                code: { type: "string" },
                ib_level: { type: "string", enum: ["PYP", "MYP", "DP"] },
                ib_group: { type: "string" },
                ib_group_name: { type: "string" }
              }
            }
          },
          rooms: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                capacity: { type: "number" },
                room_type: { type: "string" }
              }
            }
          },
          teachers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                full_name: { type: "string" },
                email: { type: "string" }
              }
            }
          },
          students: {
            type: "array",
            items: {
              type: "object",
              properties: {
                full_name: { type: "string" },
                email: { type: "string" },
                ib_programme: { type: "string" },
                year_group: { type: "string" }
              }
            }
          },
          teaching_groups: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                subject_name: { type: "string" },
                level: { type: "string" },
                year_group: { type: "string" }
              }
            }
          }
        }
      }
    });

    console.log('LLM extraction complete');
    console.log('Extracted data:', JSON.stringify(extractionResponse, null, 2));

    const data = extractionResponse;
    const results = {
      subjects: [],
      rooms: [],
      teachers: [],
      students: [],
      teaching_groups: [],
      errors: []
    };

    // Create subjects using bulk create
    console.log('Creating subjects...');
    if (data.subjects && data.subjects.length > 0) {
      try {
        const subjectsToCreate = data.subjects.map(subject => ({
          school_id: user.school_id,
          name: subject.name,
          code: subject.code || subject.name.substring(0, 3).toUpperCase(),
          ib_level: subject.ib_level || 'DP',
          ib_group: subject.ib_group || '1',
          ib_group_name: subject.ib_group_name || 'Language & Literature',
          is_active: true
        }));

        console.log('Subjects to create:', JSON.stringify(subjectsToCreate, null, 2));

        const created = await base44.asServiceRole.entities.Subject.bulkCreate(subjectsToCreate);
        results.subjects = created;
        console.log('Created subjects count:', created.length);
        console.log('Sample created subject:', JSON.stringify(created[0], null, 2));

      } catch (err) {
        console.error('Error bulk creating subjects:', err);
        results.errors.push(`Subjects bulk create: ${err.message}`);
      }
    }

    // Create rooms using bulk create
    console.log('Creating rooms...');
    if (data.rooms && data.rooms.length > 0) {
      try {
        const roomsToCreate = data.rooms.map(room => ({
          school_id: user.school_id,
          name: room.name,
          capacity: room.capacity || 20,
          room_type: room.room_type || 'classroom',
          is_active: true
        }));
        
        const created = await base44.asServiceRole.entities.Room.bulkCreate(roomsToCreate);
        results.rooms = created;
        console.log('Created rooms:', created.length);
      } catch (err) {
        console.error('Error bulk creating rooms:', err);
        results.errors.push(`Rooms bulk create: ${err.message}`);
      }
    }

    // Create teachers using bulk create
    console.log('Creating teachers...');
    if (data.teachers && data.teachers.length > 0) {
      try {
        const teachersToCreate = data.teachers.map(teacher => ({
          school_id: user.school_id,
          full_name: teacher.full_name,
          email: teacher.email || `${teacher.full_name.toLowerCase().replace(/\s/g, '.')}@school.edu`,
          is_active: true
        }));
        
        const created = await base44.asServiceRole.entities.Teacher.bulkCreate(teachersToCreate);
        results.teachers = created;
        console.log('Created teachers:', created.length);
        console.log('Sample teacher:', created[0]);
      } catch (err) {
        console.error('Error bulk creating teachers:', err);
        results.errors.push(`Teachers bulk create: ${err.message}`);
      }
    }

    // Create students using bulk create
    console.log('Creating students...');
    if (data.students && data.students.length > 0) {
      try {
        const studentsToCreate = data.students.map(student => ({
          school_id: user.school_id,
          full_name: student.full_name,
          email: student.email || `${student.full_name.toLowerCase().replace(/\s/g, '.')}@student.edu`,
          ib_programme: student.ib_programme || 'DP',
          year_group: student.year_group || 'DP1',
          is_active: true
        }));
        
        const created = await base44.asServiceRole.entities.Student.bulkCreate(studentsToCreate);
        results.students = created;
        console.log('Created students:', created.length);
      } catch (err) {
        console.error('Error bulk creating students:', err);
        results.errors.push(`Students bulk create: ${err.message}`);
      }
    }

    // Create teaching groups using bulk create
    console.log('Creating teaching groups...');
    if (data.teaching_groups && data.teaching_groups.length > 0) {
      try {
        const groupsToCreate = data.teaching_groups
          .map(group => {
            const subject = results.subjects.find(s => 
              s.name.toLowerCase().includes(group.subject_name?.toLowerCase())
            );
            
            if (subject) {
              return {
                school_id: user.school_id,
                name: group.name,
                subject_id: subject.id,
                level: group.level || 'SL',
                year_group: group.year_group || 'DP1',
                is_active: true
              };
            }
            return null;
          })
          .filter(g => g !== null);
        
        if (groupsToCreate.length > 0) {
          const created = await base44.asServiceRole.entities.TeachingGroup.bulkCreate(groupsToCreate);
          results.teaching_groups = created;
          console.log('Created teaching groups:', created.length);
        }
      } catch (err) {
        console.error('Error bulk creating teaching groups:', err);
        results.errors.push(`Teaching Groups bulk create: ${err.message}`);
      }
    }

    // CRITICAL: Verify user can actually read the created entities
    console.log('=== VERIFICATION PHASE ===');

    let verifySubjects = [];
    let verifyTeachers = [];
    let verifyStudents = [];
    let verifyRooms = [];

    try {
      verifySubjects = await base44.entities.Subject.list();
      verifyTeachers = await base44.entities.Teacher.list();
      verifyStudents = await base44.entities.Student.list();
      verifyRooms = await base44.entities.Room.list();

      console.log('✓ User can read Subjects:', verifySubjects.length);
      console.log('✓ User can read Teachers:', verifyTeachers.length);
      console.log('✓ User can read Students:', verifyStudents.length);
      console.log('✓ User can read Rooms:', verifyRooms.length);
    } catch (verifyError) {
      console.error('Verification read error:', verifyError.message);
    }

    return Response.json({
      success: true,
      school_id: user.school_id,
      results: {
        subjects_created: results.subjects.length,
        rooms_created: results.rooms.length,
        teachers_created: results.teachers.length,
        students_created: results.students.length,
        teaching_groups_created: results.teaching_groups.length,
        errors: results.errors,
        verified_readable: {
          subjects: verifySubjects.length,
          teachers: verifyTeachers.length,
          students: verifyStudents.length,
          rooms: verifyRooms.length
        }
      },
      data: results
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});