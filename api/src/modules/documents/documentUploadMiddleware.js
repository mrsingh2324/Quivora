const multer = require("multer");

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const storage = multer.memoryStorage();

function fileFilter(_req, file, callback) {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(new Error("Only PDF and DOCX files are supported"));
  }

  return callback(null, true);
}

const uploadDocument = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter,
});

module.exports = uploadDocument;
