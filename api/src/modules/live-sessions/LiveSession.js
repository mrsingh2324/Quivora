const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    joinCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "waiting_for_players",
        "question_live",
        "answers_loading",
        "answer_summary",
        "final_results",
        "closed",
      ],
      default: "waiting_for_players",
      index: true,
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    participantCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    // Epoch ms when the current question timer started — used for restart recovery
    questionStartedAt: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

liveSessionSchema.index({ host: 1, createdAt: -1 });
liveSessionSchema.index({ joinCode: 1, status: 1 });
liveSessionSchema.index({ quiz: 1, createdAt: -1 });

module.exports = mongoose.model("LiveSession", liveSessionSchema);
