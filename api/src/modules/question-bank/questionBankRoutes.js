const express = require("express");

const Question = require("./Question");
const Quiz = require("../quiz-publishing/Quiz");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

function scoreQuestionQuality(question) {
  const prompt = String(question.prompt || "");
  const options = Array.isArray(question.options) ? question.options : [];
  const notes = [];
  const uniqueOptions = new Set(options.map((option) => String(option).trim().toLowerCase()));

  if (prompt.length < 24) notes.push("Prompt may be too short.");
  if (prompt.length > 220) notes.push("Prompt may be too long for live play.");
  if (options.length !== 4) notes.push("Question should have exactly four options.");
  if (uniqueOptions.size !== options.length) notes.push("Duplicate answer options detected.");
  if (!question.explanation) notes.push("Missing explanation.");
  if (/\b(all of the above|none of the above)\b/i.test(options.join(" "))) {
    notes.push("Avoid all/none-of-the-above options for clearer scoring.");
  }

  const ambiguityRisk = notes.length >= 3 ? "high" : notes.length >= 1 ? "medium" : "low";
  const clarity = Math.max(1, Math.min(10, 10 - notes.length * 2));
  const promptLower = prompt.toLowerCase();
  const blooms = /\b(why|compare|analyze|evaluate)\b/.test(promptLower)
    ? "analyze"
    : /\b(apply|solve|use|calculate)\b/.test(promptLower)
      ? "apply"
      : /\b(explain|describe|identify)\b/.test(promptLower)
        ? "understand"
        : "remember";

  return {
    qualityScore: Math.max(30, clarity * 10),
    qualityNotes: notes,
    qualityMeta: {
      clarity,
      blooms,
      ambiguityRisk,
      difficulty: question.difficulty || "medium",
    },
  };
}

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const difficulty = String(req.query.difficulty || "").trim();
    const sourceType = String(req.query.sourceType || "").trim();
    const minAccuracy = req.query.minAccuracy !== undefined ? Number(req.query.minAccuracy) : null;

    const quizzes = await Quiz.find({ createdBy: req.user.userId }).select("questions title");
    const questionIds = quizzes.flatMap((quiz) => quiz.questions);
    const quizByQuestion = new Map();

    quizzes.forEach((quiz) => {
      quiz.questions.forEach((questionId) => {
        quizByQuestion.set(String(questionId), { id: String(quiz._id), title: quiz.title });
      });
    });

    const filter = { _id: { $in: questionIds } };
    if (q) filter.prompt = { $regex: q, $options: "i" };
    if (["easy", "medium", "hard"].includes(difficulty)) filter.difficulty = difficulty;
    if (sourceType) filter.sourceType = sourceType;
    if (Number.isFinite(minAccuracy)) filter.avgCorrectRate = { $gte: minAccuracy };

    const questions = await Question.find(filter).sort({ updatedAt: -1 }).limit(100);

    return res.status(200).json(
      questions.map((question) => ({
        id: String(question._id),
        prompt: question.prompt,
        options: question.options || [],
        correctOptionIndex: question.correctOptionIndex,
        difficulty: question.difficulty || "medium",
        sourceType: question.sourceType || "manual",
        explanation: question.explanation || "",
        reusable: question.reusable !== false,
        tags: question.tags || [],
        usageCount: question.usageCount || 0,
        avgCorrectRate: question.avgCorrectRate || 0,
        sessions: question.sessions || [],
        qualityScore: question.qualityScore || 70,
        qualityNotes: question.qualityNotes || [],
        qualityMeta: question.qualityMeta || {},
        quiz: quizByQuestion.get(String(question._id)) || null,
        updatedAt: question.updatedAt,
      }))
    );
  } catch (error) {
    return next(error);
  }
});

router.post("/quality-score", requireAdmin, async (req, res, next) => {
  try {
    const { questions = [], questionIds = [] } = req.body;
    let targets = questions;

    if (questionIds.length) {
      const ownedQuizzes = await Quiz.find({ createdBy: req.user.userId }).select("questions");
      const ownedQuestionIds = new Set(ownedQuizzes.flatMap((quiz) => quiz.questions).map(String));
      targets = await Question.find({
        _id: { $in: questionIds.filter((id) => ownedQuestionIds.has(String(id))) },
      });
    }

    const results = targets.map((question) => {
      const scored = scoreQuestionQuality(question);
      return {
        id: question._id ? String(question._id) : question.id || null,
        prompt: question.prompt,
        ...scored,
      };
    });

    if (questionIds.length && results.length) {
      await Promise.all(
        results
          .filter((result) => result.id)
          .map((result) =>
            Question.updateOne(
              { _id: result.id },
              {
                $set: {
                  qualityScore: result.qualityScore,
                  qualityNotes: result.qualityNotes,
                  qualityMeta: result.qualityMeta,
                },
              }
            )
          )
      );
    }

    return res.status(200).json({ questions: results });
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { prompt, options, correctOptionIndex, difficulty = "medium", explanation = "", tags = [] } = req.body;
    if (!prompt || !Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ message: "prompt and four options are required" });
    }
    const notes = [];
    if (prompt.length < 20) notes.push("Prompt is short; check clarity.");
    if (!explanation) notes.push("Missing explanation.");
    if (new Set(options.map((option) => String(option).trim().toLowerCase())).size < 4) notes.push("Duplicate answer options detected.");
    const question = await Question.create({
      prompt,
      options,
      correctOptionIndex,
      difficulty,
      explanation,
      tags,
      reusable: true,
      sourceType: "manual",
      qualityScore: Math.max(30, 100 - notes.length * 15),
      qualityNotes: notes,
    });
    res.status(201).json({ id: String(question._id), prompt: question.prompt, qualityScore: question.qualityScore, qualityNotes: question.qualityNotes });
  } catch (error) {
    next(error);
  }
});

router.post("/:questionId/add-to-quiz/:quizId", requireAdmin, async (req, res, next) => {
  try {
    const [question, quiz] = await Promise.all([
      Question.findById(req.params.questionId),
      Quiz.findOne({ _id: req.params.quizId, createdBy: req.user.userId }),
    ]);
    if (!question) return res.status(404).json({ message: "Question not found" });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    if (!quiz.questions.some((id) => String(id) === String(question._id))) {
      quiz.questions.push(question._id);
      quiz.totalQuestions = quiz.questions.length;
      await quiz.save();
      question.usageCount = (question.usageCount || 0) + 1;
      await question.save();
    }
    res.status(200).json({ quizId: String(quiz._id), totalQuestions: quiz.totalQuestions, usageCount: question.usageCount });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
