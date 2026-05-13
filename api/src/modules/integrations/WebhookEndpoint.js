const mongoose = require("mongoose");

const webhookEndpointSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, required: true, trim: true },
    events: { type: [String], default: ["quiz.launched", "report.generated"] },
    secret: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "disabled"], default: "active", index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("WebhookEndpoint", webhookEndpointSchema);
