// Validates actual file bytes, not just MIME type reported by the client.
// PDF magic: %PDF  (25 50 44 46)
// DOCX magic: PK\x03\x04 — it's a ZIP archive (50 4B 03 04)

const PDF_SIG = Buffer.from([0x25, 0x50, 0x44, 0x46]);
const ZIP_SIG_B0 = 0x50;
const ZIP_SIG_B1 = 0x4b;

function validateFileBytes(buffer, claimedMimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { valid: false, reason: "File is empty or too small to validate" };
  }

  if (claimedMimeType === "application/pdf") {
    if (buffer.slice(0, 4).equals(PDF_SIG)) {
      return { valid: true };
    }
    return { valid: false, reason: "File does not have a valid PDF signature" };
  }

  if (
    claimedMimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    if (buffer[0] === ZIP_SIG_B0 && buffer[1] === ZIP_SIG_B1) {
      return { valid: true };
    }
    return { valid: false, reason: "File does not have a valid DOCX/ZIP signature" };
  }

  return { valid: false, reason: "Unsupported MIME type" };
}

module.exports = { validateFileBytes };
