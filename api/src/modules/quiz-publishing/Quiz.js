const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "general",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
        required: true,
      },
    ],
    joinCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 6,
      maxlength: 6,
    },
    status: {
      type: String,
      enum: ["draft", "published", "closed"],
      default: "draft",
      index: true,
    },
    questionTimeLimitSeconds: {
      type: Number,
      min: 5,
      max: 120,
      default: 30,
    },
    resultsWindowSeconds: {
      type: Number,
      min: 1,
      max: 30,
      default: 5,
    },
    adaptiveMode: {
      type: Boolean,
      default: false,
    },
    randomizeQuestions: {
      type: Boolean,
      default: false,
    },
    randomizeOptions: {
      type: Boolean,
      default: false,
    },
    mode: {
      type: String,
      enum: ["live", "async"],
      default: "live",
      index: true,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    theme: {
      preset: {
        type: String,
        default: "aurora",
      },
      primaryColor: {
        type: String,
        default: "#2563eb",
      },
      accentColor: {
        type: String,
        default: "#f59e0b",
      },
      backgroundColor: {
        type: String,
        default: "#0f172a",
      },
      fontFamily: {
        type: String,
        default: "Inter",
      },
      logoText: {
        type: String,
        default: "Quivora Live",
      },
      coverImageUrl: {
        type: String,
        default: "",
      },
      playerStyle: {
        type: String,
        enum: ["focus", "vibrant", "calm"],
        default: "vibrant",
      },
    },
    sharing: {
      visibility: {
        type: String,
        enum: ["public", "private"],
        default: "public",
      },
      accessPassword: {
        type: String,
        trim: true,
        default: "",
      },
      availableFrom: {
        type: Date,
        default: null,
      },
      availableUntil: {
        type: Date,
        default: null,
      },
      maxParticipants: {
        type: Number,
        min: 0,
        default: 0,
      },
      reusableLink: {
        type: Boolean,
        default: true,
      },
      customSlug: {
        type: String,
        trim: true,
        lowercase: true,
        sparse: true,
      },
      embedEnabled: {
        type: Boolean,
        default: true,
      },
    },
    integrations: {
      googleSheetsEnabled: {
        type: Boolean,
        default: true,
      },
      googleDriveImportUrl: {
        type: String,
        trim: true,
        default: "",
      },
      webhookUrl: {
        type: String,
        trim: true,
        default: "",
      },
      notificationEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: "",
      },
    },
    isDefaultLibrary: {
      type: Boolean,
      default: false,
      index: true,
    },
    libraryKey: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

quizSchema.index({ createdBy: 1, updatedAt: -1 });
quizSchema.index({ status: 1, updatedAt: -1 });
quizSchema.index({ title: "text", description: "text", category: "text" });

module.exports = mongoose.model("Quiz", quizSchema);
