const quizAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    containsQuestions: {
      type: "boolean",
    },
    action: {
      type: "string",
      enum: ["parsed", "generated", "needs_preferences"],
    },
    detectedInputType: {
      type: "string",
      enum: ["question_set", "topic_or_study_material"],
    },
    title: {
      type: "string",
    },
    topicSummary: {
      type: "string",
    },
    keyConcepts: {
      type: "array",
      items: {
        type: "string",
      },
    },
    preferencesNeeded: {
      type: "boolean",
    },
    preferencePrompt: {
      type: "string",
    },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: {
            type: "string",
          },
          options: {
            type: "array",
            items: {
              type: "string",
            },
            minItems: 4,
            maxItems: 4,
          },
          correctOptionIndex: {
            type: "integer",
          },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
          },
          explanation: {
            type: "string",
          }
        },
        required: [
          "prompt",
          "options",
          "correctOptionIndex",
          "difficulty",
          "explanation"
        ]
      }
    }
  },
  required: [
    "containsQuestions",
    "action",
    "detectedInputType",
    "title",
    "topicSummary",
    "keyConcepts",
    "preferencesNeeded",
    "preferencePrompt",
    "questions"
  ]
};

module.exports = quizAnalysisSchema;
