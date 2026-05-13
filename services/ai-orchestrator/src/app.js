const express = require("express");

const aiRoutes = require("./routes/aiRoutes");

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/ai", aiRoutes);

app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  // Log the error
  console.error("[AI Service Error Handler] Unhandled error:", {
    message: err.message,
    code: err.code,
    statusCode,
    details: err.details,
    provider: err.provider,
    stack: err.stack,
  });

  // Never expose raw timeout error messages from underlying libraries
  const isTimeout = statusCode === 504 || 
                    String(err.message).toLowerCase().includes("timeout") ||
                    err.code === "AI_TIMEOUT" ||
                    err.code === "AI_PROCESSING_TIMEOUT";

  const responseBody = {
    code: err.code || "AI_SERVICE_ERROR",
    message: isTimeout 
      ? "AI request timed out. The service is taking longer than expected. You can retry the request or try with a simpler input."
      : (err.message || "Internal server error"),
    details: isTimeout
      ? "The AI service could not complete the request within the allowed time. Consider retrying with a shorter input or different parameters."
      : (err.details || null),
    provider: err.provider || null,
  };

  res.status(statusCode).json(responseBody);
});

module.exports = app;
