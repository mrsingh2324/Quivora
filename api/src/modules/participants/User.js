const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["admin", "admin_player", "participant"],
      default: "participant",
    },
    avatar: {
      type: String,
      trim: true,
      default: "",
    },
    passwordHash: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      sparse: true,
      default: null,
    },
    githubId: {
      type: String,
      sparse: true,
      default: null,
    },
    authProvider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    adminAccessGrantedAt: {
      type: Date,
      default: null,
    },
    adminAccessCodeUsed: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, updatedAt: -1 });

module.exports = mongoose.model("User", userSchema);
