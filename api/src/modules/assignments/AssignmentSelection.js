const mongoose = require("mongoose");

const assignmentSelectionSchema = new mongoose.Schema(
  {
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: true,
      index: true,
    },
    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["selected", "in_progress", "completed"],
      default: "selected",
      index: true,
    },
    progressPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    selectedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

assignmentSelectionSchema.index({ assignment: 1, learner: 1 }, { unique: true });

module.exports = mongoose.model("AssignmentSelection", assignmentSelectionSchema);
