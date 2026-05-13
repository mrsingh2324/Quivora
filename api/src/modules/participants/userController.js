const User = require("./User");
const { normalizeUser } = require("../../utils/normalize");

const DEMO_ADMIN_EMAIL = "workspace-admin@quivora.local";

async function createAdmin(req, res, next) {
  try {
    const { name, email, avatar } = req.body;

    if (!name) {
      return res.status(400).json({ message: "name is required" });
    }

    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          email,
          avatar,
          role: "admin",
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(201).json(normalizeUser(user));
  } catch (error) {
    return next(error);
  }
}

async function getOrCreateDemoAdmin(_req, res, next) {
  try {
    const user = await User.findOneAndUpdate(
      { email: DEMO_ADMIN_EMAIL },
      {
        $setOnInsert: {
          name: "Satyam Workspace",
          email: DEMO_ADMIN_EMAIL,
          avatar: "",
          role: "admin",
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json(normalizeUser(user));
  } catch (error) {
    return next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const query = {};

    if (req.query.role) {
      query.role = req.query.role;
    }

    const users = await User.find(query).sort({ createdAt: -1 });
    return res.status(200).json(users.map((user) => normalizeUser(user)));
  } catch (error) {
    return next(error);
  }
}

async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json(normalizeUser(user));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createAdmin,
  getOrCreateDemoAdmin,
  listUsers,
  getUserById,
};
