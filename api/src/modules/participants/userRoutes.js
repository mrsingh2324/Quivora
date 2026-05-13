const express = require("express");

const {
  createAdmin,
  getOrCreateDemoAdmin,
  getUserById,
  listUsers,
} = require("./userController");

const router = express.Router();

router.get("/", listUsers);
router.get("/demo-admin", getOrCreateDemoAdmin);
router.post("/admins", createAdmin);
router.get("/:userId", getUserById);

module.exports = router;
