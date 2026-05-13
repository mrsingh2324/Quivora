const express = require("express");

const { createAIJob, getAIJobById, listAIJobs, updateAIJobStatus } = require("./aiJobController");

const router = express.Router();

router.get("/", listAIJobs);
router.post("/", createAIJob);
router.get("/:jobId", getAIJobById);
router.patch("/:jobId", updateAIJobStatus);

module.exports = router;
