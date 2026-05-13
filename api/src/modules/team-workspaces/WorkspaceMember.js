const mongoose = require("mongoose");

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "editor", "viewer"], default: "viewer", index: true },
    status: { type: String, enum: ["active", "removed"], default: "active", index: true },
  },
  { timestamps: true }
);

workspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("WorkspaceMember", workspaceMemberSchema);
