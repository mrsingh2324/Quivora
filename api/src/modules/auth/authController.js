const bcrypt = require("bcryptjs");
const passport = require("passport");

const User = require("../participants/User");
const { signToken } = require("../../middleware/auth");

const CLIENT_BASE = () =>
  (process.env.CLIENT_URL || "http://localhost:3000").split(",")[0].trim();
const ADMIN_ACCESS_CODE = () => process.env.ADMIN_ACCESS_CODE || "QUIVORA-ADMIN-2026";

function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email || "",
    role: user.role,
    avatar: user.avatar || "",
  };
}

function normalizeRequestedRole() {
  return "participant";
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });

    if (existing) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: normalizeRequestedRole(role),
      passwordHash,
      authProvider: "local",
      isVerified: false,
    });

    const token = signToken(String(user._id), user.role);
    return res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    return next(err);
  }
}

function login(req, res, next) {
  passport.authenticate("local", { session: false }, (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      return res.status(401).json({ message: info?.message || "Invalid credentials" });
    }

    const token = signToken(String(user._id), user.role);
    return res.status(200).json({ token, user: serializeUser(user) });
  })(req, res, next);
}

async function upgradeAdminAccess(req, res, next) {
  try {
    const submittedCode = String(req.body.code || "").trim();

    if (!submittedCode) {
      return res.status(400).json({ message: "Admin access code is required" });
    }

    if (submittedCode !== ADMIN_ACCESS_CODE()) {
      return res.status(403).json({ message: "Invalid admin access code" });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (["admin", "admin_player"].includes(user.role)) {
      return res.status(409).json({ message: "Admin access is already enabled for this account" });
    }

    if (user.adminAccessGrantedAt) {
      return res.status(409).json({ message: "This account has already used its admin access upgrade" });
    }

    user.role = "admin";
    user.adminAccessGrantedAt = new Date();
    user.adminAccessCodeUsed = submittedCode;
    await user.save();

    const token = signToken(String(user._id), user.role);
    return res.status(200).json({ token, user: serializeUser(user) });
  } catch (err) {
    return next(err);
  }
}

function googleRedirect(req, res, next) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ message: "Google OAuth is not configured" });
  }
  return passport.authenticate("google", { scope: ["profile", "email"], session: false })(
    req,
    res,
    next
  );
}

function googleCallback(req, res, next) {
  passport.authenticate("google", { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${CLIENT_BASE()}/login?error=oauth_failed`);
    }
    const token = signToken(String(user._id), user.role);
    return res.redirect(`${CLIENT_BASE()}/auth/callback?token=${token}`);
  })(req, res, next);
}

function githubRedirect(req, res, next) {
  if (!process.env.GITHUB_CLIENT_ID) {
    return res.status(501).json({ message: "GitHub OAuth is not configured" });
  }
  return passport.authenticate("github", { scope: ["user:email"], session: false })(
    req,
    res,
    next
  );
}

function githubCallback(req, res, next) {
  passport.authenticate("github", { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${CLIENT_BASE()}/login?error=oauth_failed`);
    }
    const token = signToken(String(user._id), user.role);
    return res.redirect(`${CLIENT_BASE()}/auth/callback?token=${token}`);
  })(req, res, next);
}

async function devLogin(req, res) {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ message: "Not found" });
  }

  const user = await User.findOne({ email: "dev@quivora.local" });

  if (!user) {
    return res
      .status(500)
      .json({ message: "Dev user not seeded yet — restart the API server once." });
  }

  const token = signToken(String(user._id), user.role);
  return res.status(200).json({ token, user: serializeUser(user) });
}

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(serializeUser(user));
  } catch (err) {
    return next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { name, avatar, role, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (typeof name === "string" && name.trim()) {
      user.name = name.trim();
    }

    if (typeof avatar === "string") {
      user.avatar = avatar.trim();
    }

    if (role === "admin_player" && user.role === "admin") {
      user.role = "admin_player";
    }

    if (newPassword) {
      if (user.authProvider !== "local" || !user.passwordHash) {
        return res.status(400).json({ message: "Password changes are only available for email accounts" });
      }

      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required" });
      }

      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters" });
      }

      user.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    await user.save();
    return res.status(200).json(serializeUser(user));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  register,
  login,
  googleRedirect,
  googleCallback,
  githubRedirect,
  githubCallback,
  devLogin,
  upgradeAdminAccess,
  getMe,
  updateMe,
};
