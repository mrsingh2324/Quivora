const Attempt = require("../answers/Attempt");
const QRCode = require("qrcode");
const { getLeaderboardForSession } = require("../answers/attemptService");
const {
  normalizeLeaderboardEntry,
  normalizeLiveSession,
} = require("../../utils/normalize");
const { dispatchQuizIntegrationEvent } = require("../../services/integrationService");
const Quiz = require("../quiz-publishing/Quiz");
const LiveSession = require("./LiveSession");
const generateJoinCode = require("../quiz-publishing/generateJoinCode");
const { startQuizSession } = require("./quizEngine");

async function generateUniqueJoinCode() {
  let joinCode = generateJoinCode();
  let existingQuiz = await Quiz.findOne({ joinCode });
  let existingSession = await LiveSession.findOne({ joinCode });

  while (existingQuiz || existingSession) {
    joinCode = generateJoinCode();
    existingQuiz = await Quiz.findOne({ joinCode });
    existingSession = await LiveSession.findOne({ joinCode });
  }

  return joinCode;
}

function hasValidMvpQuestions(quiz) {
  const questions = quiz.questions || [];

  return (
    questions.length > 0 &&
    questions.every(
      (question) =>
        question.questionType === "multiple_choice" &&
        question.prompt &&
        Array.isArray(question.options) &&
        question.options.length === 4 &&
        question.options.every((option) => String(option || "").trim()) &&
        question.correctOptionIndex >= 0 &&
        question.correctOptionIndex <= 3
    )
  );
}

async function createLiveSession(req, res, next) {
  try {
    const { quizId } = req.body;
    // hostId comes from the authenticated user's JWT; fall back to body for legacy clients
    const hostId = req.user?.userId || req.body.hostId;

    if (!quizId || !hostId) {
      return res.status(400).json({
        message: "quizId is required",
      });
    }

    const quiz = await Quiz.findById(quizId).populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (!quiz.isDefaultLibrary && String(quiz.createdBy) !== String(hostId)) {
      return res.status(403).json({ message: "You can only launch quizzes you created" });
    }

    if (!hasValidMvpQuestions(quiz)) {
      return res.status(400).json({
        message: "Launch requires at least one valid multiple-choice question with four options.",
      });
    }

    const joinCode = await generateUniqueJoinCode();
    quiz.joinCode = joinCode;
    quiz.status = "published";
    await quiz.save();

    const session = await LiveSession.create({
      quiz: quiz._id,
      host: hostId,
      joinCode,
      status: "waiting_for_players",
    });
    await dispatchQuizIntegrationEvent(quiz, "quiz.launched", {
      sessionId: String(session._id),
      joinCode: session.joinCode,
    });

    return res.status(201).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function getLiveSessionById(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId)
      .populate("quiz", "title joinCode totalQuestions")
      .populate("host", "name email");

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function listLiveSessions(req, res, next) {
  try {
    const hostId = req.user?.userId;
    const sessions = await LiveSession.find({
      host: hostId,
      status: { $in: ["waiting_for_players", "question_live", "answers_loading", "answer_summary"] },
    })
      .sort({ updatedAt: -1 })
      .populate("quiz", "title joinCode totalQuestions status")
      .populate("host", "name email");

    const sessionIds = sessions.map((session) => session._id);
    const attempts = await Attempt.find({ session: { $in: sessionIds } })
      .populate("user", "name email")
      .sort({ joinedAt: 1 });

    const attemptsBySession = attempts.reduce((map, attempt) => {
      const key = String(attempt.session);
      const current = map.get(key) || [];
      current.push({
        attemptId: String(attempt._id),
        name: attempt.user?.name || "Guest",
        score: attempt.score || 0,
        status: attempt.status,
        joinedAt: attempt.joinedAt,
      });
      map.set(key, current);
      return map;
    }, new Map());

    const playerBaseUrl = process.env.PLAYER_URL || "http://localhost:3001";

    const normalizedSessions = await Promise.all(
      sessions.map(async (session) => {
        const joinUrl = `${playerBaseUrl}/?code=${session.joinCode}`;
        const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
          width: 320,
          margin: 2,
        });

        return {
        ...normalizeLiveSession(session),
        quiz: session.quiz
          ? {
              id: String(session.quiz._id),
              title: session.quiz.title,
              joinCode: session.quiz.joinCode,
              totalQuestions: session.quiz.totalQuestions || 0,
              status: session.quiz.status,
            }
          : null,
        joinUrl,
        qrCodeDataUrl,
        participants: attemptsBySession.get(String(session._id)) || [],
        };
      })
    );

    return res.status(200).json(normalizedSessions);
  } catch (error) {
    return next(error);
  }
}

async function startLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId).populate({
      path: "quiz",
      populate: { path: "questions" },
    });

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    if (String(session.host) !== String(req.user?.userId)) {
      return res.status(403).json({ message: "Only the session host can start the quiz" });
    }

    if (session.status !== "waiting_for_players") {
      return res.status(400).json({ message: "This session has already started or ended" });
    }

    if (!hasValidMvpQuestions(session.quiz)) {
      return res.status(400).json({
        message: "Start requires at least one valid multiple-choice question with four options.",
      });
    }

    await startQuizSession(session.joinCode, req.user.userId);

    const updatedSession = await LiveSession.findById(session._id);

    return res.status(200).json(normalizeLiveSession(updatedSession || session));
  } catch (error) {
    return next(error);
  }
}

async function advanceLiveSession(req, res, next) {
  try {
    const { status } = req.body;
    const session = await LiveSession.findById(req.params.sessionId).populate(
      "quiz",
      "questions totalQuestions"
    );

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    if (status) {
      session.status = status;
    } else if (session.currentQuestionIndex + 1 >= session.quiz.totalQuestions) {
      session.status = "final_results";
    } else {
      session.currentQuestionIndex += 1;
      session.status = "question_live";
    }

    await session.save();

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function endLiveSession(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    if (String(session.host) !== String(req.user?.userId)) {
      return res.status(403).json({ message: "Only the session host can close the quiz" });
    }

    session.status = "closed";
    session.endedAt = new Date();
    await session.save();

    return res.status(200).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

async function getSessionLeaderboard(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    const leaderboard = await getLeaderboardForSession(session._id);

    return res
      .status(200)
      .json(leaderboard.map((entry, index) => normalizeLeaderboardEntry(entry, index + 1)));
  } catch (error) {
    return next(error);
  }
}

async function getQuizLaunchHistory(req, res, next) {
  try {
    const sessions = await LiveSession.find({ quiz: req.params.quizId })
      .sort({ createdAt: -1 })
      .limit(4)
      .populate("quiz", "title joinCode totalQuestions")
      .populate("host", "name email");

    const history = await Promise.all(
      sessions.map(async (session) => {
        const participants = await Attempt.find({ session: session._id })
          .populate("user", "name email")
          .sort({ score: -1, updatedAt: 1 });

        return {
          ...normalizeLiveSession(session),
          participants: participants.map((attempt, index) => ({
            rank: index + 1,
            attemptId: String(attempt._id),
            name: attempt.user?.name || "Unknown",
            email: attempt.user?.email || "",
            score: attempt.score || 0,
            status: attempt.status,
            answered: attempt.answers?.length || 0,
            joinedAt: attempt.joinedAt,
            completedAt: attempt.completedAt,
          })),
        };
      })
    );

    return res.status(200).json(history);
  } catch (error) {
    return next(error);
  }
}

async function launchQuizAgain(req, res, next) {
  try {
    const { hostId } = req.body;

    if (!hostId) {
      return res.status(400).json({ message: "hostId is required" });
    }

    const quiz = await Quiz.findById(req.params.quizId).populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (!quiz.isDefaultLibrary && String(quiz.createdBy) !== String(hostId)) {
      return res.status(403).json({ message: "You can only relaunch quizzes you created" });
    }

    if (!hasValidMvpQuestions(quiz)) {
      return res.status(400).json({
        message: "Launch requires at least one valid multiple-choice question with four options.",
      });
    }

    const joinCode = await generateUniqueJoinCode();
    quiz.joinCode = joinCode;
    quiz.status = "published";
    await quiz.save();

    const session = await LiveSession.create({
      quiz: quiz._id,
      host: hostId,
      joinCode,
      status: "waiting_for_players",
    });
    await dispatchQuizIntegrationEvent(quiz, "quiz.launched", {
      sessionId: String(session._id),
      joinCode,
    });

    return res.status(201).json(normalizeLiveSession(session));
  } catch (error) {
    return next(error);
  }
}

function csvEscape(value) {
  const stringValue = value === undefined || value === null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

async function buildQuizReport(quizId, options = {}) {
  const quiz = await Quiz.findById(quizId).populate("questions");

  if (!quiz) {
    const error = new Error("Quiz not found");
    error.statusCode = 404;
    throw error;
  }

  const attemptFilter = { quiz: quiz._id };
  if (options.sessionId) {
    attemptFilter.session = options.sessionId;
  }

  const attempts = await Attempt.find(attemptFilter)
    .populate("user", "name email")
    .populate("session", "joinCode createdAt startedAt endedAt status")
    .populate("answers.question");

  const questionStatsById = new Map(
    (quiz.questions || []).map((question) => [
      String(question._id),
      {
        questionId: String(question._id),
        prompt: question.prompt,
        correctOptionIndex: question.correctOptionIndex,
        attempts: 0,
        correct: 0,
        incorrect: 0,
        accuracy: 0,
      },
    ])
  );

  const participantRows = attempts.map((attempt) => {
    const answers = (attempt.answers || []).map((answer) => {
      const question = answer.question;
      const questionId = String(question?._id || answer.question);
      const stat = questionStatsById.get(questionId);

      if (stat) {
        stat.attempts += 1;
        if (answer.isCorrect) {
          stat.correct += 1;
        } else {
          stat.incorrect += 1;
        }
      }

      return {
        questionId,
        prompt: question?.prompt || "",
        selectedOptionIndex: answer.selectedOptionIndex,
        selectedOption: question?.options?.[answer.selectedOptionIndex] || "",
        correctOptionIndex: question?.correctOptionIndex ?? null,
        correctOption:
          question?.correctOptionIndex !== undefined
            ? question?.options?.[question.correctOptionIndex] || ""
            : "",
        isCorrect: answer.isCorrect,
        answeredAt: answer.answeredAt,
        points: answer.points || 0,
        responseTimeMs: answer.responseTimeMs ?? null,
        speedBonus: answer.speedBonus || 0,
        streakBonus: answer.streakBonus || 0,
      };
    });

    const durationSeconds =
      attempt.completedAt && attempt.joinedAt
        ? Math.max(0, Math.round((new Date(attempt.completedAt) - new Date(attempt.joinedAt)) / 1000))
        : null;

    return {
      attemptId: String(attempt._id),
      participant: attempt.user?.name || "Unknown",
      email: attempt.user?.email || "",
      score: attempt.score || 0,
      status: attempt.status,
      joinedAt: attempt.joinedAt,
      completedAt: attempt.completedAt,
      durationSeconds,
      answeredCount: answers.length,
      cheatingSignals: attempt.cheatingSignals || [],
      flagged: (attempt.cheatingSignals || []).length > 0,
      sessionId: attempt.session?._id ? String(attempt.session._id) : null,
      joinCode: attempt.session?.joinCode || "",
      answers,
    };
  });

  const questionStats = Array.from(questionStatsById.values()).map((stat) => ({
    ...stat,
    accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
  }));

  const averageScore =
    participantRows.length > 0
      ? Math.round(
          participantRows.reduce((total, participant) => total + participant.score, 0) /
            participantRows.length
        )
      : 0;

  const completedAttempts = participantRows.filter((participant) => participant.completedAt);
  const averageTimeSeconds =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce(
            (total, participant) => total + (participant.durationSeconds || 0),
            0
          ) / completedAttempts.length
        )
      : 0;

  const hardestQuestions = questionStats
    .filter((question) => question.attempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  return {
    quiz: {
      id: String(quiz._id),
      title: quiz.title,
      joinCode: quiz.joinCode,
      totalQuestions: quiz.questions?.length || 0,
    },
    session: options.session
      ? {
          id: String(options.session._id),
          joinCode: options.session.joinCode,
          status: options.session.status,
          createdAt: options.session.createdAt,
          startedAt: options.session.startedAt,
          endedAt: options.session.endedAt,
        }
      : null,
    summary: {
      attempts: participantRows.length,
      completed: participantRows.filter((participant) => participant.status === "completed").length,
      averageScore,
      averageTimeSeconds,
      totalQuestions: quiz.questions?.length || 0,
    },
    participants: participantRows,
    questionStats,
    hardestQuestions,
  };
}

async function getQuizReport(req, res, next) {
  try {
    const report = await buildQuizReport(req.params.quizId);
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
}

async function getSessionReport(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    if (String(session.host) !== String(req.user?.userId)) {
      return res.status(403).json({ message: "You can only view reports for sessions you hosted" });
    }

    const report = await buildQuizReport(session.quiz, {
      sessionId: session._id,
      session,
    });
    return res.status(200).json(report);
  } catch (error) {
    return next(error);
  }
}

async function exportQuizReportCsv(req, res, next) {
  try {
    const report = await buildQuizReport(req.params.quizId);
    const rows = [
      [
        "Participant",
        "Email",
        "Join Code",
        "Score",
        "Status",
        "Joined At",
        "Completed At",
        "Duration Seconds",
        "Question",
        "Selected Option",
        "Correct Option",
        "Correct",
        "Answered At",
      ],
    ];

    report.participants.forEach((participant) => {
      if (participant.answers.length === 0) {
        rows.push([
          participant.participant,
          participant.email,
          participant.joinCode,
          participant.score,
          participant.status,
          participant.joinedAt,
          participant.completedAt,
          participant.durationSeconds,
          "",
          "",
          "",
          "",
          "",
        ]);
        return;
      }

      participant.answers.forEach((answer) => {
        rows.push([
          participant.participant,
          participant.email,
          participant.joinCode,
          participant.score,
          participant.status,
          participant.joinedAt,
          participant.completedAt,
          participant.durationSeconds,
          answer.prompt,
          answer.selectedOption,
          answer.correctOption,
          answer.isCorrect ? "Yes" : "No",
          answer.answeredAt,
        ]);
      });
    });

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${report.quiz.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-report.csv"`
    );
    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
}

async function getSessionQrCode(req, res, next) {
  try {
    const session = await LiveSession.findById(req.params.sessionId).populate("quiz", "joinCode");

    if (!session) {
      return res.status(404).json({ message: "Live session not found" });
    }

    const playerBaseUrl = process.env.PLAYER_URL || "http://localhost:3001";
    const joinUrl = `${playerBaseUrl}/?code=${session.joinCode}`;
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl, {
      width: 320,
      margin: 2,
    });

    return res.status(200).json({
      joinCode: session.joinCode,
      joinUrl,
      qrCodeDataUrl,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createLiveSession,
  getLiveSessionById,
  listLiveSessions,
  startLiveSession,
  advanceLiveSession,
  endLiveSession,
  getSessionLeaderboard,
  getSessionReport,
  getSessionQrCode,
  getQuizLaunchHistory,
  getQuizReport,
  exportQuizReportCsv,
  launchQuizAgain,
};
