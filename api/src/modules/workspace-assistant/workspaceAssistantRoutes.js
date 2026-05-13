const express = require("express");

const { queryWorkspaceAssistant } = require("./workspaceAssistantController");
const { requireAdmin } = require("../../middleware/auth");
const { aiLimiter } = require("../../middleware/rateLimiter");

const router = express.Router();

router.post("/query", requireAdmin, aiLimiter, queryWorkspaceAssistant);

module.exports = router;
