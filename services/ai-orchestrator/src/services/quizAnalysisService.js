const { generateStructuredContent } = require("./aiService");
const {
  conceptsSchema,
  inputClassificationSchema,
  mcqSchema,
  questionDraftSchema,
  summarySchema,
} = require("../schemas/aiPipelineSchemas");
const quizAnalysisSchema = require("../schemas/quizAnalysisSchema");

function buildSharedContext({ text, difficulty, count }) {
  return [
    `Creator difficulty preference: ${difficulty || "not provided"}`,
    `Creator question count preference: ${count || "not provided"}`,
    "",
    "Input text:",
    text,
  ].join("\n");
}

function normalizeTitle(text) {
  const firstLine = text.split(/\n/).map((line) => line.trim()).find(Boolean) || "Generated Quiz";
  return firstLine.replace(/[^\w\s:+#.-]/g, "").slice(0, 80) || "Generated Quiz";
}

function stripAnswerMarker(value) {
  return String(value || "").replace(/[✓✔*]+/g, "").trim();
}

function parseQuestionBlocks(text, difficulty, count) {
  const blocks = text
    .split(/(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*)?\d+[.)]\s+/i)
    .map((block) => block.trim())
    .filter(Boolean);

  const questions = [];

  blocks.forEach((block) => {
    if (questions.length >= count) return;

    const lines = block.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const optionLines = lines.filter((line) => /^[A-D][.)]\s+/i.test(line));
    if (optionLines.length < 4) return;

    const firstOptionIndex = lines.findIndex((line) => /^[A-D][.)]\s+/i.test(line));
    const prompt = lines.slice(0, firstOptionIndex).join(" ").trim();
    if (!prompt) return;

    let correctOptionIndex = optionLines.findIndex((line) => /[✓✔]/.test(line));
    if (correctOptionIndex < 0) correctOptionIndex = 0;

    const options = optionLines.slice(0, 4).map((line) => stripAnswerMarker(line.replace(/^[A-D][.)]\s+/i, "")));
    if (options.length !== 4 || options.some((option) => !option)) return;

    questions.push({
      prompt,
      options,
      correctOptionIndex,
      difficulty,
      explanation: `The correct answer is "${options[correctOptionIndex]}".`,
    });
  });

  return questions;
}

function conceptFromText(text, index) {
  const words = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-zA-Z0-9+#\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  return words[index % Math.max(words.length, 1)] || "Core concept";
}

function buildFallbackQuestions(text, difficulty, count) {
  return Array.from({ length: count }, (_, index) => {
    const concept = conceptFromText(text, index);
    return {
      prompt: `Which statement best matches ${concept}?`,
      options: [
        `${concept} is a key idea from the provided material`,
        `${concept} is unrelated to the provided material`,
        `${concept} is always optional and never tested`,
        `${concept} only applies outside this subject`,
      ],
      correctOptionIndex: 0,
      difficulty,
      explanation: `This fallback question was generated from the provided material because the AI provider was temporarily unavailable.`,
    };
  });
}

function fallbackQuizAnalysis({ text, difficulty, count, error }) {
  const resolvedDifficulty = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";
  const resolvedCount = Number.isInteger(count) && count >= 1 && count <= 50 ? count : 5;
  const parsedQuestions = parseQuestionBlocks(text, resolvedDifficulty, resolvedCount);
  const questions = parsedQuestions.length > 0
    ? parsedQuestions.slice(0, resolvedCount)
    : buildFallbackQuestions(text, resolvedDifficulty, resolvedCount);
  const containsQuestions = parsedQuestions.length > 0;
  const title = normalizeTitle(text);

  console.warn("[AI Processing] Using local fallback quiz generation", {
    reason: error.message,
    containsQuestions,
    questionCount: questions.length,
  });

  return {
    containsQuestions,
    action: containsQuestions ? "parsed" : "generated",
    detectedInputType: containsQuestions ? "question_set" : "topic_or_study_material",
    title,
    topicSummary: `Fallback summary for ${title}. The external AI provider was temporarily unavailable, so the app generated a local draft from the supplied content.`,
    keyConcepts: questions.map((question) => question.prompt).slice(0, 8),
    preferencesNeeded: false,
    preferencePrompt: "",
    questions,
    fallback: true,
    fallbackReason: error.details || error.message,
  };
}

async function classifyInput({ model, text, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "Classify whether the input already contains quiz questions or is study material/topic text.",
      "Return a short usable title.",
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: inputClassificationSchema,
  });
}

async function summarizeTopic({ model, text, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "Summarize the input for quiz creation.",
      "Focus on the teaching content only.",
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: summarySchema,
  });
}

async function extractKeyConcepts({ model, text, summary, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "Extract the key concepts that should be tested in a quiz.",
      "Return a compact list of concepts, avoiding duplicates.",
      "",
      summary ? `Summary:\n${summary}` : "No summary is available yet; extract directly from the input text.",
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: conceptsSchema,
  });
}

async function parseExistingQuestions({ model, text, summary, concepts, difficulty, count }) {
  return generateStructuredContent({
    model,
    prompt: [
      "The input already contains questions.",
      "Normalize them into MCQ JSON with exactly 4 options per question.",
      "Do not invent extra questions beyond what is reliably present.",
      "",
      `Summary:\n${summary}`,
      "",
      `Key concepts:\n${concepts.join("\n")}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: mcqSchema,
  });
}

async function generateConceptQuestions({
  model,
  text,
  summary,
  concepts,
  difficulty,
  count,
}) {
  return generateStructuredContent({
    model,
    prompt: [
      `Generate exactly ${count} high-quality quiz questions from the key concepts at ${difficulty} difficulty.`,
      "Each generated question should have one correct answer and a short explanation.",
      "Do not convert them to MCQ options yet.",
      "",
      `Summary:\n${summary}`,
      "",
      `Key concepts:\n${concepts.join("\n")}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: questionDraftSchema,
  });
}

async function convertDraftsToMcq({
  model,
  text,
  summary,
  concepts,
  drafts,
  difficulty,
  count,
}) {
  return generateStructuredContent({
    model,
    prompt: [
      "Convert the drafted quiz questions into final MCQ JSON.",
      "Each question must have exactly 4 options and a zero-based correctOptionIndex.",
      "Distractors should be plausible and non-duplicate.",
      "",
      `Summary:\n${summary}`,
      "",
      `Key concepts:\n${concepts.join("\n")}`,
      "",
      `Draft questions JSON:\n${JSON.stringify(drafts)}`,
      "",
      buildSharedContext({ text, difficulty, count }),
    ].join("\n"),
    schema: mcqSchema,
  });
}

async function processQuizTextWithAi({ text, difficulty, count }) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const hasPreferences =
    ["easy", "medium", "hard"].includes(difficulty) &&
    Number.isInteger(count) &&
    count >= 1 &&
    count <= 50;

  console.log("[AI Processing] Starting quiz text analysis...", {
    model,
    hasPreferences,
    textLength: text.length,
    difficulty: difficulty || "not_specified",
    count: count || "not_specified",
    timestamp: new Date().toISOString(),
  });

  // Step 1: Classify input type
  console.log("[AI Processing] Step 1/5: Classifying input type...");
  const classification = await classifyInput({
    model,
    text,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 1/5: Classification complete:", {
    containsQuestions: classification.containsQuestions,
    detectedInputType: classification.detectedInputType,
    title: classification.title,
  });

  // Steps 2 and 3 are independent enough to run together: both read the raw input.
  console.log("[AI Processing] Step 2-3/5: Generating summary and extracting key concepts...");
  const [summaryResult, conceptsResult] = await Promise.all([
    summarizeTopic({
      model,
      text,
      difficulty,
      count,
    }),
    extractKeyConcepts({
      model,
      text,
      summary: "",
      difficulty,
      count,
    }),
  ]);
  console.log("[AI Processing] Step 2/5: Summary generated, length:", summaryResult.topicSummary.length);
  console.log("[AI Processing] Step 3/5: Extracted", conceptsResult.keyConcepts.length, "key concepts");

  const baseResult = {
    containsQuestions: classification.containsQuestions,
    detectedInputType: classification.detectedInputType,
    title: classification.title,
    topicSummary: summaryResult.topicSummary,
    keyConcepts: conceptsResult.keyConcepts,
  };

  if (classification.containsQuestions) {
    console.log("[AI Processing] Input contains existing questions, parsing...");
    const parsedQuestions = await parseExistingQuestions({
      model,
      text,
      summary: summaryResult.topicSummary,
      concepts: conceptsResult.keyConcepts,
      difficulty,
      count,
    });
    console.log("[AI Processing] Parsed", parsedQuestions.questions.length, "existing questions");

    return {
      ...baseResult,
      action: "parsed",
      preferencesNeeded: false,
      preferencePrompt: "",
      questions: parsedQuestions.questions.map((question) => ({
        ...question,
        options: question.options.slice(0, 4),
      })),
    };
  }

  if (!hasPreferences) {
    console.log("[AI Processing] Preferences needed - returning to user");
    return {
      ...baseResult,
      action: "needs_preferences",
      preferencesNeeded: true,
      preferencePrompt:
        "The uploaded content is topic/study material, not ready-made questions. Please choose the difficulty and the number of questions to generate.",
      questions: [],
    };
  }

  // Step 4: Generate concept questions
  console.log("[AI Processing] Step 4/5: Generating concept questions...", { count, difficulty });
  const drafts = await generateConceptQuestions({
    model,
    text,
    summary: summaryResult.topicSummary,
    concepts: conceptsResult.keyConcepts,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 4/5: Generated", drafts.questions.length, "draft questions");

  // Step 5: Convert drafts to MCQ format
  console.log("[AI Processing] Step 5/5: Converting drafts to MCQ format...");
  const mcqs = await convertDraftsToMcq({
    model,
    text,
    summary: summaryResult.topicSummary,
    concepts: conceptsResult.keyConcepts,
    drafts: drafts.questions,
    difficulty,
    count,
  });
  console.log("[AI Processing] Step 5/5: Conversion complete, final questions:", mcqs.questions.length);

  console.log("[AI Processing] Quiz analysis complete!", {
    totalQuestions: mcqs.questions.length,
    action: "generated",
    duration: Date.now(),
  });

  return {
    ...baseResult,
    action: "generated",
    preferencesNeeded: false,
    preferencePrompt: "",
    questions: mcqs.questions.map((question) => ({
      ...question,
      options: question.options.slice(0, 4),
    })),
  };
}

async function processQuizText({ text, difficulty, count }) {
  try {
    return await processQuizTextWithAi({ text, difficulty, count });
  } catch (error) {
    if (error.code === "AI_PROVIDER_AUTH_ERROR") {
      throw error;
    }

    return fallbackQuizAnalysis({ text, difficulty, count, error });
  }
}

module.exports = {
  processQuizText,
};
