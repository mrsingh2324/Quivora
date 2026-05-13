const Attempt = require("./Attempt");
const {
  completeAttemptById,
  submitAttemptAnswer,
} = require("./attemptService");
const { generateCertificatePdf } = require("./certificateService");

async function getAttemptById(req, res, next) {
  try {
    const attempt = await Attempt.findById(req.params.attemptId)
      .populate("quiz", "title joinCode")
      .populate("user", "name email")
      .populate("answers.question", "prompt");

    if (!attempt) {
      return res.status(404).json({ message: "Attempt not found" });
    }

    return res.status(200).json(attempt);
  } catch (error) {
    return next(error);
  }
}

async function submitAnswer(req, res, next) {
  try {
    const { questionId, selectedOptionIndex } = req.body;

    if (!questionId || selectedOptionIndex === undefined) {
      return res.status(400).json({
        message: "questionId and selectedOptionIndex are required",
      });
    }

    const { attempt } = await submitAttemptAnswer({
      attemptId: req.params.attemptId,
      questionId,
      selectedOptionIndex,
    });

    return res.status(200).json(attempt);
  } catch (error) {
    return next(error);
  }
}

async function completeAttempt(req, res, next) {
  try {
    const attempt = await completeAttemptById(req.params.attemptId);

    return res.status(200).json(attempt);
  } catch (error) {
    return next(error);
  }
}

async function getCertificate(req, res, next) {
  try {
    const attempt = await Attempt.findById(req.params.attemptId)
      .populate("quiz", "title")
      .populate("user", "name email");

    if (!attempt) return res.status(404).json({ message: "Attempt not found" });
    if (attempt.status !== "completed") {
      return res.status(400).json({ message: "Certificate is available after completion" });
    }

    const doc = generateCertificatePdf({
      attempt,
      quiz: attempt.quiz,
      user: attempt.user,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="certificate-${String(attempt._id)}.pdf"`
    );
    doc.pipe(res);
    doc.end();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAttemptById,
  submitAnswer,
  completeAttempt,
  getCertificate,
};
