{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/individual-payload.schema.json",
  "title": "Individual Payload Schema (DP)",
  "description": "For programs where student schedules and subject choices vary significantly.",
  "allOf": [
    { "$ref": "./common.schema.json#/$defs/basePayload" },
    {
      "type": "object",
      "properties": {
        "payloadType": { "const": "individual_payload" },
        "programType": { "const": "DP" },
        "lessons": {
          "type": "array",
          "items": {
            "allOf": [
              { "$ref": "./common.schema.json#/$defs/lessonBase" },
              {
                "anyOf": [
                  { "required": ["studentIds"] },
                  { "required": ["teachingGroupId"] },
                  { "required": ["sectionId"] }
                ]
              }
            ]
          }
        },
        "subjectRequirements": {
          "type": "array",
          "items": {
            "allOf": [
              { "$ref": "./common.schema.json#/$defs/subjectRequirementBase" },
              {
                "anyOf": [
                  { "required": ["studentGroup"] },
                  { "required": ["teachingGroupId"] },
                  { "required": ["sectionId"] }
                ]
              }
            ]
          }
        },
        "studentSubjectChoices": {
          "type": "array",
          "minItems": 1,
          "items": { "$ref": "./common.schema.json#/$defs/studentSubjectChoice" }
        }
      },
      "required": ["payloadType", "programType", "studentSubjectChoices"]
    }
  ]
}