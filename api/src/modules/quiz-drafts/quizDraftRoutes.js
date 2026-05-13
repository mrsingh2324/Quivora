const express = require("express");

const Question = require("../question-bank/Question");
const Quiz = require("../quiz-publishing/Quiz");
const generateJoinCode = require("../quiz-publishing/generateJoinCode");
const QuizDraft = require("./QuizDraft");
const { requireAdmin } = require("../../middleware/auth");
const { normalizeQuiz } = require("../../utils/normalize");

const router = express.Router();

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = generateJoinCode();
    const existing = await Quiz.findOne({ joinCode }).select("_id");
    if (!existing) return joinCode;
  }
  throw new Error("Unable to generate a unique join code");
}

function normalizeDraft(draft) {
  return {
    id: String(draft._id),
    title: draft.title,
    sourceType: draft.sourceType,
    payload: draft.payload || {},
    status: draft.status,
    promotedQuiz: draft.promotedQuiz ? String(draft.promotedQuiz) : null,
    lastSavedAt: draft.lastSavedAt,
    updatedAt: draft.updatedAt,
  };
}

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const drafts = await QuizDraft.find({
      owner: req.user.userId,
      status: { $ne: "archived" },
    })
      .sort({ updatedAt: -1 })
      .limit(50);

    return res.status(200).json(drafts.map(normalizeDraft));
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { title = "Untitled draft", sourceType = "topic", payload = {} } = req.body;
    const draft = await QuizDraft.create({
      owner: req.user.userId,
      title: String(title || "Untitled draft").trim() || "Untitled draft",
      sourceType: ["topic", "materials", "template"].includes(sourceType) ? sourceType : "topic",
      payload,
      lastSavedAt: new Date(),
    });

    return res.status(201).json(normalizeDraft(draft));
  } catch (error) {
    return next(error);
  }
});

router.put("/:draftId", requireAdmin, async (req, res, next) => {
  try {
    const { title, sourceType, payload } = req.body;
    const update = { lastSavedAt: new Date() };
    if (title !== undefined) update.title = String(title || "Untitled draft").trim() || "Untitled draft";
    if (sourceType !== undefined && ["topic", "materials", "template"].includes(sourceType)) update.sourceType = sourceType;
    if (payload !== undefined) update.payload = payload;

    const draft = await QuizDraft.findOneAndUpdate(
      { _id: req.params.draftId, owner: req.user.userId, status: "draft" },
      update,
      { new: true }
    );

    if (!draft) return res.status(404).json({ message: "Draft not found" });
    return res.status(200).json(normalizeDraft(draft));
  } catch (error) {
    return next(error);
  }
});

router.post("/:draftId/publish", requireAdmin, async (req, res, next) => {
  try {
    const draft = await QuizDraft.findOne({
      _id: req.params.draftId,
      owner: req.user.userId,
      status: "draft",
    });

    if (!draft) return res.status(404).json({ message: "Draft not found" });

    const payload = draft.payload || {};
    const questionPayloads = Array.isArray(payload.questions) && payload.questions.length
      ? payload.questions
      : [
          {
            prompt: `Draft question for ${draft.title}`,
            options: ["Correct answer", "Distractor A", "Distractor B", "Distractor C"],
            correctOptionIndex: 0,
            difficulty: payload.difficulty || "medium",
            explanation: "Review and replace this draft question before launching.",
          },
        ];
    const questions = await Question.insertMany(
      questionPayloads.map((question) => ({
        prompt: question.prompt,
        options: question.options,
        correctOptionIndex: question.correctOptionIndex || 0,
        difficulty: question.difficulty || payload.difficulty || "medium",
        explanation: question.explanation || "",
        sourceType: "manual",
      }))
    );
    const joinCode = await generateUniqueJoinCode();
    const quiz = await Quiz.create({
      title: draft.title,
      description: payload.topic || payload.description || "Created from a saved draft.",
      category: payload.category || "draft",
      createdBy: req.user.userId,
      questions: questions.map((question) => question._id),
      joinCode,
      status: "draft",
      totalQuestions: questions.length,
    });

    draft.status = "published";
    draft.promotedQuiz = quiz._id;
    await draft.save();
    await quiz.populate("questions");
    await quiz.populate("createdBy", "name email role");

    return res.status(201).json({ draft: normalizeDraft(draft), quiz: normalizeQuiz(quiz) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
