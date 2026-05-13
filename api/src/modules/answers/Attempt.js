const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOptionIndex: {
      type: Number,
      required: true,
      min: 0,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    points: {
      type: Number,
      default: 0,
    },
    responseTimeMs: {
      type: Number,
      default: null,
    },
    speedBonus: {
      type: Number,
      default: 0,
    },
    streakBonus: {
      type: Number,
      default: 0,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const attemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
      index: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LiveSession",
      default: null,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    answers: {
      type: [answerSchema],
      default: [],
    },
    score: {
      type: Number,
      default: 0,
    },
    cheatingSignals: {
      type: [
        {
          type: {
            type: String,
            enum: ["tab_away", "fast_answer", "duplicate_connection"],
            required: true,
          },
          timestamp: {
            type: Date,
            default: Date.now,
          },
          meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
          },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["joined", "in_progress", "completed"],
      default: "joined",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

attemptSchema.index({ quiz: 1, score: -1, updatedAt: 1 });
attemptSchema.index({ session: 1, score: -1, updatedAt: 1 });
attemptSchema.index({ user: 1, quiz: 1 });

module.exports = mongoose.model("Attempt", attemptSchema);
