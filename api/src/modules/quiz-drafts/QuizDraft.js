const mongoose = require("mongoose");

const quizDraftSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "Untitled draft",
    },
    sourceType: {
      type: String,
      enum: ["topic", "materials", "template"],
      default: "topic",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
    promotedQuiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      default: null,
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

quizDraftSchema.index({ owner: 1, updatedAt: -1 });

module.exports = mongoose.model("QuizDraft", quizDraftSchema);
