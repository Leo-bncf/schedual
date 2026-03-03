{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/common.schema.json",
  "title": "Common Scheduling Schema",
  "$defs": {
    "scheduleSettings": {
      "type": "object",
      "properties": {
        "daysPerWeek": { "type": "integer", "minimum": 1, "maximum": 7 },
        "periodsPerDay": { "type": "integer", "minimum": 1, "maximum": 20 },
        "periodDurationMinutes": { "type": "integer", "minimum": 10, "maximum": 240 },
        "dayStartTime": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
        "dayEndTime": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
        "daysOfWeek": {
          "type": "array",
          "items": { "type": "string", "enum": ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] },
          "minItems": 1
        },
        "breaks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "start": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" },
              "end": { "type": "string", "pattern": "^\\d{2}:\\d{2}$" }
            },
            "required": ["start","end"],
            "additionalProperties": false
          }
        }
      },
      "required": ["daysPerWeek","periodsPerDay","periodDurationMinutes","dayStartTime","dayEndTime","daysOfWeek"],
      "additionalProperties": false
    },
    "calendar": {
      "type": "object",
      "properties": {
        "academicYear": { "type": "string" },
        "termId": { "type": "string" }
      },
      "required": ["academicYear","termId"],
      "additionalProperties": false
    },
    "teacher": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "code": { "type": "string" },
        "name": { "type": "string" },
        "maxPeriodsPerWeek": { "type": "integer", "minimum": 1, "maximum": 80 },
        "unavailableSlotIds": { "type": "array", "items": { "type": "integer", "minimum": 1 } },
        "unavailableDays": {
          "type": "array",
          "items": { "type": "string", "enum": ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] }
        },
        "preferredDays": {
          "type": "array",
          "items": { "type": "string", "enum": ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] }
        },
        "avoidDays": {
          "type": "array",
          "items": { "type": "string", "enum": ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] }
        }
      },
      "required": ["id","name","maxPeriodsPerWeek"],
      "additionalProperties": false
    },
    "room": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "code": { "type": "string" },
        "name": { "type": "string" },
        "capacity": { "type": "integer", "minimum": 1 }
      },
      "required": ["id","name","capacity"],
      "additionalProperties": false
    },
    "subject": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "code": { "type": "string" },
        "name": { "type": "string" }
      },
      "required": ["id","name"],
      "additionalProperties": false
    },
    "teachingGroup": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "code": { "type": "string" },
        "sectionId": { "type": "string" },
        "studentGroup": { "type": "string" },
        "subjectId": { "type": "integer" },
        "level": { "type": "string" },
        "requiredMinutesPerWeek": { "type": "integer", "minimum": 0 },
        "lessonIds": { "type": "array", "items": { "type": "integer" } }
      },
      "required": ["id","sectionId","studentGroup","subjectId","level","requiredMinutesPerWeek"],
      "additionalProperties": false
    },
    "lessonBase": {
      "type": "object",
      "properties": {
        "id": { "type": "integer" },
        "code": { "type": "string" },
        "subject": { "type": "string" },
        "studentGroup": { "type": "string" },
        "teachingGroupId": { "anyOf": [ { "type": "integer" }, { "type": "null" } ] },
        "sectionId": { "anyOf": [ { "type": "string" }, { "type": "null" } ] },
        "subjectId": { "anyOf": [ { "type": "integer" }, { "type": "null" } ] },
        "level": { "type": "string" },
        "yearGroup": { "type": "string" },
        "studentIds": { "type": "array", "items": { "type": "string" } },
        "requiredCapacity": { "type": "integer", "minimum": 0 },
        "blockId": { "anyOf": [ { "type": "string" }, { "type": "null" } ] },
        "teacherId": { "anyOf": [ { "type": "integer" }, { "type": "null" } ] },
        "timeslotId": { "anyOf": [ { "type": "integer" }, { "type": "null" } ] },
        "roomId": { "anyOf": [ { "type": "integer" }, { "type": "null" } ] }
      },
      "required": ["id","subject","studentGroup","level","yearGroup","requiredCapacity"],
      "additionalProperties": false
    },
    "subjectRequirementBase": {
      "type": "object",
      "properties": {
        "studentGroup": { "type": "string" },
        "teachingGroupId": { "type": "integer" },
        "sectionId": { "type": "string" },
        "subject": { "type": "string" },
        "minutesPerWeek": { "type": "integer", "minimum": 0 }
      },
      "required": ["subject","minutesPerWeek"],
      "additionalProperties": false
    },
    "studentSubjectChoice": {
      "type": "object",
      "properties": {
        "studentId": { "type": "string" },
        "subjectId": { "type": "string" },
        "subject": { "type": "string" },
        "level": { "type": "string", "enum": ["HL","SL"] },
        "yearGroup": { "type": "string" }
      },
      "required": ["studentId","subject","level","yearGroup"],
      "additionalProperties": false
    },
    "constraints": {
      "type": "object",
      "properties": {
        "hard": {
          "type": "object",
          "properties": {
            "spreadAcrossDaysPerTeachingGroupSection": { "type": "boolean" },
            "avoidSamePeriodRepetition": { "type": "boolean" },
            "avoidTeacherLatePeriods": { "type": "boolean" },
            "respectTeacherUnavailability": { "type": "boolean" },
            "enforceRoomCapacity": { "type": "boolean" }
          },
          "additionalProperties": false
        },
        "soft": {
          "type": "object",
          "properties": {
            "teacherPreferredDaysWeight": { "type": "number" },
            "teacherAvoidDaysWeight": { "type": "number" },
            "minimizeGapsWeight": { "type": "number" },
            "balanceLoadWeight": { "type": "number" },
            "morningPreferenceWeight": { "type": "number" },
            "afternoonPreferenceWeight": { "type": "number" },
            "maxConsecutivePeriods": { "type": "integer", "minimum": 1 }
          },
          "additionalProperties": true
        }
      },
      "additionalProperties": false
    },
    "basePayload": {
      "type": "object",
      "properties": {
        "schoolId": { "type": "string" },
        "timezone": { "type": "string" },
        "calendar": { "$ref": "#/$defs/calendar" },
        "scheduleVersion": { "type": "string" },
        "scheduleVersionId": { "type": "string" },
        "scheduleSettings": { "$ref": "#/$defs/scheduleSettings" },
        "rooms": { "type": "array", "items": { "$ref": "#/$defs/room" } },
        "teachers": { "type": "array", "items": { "$ref": "#/$defs/teacher" } },
        "subjects": { "type": "array", "items": { "$ref": "#/$defs/subject" } },
        "teachingGroups": { "type": "array", "items": { "$ref": "#/$defs/teachingGroup" } },
        "lessons": { "type": "array", "items": { "$ref": "#/$defs/lessonBase" } },
        "subjectRequirements": { "type": "array", "items": { "$ref": "#/$defs/subjectRequirementBase" } },
        "constraints": { "$ref": "#/$defs/constraints" },
        "blockedSlotIds": { "type": "array", "items": { "type": "integer" } },
        "randomSeed": { "type": "integer" },
        "randomizeSearch": { "type": "boolean" },
        "numSearchWorkers": { "type": "integer", "minimum": 1 },
        "shuffleInputOrder": { "type": "boolean" }
      },
      "required": ["schoolId","scheduleVersionId","scheduleSettings","rooms","teachers","subjects"],
      "additionalProperties": false
    }
  }
}