const Assignment = require("./Assignment");
const AssignmentSelection = require("./AssignmentSelection");
const Quiz = require("../quiz-publishing/Quiz");

function normalizeAssignment(assignment, selection = null) {
  const quiz = assignment.quiz;

  return {
    id: String(assignment._id || assignment.id),
    title: assignment.title,
    description: assignment.description || "",
    quiz: quiz
      ? {
          id: String(quiz._id || quiz),
          title: quiz.title || "",
          status: quiz.status || "",
          totalQuestions: quiz.totalQuestions || quiz.questions?.length || 0,
        }
      : null,
    createdBy: assignment.createdBy
      ? {
          id: String(assignment.createdBy._id || assignment.createdBy),
          name: assignment.createdBy.name || "",
          email: assignment.createdBy.email || "",
        }
      : null,
    audience: assignment.audience,
    difficulty: assignment.difficulty,
    tags: assignment.tags || [],
    materials: assignment.materials || [],
    status: assignment.status,
    selection: selection
      ? {
          id: String(selection._id || selection.id),
          status: selection.status,
          progressPercent: selection.progressPercent || 0,
          selectedAt: selection.selectedAt,
          completedAt: selection.completedAt,
        }
      : null,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

async function listAssignments(req, res, next) {
  try {
    const assignments = await Assignment.find({ status: { $ne: "archived" } })
      .populate("quiz", "title status totalQuestions questions")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 });

    const selections = req.user
      ? await AssignmentSelection.find({ learner: req.user.userId })
      : [];
    const selectionByAssignment = new Map(
      selections.map((selection) => [String(selection.assignment), selection])
    );

    return res.status(200).json(
      assignments.map((assignment) =>
        normalizeAssignment(assignment, selectionByAssignment.get(String(assignment._id)))
      )
    );
  } catch (error) {
    return next(error);
  }
}

async function createAssignment(req, res, next) {
  try {
    const {
      title,
      description = "",
      quizId = null,
      audience = "public",
      difficulty = "medium",
      tags = [],
      materials = [],
      status = "published",
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "title is required" });
    }

    if (quizId) {
      const quiz = await Quiz.findOne({ _id: quizId, createdBy: req.user.userId });
      if (!quiz) {
        return res.status(404).json({ message: "Quiz not found for this workspace" });
      }
    }

    const assignment = await Assignment.create({
      title: title.trim(),
      description: description.trim(),
      quiz: quizId || null,
      createdBy: req.user.userId,
      audience,
      difficulty,
      tags: Array.isArray(tags) ? tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
      materials: Array.isArray(materials) ? materials : [],
      status,
    });

    await assignment.populate("quiz", "title status totalQuestions questions");
    await assignment.populate("createdBy", "name email");
    return res.status(201).json(normalizeAssignment(assignment));
  } catch (error) {
    return next(error);
  }
}

async function selectAssignment(req, res, next) {
  try {
    const assignment = await Assignment.findOne({
      _id: req.params.assignmentId,
      status: "published",
    })
      .populate("quiz", "title status totalQuestions questions")
      .populate("createdBy", "name email");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    const selection = await AssignmentSelection.findOneAndUpdate(
      { assignment: assignment._id, learner: req.user.userId },
      { $setOnInsert: { status: "selected", selectedAt: new Date() } },
      { new: true, upsert: true }
    );

    return res.status(200).json(normalizeAssignment(assignment, selection));
  } catch (error) {
    return next(error);
  }
}

async function updateSelection(req, res, next) {
  try {
    const { status, progressPercent } = req.body;
    const selection = await AssignmentSelection.findOne({
      assignment: req.params.assignmentId,
      learner: req.user.userId,
    }).populate({
      path: "assignment",
      populate: [
        { path: "quiz", select: "title status totalQuestions questions" },
        { path: "createdBy", select: "name email" },
      ],
    });

    if (!selection) {
      return res.status(404).json({ message: "Assignment selection not found" });
    }

    if (status) selection.status = status;
    if (progressPercent !== undefined) {
      selection.progressPercent = Math.max(0, Math.min(100, Number(progressPercent)));
    }
    if (selection.status === "completed") {
      selection.progressPercent = 100;
      selection.completedAt = selection.completedAt || new Date();
    }

    await selection.save();
    return res.status(200).json(normalizeAssignment(selection.assignment, selection));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAssignment,
  listAssignments,
  selectAssignment,
  updateSelection,
};
