const express = require("express");

const {
  devLogin,
  getMe,
  githubCallback,
  githubRedirect,
  googleCallback,
  googleRedirect,
  login,
  register,
  upgradeAdminAccess,
  updateMe,
} = require("./authController");
const { requireAuth } = require("../../middleware/auth");
const { authLimiter } = require("../../middleware/rateLimiter");

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

router.get("/google", googleRedirect);
router.get("/google/callback", googleCallback);

router.get("/github", githubRedirect);
router.get("/github/callback", githubCallback);

// Dev-only: instant login as the seeded dev admin — blocked in production
router.post("/dev-login", devLogin);
router.post("/admin-access", requireAuth, authLimiter, upgradeAdminAccess);

router.get("/me", requireAuth, getMe);
router.patch("/me", requireAuth, updateMe);

module.exports = router;
