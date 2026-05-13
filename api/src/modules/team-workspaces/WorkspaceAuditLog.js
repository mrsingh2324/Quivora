const mongoose = require("mongoose");

const workspaceAuditLogSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true, trim: true, index: true },
    targetType: { type: String, trim: true, default: "" },
    targetId: { type: String, trim: true, default: "" },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkspaceAuditLog", workspaceAuditLogSchema);
