const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
    approvalsEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workspace", workspaceSchema);
