const inputClassificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    containsQuestions: {
      type: "boolean",
    },
    detectedInputType: {
      type: "string",
      enum: ["question_set", "topic_or_study_material"],
    },
    title: {
      type: "string",
    },
  },
  required: ["containsQuestions", "detectedInputType", "title"],
};

const summarySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    topicSummary: {
      type: "string",
    },
  },
  required: ["topicSummary"],
};

const conceptsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    keyConcepts: {
      type: "array",
      items: {
        type: "string",
      },
    },
  },
  required: ["keyConcepts"],
};

const questionDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          answer: { type: "string" },
          explanation: { type: "string" },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
          },
        },
        required: ["prompt", "answer", "explanation", "difficulty"],
      },
    },
  },
  required: ["questions"],
};

const mcqSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          options: {
            type: "array",
            items: { type: "string" },
            minItems: 4,
            maxItems: 4,
          },
          correctOptionIndex: { type: "integer" },
          difficulty: {
            type: "string",
            enum: ["easy", "medium", "hard"],
          },
          explanation: { type: "string" },
        },
        required: [
          "prompt",
          "options",
          "correctOptionIndex",
          "difficulty",
          "explanation",
        ],
      },
    },
  },
  required: ["questions"],
};

module.exports = {
  conceptsSchema,
  inputClassificationSchema,
  mcqSchema,
  questionDraftSchema,
  summarySchema,
};
