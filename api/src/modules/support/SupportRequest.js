const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    url: { type: String, trim: true, default: "" },
  },
  { _id: true, timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    attachments: { type: [attachmentSchema], default: [] },
  },
  { _id: true, timestamps: true }
);

const supportRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["account", "bug", "quiz_issue", "report_issue", "live_session_issue", "integration_issue", "other"],
      default: "other",
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    status: {
      type: String,
      enum: ["open", "in_review", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["normal", "high"],
      default: "normal",
    },
    adminNote: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportRequest", supportRequestSchema);
