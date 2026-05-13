const mongoose = require("mongoose");

const supportArticleSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "general", index: true },
    body: { type: String, required: true, trim: true },
    tags: { type: [String], default: [], index: true },
    status: { type: String, enum: ["draft", "published"], default: "published", index: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

supportArticleSchema.index({ title: "text", body: "text", tags: "text" });

module.exports = mongoose.model("SupportArticle", supportArticleSchema);
