const { analyzeDocumentText } = require("../../services/aiService");
const { extractTextFromFile } = require("./textExtractionService");
const { validateFileBytes } = require("./fileValidator");
const UploadedDocument = require("./UploadedDocument");
const Question = require("../question-bank/Question");
const Quiz = require("../quiz-publishing/Quiz");
const generateJoinCode = require("../quiz-publishing/generateJoinCode");
const { upsertWorkspaceEmbedding } = require("../workspace-assistant/embeddingService");

async function generateUniqueJoinCode() {
  let joinCode = generateJoinCode();
  let existing = await Quiz.findOne({ joinCode });

  while (existing) {
    joinCode = generateJoinCode();
    existing = await Quiz.findOne({ joinCode });
  }

  return joinCode;
}

async function createDocument(req, res, next) {
  try {
    const { admin, title, fileName, mimeType, sourceType, rawText, status, containsQuestions } =
      req.body;
    const effectiveAdmin = admin || req.user?.userId;

    if (!effectiveAdmin || !title || !rawText) {
      return res.status(400).json({
        message: "admin, title, and rawText are required",
      });
    }

    const document = await UploadedDocument.create({
      admin: effectiveAdmin,
      title,
      fileName,
      mimeType,
      sourceType,
      rawText,
      status,
      containsQuestions,
    });
    await upsertWorkspaceEmbedding({
      owner: effectiveAdmin,
      sourceType: "document",
      sourceId: document._id,
      title: document.title,
      text: rawText,
      route: "/build/materials",
    });

    return res.status(201).json(document);
  } catch (error) {
    return next(error);
  }
}

async function uploadDocumentAndAnalyze(req, res, next) {
  try {
    const { admin, title, difficulty, count } = req.body;
    const effectiveAdmin = admin || req.user?.userId;

    if (!effectiveAdmin || !title) {
      return res.status(400).json({
        message: "admin and title are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "file is required",
      });
    }

    const fileCheck = validateFileBytes(req.file.buffer, req.file.mimetype);
    if (!fileCheck.valid) {
      return res.status(400).json({ message: fileCheck.reason });
    }

    if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
      return res.status(400).json({
        message: "difficulty must be one of: easy, medium, hard",
      });
    }

    if (count !== undefined) {
      const parsedCount = Number(count);

      if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 50) {
        return res.status(400).json({
          message: "count must be an integer between 1 and 50",
        });
      }
    }

    console.log("[Document Upload] Extracting text from file:", {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });

    const extractedText = await extractTextFromFile(req.file);

    if (!extractedText) {
      console.log("[Document Upload] No text could be extracted");
      return res.status(400).json({
        message: "No readable text could be extracted from the file",
      });
    }

    console.log("[Document Upload] Text extracted successfully:", {
      textLength: extractedText.length,
      fileName: req.file.originalname,
    });

    const document = await UploadedDocument.create({
      admin: effectiveAdmin,
      title,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      sourceType: "upload",
      rawText: extractedText,
      status: "processed",
    });
    await upsertWorkspaceEmbedding({
      owner: effectiveAdmin,
      sourceType: "document",
      sourceId: document._id,
      title: document.title,
      text: extractedText,
      route: "/build/materials",
    });

    console.log("[Document Upload] Document created, sending to AI analysis...", {
      documentId: document._id,
      title,
    });

    try {
      const aiResult = await analyzeDocumentText({
        text: extractedText,
        difficulty,
        count: count !== undefined ? Number(count) : undefined,
      });

      document.containsQuestions = aiResult.containsQuestions;
      document.status = "processed";
      await document.save();

      console.log("[Document Upload] AI analysis complete:", {
        documentId: document._id,
        containsQuestions: aiResult.containsQuestions,
        action: aiResult.action,
      });

      let draftQuiz = null;

      if (Array.isArray(aiResult.questions) && aiResult.questions.length > 0) {
        const createdQuestions = await Question.insertMany(
          aiResult.questions.map((question) => ({
            ...question,
            sourceType: aiResult.containsQuestions ? "document" : "ai_generated",
          }))
        );
        const joinCode = await generateUniqueJoinCode();

        draftQuiz = await Quiz.create({
          title: title || document.title,
          description: `Quiz generated from document: ${document.fileName}`,
          category: "ai-generated",
          createdBy: effectiveAdmin,
          questions: createdQuestions.map((question) => question._id),
          joinCode,
          status: "draft",
          totalQuestions: createdQuestions.length,
          questionTimeLimitSeconds: 20,
          resultsWindowSeconds: 5,
        });

        draftQuiz = await Quiz.findById(draftQuiz._id).populate("questions");
      }

      return res.status(201).json({
        document,
        aiResult,
        draftQuiz,
      });
    } catch (error) {
      console.error("[Document Upload] AI analysis failed:", {
        documentId: document._id,
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });

      document.status = "failed";
      await document.save();

      return res.status(error.statusCode || 502).json({
        document,
        aiResult: {
          action: "error",
          message: error.message,
          details: error.details || null,
          provider: error.provider || null,
          code: error.code || null,
        },
      });
    }
  } catch (error) {
    console.error("[Document Upload] Unexpected error:", {
      error: error.message,
      stack: error.stack,
    });
    return next(error);
  }
}

async function listDocuments(_req, res, next) {
  try {
    const documents = await UploadedDocument.find()
      .populate("admin", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json(documents);
  } catch (error) {
    return next(error);
  }
}

async function getDocumentById(req, res, next) {
  try {
    const document = await UploadedDocument.findById(req.params.documentId).populate(
      "admin",
      "name email"
    );

    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.status(200).json(document);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createDocument,
  uploadDocumentAndAnalyze,
  listDocuments,
  getDocumentById,
};
