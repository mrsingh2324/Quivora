const express = require("express");

const {
  createAssignment,
  listAssignments,
  selectAssignment,
  updateSelection,
} = require("./assignmentController");
const { requireAdmin, requireAuth } = require("../../middleware/auth");

const router = express.Router();

router.get("/", requireAuth, listAssignments);
router.post("/", requireAdmin, createAssignment);
router.post("/:assignmentId/select", requireAuth, selectAssignment);
router.patch("/:assignmentId/selection", requireAuth, updateSelection);

module.exports = router;
