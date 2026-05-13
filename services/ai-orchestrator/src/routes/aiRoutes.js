const express = require("express");

const { analyzeText } = require("../controllers/aiController");

const router = express.Router();

router.post("/analyze", analyzeText);

module.exports = router;
