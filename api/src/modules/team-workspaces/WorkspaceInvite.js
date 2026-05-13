const mongoose = require("mongoose");

const workspaceInviteSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    role: { type: String, enum: ["admin", "editor", "viewer"], default: "viewer" },
    token: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending", index: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkspaceInvite", workspaceInviteSchema);
