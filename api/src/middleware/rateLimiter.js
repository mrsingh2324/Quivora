const rateLimit = require("express-rate-limit");

const isDev = process.env.NODE_ENV !== "production";

// In development all limiters are completely bypassed so they never interfere
// with local iteration. In production strict caps apply.
const skip = () => isDev;

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many requests — please slow down." },
});

// AI generation is expensive; cap hard in production
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "AI generation quota reached. Please wait before generating more quizzes." },
});

// Brute-force protection on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { message: "Too many authentication attempts. Try again in 15 minutes." },
});

module.exports = { globalLimiter, aiLimiter, authLimiter };
