const mongoose = require("mongoose");

const integrationDeliveryLogSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, required: true, index: true },
    event: { type: String, required: true, index: true },
    target: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["pending", "delivered", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    requestPayload: { type: Object, default: {} },
    responseStatus: { type: Number, default: 0 },
    responseBody: { type: String, trim: true, default: "" },
    error: { type: String, trim: true, default: "" },
    nextRetryAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IntegrationDeliveryLog", integrationDeliveryLogSchema);
