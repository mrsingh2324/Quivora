const mongoose = require("mongoose");

const quizApprovalSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz", required: true, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    comments: { type: String, trim: true, default: "", maxlength: 2000 },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("QuizApproval", quizApprovalSchema);
