const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

function signToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.query.token || null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    req.user = verifyToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  return requireAuth(req, res, () => {
    if (!["admin", "admin_player"].includes(req.user.role)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    return next();
  });
}

module.exports = { signToken, verifyToken, requireAuth, requireAdmin };
