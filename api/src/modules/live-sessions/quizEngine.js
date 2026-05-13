const Attempt = require("../answers/Attempt");
const {
  completeAttemptById,
  getLeaderboardForSession,
  submitAttemptAnswer,
} = require("../answers/attemptService");
const LiveSession = require("./LiveSession");
const Quiz = require("../quiz-publishing/Quiz");
const Question = require("../question-bank/Question");
const { dispatchQuizIntegrationEvent } = require("../../services/integrationService");
const { upsertWorkspaceEmbedding } = require("../workspace-assistant/embeddingService");
const { normalizeLeaderboardEntry, normalizeQuestion } = require("../../utils/normalize");
const quizEventBus = require("./quizEventBus");
const {
  getSessionState,
  removeSessionState,
  setSessionState,
} = require("./socketSessionStore");

function emitRoomEvent(roomCode, eventName, payload) {
  quizEventBus.emit("room:event", { roomCode, eventName, payload });
}

function emitTargetedRoomEvent(roomCode, eventName, hostPayload, participantPayloads) {
  quizEventBus.emit("room:targeted-event", {
    roomCode,
    eventName,
    hostPayload,
    participantPayloads,
  });
}

function getConnectedParticipantCount(state) {
  return state.participantSockets.size;
}

function getQuestionPayload(state) {
  // normalizeQuestion intentionally omits correctOptionIndex — safe for broadcast
  return normalizeQuestion(state.currentQuestion, {
    index: state.currentQuestionIndex,
    totalQuestions: state.questions.length,
  });
}

function reorderQuestionsForAdaptiveMode(questions) {
  const rank = { easy: 0, medium: 1, hard: 2 };
  return [...questions].sort((a, b) => (rank[a.difficulty] ?? 1) - (rank[b.difficulty] ?? 1));
}

function hashString(value) {
  return String(value).split("").reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

function shuffleBySeed(items, seed) {
  const shuffled = [...items];
  let state = hashString(seed) || 1;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function orderQuestions(quiz) {
  const baseQuestions = quiz.adaptiveMode ? reorderQuestionsForAdaptiveMode(quiz.questions) : [...quiz.questions];
  if (!quiz.randomizeQuestions || baseQuestions.length < 2) {
    return baseQuestions;
  }

  return shuffleBySeed(baseQuestions, `${quiz._id}:${quiz.joinCode}:questions`);
}

function getOptionOrder(state, attemptId, question = state.currentQuestion) {
  const optionCount = question?.options?.length || 0;
  const baseOrder = Array.from({ length: optionCount }, (_, index) => index);

  if (!state.randomizeOptions || optionCount < 2 || !attemptId) {
    return baseOrder;
  }

  return shuffleBySeed(baseOrder, `${state.sessionId || state.joinCode}:${attemptId}:${question._id}:options`);
}

function getQuestionPayloadForAttempt(state, attemptId) {
  const order = getOptionOrder(state, attemptId);
  return {
    ...getQuestionPayload(state),
    options: order.map((optionIndex) => state.currentQuestion.options[optionIndex]),
  };
}

function getAnswerDistributionPayload(state) {
  const counts = state.currentQuestion.options.map((_, optionIndex) => ({
    optionIndex,
    count: state.answerCounts.get(optionIndex) || 0,
  }));

  return {
    joinCode: state.joinCode,
    questionId: String(state.currentQuestion._id),
    counts,
    answeredCount: state.answeredAttemptIds.size,
    participantCount: getConnectedParticipantCount(state),
  };
}

function getAnswerDistributionPayloadForAttempt(state, attemptId) {
  const order = getOptionOrder(state, attemptId);
  const counts = order.map((originalOptionIndex, displayOptionIndex) => ({
    optionIndex: displayOptionIndex,
    count: state.answerCounts.get(originalOptionIndex) || 0,
  }));

  return {
    ...getAnswerDistributionPayload(state),
    counts,
  };
}

function getSummaryPayload(state, reason, attemptId = null) {
  const order = getOptionOrder(state, attemptId);
  const correctOptionIndex = order.indexOf(state.currentQuestion.correctOptionIndex);
  const counts = order.map((originalOptionIndex, displayOptionIndex) => ({
    optionIndex: displayOptionIndex,
    count: state.answerCounts.get(originalOptionIndex) || 0,
  }));

  return {
    joinCode: state.joinCode,
    questionId: String(state.currentQuestion._id),
    correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : state.currentQuestion.correctOptionIndex,
    reason,
    counts,
    totalParticipants: getConnectedParticipantCount(state),
    durationSeconds: state.resultsWindowSeconds,
  };
}

function buildParticipantPayloads(state, createPayload) {
  return Object.fromEntries(
    [...state.participantSockets.keys()].map((attemptId) => [
      String(attemptId),
      createPayload(String(attemptId)),
    ])
  );
}

async function emitLeaderboard(state) {
  const leaderboard = state.sessionId
    ? await getLeaderboardForSession(state.sessionId)
    : [];
  const normalized = leaderboard.map((entry, index) =>
    normalizeLeaderboardEntry(entry, index + 1)
  );
  emitRoomEvent(state.joinCode, "leaderboard:update", normalized);
  return normalized;
}

async function updateQuestionPerformanceForSession(sessionId) {
  if (!sessionId) return;
  const attempts = await Attempt.find({ session: sessionId }).select("answers");
  const statsByQuestion = new Map();

  attempts.forEach((attempt) => {
    (attempt.answers || []).forEach((answer) => {
      const questionId = String(answer.question);
      const stat = statsByQuestion.get(questionId) || { attempts: 0, correct: 0 };
      stat.attempts += 1;
      if (answer.isCorrect) stat.correct += 1;
      statsByQuestion.set(questionId, stat);
    });
  });

  await Promise.all(
    [...statsByQuestion.entries()].map(async ([questionId, stat]) => {
      const sessionRate = stat.attempts ? Math.round((stat.correct / stat.attempts) * 100) : 0;
      const question = await Question.findById(questionId).select("usageCount avgCorrectRate sessions");
      if (!question) return;
      const previousUsage = question.usageCount || 0;
      const nextUsage = previousUsage + 1;
      question.avgCorrectRate = Math.round(
        ((question.avgCorrectRate || 0) * previousUsage + sessionRate) / nextUsage
      );
      question.usageCount = nextUsage;
      if (!question.sessions.some((id) => String(id) === String(sessionId))) {
        question.sessions.push(sessionId);
      }
      await question.save();
    })
  );
}

async function finalizeQuiz(state) {
  const attempts = await Attempt.find({ session: state.sessionId });
  await Promise.all(attempts.map((attempt) => completeAttemptById(attempt._id)));

  state.phase = "final_results";

  const session = state.sessionId
    ? await LiveSession.findById(state.sessionId)
    : await LiveSession.findOne({
        joinCode: state.joinCode,
        status: { $ne: "closed" },
      }).sort({ createdAt: -1 });

  if (session) {
    session.status = "final_results";
    session.endedAt = new Date();
    await session.save();
  }

  const finalLeaderboard = await emitLeaderboard(state);
  await updateQuestionPerformanceForSession(state.sessionId);
  const quiz = state.quizId ? await Quiz.findById(state.quizId) : null;
  if (quiz) {
    await dispatchQuizIntegrationEvent(quiz, "quiz.completed", {
      sessionId: state.sessionId,
      joinCode: state.joinCode,
      leaderboard: finalLeaderboard,
    });
    await upsertWorkspaceEmbedding({
      owner: quiz.createdBy,
      sourceType: "report",
      sourceId: state.sessionId || state.joinCode,
      title: `${quiz.title} report`,
      text: finalLeaderboard
        .map((entry) => `${entry.participant} scored ${entry.score} and ranked ${entry.rank}`)
        .join(" "),
      route: state.sessionId ? `/reports/${state.sessionId}` : "/reports",
    });
  }
  emitRoomEvent(state.joinCode, "quiz:finished", {
    joinCode: state.joinCode,
    leaderboard: finalLeaderboard,
  });
  return finalLeaderboard;
}

async function startQuestion(joinCode, questionIndex = 0) {
  const state = getSessionState(joinCode);

  if (!state) throw new Error("Session state not found");

  if (state.questionTimer) {
    clearInterval(state.questionTimer);
    state.questionTimer = null;
  }

  if (state.summaryTimer) {
    clearTimeout(state.summaryTimer);
    state.summaryTimer = null;
  }

  if (state.loadingTimer) {
    clearTimeout(state.loadingTimer);
    state.loadingTimer = null;
  }

  state.currentQuestionIndex = questionIndex;
  state.currentQuestion = state.questions[questionIndex];
  state.phase = "question_live";
  state.answerCounts = new Map();
  state.answeredAttemptIds = new Set();
  state.remainingSeconds = state.questionTimeLimitSeconds;
  state.questionStartedAt = Date.now();

  const session = state.sessionId
    ? await LiveSession.findById(state.sessionId)
    : await LiveSession.findOne({ joinCode, status: { $ne: "closed" } }).sort({
        createdAt: -1,
      });
  if (session) {
    session.status = "question_live";
    session.currentQuestionIndex = questionIndex;
    session.questionStartedAt = state.questionStartedAt;
    if (!session.startedAt) session.startedAt = new Date();
    await session.save();
  }

  const hostQuestionPayload = {
    joinCode,
    phase: "question_live",
    remainingSeconds: state.questionTimeLimitSeconds,
    question: getQuestionPayload(state),
    answeredCount: 0,
    participantCount: getConnectedParticipantCount(state),
  };

  if (state.randomizeOptions) {
    emitTargetedRoomEvent(
      joinCode,
      "question:broadcast",
      hostQuestionPayload,
      buildParticipantPayloads(state, (attemptId) => ({
        ...hostQuestionPayload,
        question: getQuestionPayloadForAttempt(state, attemptId),
      }))
    );
  } else {
    emitRoomEvent(joinCode, "question:broadcast", hostQuestionPayload);
  }

  emitRoomEvent(joinCode, "session:ready", {
    joinCode,
    phase: "question_live",
    currentQuestionIndex: questionIndex,
  });

  emitRoomEvent(joinCode, "timer:sync", {
    phase: "question_live",
    remainingSeconds: state.questionTimeLimitSeconds,
  });

  if (state.randomizeOptions) {
    emitTargetedRoomEvent(
      joinCode,
      "question:live-distribution",
      getAnswerDistributionPayload(state),
      buildParticipantPayloads(state, (attemptId) => getAnswerDistributionPayloadForAttempt(state, attemptId))
    );
  } else {
    emitRoomEvent(joinCode, "question:live-distribution", getAnswerDistributionPayload(state));
  }

  // Use wall-clock time so drift from setInterval jitter doesn't accumulate.
  state.questionTimer = setInterval(async () => {
    const elapsed = Math.floor((Date.now() - state.questionStartedAt) / 1000);
    const remaining = Math.max(0, state.questionTimeLimitSeconds - elapsed);
    state.remainingSeconds = remaining;

    if (remaining > 0) {
      emitRoomEvent(joinCode, "timer:tick", {
        phase: "question_live",
        remainingSeconds: remaining,
      });
      return;
    }

    await finishQuestion(joinCode, "timer_finished");
  }, 1000);
}

async function finishQuestion(joinCode, reason = "timer_finished") {
  const state = getSessionState(joinCode);

  if (!state || state.phase !== "question_live") return null;

  if (state.questionTimer) {
    clearInterval(state.questionTimer);
    state.questionTimer = null;
  }

  state.phase = "answers_loading";
  state.remainingSeconds = 2;

  const session = state.sessionId ? await LiveSession.findById(state.sessionId) : null;
  if (session) {
    session.status = "answers_loading";
    await session.save();
  }

  emitRoomEvent(joinCode, "answers:loading", {
    joinCode,
    phase: "answers_loading",
    reason,
    durationSeconds: 2,
    answeredCount: state.answeredAttemptIds.size,
    participantCount: getConnectedParticipantCount(state),
  });

  emitRoomEvent(joinCode, "timer:sync", {
    phase: "answers_loading",
    remainingSeconds: 2,
  });

  state.loadingTimer = setTimeout(async () => {
    state.loadingTimer = null;
    await showQuestionSummary(joinCode, reason);
  }, 2000);

  return null;
}

async function showQuestionSummary(joinCode, reason = "timer_finished") {
  const state = getSessionState(joinCode);

  if (!state || state.phase !== "answers_loading") return null;

  state.phase = "answer_summary";
  state.remainingSeconds = state.resultsWindowSeconds;

  const session = state.sessionId ? await LiveSession.findById(state.sessionId) : null;
  if (session) {
    session.status = "answer_summary";
    await session.save();
  }

  // correctOptionIndex is safe to reveal here — question is over
  if (state.randomizeOptions) {
    emitTargetedRoomEvent(
      joinCode,
      "question:summary",
      getSummaryPayload(state, reason),
      buildParticipantPayloads(state, (attemptId) => getSummaryPayload(state, reason, attemptId))
    );
  } else {
    emitRoomEvent(joinCode, "question:summary", getSummaryPayload(state, reason));
  }

  const leaderboard = await emitLeaderboard(state);

  emitRoomEvent(joinCode, "timer:sync", {
    phase: "answer_summary",
    remainingSeconds: state.resultsWindowSeconds,
  });

  state.summaryTimer = setTimeout(async () => {
    state.summaryTimer = null;
    const hasNextQuestion = state.currentQuestionIndex + 1 < state.questions.length;

    if (!hasNextQuestion) {
      await finalizeQuiz(state);
      return;
    }

    await startQuestion(joinCode, state.currentQuestionIndex + 1);
  }, state.resultsWindowSeconds * 1000);

  return leaderboard;
}

async function initializeQuizSession(joinCode) {
  let state = getSessionState(joinCode);

  const session = await LiveSession.findOne({
    joinCode,
    status: { $nin: ["closed", "final_results"] },
  }).sort({ createdAt: -1 });
  const quiz = session
    ? await Quiz.findById(session.quiz).populate("questions")
    : await Quiz.findOne({ joinCode }).populate("questions");

  if (state && (!session || !state.sessionId || state.sessionId === String(session._id))) {
    if (!state.questions) state.questions = quiz?.questions || [];
    return state;
  }

  if (state && session && state.sessionId !== String(session._id)) {
    removeSessionState(joinCode);
    state = null;
  }

  if (!quiz) {
    const error = new Error("Quiz not found");
    error.statusCode = 404;
    throw error;
  }

  const orderedQuestions = orderQuestions(quiz);

  state = setSessionState(joinCode, {
    joinCode,
    quizId: String(quiz._id),
    sessionId: session?._id ? String(session._id) : null,
    hostUserId: session?.host ? String(session.host) : null,
    questions: orderedQuestions,
    currentQuestionIndex: 0,
    currentQuestion: orderedQuestions[0] || null,
    phase: "waiting_for_players",
    questionTimeLimitSeconds: quiz.questionTimeLimitSeconds || 30,
    resultsWindowSeconds: quiz.resultsWindowSeconds || 5,
    remainingSeconds: quiz.questionTimeLimitSeconds || 30,
    participantSockets: new Map(),
    answerCounts: new Map(),
    answeredAttemptIds: new Set(),
    questionTimer: null,
    summaryTimer: null,
    loadingTimer: null,
    questionStartedAt: null,
    adaptiveMode: Boolean(quiz.adaptiveMode),
    randomizeOptions: Boolean(quiz.randomizeOptions),
  });

  return state;
}

function createJoinSnapshot(state) {
  const snapshot = {
    joinCode: state.joinCode,
    quizId: state.quizId,
    phase: state.phase,
    participantsConnected: getConnectedParticipantCount(state),
    answeredCount: state.answeredAttemptIds?.size || 0,
  };

  if (state.phase === "question_live" && state.currentQuestion) {
    snapshot.activeQuestion = getQuestionPayload(state);
    snapshot.remainingSeconds = Math.max(
      0,
      state.remainingSeconds ||
        state.questionTimeLimitSeconds -
          Math.floor((Date.now() - state.questionStartedAt) / 1000)
    );
  }

  if (state.phase === "answers_loading") {
    snapshot.remainingSeconds = Math.max(0, state.remainingSeconds || 2);
    snapshot.activeQuestion = state.currentQuestion ? getQuestionPayload(state) : null;
  }

  if (state.phase === "answer_summary" && state.currentQuestion) {
    const counts = state.currentQuestion.options.map((_, optionIndex) => ({
      optionIndex,
      count: state.answerCounts.get(optionIndex) || 0,
    }));

    snapshot.activeQuestion = getQuestionPayload(state);
    snapshot.answerSummary = {
      joinCode: state.joinCode,
      questionId: String(state.currentQuestion._id),
      correctOptionIndex: state.currentQuestion.correctOptionIndex,
      counts,
      totalParticipants: getConnectedParticipantCount(state),
      durationSeconds: state.resultsWindowSeconds,
    };
  }

  return snapshot;
}

async function joinQuizSession({ joinCode, role = "participant", attemptId, socketId, userId }) {
  const roomCode = joinCode.toUpperCase();
  const state = await initializeQuizSession(roomCode);

  if (role === "participant" && attemptId) {
    state.participantSockets.set(String(attemptId), socketId);
  }

  // If a verified host joins and the session has no hostUserId recorded yet, set it now
  if (role === "host" && userId && !state.hostUserId) {
    state.hostUserId = userId;
  }

  emitRoomEvent(roomCode, "room:presence", {
    joinCode: roomCode,
    participantsConnected: getConnectedParticipantCount(state),
    phase: state.phase,
  });

  return createJoinSnapshot(state);
}

function isAuthorizedHost(state, userId) {
  if (!state.hostUserId || !userId) return false;
  return state.hostUserId === userId;
}

async function startQuizSession(joinCode, userId) {
  const roomCode = joinCode.toUpperCase();
  const state = await initializeQuizSession(roomCode);

  if (!isAuthorizedHost(state, userId)) {
    const error = new Error("Only the session host can start the quiz");
    error.statusCode = 403;
    throw error;
  }

  await startQuestion(roomCode, state.currentQuestionIndex || 0);
}

async function advanceQuizSession(joinCode, userId) {
  const roomCode = joinCode.toUpperCase();
  const state = getSessionState(roomCode);

  if (!state) throw new Error("Session state not found");

  if (!isAuthorizedHost(state, userId)) {
    const error = new Error("Only the session host can advance the quiz");
    error.statusCode = 403;
    throw error;
  }

  if (state.phase === "answer_summary") {
    if (state.summaryTimer) {
      clearTimeout(state.summaryTimer);
      state.summaryTimer = null;
    }

    if (state.currentQuestionIndex + 1 >= state.questions.length) {
      await finalizeQuiz(state);
      return;
    }

    await startQuestion(roomCode, state.currentQuestionIndex + 1);
    return;
  }

  if (state.phase === "question_live") {
    await finishQuestion(roomCode, "host_forced_advance");
  }
}

async function submitQuizAnswer({ joinCode, attemptId, questionId, selectedOptionIndex }) {
  const roomCode = joinCode.toUpperCase();
  const state = getSessionState(roomCode);

  if (!state) throw new Error("Session state not found");
  if (state.phase !== "question_live") throw new Error("Question is not currently active");

  if (String(state.currentQuestion._id) !== String(questionId)) {
    throw new Error("Answer submitted for the wrong question");
  }

  // Prevent double-counting from a duplicate submit for the same attempt
  const alreadyAnswered = state.answeredAttemptIds.has(String(attemptId));

  const responseTimeMs = state.questionStartedAt ? Date.now() - state.questionStartedAt : null;

  const { attempt, isCorrect } = await submitAttemptAnswer({
    attemptId,
    questionId,
    selectedOptionIndex: getOptionOrder(state, attemptId)[selectedOptionIndex] ?? selectedOptionIndex,
    responseTimeMs,
    timeLimitSeconds: state.questionTimeLimitSeconds,
  });

  if (!alreadyAnswered) {
    state.answeredAttemptIds.add(String(attemptId));
    const originalOptionIndex = getOptionOrder(state, attemptId)[selectedOptionIndex] ?? selectedOptionIndex;
    state.answerCounts.set(
      originalOptionIndex,
      (state.answerCounts.get(originalOptionIndex) || 0) + 1
    );
  }

  emitRoomEvent(roomCode, "answers:progress", {
    joinCode: roomCode,
    answeredCount: state.answeredAttemptIds.size,
    participantCount: getConnectedParticipantCount(state),
  });

  if (state.randomizeOptions) {
    emitTargetedRoomEvent(
      roomCode,
      "question:live-distribution",
      getAnswerDistributionPayload(state),
      buildParticipantPayloads(state, (participantAttemptId) =>
        getAnswerDistributionPayloadForAttempt(state, participantAttemptId)
      )
    );
  } else {
    emitRoomEvent(roomCode, "question:live-distribution", getAnswerDistributionPayload(state));
  }

  if (
    getConnectedParticipantCount(state) > 0 &&
    state.answeredAttemptIds.size >= getConnectedParticipantCount(state)
  ) {
    await finishQuestion(roomCode, "all_answered");
  }

  return {
    attemptId: String(attempt._id),
    isCorrect,
    score: attempt.score,
    responseTimeMs,
  };
}

async function getQuizSessionLeaderboard(joinCode) {
  const roomCode = joinCode.toUpperCase();
  const state = await initializeQuizSession(roomCode);
  return emitLeaderboard(state);
}

function leaveQuizSession({ joinCode, role, attemptId }) {
  if (!joinCode) return;

  const roomCode = joinCode.toUpperCase();
  const state = getSessionState(roomCode);

  if (!state) return;

  if (role === "participant" && attemptId) {
    state.participantSockets.delete(String(attemptId));
  }

  emitRoomEvent(roomCode, "room:presence", {
    joinCode: roomCode,
    participantsConnected: getConnectedParticipantCount(state),
    phase: state.phase,
  });

  if (state.phase === "final_results" && getConnectedParticipantCount(state) === 0) {
    removeSessionState(roomCode);
  }
}

module.exports = {
  advanceQuizSession,
  getQuizSessionLeaderboard,
  initializeQuizSession,
  joinQuizSession,
  leaveQuizSession,
  startQuizSession,
  submitQuizAnswer,
};
