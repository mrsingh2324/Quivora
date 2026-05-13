const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["note", "link", "document"],
      default: "note",
    },
    body: {
      type: String,
      trim: true,
      default: "",
      maxlength: 5000,
    },
    url: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    audience: {
      type: String,
      enum: ["public", "workspace"],
      default: "public",
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    tags: {
      type: [String],
      default: [],
    },
    materials: {
      type: [materialSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "published",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Assignment", assignmentSchema);
