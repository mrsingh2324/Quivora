const { randomUUID } = require("crypto");

const Attempt = require("../answers/Attempt");
const { getLeaderboardForQuiz } = require("../answers/attemptService");
const { completeAttemptById, submitAttemptAnswer } = require("../answers/attemptService");
const Question = require("../question-bank/Question");
const LiveSession = require("../live-sessions/LiveSession");
const { analyzeTopicText } = require("../../services/aiService");
const { upsertWorkspaceEmbedding } = require("../workspace-assistant/embeddingService");
const {
  normalizeLeaderboardEntry,
  normalizeQuestion,
  normalizeQuiz,
  normalizeQuizListItem,
  normalizeUser,
} = require("../../utils/normalize");
const Quiz = require("./Quiz");
const User = require("../participants/User");
const generateJoinCode = require("./generateJoinCode");

// MongoDB enforces uniqueness on joinCode via a unique index.
// We rely on that guarantee and retry on duplicate-key errors instead of
// pre-checking with findOne (which has a TOCTOU race window).
const DUPLICATE_KEY_CODE = 11000;
const JOIN_CODE_MAX_RETRIES = 10;

function createInternalParticipantEmail(joinCode) {
  return `participant-${joinCode.toLowerCase()}-${randomUUID()}@quivora.local`;
}

function getAvailabilityError(quiz) {
  const now = new Date();

  if (quiz.sharing?.availableFrom && now < new Date(quiz.sharing.availableFrom)) {
    return { status: 403, message: "Quiz is not yet available" };
  }

  if (quiz.sharing?.availableUntil && now > new Date(quiz.sharing.availableUntil)) {
    return { status: 403, message: "Quiz is no longer available" };
  }

  return null;
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

function getAsyncOptionOrder(quiz, attemptId, question) {
  const optionCount = question?.options?.length || 0;
  const baseOrder = Array.from({ length: optionCount }, (_, index) => index);

  if (!quiz.randomizeOptions || optionCount < 2 || !attemptId) {
    return baseOrder;
  }

  return shuffleBySeed(baseOrder, `${quiz._id}:${attemptId}:${question._id}:async-options`);
}

function normalizeAsyncQuestion(quiz, question, index, attemptId) {
  if (!question) return null;
  const order = getAsyncOptionOrder(quiz, attemptId, question);

  return {
    ...normalizeQuestion(question, {
      index,
      totalQuestions: quiz.questions.length,
    }),
    options: order.map((optionIndex) => question.options[optionIndex]),
  };
}

async function updateQuestionPerformanceForAttempt(attempt) {
  await Promise.all(
    (attempt.answers || []).map(async (answer) => {
      const question = await Question.findById(answer.question).select("usageCount avgCorrectRate");
      if (!question) return;
      const previousUsage = question.usageCount || 0;
      const nextUsage = previousUsage + 1;
      const answerRate = answer.isCorrect ? 100 : 0;
      question.avgCorrectRate = Math.round(
        ((question.avgCorrectRate || 0) * previousUsage + answerRate) / nextUsage
      );
      question.usageCount = nextUsage;
      await question.save();
    })
  );
}

async function createQuizDocument(data) {
  for (let attempt = 0; attempt < JOIN_CODE_MAX_RETRIES; attempt++) {
    try {
      return await Quiz.create({ ...data, joinCode: generateJoinCode() });
    } catch (err) {
      const isDuplicateJoinCode =
        err.code === DUPLICATE_KEY_CODE && err.keyPattern?.joinCode;

      if (isDuplicateJoinCode && attempt < JOIN_CODE_MAX_RETRIES - 1) {
        continue;
      }

      throw err;
    }
  }

  throw new Error("Failed to generate a unique join code — please try again.");
}

async function findOrCreateAdmin({ adminId, adminName, adminEmail }) {
  if (adminId) {
    const existingAdmin = await User.findById(adminId);

    if (!existingAdmin) {
      const error = new Error("Admin not found");
      error.statusCode = 404;
      throw error;
    }

    return existingAdmin;
  }

  return User.create({
    name: adminName,
    email: adminEmail,
    role: "admin",
  });
}

async function createQuiz(req, res, next) {
  try {
    const {
      title,
      description,
      category,
      adminId,
      adminName,
      adminEmail,
      questions,
      questionTimeLimitSeconds,
      resultsWindowSeconds,
      status = "draft",
    } = req.body;
    const authenticatedAdminId = req.user?.userId;
    const effectiveAdminId = adminId || authenticatedAdminId;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        message: "title and at least one question are required",
      });
    }
    if (!effectiveAdminId && !adminName) {
      return res.status(400).json({
        message: "adminId or adminName is required",
      });
    }

    const admin = await findOrCreateAdmin({
      adminId: effectiveAdminId,
      adminName,
      adminEmail,
    });

    const invalidQuestion = questions.find(
      (question) =>
        question.questionType && question.questionType !== "multiple_choice" ||
        !question.prompt ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        question.options.some((option) => !String(option || "").trim()) ||
        question.correctOptionIndex === undefined ||
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex > 3
    );

    if (invalidQuestion) {
      return res.status(400).json({
        message: "Each question must include prompt, 4 options, and a valid correctOptionIndex",
      });
    }

    const createdQuestions = await Question.insertMany(
      questions.map((question) => ({
        ...question,
        questionType: "multiple_choice",
        options: question.options.map((option) => String(option).trim()),
      }))
    );

    const desiredStatus = ["draft", "published", "closed"].includes(status) ? status : "draft";

    const quiz = await createQuizDocument({
      title,
      description,
      category,
      createdBy: admin._id,
      questions: createdQuestions.map((question) => question._id),
      status: desiredStatus,
      totalQuestions: createdQuestions.length,
      questionTimeLimitSeconds,
      resultsWindowSeconds,
    });

    const populatedQuiz = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email role")
      .populate("questions");

    return res.status(201).json(normalizeQuiz(populatedQuiz));
  } catch (error) {
    return next(error);
  }
}

async function createQuizFromTopic(req, res, next) {
  try {
    const {
      topic,
      title,
      description,
      category,
      adminId,
      adminName,
      adminEmail,
      difficulty,
      count,
    } = req.body;
    const authenticatedAdminId = req.user?.userId;
    const effectiveAdminId = adminId || authenticatedAdminId;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ message: "topic is required" });
    }

    if (!effectiveAdminId && !adminName) {
      return res.status(400).json({ message: "adminId or adminName is required" });
    }

    console.log("[Create Quiz From Topic] Request received:", {
      title: title || "(not provided)",
      topicLength: topic.length,
      difficulty: difficulty || "not specified",
      count: count || "not specified",
      adminId: effectiveAdminId,
      adminName,
      timestamp: new Date().toISOString(),
    });

    const aiResult = await analyzeTopicText({
      topic,
      difficulty,
      count,
    });

    console.log("[Create Quiz From Topic] AI analysis result:", {
      action: aiResult.action,
      containsQuestions: aiResult.containsQuestions,
      preferencesNeeded: aiResult.preferencesNeeded,
    });

    if (aiResult.action === "needs_preferences") {
      console.log("[Create Quiz From Topic] Preferences needed, returning to user");
      return res.status(200).json({
        requiresPreferences: true,
        aiResult,
      });
    }

    req.body = {
      title: title || aiResult.title || topic,
      description: description || `AI-generated quiz for ${topic}`,
      category: category || "ai-generated",
      adminId: effectiveAdminId,
      adminName,
      adminEmail,
      questions: aiResult.questions.map((question) => ({
        ...question,
        sourceType: aiResult.containsQuestions ? "document" : "ai_generated",
      })),
      status: "published",
      questionTimeLimitSeconds: 20,
      resultsWindowSeconds: 5,
    };

    console.log("[Create Quiz From Topic] Creating quiz with", aiResult.questions.length, "questions");

    return createQuiz(req, res, next);
  } catch (error) {
    console.error("[Create Quiz From Topic] Error:", {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return next(error);
  }
}

async function listQuizzes(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();

    const filter = {};
    const andFilters = [];

    if (req.user?.userId) {
      andFilters.push({ $or: [{ createdBy: req.user.userId }, { isDefaultLibrary: true }] });
    }

    if (["draft", "published", "closed"].includes(status)) {
      filter.status = status;
    }

    if (search) {
      andFilters.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          { category: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (andFilters.length) filter.$and = andFilters;

    const [quizzes, total] = await Promise.all([
      Quiz.find(filter)
        .select(
          "title description category createdBy status totalQuestions questionTimeLimitSeconds resultsWindowSeconds isDefaultLibrary libraryKey createdAt updatedAt"
        )
        .populate("createdBy", "name email role")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Quiz.countDocuments(filter),
    ]);

    return res.status(200).json({
      items: quizzes.map((quiz) => normalizeQuizListItem(quiz)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getQuizById(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId)
      .populate("createdBy", "name email role")
      .populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    return res.status(200).json(normalizeQuiz(quiz));
  } catch (error) {
    return next(error);
  }
}

async function publishQuiz(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId).populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const questions = quiz.questions || [];
    const invalidQuestion = questions.find(
      (question) =>
        question.questionType !== "multiple_choice" ||
        !question.prompt ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        question.options.some((option) => !String(option || "").trim()) ||
        question.correctOptionIndex === undefined ||
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex > 3
    );

    if (questions.length === 0 || invalidQuestion) {
      return res.status(400).json({
        message: "Publish requires at least one valid multiple-choice question with four options.",
      });
    }

    quiz.totalQuestions = questions.length;
    quiz.status = "published";
    await quiz.save();
    await upsertWorkspaceEmbedding({
      owner: quiz.createdBy,
      sourceType: "quiz",
      sourceId: quiz._id,
      title: quiz.title,
      text: `${quiz.description || ""} ${questions.map((question) => `${question.prompt} ${question.explanation || ""}`).join(" ")}`,
      route: `/quizzes/${quiz._id}/review`,
    });

    return res.status(200).json(normalizeQuiz(quiz, { includeQuestions: false }));
  } catch (error) {
    return next(error);
  }
}

async function updateQuizStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!["draft", "published", "closed"].includes(status)) {
      return res.status(400).json({
        message: "status must be draft, published, or closed",
      });
    }

    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    quiz.status = status;
    await quiz.save();

    return res.status(200).json(normalizeQuiz(quiz, { includeQuestions: false }));
  } catch (error) {
    return next(error);
  }
}

async function updateQuizSettings(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId).populate("createdBy", "name email role").populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (String(quiz.createdBy?._id || quiz.createdBy) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You can only update quizzes you created" });
    }

    const allowedFields = [
      "title",
      "description",
      "category",
      "questionTimeLimitSeconds",
      "resultsWindowSeconds",
      "adaptiveMode",
      "randomizeQuestions",
      "randomizeOptions",
      "mode",
      "theme",
      "sharing",
      "integrations",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        quiz[field] = req.body[field];
      }
    });

    await quiz.save();
    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email role")
      .populate("questions");

    return res.status(200).json(normalizeQuiz(updatedQuiz));
  } catch (error) {
    return next(error);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (String(quiz.createdBy) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You can only update quizzes you created" });
    }

    if (!quiz.questions.some((questionId) => String(questionId) === String(req.params.questionId))) {
      return res.status(404).json({ message: "Question not found in this quiz" });
    }

    const { prompt, options, correctOptionIndex, difficulty, explanation } = req.body;
    const update = {};

    if (prompt !== undefined) update.prompt = String(prompt).trim();
    if (options !== undefined) {
      if (!Array.isArray(options) || options.length !== 4 || options.some((option) => !String(option || "").trim())) {
        return res.status(400).json({ message: "options must contain four non-empty values" });
      }
      update.options = options.map((option) => String(option).trim());
    }
    if (correctOptionIndex !== undefined) {
      const index = Number(correctOptionIndex);
      if (!Number.isInteger(index) || index < 0 || index > 3) {
        return res.status(400).json({ message: "correctOptionIndex must be between 0 and 3" });
      }
      update.correctOptionIndex = index;
    }
    if (difficulty !== undefined) update.difficulty = difficulty;
    if (explanation !== undefined) update.explanation = String(explanation).trim();

    await Question.findByIdAndUpdate(req.params.questionId, update, { runValidators: true });
    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email role")
      .populate("questions");

    return res.status(200).json(normalizeQuiz(updatedQuiz));
  } catch (error) {
    return next(error);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    const quiz = await Quiz.findById(req.params.quizId);

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (String(quiz.createdBy) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You can only update quizzes you created" });
    }

    const nextQuestionIds = quiz.questions.filter(
      (questionId) => String(questionId) !== String(req.params.questionId)
    );

    if (nextQuestionIds.length === quiz.questions.length) {
      return res.status(404).json({ message: "Question not found in this quiz" });
    }

    quiz.questions = nextQuestionIds;
    quiz.totalQuestions = nextQuestionIds.length;
    await quiz.save();
    await Question.deleteOne({ _id: req.params.questionId });

    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email role")
      .populate("questions");

    return res.status(200).json(normalizeQuiz(updatedQuiz));
  } catch (error) {
    return next(error);
  }
}

function parseRequestedQuestionCount(prompt) {
  const match = prompt.match(/(?:add|create|generate)\s+(\d{1,2})\s+(?:more\s+)?questions?/i);
  if (!match) return 0;

  return Math.max(1, Math.min(Number(match[1]), 10));
}

function inferDifficulty(prompt) {
  const text = prompt.toLowerCase();

  if (text.includes("harder") || text.includes("hard")) return "hard";
  if (text.includes("easier") || text.includes("easy")) return "easy";
  if (text.includes("medium") || text.includes("intermediate")) return "medium";

  return null;
}

async function aiEditQuiz(req, res, next) {
  try {
    const { prompt, instruction, previewOnly = false } = req.body;
    const editPrompt = prompt || instruction;

    if (!editPrompt || typeof editPrompt !== "string" || !editPrompt.trim()) {
      return res.status(400).json({ message: "prompt or instruction is required" });
    }

    const quiz = await Quiz.findById(req.params.quizId).populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (String(quiz.createdBy) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You can only edit quizzes you created" });
    }

    const normalizedPrompt = editPrompt.trim().toLowerCase();
    const actions = [];
    const desiredDifficulty = inferDifficulty(editPrompt);
    const questionNumberMatch = normalizedPrompt.match(/question\s+(\d{1,2})/);
    const targetQuestionIndex = questionNumberMatch ? Number(questionNumberMatch[1]) - 1 : null;
    const targetQuestions =
      targetQuestionIndex !== null && quiz.questions[targetQuestionIndex]
        ? [quiz.questions[targetQuestionIndex]]
        : quiz.questions;
    const previewChanges = [];

    if (desiredDifficulty) {
      previewChanges.push({
        type: "difficulty",
        questionIds: targetQuestions.map((question) => String(question._id)),
        value: desiredDifficulty,
      });
      if (!previewOnly) {
        await Question.updateMany(
          { _id: { $in: targetQuestions.map((question) => question._id) } },
          { $set: { difficulty: desiredDifficulty } }
        );
      }
      actions.push(`Set ${targetQuestions.length === 1 ? "question" : "questions"} to ${desiredDifficulty} difficulty`);
    }

    if (
      normalizedPrompt.includes("explanation") ||
      normalizedPrompt.includes("explain") ||
      normalizedPrompt.includes("rationale")
    ) {
      const explanationUpdates = targetQuestions
        .filter((question) => !question.explanation)
        .map((question) =>
          Question.updateOne(
            { _id: question._id },
            {
              $set: {
                explanation: `The correct answer is "${question.options[question.correctOptionIndex]}". Review the related concept before launching this quiz.`,
              },
            }
          )
        );

      if (explanationUpdates.length && !previewOnly) {
        await Promise.all(explanationUpdates);
      }
      if (explanationUpdates.length) {
        actions.push(`Added explanations to ${explanationUpdates.length} questions`);
      } else {
        actions.push("All questions already had explanations");
      }
    }

    const addCount = parseRequestedQuestionCount(prompt);

    if (addCount > 0) {
      const draftQuestions = Array.from({ length: addCount }, (_, index) => ({
          prompt: `AI draft question ${quiz.totalQuestions + index + 1} for ${quiz.title}`,
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctOptionIndex: 0,
          sourceType: "ai_generated",
          difficulty: desiredDifficulty || "medium",
          explanation: "Replace this draft with a final question before publishing to learners.",
      }));
      previewChanges.push({ type: "add_questions", questions: draftQuestions });

      if (!previewOnly) {
        const createdQuestions = await Question.insertMany(draftQuestions);
        quiz.questions.push(...createdQuestions.map((question) => question._id));
        quiz.totalQuestions = quiz.questions.length;
        await quiz.save();
      }
      actions.push(`Added ${addCount} draft questions`);
    }

    if (normalizedPrompt.includes("interview")) {
      if (!previewOnly) {
        await Promise.all(
          targetQuestions.map((question, index) =>
          Question.updateOne(
            { _id: question._id },
            { $set: { prompt: `Interview MCQ ${index + 1}: ${question.prompt}` } }
          )
          )
        );
      }
      previewChanges.push({ type: "interview_style", questionIds: targetQuestions.map((question) => String(question._id)) });
      actions.push("Converted prompts to interview-style MCQs");
    }

    if (normalizedPrompt.includes("duplicate")) {
      const seenPrompts = new Set();
      const keptQuestionIds = [];
      const duplicateQuestionIds = [];

      quiz.questions.forEach((question) => {
        const key = question.prompt.trim().toLowerCase();
        if (seenPrompts.has(key)) {
          duplicateQuestionIds.push(question._id);
        } else {
          seenPrompts.add(key);
          keptQuestionIds.push(question._id);
        }
      });

      if (duplicateQuestionIds.length && !previewOnly) {
        quiz.questions = keptQuestionIds;
        quiz.totalQuestions = keptQuestionIds.length;
        await quiz.save();
        await Question.deleteMany({ _id: { $in: duplicateQuestionIds } });
      }

      previewChanges.push({ type: "remove_duplicates", questionIds: duplicateQuestionIds.map(String) });
      actions.push(`Removed ${duplicateQuestionIds.length} duplicate questions`);
    }

    if (actions.length === 0) {
      return res.status(400).json({
        message:
          "I can apply edits like: make this quiz harder, make it easier, add explanations, add 5 questions, convert to interview-style MCQs, or remove duplicate questions.",
      });
    }

    if (previewOnly) {
      return res.status(200).json({
        message: `Previewed ${actions.length} AI edit${actions.length === 1 ? "" : "s"}.`,
        actions,
        previewChanges,
        quiz: normalizeQuiz(quiz),
      });
    }

    const updatedQuiz = await Quiz.findById(quiz._id)
      .populate("createdBy", "name email role")
      .populate("questions");

    return res.status(200).json({
      message: `Applied ${actions.length} AI edit${actions.length === 1 ? "" : "s"}.`,
      actions,
      quiz: normalizeQuiz(updatedQuiz),
    });
  } catch (error) {
    return next(error);
  }
}

async function joinQuiz(req, res, next) {
  try {
    const { joinCode } = req.params;
    const { participantName, attemptId: existingAttemptId } = req.body;
    const normalizedJoinCode = joinCode.toUpperCase();
    const normalizedParticipantName = String(participantName || "").trim();

    if (!normalizedParticipantName) {
      return res.status(400).json({ message: "participantName is required" });
    }

    const liveSession = await LiveSession.findOne({
      joinCode: normalizedJoinCode,
      status: { $nin: ["closed", "final_results"] },
    }).sort({ createdAt: -1 });

    if (!liveSession) {
      const asyncQuiz = await Quiz.findOne({
        joinCode: normalizedJoinCode,
        status: "published",
        mode: "async",
      }).populate("questions");

      if (asyncQuiz) {
        const availabilityError = getAvailabilityError(asyncQuiz);
        if (availabilityError) {
          return res.status(availabilityError.status).json({ message: availabilityError.message });
        }

        if (asyncQuiz.sharing?.maxParticipants && asyncQuiz.sharing.maxParticipants > 0) {
          const currentParticipants = await Attempt.countDocuments({ quiz: asyncQuiz._id });
          if (currentParticipants >= asyncQuiz.sharing.maxParticipants) {
            return res.status(403).json({ message: "Quiz is full" });
          }
        }

        const participant = await User.create({
          name: normalizedParticipantName,
          email: createInternalParticipantEmail(normalizedJoinCode),
          role: "participant",
        });
        const attempt = await Attempt.create({
          quiz: asyncQuiz._id,
          session: null,
          user: participant._id,
          status: "in_progress",
        });

        return res.status(200).json({
          message: "Started self-paced quiz",
          quiz: normalizeQuiz(asyncQuiz),
          participant: normalizeUser(participant),
          attemptId: String(attempt._id),
          asyncMode: true,
          question: normalizeAsyncQuestion(asyncQuiz, asyncQuiz.questions[0], 0, attempt._id),
          questionIndex: 0,
          totalQuestions: asyncQuiz.questions.length,
        });
      }
      return res.status(404).json({ message: "Live quiz is not accepting joins" });
    }

    const quiz = await Quiz.findById(liveSession.quiz).populate("questions");

    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    if (quiz.status !== "published") {
      return res.status(400).json({ message: "Quiz is not open for joining" });
    }

    const availabilityError = getAvailabilityError(quiz);
    if (availabilityError) {
      return res.status(availabilityError.status).json({ message: availabilityError.message });
    }

    // Rejoin path — client sends back the attemptId it stored locally.
    // Validate the attempt belongs to this exact launch session, not just this quiz.
    // That keeps repeat launches isolated while still allowing refresh/reconnect.
    if (existingAttemptId) {
      const existingAttempt = await Attempt.findById(existingAttemptId).populate("user");

      if (
        existingAttempt &&
        String(existingAttempt.quiz) === String(quiz._id) &&
        liveSession &&
        String(existingAttempt.session) === String(liveSession._id) &&
        existingAttempt.user
      ) {
        return res.status(200).json({
          message: "Rejoined quiz successfully",
          quiz: normalizeQuiz(quiz),
          participant: normalizeUser(existingAttempt.user),
          attemptId: String(existingAttempt._id),
          rejoined: true,
        });
      }
      // Attempt invalid / not for this quiz — fall through to create fresh
    }

    if (liveSession.status !== "waiting_for_players") {
      return res.status(403).json({ message: "This quiz has already started. New players cannot join." });
    }

    if (quiz.sharing?.maxParticipants && quiz.sharing.maxParticipants > 0) {
      const currentParticipants = await Attempt.countDocuments({ session: liveSession._id });
      if (currentParticipants >= quiz.sharing.maxParticipants) {
        return res.status(403).json({ message: "Quiz is full" });
      }
    }

    const participant = await User.create({
      name: normalizedParticipantName,
      email: createInternalParticipantEmail(normalizedJoinCode),
      role: "participant",
    });

    const attempt = await Attempt.create({
      quiz: quiz._id,
      session: liveSession?._id || null,
      user: participant._id,
      status: "joined",
    });

    await LiveSession.findOneAndUpdate(
      liveSession ? { _id: liveSession._id } : { quiz: quiz._id, status: { $ne: "closed" } },
      { $inc: { participantCount: 1 } }
    );

    return res.status(200).json({
      message: "Joined quiz successfully",
      quiz: normalizeQuiz(quiz),
      participant: normalizeUser(participant),
      attemptId: String(attempt._id),
      rejoined: false,
    });
  } catch (error) {
    return next(error);
  }
}

async function submitAsyncAnswer(req, res, next) {
  try {
    const { attemptId, questionId, selectedOptionIndex } = req.body;
    if (!attemptId || !questionId || selectedOptionIndex === undefined) {
      return res.status(400).json({ message: "attemptId, questionId, and selectedOptionIndex are required" });
    }

    const quiz = await Quiz.findById(req.params.quizId).populate("questions");
    if (!quiz || quiz.mode !== "async") {
      return res.status(404).json({ message: "Self-paced quiz not found" });
    }

    const { attempt, isCorrect } = await submitAttemptAnswer({
      attemptId,
      questionId,
      selectedOptionIndex:
        getAsyncOptionOrder(quiz, attemptId, quiz.questions.find((question) => String(question._id) === String(questionId)))[
          selectedOptionIndex
        ] ?? selectedOptionIndex,
      timeLimitSeconds: quiz.questionTimeLimitSeconds || 30,
    });

    if (String(attempt.quiz) !== String(quiz._id)) {
      return res.status(403).json({ message: "Attempt does not belong to this quiz" });
    }

    const answeredIds = new Set((attempt.answers || []).map((answer) => String(answer.question)));
    const nextIndex = quiz.questions.findIndex((question) => !answeredIds.has(String(question._id)));
    const complete = nextIndex === -1;

    if (complete) {
      const completedAttempt = await completeAttemptById(attempt._id);
      await updateQuestionPerformanceForAttempt(completedAttempt);
    }

    return res.status(200).json({
      isCorrect,
      score: attempt.score,
      complete,
      question: complete
        ? null
        : normalizeAsyncQuestion(quiz, quiz.questions[nextIndex], nextIndex, attemptId),
      questionIndex: complete ? quiz.questions.length : nextIndex,
      totalQuestions: quiz.questions.length,
    });
  } catch (error) {
    return next(error);
  }
}

async function getAsyncAttemptState(req, res, next) {
  try {
    const [quiz, attempt] = await Promise.all([
      Quiz.findById(req.params.quizId).populate("questions"),
      Attempt.findById(req.params.attemptId),
    ]);

    if (!quiz || quiz.mode !== "async") {
      return res.status(404).json({ message: "Self-paced quiz not found" });
    }

    if (!attempt || String(attempt.quiz) !== String(quiz._id)) {
      return res.status(404).json({ message: "Attempt not found for this quiz" });
    }

    const answeredIds = new Set((attempt.answers || []).map((answer) => String(answer.question)));
    const nextIndex = quiz.questions.findIndex((question) => !answeredIds.has(String(question._id)));
    const complete = attempt.status === "completed" || nextIndex === -1;

    return res.status(200).json({
      complete,
      score: attempt.score || 0,
      question: complete ? null : normalizeAsyncQuestion(quiz, quiz.questions[nextIndex], nextIndex, attempt._id),
      questionIndex: complete ? quiz.questions.length : nextIndex,
      totalQuestions: quiz.questions.length,
    });
  } catch (error) {
    return next(error);
  }
}

async function getQuizLeaderboard(req, res, next) {
  try {
    const leaderboard = await getLeaderboardForQuiz(req.params.quizId);
    return res
      .status(200)
      .json(leaderboard.map((entry, index) => normalizeLeaderboardEntry(entry, index + 1)));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createQuiz,
  createQuizFromTopic,
  listQuizzes,
  getQuizById,
  publishQuiz,
  updateQuizSettings,
  updateQuizStatus,
  updateQuestion,
  deleteQuestion,
  aiEditQuiz,
  joinQuiz,
  submitAsyncAnswer,
  getAsyncAttemptState,
  getQuizLeaderboard,
};
