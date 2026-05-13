const mongoose = require("mongoose");

const workspaceFolderSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, default: "", maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    quizIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Quiz" }],
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkspaceFolder", workspaceFolderSchema);
