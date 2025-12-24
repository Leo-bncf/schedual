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

    console.log('Starting import for school:', user.school_id);
    console.log('File URL:', fileUrl);

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

    // Create subjects
    console.log('Creating subjects...');
    if (data.subjects && data.subjects.length > 0) {
      for (const subject of data.subjects) {
        try {
          console.log('Creating subject:', subject.name);
          const created = await base44.asServiceRole.entities.Subject.create({
            school_id: user.school_id,
            name: subject.name,
            code: subject.code || subject.name.substring(0, 3).toUpperCase(),
            ib_level: subject.ib_level || 'DP',
            ib_group: subject.ib_group || '1',
            ib_group_name: subject.ib_group_name || 'Language & Literature',
            is_active: true
          });
          console.log('Created subject:', created.id);
          results.subjects.push(created);
        } catch (err) {
          console.error('Error creating subject:', err);
          results.errors.push(`Subject ${subject.name}: ${err.message}`);
        }
      }
    }

    // Create rooms
    console.log('Creating rooms...');
    if (data.rooms && data.rooms.length > 0) {
      for (const room of data.rooms) {
        try {
          const created = await base44.asServiceRole.entities.Room.create({
            school_id: user.school_id,
            name: room.name,
            capacity: room.capacity || 20,
            room_type: room.room_type || 'classroom',
            is_active: true
          });
          results.rooms.push(created);
        } catch (err) {
          results.errors.push(`Room ${room.name}: ${err.message}`);
        }
      }
    }

    // Create teachers
    if (data.teachers && data.teachers.length > 0) {
      for (const teacher of data.teachers) {
        try {
          const created = await base44.asServiceRole.entities.Teacher.create({
            school_id: user.school_id,
            full_name: teacher.full_name,
            email: teacher.email || `${teacher.full_name.toLowerCase().replace(/\s/g, '.')}@school.edu`,
            is_active: true
          });
          results.teachers.push(created);
        } catch (err) {
          results.errors.push(`Teacher ${teacher.full_name}: ${err.message}`);
        }
      }
    }

    // Create students
    if (data.students && data.students.length > 0) {
      for (const student of data.students) {
        try {
          const created = await base44.asServiceRole.entities.Student.create({
            school_id: user.school_id,
            full_name: student.full_name,
            email: student.email || `${student.full_name.toLowerCase().replace(/\s/g, '.')}@student.edu`,
            ib_programme: student.ib_programme || 'DP',
            year_group: student.year_group || 'DP1',
            is_active: true
          });
          results.students.push(created);
        } catch (err) {
          results.errors.push(`Student ${student.full_name}: ${err.message}`);
        }
      }
    }

    // Create teaching groups
    if (data.teaching_groups && data.teaching_groups.length > 0) {
      for (const group of data.teaching_groups) {
        try {
          // Find matching subject
          const subject = results.subjects.find(s => 
            s.name.toLowerCase().includes(group.subject_name?.toLowerCase())
          );
          
          if (subject) {
            const created = await base44.asServiceRole.entities.TeachingGroup.create({
              school_id: user.school_id,
              name: group.name,
              subject_id: subject.id,
              level: group.level || 'SL',
              year_group: group.year_group || 'DP1',
              is_active: true
            });
            results.teaching_groups.push(created);
          }
        } catch (err) {
          results.errors.push(`Teaching Group ${group.name}: ${err.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      results: {
        subjects_created: results.subjects.length,
        rooms_created: results.rooms.length,
        teachers_created: results.teachers.length,
        students_created: results.students.length,
        teaching_groups_created: results.teaching_groups.length,
        errors: results.errors
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