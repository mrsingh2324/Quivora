const express = require("express");

const { completeAttempt, getAttemptById, getCertificate, submitAnswer } = require("./attemptController");

const router = express.Router();

router.get("/:attemptId", getAttemptById);
router.get("/:attemptId/certificate", getCertificate);
router.post("/:attemptId/answers", submitAnswer);
router.post("/:attemptId/complete", completeAttempt);

module.exports = router;
