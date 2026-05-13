const Attempt = require("../answers/Attempt");
const UploadedDocument = require("../documents/UploadedDocument");
const LiveSession = require("../live-sessions/LiveSession");
const Question = require("../question-bank/Question");
const Quiz = require("../quiz-publishing/Quiz");
const SupportArticle = require("../support/SupportArticle");
const generateJoinCode = require("../quiz-publishing/generateJoinCode");
const { analyzeTopicText } = require("../../services/aiService");
const { retrieveWorkspaceEmbeddings, upsertWorkspaceEmbedding } = require("./embeddingService");
const { normalizeLiveSession, normalizeQuiz } = require("../../utils/normalize");

const supportKnowledge = [
  "Create quizzes from topic text, uploaded documents, or templates.",
  "Launch creates a live session with a join code and QR player link.",
  "Reports include average score, completed attempts, hardest questions, and CSV exports.",
  "Use the profile menu for profile, workspace settings, admin console, support requests, and logout.",
];

const templateKnowledge = [
  "Coding Interview Templates",
  "School Exam Templates",
  "Corporate Training Templates",
  "HR Screening Templates",
  "Cybersecurity Quiz Templates",
  "AWS/DevOps Quiz Templates",
  "Language Learning Templates",
];

function parseCount(text, fallback = 5) {
  const match = text.match(/\b(\d{1,2})\b/);
  if (!match) return fallback;
  return Math.max(1, Math.min(Number(match[1]), 20));
}

function inferDifficulty(text) {
  if (/\b(hard|harder|advanced|difficult)\b/i.test(text)) return "hard";
  if (/\b(easy|easier|basic|beginner)\b/i.test(text)) return "easy";
  if (/\b(medium|intermediate)\b/i.test(text)) return "medium";
  return "medium";
}

function titleFromPrompt(prompt) {
  const cleaned = prompt
    .replace(/create|generate|build|make|quiz|questions?|mcqs?|for|about/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "AI Generated Quiz";

  return `${cleaned
    .split(" ")
    .slice(0, 7)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")} Quiz`;
}

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const joinCode = generateJoinCode();
    const existing = await Quiz.findOne({ joinCode }).select("_id");
    if (!existing) return joinCode;
  }

  throw new Error("Unable to generate a unique join code");
}

function buildDraftQuestions(topic, count, difficulty) {
  return Array.from({ length: count }, (_, index) => ({
    prompt: `${topic}: question ${index + 1}`,
    options: [
      `Correct concept for ${topic}`,
      `Common misconception ${index + 1}`,
      `Unrelated option ${index + 1}`,
      `Partially correct option ${index + 1}`,
    ],
    correctOptionIndex: 0,
    sourceType: "ai_generated",
    difficulty,
    explanation: `This checks the core concept for ${topic}. Replace this draft with a refined question if needed.`,
  }));
}

function findTargetQuiz({ quizzes, message, selectedQuizId }) {
  if (selectedQuizId) {
    const selected = quizzes.find((quiz) => String(quiz._id) === String(selectedQuizId));
    if (selected) return selected;
  }

  const text = message.toLowerCase();
  const titleMatch = quizzes.find((quiz) => quiz.title && text.includes(quiz.title.toLowerCase()));
  if (titleMatch) return titleMatch;

  return quizzes.length === 1 ? quizzes[0] : null;
}

function summarizeReports(quizzes, attempts) {
  if (!attempts.length) {
    return "No participant results exist yet. Launch a quiz and collect responses to generate report insights.";
  }

  const byQuiz = new Map();
  attempts.forEach((attempt) => {
    const quizId = String(attempt.quiz?._id || attempt.quiz);
    const current = byQuiz.get(quizId) || { attempts: 0, completed: 0, score: 0 };
    current.attempts += 1;
    current.completed += attempt.status === "completed" ? 1 : 0;
    current.score += attempt.score || 0;
    byQuiz.set(quizId, current);
  });

  const ranked = [...byQuiz.entries()]
    .map(([quizId, stat]) => ({
      quiz: quizzes.find((quiz) => String(quiz._id) === quizId),
      average: Math.round(stat.score / stat.attempts),
      attempts: stat.attempts,
      completed: stat.completed,
    }))
    .filter((item) => item.quiz)
    .sort((a, b) => b.average - a.average);

  const best = ranked[0];
  if (!best) return "Reports are connected, but no matching quiz results were found for your workspace.";

  return `Best-performing quiz: ${best.quiz.title} with ${best.average} average score across ${best.attempts} attempt${best.attempts === 1 ? "" : "s"}.`;
}

function tokenize(text) {
  return String(text || "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
}

function scoreSource(message, source) {
  const terms = new Set(tokenize(message));
  const body = tokenize(`${source.title} ${source.text}`);
  if (!terms.size || !body.length) return 0;
  return body.reduce((score, token) => score + (terms.has(token) ? 1 : 0), 0);
}

function buildWorkspaceSources({ quizzes, documents, attempts, sessions, articles }) {
  return [
    ...quizzes.map((quiz) => ({
      type: "quiz",
      id: String(quiz._id),
      title: quiz.title,
      text: `${quiz.description || ""} ${quiz.category || ""} ${(quiz.questions || []).map((question) => `${question.prompt} ${question.explanation || ""}`).join(" ")}`,
      route: `/quizzes/${quiz._id}/review`,
    })),
    ...documents.map((document) => ({
      type: "document",
      id: String(document._id),
      title: document.title,
      text: document.rawText || document.extractedText || "",
      route: "/build/materials",
    })),
    ...attempts.map((attempt) => ({
      type: "report",
      id: String(attempt._id),
      title: attempt.quiz?.title || "Participant attempt",
      text: `${attempt.user?.name || ""} score ${attempt.score || 0} status ${attempt.status}`,
      route: "/reports",
    })),
    ...sessions.map((session) => ({
      type: "session",
      id: String(session._id),
      title: session.joinCode,
      text: `${session.status} ${session.joinCode}`,
      route: "/active-quizzes",
    })),
    ...articles.map((article) => ({
      type: "support",
      id: String(article._id),
      title: article.title,
      text: article.body,
      route: `/support/${article.slug}`,
    })),
  ];
}

function retrieveSources(message, sources, limit = 5) {
  return sources
    .map((source) => ({ ...source, score: scoreSource(message, source) }))
    .filter((source) => source.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function createQuizFromAssistant({ message, userId }) {
  const count = parseCount(message, 5);
  const difficulty = inferDifficulty(message);
  const title = titleFromPrompt(message);
  const topic = title.replace(/\sQuiz$/i, "");
  let generatedQuestions = null;

  try {
    const aiResult = await analyzeTopicText({ topic: message, difficulty, count });
    if (Array.isArray(aiResult.questions) && aiResult.questions.length) {
      generatedQuestions = aiResult.questions.map((question) => ({
        ...question,
        questionType: "multiple_choice",
        sourceType: aiResult.containsQuestions ? "document" : "ai_generated",
      }));
    }
  } catch (error) {
    console.warn("[Workspace Assistant] Gemini quiz generation failed, using reviewable draft fallback:", error.message);
  }

  const questions = await Question.insertMany(generatedQuestions || buildDraftQuestions(topic, count, difficulty));
  const joinCode = await generateUniqueJoinCode();
  const quiz = await Quiz.create({
    title,
    description: `Created by Workspace AI Assistant from: ${message}`,
    category: "assistant-generated",
    createdBy: userId,
    questions: questions.map((question) => question._id),
    joinCode,
    status: "draft",
    totalQuestions: questions.length,
    questionTimeLimitSeconds: 20,
    resultsWindowSeconds: 5,
  });

  return Quiz.findById(quiz._id).populate("createdBy", "name email role").populate("questions");
}

async function editQuizFromAssistant({ quiz, message }) {
  const text = message.toLowerCase();
  const actions = [];

  if (/\b(hard|harder|easy|easier|medium|intermediate)\b/.test(text)) {
    const difficulty = inferDifficulty(text);
    await Question.updateMany({ _id: { $in: quiz.questions } }, { $set: { difficulty } });
    actions.push(`set difficulty to ${difficulty}`);
  }

  if (/add|create|generate/.test(text) && /questions?/.test(text)) {
    const count = parseCount(text, 5);
    const questions = await Question.insertMany(
      buildDraftQuestions(`${quiz.title} extension`, count, inferDifficulty(text))
    );
    quiz.questions.push(...questions.map((question) => question._id));
    quiz.totalQuestions = quiz.questions.length;
    await quiz.save();
    actions.push(`added ${count} draft questions`);
  }

  if (/explanations?|rationale|explain/.test(text)) {
    const questions = await Question.find({ _id: { $in: quiz.questions } });
    await Promise.all(
      questions
        .filter((question) => !question.explanation)
        .map((question) =>
          Question.updateOne(
            { _id: question._id },
            {
              $set: {
                explanation: `The correct answer is "${question.options[question.correctOptionIndex]}".`,
              },
            }
          )
        )
    );
    actions.push("added missing explanations");
  }

  if (/interview/.test(text)) {
    const questions = await Question.find({ _id: { $in: quiz.questions } });
    await Promise.all(
      questions.map((question, index) =>
        Question.updateOne(
          { _id: question._id },
          { $set: { prompt: `Interview MCQ ${index + 1}: ${question.prompt}` } }
        )
      )
    );
    actions.push("converted prompts to interview-style MCQs");
  }

  if (/duplicate/.test(text)) {
    const questions = await Question.find({ _id: { $in: quiz.questions } });
    const seen = new Set();
    const keepIds = [];
    const removeIds = [];

    questions.forEach((question) => {
      const key = question.prompt.trim().toLowerCase();
      if (seen.has(key)) {
        removeIds.push(question._id);
      } else {
        seen.add(key);
        keepIds.push(question._id);
      }
    });

    if (removeIds.length) {
      quiz.questions = keepIds;
      quiz.totalQuestions = keepIds.length;
      await quiz.save();
      await Question.deleteMany({ _id: { $in: removeIds } });
    }
    actions.push(`removed ${removeIds.length} duplicate questions`);
  }

  if (!actions.length) {
    actions.push("no structural edit was needed");
  }

  const updatedQuiz = await Quiz.findById(quiz._id)
    .populate("createdBy", "name email role")
    .populate("questions");

  return { actions, quiz: updatedQuiz };
}

async function launchQuizFromAssistant({ quiz, userId }) {
  if (quiz.status !== "published") {
    quiz.status = "published";
    await quiz.save();
  }

  const session = await LiveSession.create({
    quiz: quiz._id,
    host: userId,
    joinCode: quiz.joinCode,
    status: "waiting_for_players",
  });

  return session;
}

async function queryWorkspaceAssistant(req, res, next) {
  try {
    const { message, selectedQuizId } = req.body;
    const userId = req.user?.userId;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    const [quizzes, documents, articles] = await Promise.all([
      Quiz.find({ createdBy: userId }).populate("createdBy", "name email role").populate("questions").sort({ updatedAt: -1 }),
      UploadedDocument.find({ admin: userId }).sort({ updatedAt: -1 }).limit(12),
      SupportArticle.find({ status: "published" }).sort({ updatedAt: -1 }).limit(20),
    ]);
    const quizIds = quizzes.map((quiz) => quiz._id);
    const [attempts, sessions] = await Promise.all([
      Attempt.find({ quiz: { $in: quizIds } }).populate("quiz", "title").populate("user", "name email"),
      LiveSession.find({ quiz: { $in: quizIds } }).sort({ createdAt: -1 }).limit(8),
    ]);

    const text = message.toLowerCase();
    const context = {
      quizzes: quizzes.length,
      documents: documents.length,
      attempts: attempts.length,
      sessions: sessions.length,
      templates: templateKnowledge,
      support: supportKnowledge,
    };
    const retrievedSources = retrieveSources(
      message,
      buildWorkspaceSources({ quizzes, documents, attempts, sessions, articles })
    );
    const storedSources = await retrieveWorkspaceEmbeddings({
      owner: userId,
      query: message,
      limit: 5,
    });
    const combinedSources = [...storedSources, ...retrievedSources]
      .filter((source, index, list) =>
        list.findIndex((item) => item.type === source.type && item.id === source.id) === index
      )
      .slice(0, 5);
    const citations = retrievedSources.map((source) => ({
      type: source.type,
      id: source.id,
      title: source.title,
      route: source.route,
      score: source.score,
    }));
    const storedCitations = combinedSources.map((source) => ({
      type: source.type,
      id: source.id,
      title: source.title,
      route: source.route,
      score: source.score,
    }));

    if (/\b(create|generate|build)\b/.test(text) && /\bquiz\b/.test(text)) {
      const quiz = await createQuizFromAssistant({ message, userId });
      return res.status(200).json({
        answer: `Created "${quiz.title}" with ${quiz.totalQuestions} ${inferDifficulty(text)} draft questions. Review it in your workspace before launch.`,
        action: "quiz_created",
        refreshQuizzes: true,
        quiz: normalizeQuiz(quiz),
        context,
        citations: storedCitations,
      });
    }

    if (
      /\b(make|convert|add|remove)\b/.test(text) &&
      /\b(question|questions|explanation|explanations|harder|easier|intermediate|duplicate|interview)\b/.test(text)
    ) {
      const quiz = findTargetQuiz({ quizzes, message, selectedQuizId });
      if (!quiz) {
        return res.status(200).json({
          answer: "I could not find a quiz to edit. Create or select a quiz first, then try the edit prompt again.",
          action: "needs_quiz",
          context,
        });
      }

      const result = await editQuizFromAssistant({ quiz, message });
      return res.status(200).json({
        answer: `Updated "${result.quiz.title}": ${result.actions.join(", ")}.`,
        action: "quiz_edited",
        refreshQuizzes: true,
        quiz: normalizeQuiz(result.quiz),
        context,
        citations: storedCitations,
      });
    }

    if (/\b(launch|start|host)\b/.test(text) && /\bquiz|session|live\b/.test(text)) {
      const quiz = findTargetQuiz({ quizzes, message, selectedQuizId });
      if (!quiz) {
        return res.status(200).json({
          answer: "I could not find a quiz to launch. Select a quiz or mention the quiz title.",
          action: "needs_quiz",
          context,
        });
      }

      const session = await launchQuizFromAssistant({ quiz, userId });
      return res.status(200).json({
        answer: `Launched "${quiz.title}". Join code: ${session.joinCode}.`,
        action: "session_created",
        session: normalizeLiveSession(session),
        context,
        citations: storedCitations,
      });
    }

    if (/\b(best|performing|score|report|analytics|results)\b/.test(text)) {
      return res.status(200).json({
        answer: summarizeReports(quizzes, attempts),
        action: "report_answer",
        context,
        citations: storedCitations,
      });
    }

    if (/\b(document|docs|upload|uploaded)\b/.test(text)) {
      const titles = documents.slice(0, 5).map((document) => document.title).join(", ");
      return res.status(200).json({
        answer: documents.length
          ? `I found ${documents.length} uploaded document${documents.length === 1 ? "" : "s"} in your workspace: ${titles}. You can generate quizzes from uploaded PDF/DOCX files in the create panel.`
          : "No uploaded documents are connected to your workspace yet.",
        action: "document_answer",
        context,
        citations: storedCitations,
      });
    }

    if (/\b(template|marketplace)\b/.test(text)) {
      return res.status(200).json({
        answer: `Available template families: ${templateKnowledge.join(", ")}. Open Templates from the header to browse ready and upcoming categories.`,
        action: "template_answer",
        context,
        citations: storedCitations,
      });
    }

    return res.status(200).json({
      answer: `I searched your workspace: ${quizzes.length} quizzes, ${attempts.length} attempts, ${documents.length} uploaded docs, and ${sessions.length} launch sessions. Ask me to create a quiz, edit a selected quiz, launch a quiz, summarize reports, or find templates.`,
      action: "context_answer",
      context,
      citations: storedCitations,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  queryWorkspaceAssistant,
  upsertWorkspaceEmbedding,
};
