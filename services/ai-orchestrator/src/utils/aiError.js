function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toAiServiceError(error) {
  const parsed = tryParseJson(error.message);
  const providerError = parsed?.error || null;
  const providerCode = providerError?.code;
  const providerStatus = providerError?.status;
  const providerMessage = providerError?.message || error.message;

  // Handle timeout/connection errors gracefully (not auth errors)
  const isTimeout = error.message?.toLowerCase().includes("timeout") ||
                    error.code === "ECONNABORTED" ||
                    error.code === "ETIMEDOUT" ||
                    error.message?.toLowerCase().includes("deadline exceeded");

  if (isTimeout) {
    const wrapped = new Error(
      "AI request timed out. The service is still processing - please try again or simplify your request."
    );
    wrapped.statusCode = 504;
    wrapped.code = "AI_TIMEOUT";
    wrapped.details =
      "The AI service is taking longer than expected. This may happen with long inputs or complex requests. Try with a shorter input or retry the request.";
    wrapped.provider = {
      status: providerStatus || "TIMEOUT",
      code: providerCode || null,
      message: providerMessage || "Request timeout",
    };
    return wrapped;
  }

  if (
    providerStatus === "INVALID_ARGUMENT" &&
    String(providerMessage).toLowerCase().includes("api key")
  ) {
    const wrapped = new Error("Gemini API key is invalid or missing.");
    wrapped.statusCode = 502;
    wrapped.code = "AI_PROVIDER_AUTH_ERROR";
    wrapped.details =
      "The AI service could not authenticate with Gemini. Update GEMINI_API_KEY in services/ai-orchestrator/.env and restart the AI service.";
    wrapped.provider = {
      status: providerStatus,
      code: providerCode,
      message: providerMessage,
    };
    return wrapped;
  }

  const wrapped = new Error("AI generation failed.");
  wrapped.statusCode = error.statusCode || 502;
  wrapped.code = "AI_PROVIDER_ERROR";
  wrapped.details = providerMessage;
  wrapped.provider = {
    status: providerStatus || null,
    code: providerCode || null,
    message: providerMessage,
  };
  return wrapped;
}

module.exports = {
  toAiServiceError,
};
