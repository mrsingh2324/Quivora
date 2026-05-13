const mongoose = require("mongoose");

const integrationConnectionSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["google_sheets", "google_drive", "email", "webhook"], required: true, index: true },
    status: { type: String, enum: ["connected", "needs_setup", "error", "disabled"], default: "needs_setup", index: true },
    config: { type: Object, default: {} },
    lastError: { type: String, trim: true, default: "" },
    connectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

integrationConnectionSchema.index({ owner: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model("IntegrationConnection", integrationConnectionSchema);
