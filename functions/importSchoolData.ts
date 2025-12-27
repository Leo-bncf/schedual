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
    const extractionResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract school data from this file and structure it as JSON. Be thorough and extract ALL relationships.

    CRITICAL REQUIREMENTS:

    1. SUBJECTS: Extract name, code, ib_level (PYP/MYP/DP), ib_group (1-6 as string), ib_group_name

    2. TEACHERS: Extract full_name, email, AND which subjects they teach
    - Look for subject assignments, teaching schedules, or course lists
    - Add subject_names array with the names of subjects this teacher teaches
    - Example: {"full_name": "John Doe", "email": "john@edu", "subject_names": ["Physics HL", "Physics SL"]}

    3. STUDENTS: Extract full_name, email, ib_programme (PYP/MYP/DP), year_group (DP1/DP2/MYP3/PYP5)
    - FOR DP STUDENTS: Extract their 6 subject choices with levels (HL or SL)
    - Add subject_selections array with subject names and levels
    - Example: {"full_name": "Jane Smith", "ib_programme": "DP", "year_group": "DP1", "subject_selections": [{"subject_name": "Physics", "level": "HL"}, {"subject_name": "Math", "level": "HL"}]}

    4. ROOMS: name, capacity, room_type

    5. TEACHING GROUPS: name, subject reference, level (HL/SL), year_group

    Extract EVERYTHING you can find including all relationships between teachers-subjects and students-subjects.`,
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
                email: { type: "string" },
                subject_names: { 
                  type: "array",
                  items: { type: "string" },
                  description: "Names of subjects this teacher teaches"
                }
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
                year_group: { type: "string" },
                subject_selections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      subject_name: { type: "string" },
                      level: { type: "string", enum: ["HL", "SL"] }
                    }
                  },
                  description: "Student's subject choices with HL/SL levels"
                }
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

    // Create teachers using bulk create with subject assignments
    console.log('Creating teachers...');
    if (data.teachers && data.teachers.length > 0) {
      try {
        const teachersToCreate = data.teachers.map(teacher => {
          // Map subject names to subject IDs
          const teacherSubjectIds = [];
          if (teacher.subject_names && teacher.subject_names.length > 0) {
            teacher.subject_names.forEach(subjectName => {
              const matchedSubject = results.subjects.find(s => 
                s.name.toLowerCase().includes(subjectName.toLowerCase()) ||
                subjectName.toLowerCase().includes(s.name.toLowerCase())
              );
              if (matchedSubject) {
                teacherSubjectIds.push(matchedSubject.id);
              }
            });
          }

          return {
            school_id: user.school_id,
            full_name: teacher.full_name,
            email: teacher.email || `${teacher.full_name.toLowerCase().replace(/\s/g, '.')}@school.edu`,
            subjects: teacherSubjectIds,
            is_active: true
          };
        });

        const created = await base44.asServiceRole.entities.Teacher.bulkCreate(teachersToCreate);
        results.teachers = created;
        console.log('Created teachers:', created.length);
        console.log('Sample teacher with subjects:', created[0]);
      } catch (err) {
        console.error('Error bulk creating teachers:', err);
        results.errors.push(`Teachers bulk create: ${err.message}`);
      }
    }

    // Create students using bulk create with subject choices
    console.log('Creating students...');
    if (data.students && data.students.length > 0) {
      try {
        const studentsToCreate = data.students.map(student => {
          // Map subject selections to subject_choices format
          const subjectChoices = [];
          if (student.subject_selections && student.subject_selections.length > 0) {
            student.subject_selections.forEach(selection => {
              const matchedSubject = results.subjects.find(s => 
                s.name.toLowerCase().includes(selection.subject_name.toLowerCase()) ||
                selection.subject_name.toLowerCase().includes(s.name.toLowerCase())
              );
              if (matchedSubject) {
                subjectChoices.push({
                  subject_id: matchedSubject.id,
                  level: selection.level || 'SL',
                  ib_group: matchedSubject.ib_group
                });
              }
            });
          }

          // Normalize year_group for PYP students (handle "class a", "Class B", "PYP_Class_D", "A", etc.)
          let normalizedYearGroup = student.year_group || 'DP1';
          const ibProgramme = student.ib_programme || 'DP';
          
          if (ibProgramme === 'PYP') {
            // Try multiple patterns to extract class letter (A-F)
            let classLetter = null;
            
            // Pattern 1: "class [a-f]" or "Class [a-f]"
            const pattern1 = normalizedYearGroup.match(/class\s*([a-f])/i);
            if (pattern1) {
              classLetter = pattern1[1];
            }
            
            // Pattern 2: ends with "_[a-f]" or "-[a-f]"
            if (!classLetter) {
              const pattern2 = normalizedYearGroup.match(/[_-]([a-f])$/i);
              if (pattern2) {
                classLetter = pattern2[1];
              }
            }
            
            // Pattern 3: just the letter [a-f] at the end
            if (!classLetter) {
              const pattern3 = normalizedYearGroup.match(/([a-f])$/i);
              if (pattern3) {
                classLetter = pattern3[1];
              }
            }
            
            // Pattern 4: any [a-f] in the string (last resort)
            if (!classLetter) {
              const pattern4 = normalizedYearGroup.match(/([a-f])/i);
              if (pattern4) {
                classLetter = pattern4[1];
              }
            }
            
            if (classLetter) {
              normalizedYearGroup = `PYP-${classLetter.toUpperCase()}`;
            } else {
              normalizedYearGroup = 'PYP-A';
            }
          }

          return {
            school_id: user.school_id,
            full_name: student.full_name,
            email: student.email || `${student.full_name.toLowerCase().replace(/\s/g, '.')}@student.edu`,
            ib_programme: ibProgramme,
            year_group: normalizedYearGroup,
            subject_choices: subjectChoices,
            is_active: true
          };
        });

        const created = await base44.asServiceRole.entities.Student.bulkCreate(studentsToCreate);
        results.students = created;
        console.log('Created students:', created.length);
        console.log('Sample student with normalized year_group:', created[0]?.full_name, created[0]?.year_group);
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

    // Auto-generate ClassGroups for imported students
    console.log('=== AUTO-GENERATING CLASSGROUPS ===');
    let classGroupsCreated = 0;
    try {
      // Group students by year_group
      const studentsByYear = {};
      results.students.forEach(student => {
        const key = student.year_group;
        if (!studentsByYear[key]) {
          studentsByYear[key] = [];
        }
        studentsByYear[key].push(student);
      });

      const classGroupsToCreate = [];

      // Create ClassGroups for each year_group (exactly 20 students per group)
      for (const [yearGroup, students] of Object.entries(studentsByYear)) {
        const ibProgramme = students[0].ib_programme;
        const batchSize = 20;
        const numBatches = Math.floor(students.length / batchSize); // Only create full batches

        for (let i = 0; i < numBatches; i++) {
          const batchLetter = String.fromCharCode(65 + i); // A, B, C, etc.
          const batchStudents = students.slice(i * batchSize, (i + 1) * batchSize);
          
          const classGroup = {
            school_id: user.school_id,
            name: `${yearGroup}-Batch-${batchLetter}`,
            year_group: yearGroup,
            ib_programme: ibProgramme,
            batch_letter: batchLetter,
            student_ids: batchStudents.map(s => s.id),
            max_students: batchSize,
            is_active: true
          };

          classGroupsToCreate.push(classGroup);
        }
      }

      // Create all ClassGroups
      if (classGroupsToCreate.length > 0) {
        const createdClassGroups = await base44.asServiceRole.entities.ClassGroup.bulkCreate(classGroupsToCreate);
        classGroupsCreated = createdClassGroups.length;

        // Update students with their ClassGroup IDs in batches to avoid rate limits
        const updateBatchSize = 5;
        for (const classGroup of createdClassGroups) {
          for (let i = 0; i < classGroup.student_ids.length; i += updateBatchSize) {
            const batch = classGroup.student_ids.slice(i, i + updateBatchSize);
            await Promise.all(
              batch.map(studentId => 
                base44.asServiceRole.entities.Student.update(studentId, {
                  classgroup_id: classGroup.id
                })
              )
            );
            // Delay between batches to avoid rate limit
            if (i + updateBatchSize < classGroup.student_ids.length) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        console.log('✓ ClassGroups created:', classGroupsCreated);
      }
    } catch (cgError) {
      console.error('ClassGroup generation error:', cgError);
      results.errors.push(`ClassGroup generation: ${cgError.message}`);
    }

    // CRITICAL: Verify user can actually read the created entities
    console.log('=== VERIFICATION PHASE ===');

    let verifySubjects = [];
    let verifyTeachers = [];
    let verifyStudents = [];
    let verifyRooms = [];
    let verifyClassGroups = [];

    try {
      verifySubjects = await base44.entities.Subject.list();
      verifyTeachers = await base44.entities.Teacher.list();
      verifyStudents = await base44.entities.Student.list();
      verifyRooms = await base44.entities.Room.list();
      verifyClassGroups = await base44.entities.ClassGroup.list();

      console.log('✓ User can read Subjects:', verifySubjects.length);
      console.log('✓ User can read Teachers:', verifyTeachers.length);
      console.log('✓ User can read Students:', verifyStudents.length);
      console.log('✓ User can read Rooms:', verifyRooms.length);
      console.log('✓ User can read ClassGroups:', verifyClassGroups.length);
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
        classgroups_created: classGroupsCreated,
        errors: results.errors,
        verified_readable: {
          subjects: verifySubjects.length,
          teachers: verifyTeachers.length,
          students: verifyStudents.length,
          rooms: verifyRooms.length,
          classGroups: verifyClassGroups.length
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