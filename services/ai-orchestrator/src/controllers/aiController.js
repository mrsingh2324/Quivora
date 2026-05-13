const { processQuizText } = require("../services/quizAnalysisService");

async function analyzeText(req, res, next) {
  console.log("[AI Controller] Request received:", {
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  try {
    const { text, difficulty, count } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      console.log("[AI Controller] Validation error: text is required");
      return res.status(400).json({
        message: "text is required",
      });
    }

    if (difficulty !== undefined && !["easy", "medium", "hard"].includes(difficulty)) {
      console.log("[AI Controller] Validation error: invalid difficulty", { difficulty });
      return res.status(400).json({
        message: "difficulty must be one of: easy, medium, hard",
      });
    }

    if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 50)) {
      console.log("[AI Controller] Validation error: invalid count", { count });
      return res.status(400).json({
        message: "count must be an integer between 1 and 50",
      });
    }

    console.log("[AI Controller] Processing quiz text...", {
      textLength: text.length,
      difficulty,
      count,
    });

    const result = await processQuizText({
      text,
      difficulty,
      count,
    });

    console.log("[AI Controller] Processing complete, returning result:", {
      action: result.action,
      questionsCount: result.questions?.length || 0,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
    }
    console.error("[AI Controller] Error processing request:", {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack,
    });
    return next(error);
  }
}

module.exports = {
  analyzeText,
};
