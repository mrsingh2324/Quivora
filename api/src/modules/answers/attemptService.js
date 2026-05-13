const Attempt = require("./Attempt");
const Question = require("../question-bank/Question");
const {
  calculateAnswerPoints,
  calculateCurrentStreak,
  calculateTotalScore,
} = require("../scoring/scoringService");

function calculateScore(answers) {
  return calculateTotalScore(answers);
}

async function submitAttemptAnswer({
  attemptId,
  questionId,
  selectedOptionIndex,
  responseTimeMs = null,
  timeLimitSeconds = 30,
}) {
  const [attempt, question] = await Promise.all([
    Attempt.findById(attemptId),
    Question.findById(questionId),
  ]);

  if (!attempt) {
    const error = new Error("Attempt not found");
    error.statusCode = 404;
    throw error;
  }

  if (!question) {
    const error = new Error("Question not found");
    error.statusCode = 404;
    throw error;
  }

  const isCorrect = question.correctOptionIndex === selectedOptionIndex;
  const existingAnswerIndex = attempt.answers.findIndex(
    (answer) => String(answer.question) === String(questionId)
  );
  const existingAnswer = existingAnswerIndex >= 0 ? attempt.answers[existingAnswerIndex] : null;
  const streakCount = calculateCurrentStreak(
    existingAnswerIndex >= 0
      ? attempt.answers.filter((answer) => String(answer.question) !== String(questionId))
      : attempt.answers
  );
  const scoreMeta = calculateAnswerPoints({
    isCorrect,
    responseTimeMs,
    timeLimitSeconds,
    streakCount,
  });

  const answerPayload = {
    question: question._id,
    selectedOptionIndex,
    isCorrect,
    points: scoreMeta.points,
    responseTimeMs,
    speedBonus: scoreMeta.speedBonus,
    streakBonus: scoreMeta.streakBonus,
    answeredAt: new Date(),
  };

  if (existingAnswerIndex >= 0) {
    attempt.answers[existingAnswerIndex] = answerPayload;
  } else {
    attempt.answers.push(answerPayload);
  }

  if (
    !existingAnswer &&
    responseTimeMs !== null &&
    responseTimeMs !== undefined &&
    Number(responseTimeMs) >= 0 &&
    Number(responseTimeMs) < 1000
  ) {
    attempt.cheatingSignals.push({
      type: "fast_answer",
      timestamp: new Date(),
      meta: {
        questionId: String(question._id),
        responseTimeMs: Number(responseTimeMs),
      },
    });
  }

  attempt.status = "in_progress";
  attempt.score = calculateScore(attempt.answers);
  await attempt.save();

  return {
    attempt,
    question,
    isCorrect,
  };
}

async function recordCheatingSignal({ attemptId, type, meta = {} }) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    const error = new Error("Attempt not found");
    error.statusCode = 404;
    throw error;
  }

  attempt.cheatingSignals.push({
    type,
    timestamp: new Date(),
    meta,
  });
  await attempt.save();
  return attempt;
}

async function completeAttemptById(attemptId) {
  const attempt = await Attempt.findById(attemptId);

  if (!attempt) {
    const error = new Error("Attempt not found");
    error.statusCode = 404;
    throw error;
  }

  attempt.status = "completed";
  attempt.completedAt = new Date();
  attempt.score = calculateScore(attempt.answers);
  await attempt.save();

  return attempt;
}

async function getLeaderboardForQuiz(quizId) {
  const attempts = await Attempt.find({ quiz: quizId })
    .populate("user", "name")
    .sort({ score: -1, updatedAt: 1 });

  return attempts.map((attempt, index) => ({
    rank: index + 1,
    attemptId: attempt._id,
    participant: attempt.user ? attempt.user.name : "Unknown",
    score: attempt.score,
    status: attempt.status,
    completedAt: attempt.completedAt,
  }));
}

async function getLeaderboardForSession(sessionId) {
  const attempts = await Attempt.find({ session: sessionId })
    .populate("user", "name")
    .sort({ score: -1, updatedAt: 1 });

  return attempts.map((attempt, index) => ({
    rank: index + 1,
    attemptId: attempt._id,
    participant: attempt.user ? attempt.user.name : "Unknown",
    score: attempt.score,
    status: attempt.status,
    completedAt: attempt.completedAt,
  }));
}

module.exports = {
  calculateScore,
  submitAttemptAnswer,
  recordCheatingSignal,
  completeAttemptById,
  getLeaderboardForQuiz,
  getLeaderboardForSession,
};
