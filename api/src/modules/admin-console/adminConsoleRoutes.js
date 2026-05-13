const express = require("express");

const Attempt = require("../answers/Attempt");
const UploadedDocument = require("../documents/UploadedDocument");
const LiveSession = require("../live-sessions/LiveSession");
const Quiz = require("../quiz-publishing/Quiz");
const SupportRequest = require("../support/SupportRequest");
const User = require("../participants/User");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

async function getSummary(req, res, next) {
  try {
    const userId = req.user.userId;
    const quizzes = await Quiz.find({ createdBy: userId }).select("_id status totalQuestions updatedAt");
    const quizIds = quizzes.map((quiz) => quiz._id);

    const [
      attempts,
      sessions,
      documents,
      supportRequests,
      users,
    ] = await Promise.all([
      Attempt.countDocuments({ quiz: { $in: quizIds } }),
      LiveSession.find({ quiz: { $in: quizIds } }).select("status createdAt").sort({ createdAt: -1 }).limit(8),
      UploadedDocument.countDocuments({ admin: userId }),
      SupportRequest.find({}).populate("requester", "name email").sort({ updatedAt: -1 }).limit(8),
      User.countDocuments({ role: { $in: ["admin", "admin_player"] } }),
    ]);

    const draftCount = quizzes.filter((quiz) => quiz.status === "draft").length;
    const publishedCount = quizzes.filter((quiz) => quiz.status === "published").length;
    const activeSessionCount = sessions.filter((session) =>
      ["waiting_for_players", "question_live", "answers_loading", "answer_summary"].includes(session.status)
    ).length;

    return res.status(200).json({
      stats: {
        quizzes: quizzes.length,
        drafts: draftCount,
        published: publishedCount,
        questions: quizzes.reduce((total, quiz) => total + (quiz.totalQuestions || 0), 0),
        attempts,
        sessions: sessions.length,
        activeSessions: activeSessionCount,
        uploadedDocuments: documents,
        supportRequests: supportRequests.length,
        admins: users,
      },
      recentSessions: sessions.map((session) => ({
        id: String(session._id),
        status: session.status,
        createdAt: session.createdAt,
      })),
      recentSupportRequests: supportRequests.map((request) => ({
        id: String(request._id),
        subject: request.subject,
        category: request.category,
        status: request.status,
        requester: request.requester?.name || request.requester?.email || "User",
        updatedAt: request.updatedAt,
      })),
      readiness: [
        { label: "Published quizzes", ok: publishedCount > 0 },
        { label: "Live sessions tested", ok: sessions.length > 0 },
        { label: "Reports have attempts", ok: attempts > 0 },
        { label: "Support queue reviewed", ok: supportRequests.filter((item) => item.status === "open").length === 0 },
      ],
    });
  } catch (error) {
    return next(error);
  }
}

router.get("/summary", requireAdmin, getSummary);
router.get("/stats", requireAdmin, getSummary);

module.exports = router;
