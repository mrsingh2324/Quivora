const express = require("express");

const {
  createQuiz,
  createQuizFromTopic,
  deleteQuestion,
  aiEditQuiz,
  getQuizById,
  getQuizLeaderboard,
  getAsyncAttemptState,
  joinQuiz,
  listQuizzes,
  publishQuiz,
  submitAsyncAnswer,
  updateQuestion,
  updateQuizSettings,
  updateQuizStatus,
} = require("./quizController");
const { requireAdmin } = require("../../middleware/auth");
const { aiLimiter } = require("../../middleware/rateLimiter");

const router = express.Router();

router.get("/", requireAdmin, listQuizzes);
router.post("/", requireAdmin, createQuiz);
router.post("/generate-from-topic", requireAdmin, aiLimiter, createQuizFromTopic);
router.get("/:quizId", getQuizById);
router.get("/:quizId/leaderboard", getQuizLeaderboard);
router.get("/:quizId/async-attempts/:attemptId", getAsyncAttemptState);
router.post("/:quizId/async-submit", submitAsyncAnswer);
router.post("/:quizId/publish", requireAdmin, publishQuiz);
router.patch("/:quizId", requireAdmin, updateQuizSettings);
router.patch("/:quizId/status", requireAdmin, updateQuizStatus);
router.patch("/:quizId/questions/:questionId", requireAdmin, updateQuestion);
router.delete("/:quizId/questions/:questionId", requireAdmin, deleteQuestion);
router.post("/:quizId/ai-edit", requireAdmin, aiLimiter, aiEditQuiz);
// Participants join without auth — they only need the join code
router.post("/:joinCode/join", joinQuiz);

module.exports = router;
