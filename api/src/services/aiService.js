const axios = require("axios");

function getAiServiceUrl() {
  const aiServiceUrl = process.env.AI_SERVICE_URL;

  if (!aiServiceUrl) {
    throw new Error("AI_SERVICE_URL is not configured");
  }

  return aiServiceUrl;
}

async function analyzeText({ text, difficulty, count }) {
  const payload = { text };

  if (difficulty) {
    payload.difficulty = difficulty;
  }

  if (count !== undefined) {
    payload.count = count;
  }

  console.log("[AI API Service] Forwarding AI request to AI orchestrator service...", {
    textLength: text.length,
    difficulty: difficulty || "not_specified",
    count: count || "not_specified",
    aiServiceUrl: getAiServiceUrl(),
    timestamp: new Date().toISOString(),
  });

  try {
    const startTime = Date.now();

    const response = await axios.post(getAiServiceUrl(), payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: Number(process.env.AI_REQUEST_TIMEOUT_MS || 90_000),
    });

    const duration = Date.now() - startTime;

    console.log("[AI API Service] AI request completed successfully:", {
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });

    return response.data;
  } catch (error) {
    const duration = Date.now();

    // Check if this is a timeout error from axios
    const isTimeout = error.code === "ECONNABORTED" || 
                      error.message?.toLowerCase().includes("timeout") ||
                      error.message?.toLowerCase().includes("deadline exceeded");

    if (isTimeout) {
      console.error("[AI API Service] AI request timed out:", {
        error: error.message,
        durationMs: duration,
        textLength: text.length,
        timestamp: new Date().toISOString(),
      });

      const apiError = new Error(
        "AI service request timed out while processing. Try again with a simpler request or shorter input."
      );

      apiError.statusCode = 504;
      apiError.code = "AI_TIMEOUT";
      apiError.details =
        "The AI service could not complete processing within the expected time. Consider retrying with a shorter input or simpler request parameters.";
      apiError.provider = null;

      throw apiError;
    }

    // Network/connection errors
    if (!error.response) {
      console.error("[AI API Service] AI service connection error:", {
        error: error.message,
        timestamp: new Date().toISOString(),
      });

      const apiError = new Error(
        "AI service is unavailable. Please check the AI service connection."
      );

      apiError.statusCode = 503;
      apiError.code = "AI_SERVICE_UNAVAILABLE";
      apiError.details = error.message;
      apiError.provider = null;

      throw apiError;
    }

    // AI service returned an error response
    console.error("[AI API Service] AI service returned error:", {
      status: error.response.status,
      data: error.response.data,
      timestamp: new Date().toISOString(),
    });

    // Check if the AI service already handled the timeout gracefully
    const hasTimeoutCode = error.response.data?.code?.includes("TIMEOUT") ||
                           error.response.data?.code === "AI_TIMEOUT" ||
                           error.response.data?.code === "AI_PROCESSING_TIMEOUT";

    const apiError = new Error(
      hasTimeoutCode
        ? "AI request timed out. The service is taking longer than expected."
        : (error.response?.data?.message || "AI service request failed.")
    );

    apiError.statusCode = hasTimeoutCode ? 504 : (error.response?.status || 502);
    apiError.code = hasTimeoutCode ? "AI_TIMEOUT" : (error.response?.data?.code || "AI_REQUEST_FAILED");
    apiError.details = hasTimeoutCode
      ? "The AI service could not complete processing in time. Retry with a simpler request."
      : (error.response?.data?.details ||
         error.response?.data?.provider?.message ||
         error.message);
    apiError.provider = error.response?.data?.provider || null;

    throw apiError;
  }
}

async function analyzeDocumentText({ text, difficulty, count }) {
  console.log("[AI API Service] Document text analysis requested");
  return analyzeText({ text, difficulty, count });
}

async function analyzeTopicText({ topic, difficulty, count }) {
  console.log("[AI API Service] Topic text analysis requested");
  return analyzeText({ text: topic, difficulty, count });
}

module.exports = {
  analyzeText,
  analyzeDocumentText,
  analyzeTopicText,
};
