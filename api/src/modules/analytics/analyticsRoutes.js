const express = require("express");

const Attempt = require("../answers/Attempt");
const LiveSession = require("../live-sessions/LiveSession");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

router.get("/sessions/:sessionId/ai-summary", requireAdmin, async (req, res, next) => {
  try {
    const session = await LiveSession.findById(req.params.sessionId).populate("quiz");
    if (!session) return res.status(404).json({ message: "Session not found" });
    if (String(session.host) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You can only summarize sessions you hosted" });
    }

    const attempts = await Attempt.find({ session: session._id })
      .populate("user", "name email")
      .populate("answers.question", "prompt difficulty");
    const completed = attempts.filter((attempt) => attempt.status === "completed").length;
    const averageScore = attempts.length
      ? Math.round(attempts.reduce((total, attempt) => total + (attempt.score || 0), 0) / attempts.length)
      : 0;
    const questionStats = new Map();

    attempts.forEach((attempt) => {
      (attempt.answers || []).forEach((answer) => {
        const question = answer.question;
        const questionId = String(question?._id || answer.question);
        const stat = questionStats.get(questionId) || {
          prompt: question?.prompt || "Question",
          attempts: 0,
          correct: 0,
        };
        stat.attempts += 1;
        if (answer.isCorrect) stat.correct += 1;
        questionStats.set(questionId, stat);
      });
    });

    const hardest = [...questionStats.values()]
      .filter((stat) => stat.attempts > 0)
      .map((stat) => ({
        ...stat,
        accuracy: Math.round((stat.correct / stat.attempts) * 100),
      }))
      .sort((a, b) => a.accuracy - b.accuracy)[0];
    const recommendedTopic = hardest?.prompt
      ? hardest.prompt.replace(/[?.!]/g, "").split(/\s+/).slice(0, 6).join(" ")
      : session.quiz?.category || "core concepts";

    const summary = attempts.length
      ? [
          `${attempts.length} participant${attempts.length === 1 ? "" : "s"} joined and ${completed} completed the session.`,
          `The average score was ${averageScore} points.`,
          hardest
            ? `The hardest question was "${hardest.prompt}" at ${hardest.accuracy}% accuracy.`
            : "No question-level answer data is available yet.",
          `Recommended follow-up topic: ${recommendedTopic}.`,
        ].join(" ")
      : "No participant attempts exist yet. Launch the quiz and collect answers before generating report insights.";

    return res.status(200).json({
      sessionId: String(session._id),
      quizTitle: session.quiz?.title || "",
      summary,
      recommendedTopic,
      stats: {
        attempts: attempts.length,
        completed,
        averageScore,
        hardestQuestion: hardest || null,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
