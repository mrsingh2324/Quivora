function validateEnv() {
  const required = ["MONGODB_URI", "AI_SERVICE_URL"];

  if (process.env.NODE_ENV === "production") {
    required.push("JWT_SECRET", "CLIENT_URL");
  }

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length) {
    const error = new Error(`Missing required environment variables: ${missing.join(", ")}`);
    error.code = "ENV_VALIDATION_FAILED";
    throw error;
  }

  if (process.env.NODE_ENV === "production" && process.env.JWT_SECRET === "dev-secret-change-in-production") {
    const error = new Error("JWT_SECRET must be changed in production");
    error.code = "ENV_VALIDATION_FAILED";
    throw error;
  }
}

module.exports = { validateEnv };
