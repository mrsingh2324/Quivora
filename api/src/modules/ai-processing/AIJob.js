const mongoose = require("mongoose");

const aiJobSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UploadedDocument",
      default: null,
    },
    inputText: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    questionCount: {
      type: Number,
      min: 1,
      max: 100,
      default: 5,
    },
    status: {
      type: String,
      enum: [
        "uploaded",
        "parsing",
        "classified",
        "question_extraction",
        "generation",
        "validation",
        "awaiting_admin_confirmation",
        "approved",
        "failed",
      ],
      default: "uploaded",
    },
    containsQuestions: {
      type: Boolean,
      default: null,
    },
    resultQuestions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    errorMessage: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AIJob", aiJobSchema);
