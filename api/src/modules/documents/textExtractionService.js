const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

async function extractPdfText(buffer) {
  const result = await pdfParse(buffer);
  return result.text.trim();
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

async function extractTextFromFile(file) {
  if (!file || !file.buffer || !file.mimetype) {
    throw new Error("A valid uploaded file is required");
  }

  if (file.mimetype === "application/pdf") {
    return extractPdfText(file.buffer);
  }

  if (
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(file.buffer);
  }

  throw new Error("Unsupported file type");
}

module.exports = {
  extractTextFromFile,
};
