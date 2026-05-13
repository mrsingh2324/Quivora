const express = require("express");

const uploadDocument = require("./documentUploadMiddleware");
const {
  createDocument,
  getDocumentById,
  listDocuments,
  uploadDocumentAndAnalyze,
} = require("./documentController");
const { requireAdmin } = require("../../middleware/auth");
const { aiLimiter } = require("../../middleware/rateLimiter");

const router = express.Router();

router.get("/", requireAdmin, listDocuments);
router.post("/", requireAdmin, createDocument);
router.post(
  "/upload",
  requireAdmin,
  aiLimiter,
  uploadDocument.single("file"),
  uploadDocumentAndAnalyze
);
router.get("/:documentId", requireAdmin, getDocumentById);

module.exports = router;
