// normalizeQuestion strips the correct answer — safe to send to participants during
// an active question phase. Never include correctOptionIndex/explanation here.
function normalizeQuestion(question, extra = {}) {
  if (!question) {
    return null;
  }

  return {
    id: String(question._id || question.id),
    questionType: question.questionType || "multiple_choice",
    prompt: question.prompt,
    options: Array.isArray(question.options) ? question.options : [],
    difficulty: question.difficulty || "medium",
    sourceType: question.sourceType || "manual",
    qualityScore: question.qualityScore || 70,
    qualityNotes: question.qualityNotes || [],
    qualityMeta: question.qualityMeta || {},
    ...extra,
  };
}

// Used only after a question ends (summary event + admin views).
function normalizeQuestionWithAnswer(question, extra = {}) {
  if (!question) {
    return null;
  }

  return {
    ...normalizeQuestion(question, extra),
    correctOptionIndex:
      question.correctOptionIndex !== undefined ? question.correctOptionIndex : null,
    explanation: question.explanation || "",
  };
}

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  if (typeof user === "string") {
    return { id: user, name: "", email: "", role: "", avatar: "" };
  }

  if (!user._id && !user.id) {
    return { id: String(user), name: "", email: "", role: "", avatar: "" };
  }

  const email = user.email || "";
  const isInternalParticipantEmail =
    email.startsWith("participant-") && email.endsWith("@quivora.local");

  return {
    id: String(user._id || user.id),
    name: user.name,
    email: isInternalParticipantEmail ? "" : email,
    role: user.role,
    avatar: user.avatar || "",
  };
}

function normalizeQuiz(quiz, options = {}) {
  if (!quiz) {
    return null;
  }

  const includeQuestions = options.includeQuestions !== false;
  const total = quiz.totalQuestions || quiz.questions?.length || 0;

  return {
    id: String(quiz._id || quiz.id),
    title: quiz.title,
    description: quiz.description || "",
    category: quiz.category || "general",
    joinCode: quiz.joinCode,
    status: quiz.status,
    totalQuestions: total,
    questionTimeLimitSeconds: quiz.questionTimeLimitSeconds || 30,
    resultsWindowSeconds: quiz.resultsWindowSeconds || 5,
    adaptiveMode: Boolean(quiz.adaptiveMode),
    randomizeQuestions: Boolean(quiz.randomizeQuestions),
    randomizeOptions: Boolean(quiz.randomizeOptions),
    mode: quiz.mode || "live",
    theme: {
      preset: quiz.theme?.preset || "aurora",
      primaryColor: quiz.theme?.primaryColor || "#2563eb",
      accentColor: quiz.theme?.accentColor || "#f59e0b",
      backgroundColor: quiz.theme?.backgroundColor || "#0f172a",
      fontFamily: quiz.theme?.fontFamily || "Inter",
      logoText: quiz.theme?.logoText || "Quivora Live",
      coverImageUrl: quiz.theme?.coverImageUrl || "",
      playerStyle: quiz.theme?.playerStyle || "vibrant",
    },
    sharing: {
      visibility: quiz.sharing?.visibility || "public",
      hasPassword: Boolean(quiz.sharing?.accessPassword),
      availableFrom: quiz.sharing?.availableFrom || null,
      availableUntil: quiz.sharing?.availableUntil || null,
      maxParticipants: quiz.sharing?.maxParticipants || 0,
      reusableLink: quiz.sharing?.reusableLink !== false,
      customSlug: quiz.sharing?.customSlug || "",
      embedEnabled: quiz.sharing?.embedEnabled !== false,
    },
    integrations: {
      googleSheetsEnabled: quiz.integrations?.googleSheetsEnabled !== false,
      googleDriveImportUrl: quiz.integrations?.googleDriveImportUrl || "",
      webhookUrl: quiz.integrations?.webhookUrl || "",
      notificationEmail: quiz.integrations?.notificationEmail || "",
    },
    createdBy: normalizeUser(quiz.createdBy),
    isDefaultLibrary: Boolean(quiz.isDefaultLibrary),
    libraryKey: quiz.libraryKey || "",
    // Public quiz listing never exposes answers — normalizeQuestion is used here
    questions: includeQuestions
      ? (quiz.questions || []).map((q, index) =>
          normalizeQuestion(q, { index, totalQuestions: total })
        )
      : undefined,
  };
}

function normalizeQuizListItem(quiz) {
  if (!quiz) {
    return null;
  }

  return {
    id: String(quiz._id || quiz.id),
    title: quiz.title,
    description: quiz.description || "",
    category: quiz.category || "general",
    status: quiz.status,
    totalQuestions: quiz.totalQuestions || quiz.questions?.length || 0,
    questionTimeLimitSeconds: quiz.questionTimeLimitSeconds || 30,
    resultsWindowSeconds: quiz.resultsWindowSeconds || 5,
    createdBy: normalizeUser(quiz.createdBy),
    isDefaultLibrary: Boolean(quiz.isDefaultLibrary),
    libraryKey: quiz.libraryKey || "",
    createdAt: quiz.createdAt || null,
    updatedAt: quiz.updatedAt || null,
  };
}

function normalizeAttempt(attempt) {
  if (!attempt) {
    return null;
  }

  return {
    id: String(attempt._id || attempt.id),
    quiz: attempt.quiz ? String(attempt.quiz._id || attempt.quiz) : null,
    user: normalizeUser(attempt.user),
    score: attempt.score || 0,
    status: attempt.status || "joined",
    joinedAt: attempt.joinedAt || null,
    completedAt: attempt.completedAt || null,
  };
}

function normalizeLeaderboardEntry(entry, fallbackRank) {
  if (!entry) {
    return null;
  }

  return {
    rank: entry.rank || fallbackRank || null,
    attemptId: entry.attemptId ? String(entry.attemptId) : null,
    participant: entry.participant || entry.user?.name || "Unknown",
    score: entry.score || 0,
    status: entry.status || "joined",
    completedAt: entry.completedAt || null,
  };
}

function normalizeLiveSession(session) {
  if (!session) {
    return null;
  }

  return {
    id: String(session._id || session.id),
    quiz: session.quiz ? String(session.quiz._id || session.quiz) : null,
    host: normalizeUser(session.host),
    joinCode: session.joinCode,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex || 0,
    participantCount: session.participantCount || 0,
    startedAt: session.startedAt || null,
    endedAt: session.endedAt || null,
    createdAt: session.createdAt || null,
    updatedAt: session.updatedAt || null,
  };
}

module.exports = {
  normalizeAttempt,
  normalizeLeaderboardEntry,
  normalizeLiveSession,
  normalizeQuestion,
  normalizeQuestionWithAnswer,
  normalizeQuiz,
  normalizeQuizListItem,
  normalizeUser,
};
