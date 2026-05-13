const cors = require("cors");
const axios = require("axios");
const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");

const { configurePassport } = require("./modules/auth/passportConfig");
const adminConsoleRoutes = require("./modules/admin-console/adminConsoleRoutes");
const analyticsRoutes = require("./modules/analytics/analyticsRoutes");
const authRoutes = require("./modules/auth/authRoutes");
const aiJobRoutes = require("./modules/ai-processing/aiJobRoutes");
const assignmentRoutes = require("./modules/assignments/assignmentRoutes");
const attemptRoutes = require("./modules/answers/attemptRoutes");
const documentRoutes = require("./modules/documents/documentRoutes");
const integrationRoutes = require("./modules/integrations/integrationRoutes");
const liveSessionRoutes = require("./modules/live-sessions/liveSessionRoutes");
const userRoutes = require("./modules/participants/userRoutes");
const questionBankRoutes = require("./modules/question-bank/questionBankRoutes");
const quizDraftRoutes = require("./modules/quiz-drafts/quizDraftRoutes");
const quizRoutes = require("./modules/quiz-publishing/quizRoutes");
const searchRoutes = require("./modules/search/searchRoutes");
const supportRoutes = require("./modules/support/supportRoutes");
const teamWorkspaceRoutes = require("./modules/team-workspaces/teamWorkspaceRoutes");
const workspaceAssistantRoutes = require("./modules/workspace-assistant/workspaceAssistantRoutes");
const { globalLimiter } = require("./middleware/rateLimiter");

configurePassport();

const app = express();

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      const configuredOrigins = (process.env.CLIENT_URL || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      const allowedOrigins = configuredOrigins.length
        ? configuredOrigins
        : defaultAllowedOrigins;

      if (allowedOrigins.includes("*") || !origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(passport.initialize());
app.use(globalLimiter);
app.use((req, res, next) => {
  req.setTimeout(60_000);
  res.setTimeout(65_000);
  next();
});

app.get("/health", async (_req, res) => {
  let dbOk = mongoose.connection.readyState === 1;
  let aiOk = false;

  if (dbOk) {
    try {
      await mongoose.connection.db.admin().ping();
    } catch {
      dbOk = false;
    }
  }

  if (process.env.AI_SERVICE_URL) {
    try {
      const aiBase = process.env.AI_SERVICE_URL.replace(/\/api\/ai\/analyze.*$/, "");
      await axios.get(`${aiBase}/health`, { timeout: 1500 });
      aiOk = true;
    } catch {
      aiOk = false;
    }
  }

  const ok = dbOk && (aiOk || !process.env.AI_SERVICE_URL);
  res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    checks: {
      database: dbOk ? "ok" : "down",
      aiService: aiOk ? "ok" : "unavailable",
      env: {
        mongodb: Boolean(process.env.MONGODB_URI),
        jwtSecret: Boolean(process.env.JWT_SECRET),
        aiServiceUrl: Boolean(process.env.AI_SERVICE_URL),
        emailProvider: Boolean(process.env.EMAIL_PROVIDER_URL),
      },
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin-console", adminConsoleRoutes);
app.use("/api/admin", adminConsoleRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/question-bank", questionBankRoutes);
app.use("/api/quiz-drafts", quizDraftRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/attempts", attemptRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/integrations", integrationRoutes);
app.use("/api/ai-jobs", aiJobRoutes);
app.use("/api/live-sessions", liveSessionRoutes);
app.use("/api/support-requests", supportRoutes);
app.use("/api/team-workspaces", teamWorkspaceRoutes);
app.use("/api/workspace-assistant", workspaceAssistantRoutes);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    code: err.code || "API_ERROR",
    message: err.message || "Internal server error",
    details: err.details || null,
    provider: err.provider || null,
  });
});

module.exports = app;
