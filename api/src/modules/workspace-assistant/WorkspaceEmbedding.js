const mongoose = require("mongoose");

const workspaceEmbeddingSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ["quiz", "document", "report", "session", "support"],
      required: true,
      index: true,
    },
    sourceId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    text: {
      type: String,
      required: true,
    },
    route: {
      type: String,
      trim: true,
      default: "",
    },
    tokens: {
      type: [String],
      default: [],
      index: true,
    },
    vector: {
      type: [Number],
      default: [],
    },
  },
  { timestamps: true }
);

workspaceEmbeddingSchema.index({ owner: 1, sourceType: 1, sourceId: 1 }, { unique: true });
workspaceEmbeddingSchema.index({ title: "text", text: "text", tokens: "text" });

module.exports = mongoose.model("WorkspaceEmbedding", workspaceEmbeddingSchema);
