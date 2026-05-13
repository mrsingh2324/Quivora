const mongoose = require("mongoose");

const uploadedDocumentSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
    },
    mimeType: {
      type: String,
      trim: true,
      default: "",
    },
    sourceType: {
      type: String,
      enum: ["upload", "topic"],
      default: "upload",
    },
    rawText: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "parsing", "classified", "processed", "failed"],
      default: "uploaded",
    },
    containsQuestions: {
      type: Boolean,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("UploadedDocument", uploadedDocumentSchema);
