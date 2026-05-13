const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    questionType: {
      type: String,
      enum: ["multiple_choice"],
      default: "multiple_choice",
    },
    options: {
      type: [String],
      required: true,
      validate: {
        validator(value) {
          return (
            Array.isArray(value) &&
            value.length === 4 &&
            value.every((option) => typeof option === "string" && option.trim())
          );
        },
        message: "A multiple-choice question must have exactly four non-empty options",
      },
    },
    correctOptionIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3,
    },
    sourceType: {
      type: String,
      enum: ["manual", "document", "ai_generated"],
      default: "manual",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    explanation: {
      type: String,
      trim: true,
    },
    reusable: {
      type: Boolean,
      default: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    avgCorrectRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    sessions: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "LiveSession",
      default: [],
    },
    qualityScore: {
      type: Number,
      default: 70,
      min: 0,
      max: 100,
    },
    qualityNotes: {
      type: [String],
      default: [],
    },
    qualityMeta: {
      clarity: {
        type: Number,
        min: 0,
        max: 10,
        default: 7,
      },
      blooms: {
        type: String,
        enum: ["remember", "understand", "apply", "analyze"],
        default: "understand",
      },
      ambiguityRisk: {
        type: String,
        enum: ["low", "medium", "high"],
        default: "medium",
      },
      difficulty: {
        type: String,
        enum: ["easy", "medium", "hard"],
        default: "medium",
      },
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ prompt: "text", explanation: "text", tags: "text" });

module.exports = mongoose.model("Question", questionSchema);
