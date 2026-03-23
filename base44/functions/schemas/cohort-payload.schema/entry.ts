{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/cohort-payload.schema.json",
  "title": "Cohort Payload Schema (PYP/MYP)",
  "description": "For programs where most students in a cohort follow the same lessons.",
  "allOf": [
    { "$ref": "./common.schema.json#/$defs/basePayload" },
    {
      "type": "object",
      "properties": {
        "payloadType": { "const": "cohort_payload" },
        "programType": { "enum": ["PYP", "MYP"] },
        "lessons": {
          "type": "array",
          "items": {
            "allOf": [
              { "$ref": "./common.schema.json#/$defs/lessonBase" },
              { "not": { "required": ["studentIds"] } }
            ]
          }
        },
        "subjectRequirements": {
          "type": "array",
          "items": {
            "allOf": [
              { "$ref": "./common.schema.json#/$defs/subjectRequirementBase" },
              { "required": ["studentGroup"] }
            ]
          }
        }
      },
      "required": ["payloadType", "programType"]
    }
  ]
}