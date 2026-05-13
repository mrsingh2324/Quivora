const express = require("express");

const {
  advanceLiveSession,
  createLiveSession,
  endLiveSession,
  getLiveSessionById,
  getQuizLaunchHistory,
  getQuizReport,
  listLiveSessions,
  launchQuizAgain,
  exportQuizReportCsv,
  getSessionQrCode,
  getSessionLeaderboard,
  getSessionReport,
  startLiveSession,
} = require("./liveSessionController");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

router.post("/", requireAdmin, createLiveSession);
router.get("/", requireAdmin, listLiveSessions);
router.get("/quizzes/:quizId/history", requireAdmin, getQuizLaunchHistory);
router.get("/quizzes/:quizId/report", requireAdmin, getQuizReport);
router.get("/quizzes/:quizId/report.csv", requireAdmin, exportQuizReportCsv);
router.post("/quizzes/:quizId/launch-again", requireAdmin, launchQuizAgain);
router.get("/:sessionId", requireAdmin, getLiveSessionById);
router.post("/:sessionId/start", requireAdmin, startLiveSession);
router.post("/:sessionId/advance", requireAdmin, advanceLiveSession);
router.post("/:sessionId/end", requireAdmin, endLiveSession);
router.get("/:sessionId/leaderboard", requireAdmin, getSessionLeaderboard);
router.get("/:sessionId/report", requireAdmin, getSessionReport);
router.get("/:sessionId/qr", requireAdmin, getSessionQrCode);

module.exports = router;
