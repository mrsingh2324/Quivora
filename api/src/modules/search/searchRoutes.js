const express = require("express");

const Assignment = require("../assignments/Assignment");
const UploadedDocument = require("../documents/UploadedDocument");
const LiveSession = require("../live-sessions/LiveSession");
const Question = require("../question-bank/Question");
const Quiz = require("../quiz-publishing/Quiz");
const SupportArticle = require("../support/SupportArticle");
const SupportRequest = require("../support/SupportRequest");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

const helpEntries = [
  ["Help Center", "Guides for quiz creation, live rooms, reports, assignments, and troubleshooting.", "/support/help-center", "help guide docs support"],
  ["Contact Support", "Create and track support requests for account, quiz, report, and live-session issues.", "/account/support-requests", "contact support ticket request"],
  ["User Guide", "Step-by-step workflow from first quiz to final report.", "/support/user-guide", "guide create launch report"],
  ["Assignments", "Select preparation material and track completion.", "/assignments", "assignment preparation learner material"],
];

function regexFor(query) {
  return new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function makeResult(type, title, description, to, keywords = "", id = "") {
  return { type, title, description, to, keywords, id };
}

function rank(result, query) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${result.title} ${result.description} ${result.keywords}`.toLowerCase();
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 2 : 0) + (result.title.toLowerCase().startsWith(term) ? 3 : 0), 0);
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 8));
    const userId = req.user.userId;

    if (!q) {
      return res.status(200).json([]);
    }

    const rx = regexFor(q);
    const isAdminLike = ["admin", "admin_player"].includes(req.user.role);
    const quizFilter = isAdminLike
      ? { createdBy: userId }
      : { status: "published" };

    const scopedQuizzes = await Quiz.find(quizFilter).select("_id questions");
    const scopedQuizIds = scopedQuizzes.map((quiz) => quiz._id);
    const scopedQuestionIds = scopedQuizzes.flatMap((quiz) => quiz.questions || []);

    const [quizzes, questions, sessions, documents, assignments, supportRequests, articles] = await Promise.all([
      Quiz.find({
        ...quizFilter,
        $or: [{ title: rx }, { description: rx }, { category: rx }, { joinCode: rx }],
      }).select("title description category status totalQuestions").limit(limit),
      Question.find({
        _id: { $in: scopedQuestionIds },
        $or: [{ prompt: rx }, { explanation: rx }, { difficulty: rx }],
      }).select("prompt difficulty sourceType").limit(limit),
      LiveSession.find({ quiz: { $in: scopedQuizIds }, joinCode: rx }).select("joinCode status createdAt").limit(limit),
      UploadedDocument.find({ admin: userId, $or: [{ title: rx }, { originalName: rx }, { extractedText: rx }] }).select("title originalName").limit(limit),
      Assignment.find({ status: "published", $or: [{ title: rx }, { description: rx }, { tags: rx }] }).select("title description difficulty").limit(limit),
      SupportRequest.find({
        ...(isAdminLike ? {} : { requester: userId }),
        $or: [{ subject: rx }, { description: rx }, { category: rx }, { status: rx }],
      }).select("subject category status").limit(limit),
      SupportArticle.find({ status: "published", $or: [{ title: rx }, { body: rx }, { tags: rx }, { category: rx }] }).select("slug title category body tags").limit(limit),
    ]);

    const results = [
      ...quizzes.map((quiz) =>
        makeResult("Quiz", quiz.title, `${quiz.totalQuestions || 0} questions · ${quiz.status}`, `/quizzes/${quiz._id}/review`, quiz.category, String(quiz._id))
      ),
      ...questions.map((question) =>
        makeResult("Question", question.prompt, `${question.difficulty || "medium"} · ${question.sourceType || "manual"}`, "/question-bank", question.explanation, String(question._id))
      ),
      ...sessions.map((session) =>
        makeResult("Session", session.joinCode, `${session.status} · ${session.createdAt?.toISOString?.() || ""}`, "/active-quizzes", "", String(session._id))
      ),
      ...documents.map((document) =>
        makeResult("Document", document.title, document.originalName || "Uploaded material", "/build/materials", "", String(document._id))
      ),
      ...assignments.map((assignment) =>
        makeResult("Assignment", assignment.title, `${assignment.difficulty} preparation material`, "/assignments", assignment.description, String(assignment._id))
      ),
      ...supportRequests.map((request) =>
        makeResult("Support", request.subject, `${request.category} · ${request.status}`, "/account/support-requests", "", String(request._id))
      ),
      ...articles.map((article) =>
        makeResult("Help Article", article.title, `${article.category} · ${article.body.slice(0, 120)}`, `/support/${article.slug}`, (article.tags || []).join(" "), String(article._id))
      ),
      ...helpEntries
        .filter(([title, description, , keywords]) =>
          `${title} ${description} ${keywords}`.toLowerCase().includes(q.toLowerCase())
        )
        .map(([title, description, to, keywords]) =>
          makeResult("Help", title, description, to, keywords, title)
        ),
    ];

    return res.status(200).json(results.map((result) => ({ ...result, score: rank(result, q) })).sort((a, b) => b.score - a.score).slice(0, limit));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
