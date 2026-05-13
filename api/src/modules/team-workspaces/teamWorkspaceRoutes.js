const crypto = require("crypto");
const express = require("express");

const Quiz = require("../quiz-publishing/Quiz");
const User = require("../participants/User");
const Workspace = require("./Workspace");
const WorkspaceAuditLog = require("./WorkspaceAuditLog");
const WorkspaceFolder = require("./WorkspaceFolder");
const WorkspaceInvite = require("./WorkspaceInvite");
const WorkspaceMember = require("./WorkspaceMember");
const QuizApproval = require("./QuizApproval");
const { requireAuth } = require("../../middleware/auth");

const router = express.Router();

const canManage = (role) => ["owner", "admin"].includes(role);
const canEdit = (role) => ["owner", "admin", "editor"].includes(role);

async function audit(workspace, actor, action, targetType = "", targetId = "", metadata = {}) {
  return WorkspaceAuditLog.create({ workspace, actor, action, targetType, targetId, metadata });
}

async function ensurePersonalWorkspace(userId) {
  let membership = await WorkspaceMember.findOne({ user: userId, role: "owner", status: "active" }).populate("workspace");
  if (membership) return membership.workspace;

  const user = await User.findById(userId).select("name email");
  const workspace = await Workspace.create({
    name: `${user?.name || "My"} Workspace`,
    owner: userId,
  });
  await WorkspaceMember.create({ workspace: workspace._id, user: userId, role: "owner" });
  await audit(workspace._id, userId, "workspace.created", "Workspace", workspace._id, { source: "auto" });
  return workspace;
}

async function requireMembership(req, res, next) {
  const membership = await WorkspaceMember.findOne({
    workspace: req.params.workspaceId,
    user: req.user.userId,
    status: "active",
  });
  if (!membership) return res.status(403).json({ message: "Workspace access required" });
  req.workspaceRole = membership.role;
  return next();
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    await ensurePersonalWorkspace(req.user.userId);
    const memberships = await WorkspaceMember.find({ user: req.user.userId, status: "active" })
      .populate("workspace")
      .sort({ updatedAt: -1 });

    res.status(200).json(memberships.map((membership) => ({
      id: String(membership.workspace._id),
      name: membership.workspace.name,
      role: membership.role,
      approvalsEnabled: membership.workspace.approvalsEnabled,
      status: membership.workspace.status,
      updatedAt: membership.workspace.updatedAt,
    })));
  } catch (error) {
    next(error);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, approvalsEnabled = false } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    const workspace = await Workspace.create({ name: name.trim(), owner: req.user.userId, approvalsEnabled });
    await WorkspaceMember.create({ workspace: workspace._id, user: req.user.userId, role: "owner" });
    await audit(workspace._id, req.user.userId, "workspace.created", "Workspace", workspace._id);
    res.status(201).json({ id: String(workspace._id), name: workspace.name, role: "owner", approvalsEnabled });
  } catch (error) {
    next(error);
  }
});

router.get("/:workspaceId", requireAuth, requireMembership, async (req, res, next) => {
  try {
    const [workspace, members, invites, folders, approvals, logs] = await Promise.all([
      Workspace.findById(req.params.workspaceId),
      WorkspaceMember.find({ workspace: req.params.workspaceId, status: "active" }).populate("user", "name email role"),
      WorkspaceInvite.find({ workspace: req.params.workspaceId }).sort({ createdAt: -1 }).limit(20),
      WorkspaceFolder.find({ workspace: req.params.workspaceId }).populate("quizIds", "title status totalQuestions").sort({ updatedAt: -1 }),
      QuizApproval.find({ workspace: req.params.workspaceId }).populate("quiz", "title status").populate("requestedBy reviewer", "name email").sort({ updatedAt: -1 }).limit(30),
      WorkspaceAuditLog.find({ workspace: req.params.workspaceId }).populate("actor", "name email").sort({ createdAt: -1 }).limit(40),
    ]);

    res.status(200).json({
      id: String(workspace._id),
      name: workspace.name,
      role: req.workspaceRole,
      approvalsEnabled: workspace.approvalsEnabled,
      members: members.map((member) => ({
        id: String(member._id),
        role: member.role,
        user: { id: String(member.user._id), name: member.user.name, email: member.user.email, role: member.user.role },
      })),
      invites: invites.map((invite) => ({ id: String(invite._id), email: invite.email, role: invite.role, status: invite.status, expiresAt: invite.expiresAt })),
      folders: folders.map((folder) => ({ id: String(folder._id), name: folder.name, description: folder.description, quizzes: folder.quizIds })),
      approvals: approvals.map((approval) => ({ id: String(approval._id), quiz: approval.quiz, requestedBy: approval.requestedBy, reviewer: approval.reviewer, status: approval.status, comments: approval.comments, decidedAt: approval.decidedAt })),
      auditLogs: logs.map((log) => ({ id: String(log._id), actor: log.actor, action: log.action, targetType: log.targetType, targetId: log.targetId, metadata: log.metadata, createdAt: log.createdAt })),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:workspaceId/invites", requireAuth, requireMembership, async (req, res, next) => {
  try {
    if (!canManage(req.workspaceRole)) return res.status(403).json({ message: "Owner/admin role required" });
    const { email, role = "viewer" } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: "email is required" });
    const token = crypto.randomBytes(24).toString("hex");
    const invite = await WorkspaceInvite.create({
      workspace: req.params.workspaceId,
      email,
      role: ["admin", "editor", "viewer"].includes(role) ? role : "viewer",
      token,
      invitedBy: req.user.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    await audit(req.params.workspaceId, req.user.userId, "member.invited", "WorkspaceInvite", invite._id, { email, role: invite.role });
    res.status(201).json({ id: String(invite._id), email: invite.email, role: invite.role, token, status: invite.status });
  } catch (error) {
    next(error);
  }
});

router.post("/:workspaceId/invite", requireAuth, requireMembership, async (req, res, next) => {
  req.url = `/${req.params.workspaceId}/invites`;
  return router.handle(req, res, next);
});

router.post("/invites/:token/accept", requireAuth, async (req, res, next) => {
  try {
    const invite = await WorkspaceInvite.findOne({ token: req.params.token, status: "pending" });
    if (!invite || invite.expiresAt < new Date()) return res.status(404).json({ message: "Invite not found or expired" });
    const user = await User.findById(req.user.userId);
    if (user.email && user.email.toLowerCase() !== invite.email) return res.status(403).json({ message: "Invite email does not match this account" });
    await WorkspaceMember.findOneAndUpdate(
      { workspace: invite.workspace, user: req.user.userId },
      { workspace: invite.workspace, user: req.user.userId, role: invite.role, status: "active" },
      { upsert: true, new: true }
    );
    invite.status = "accepted";
    invite.acceptedAt = new Date();
    await invite.save();
    await audit(invite.workspace, req.user.userId, "member.joined", "WorkspaceInvite", invite._id);
    res.status(200).json({ message: "Workspace invite accepted", workspace: String(invite.workspace) });
  } catch (error) {
    next(error);
  }
});

router.post("/accept-invite/:token", requireAuth, async (req, res, next) => {
  req.url = `/invites/${req.params.token}/accept`;
  return router.handle(req, res, next);
});

router.get("/:workspaceId/members", requireAuth, requireMembership, async (req, res, next) => {
  try {
    const members = await WorkspaceMember.find({
      workspace: req.params.workspaceId,
      status: "active",
    }).populate("user", "name email role");

    return res.status(200).json(
      members.map((member) => ({
        id: String(member._id),
        role: member.role,
        user: {
          id: String(member.user._id),
          name: member.user.name,
          email: member.user.email,
          role: member.user.role,
        },
      }))
    );
  } catch (error) {
    return next(error);
  }
});

router.patch("/:workspaceId/members/:userId/role", requireAuth, requireMembership, async (req, res, next) => {
  try {
    if (!canManage(req.workspaceRole)) return res.status(403).json({ message: "Owner/admin role required" });
    const { role } = req.body;
    if (!["admin", "editor", "viewer"].includes(role)) {
      return res.status(400).json({ message: "role must be admin, editor, or viewer" });
    }
    const member = await WorkspaceMember.findOneAndUpdate(
      {
        workspace: req.params.workspaceId,
        user: req.params.userId,
        status: "active",
        role: { $ne: "owner" },
      },
      { role },
      { new: true }
    ).populate("user", "name email role");
    if (!member) return res.status(404).json({ message: "Member not found or owner cannot be changed" });
    await audit(req.params.workspaceId, req.user.userId, "member.role_updated", "WorkspaceMember", member._id, { role });
    return res.status(200).json({
      id: String(member._id),
      role: member.role,
      user: {
        id: String(member.user._id),
        name: member.user.name,
        email: member.user.email,
        role: member.user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:workspaceId/folders", requireAuth, requireMembership, async (req, res, next) => {
  try {
    if (!canEdit(req.workspaceRole)) return res.status(403).json({ message: "Editor role required" });
    const { name, description = "", quizIds = [], questionIds = [] } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name is required" });
    const folder = await WorkspaceFolder.create({ workspace: req.params.workspaceId, name, description, quizIds, questionIds, createdBy: req.user.userId });
    await audit(req.params.workspaceId, req.user.userId, "folder.created", "WorkspaceFolder", folder._id, { name });
    res.status(201).json({ id: String(folder._id), name: folder.name, description: folder.description });
  } catch (error) {
    next(error);
  }
});

router.post("/:workspaceId/approvals", requireAuth, requireMembership, async (req, res, next) => {
  try {
    if (!canEdit(req.workspaceRole)) return res.status(403).json({ message: "Editor role required" });
    const { quizId, comments = "" } = req.body;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const approval = await QuizApproval.create({ workspace: req.params.workspaceId, quiz: quizId, requestedBy: req.user.userId, comments });
    await audit(req.params.workspaceId, req.user.userId, "approval.requested", "Quiz", quizId);
    res.status(201).json({ id: String(approval._id), status: approval.status });
  } catch (error) {
    next(error);
  }
});

router.patch("/:workspaceId/approvals/:approvalId", requireAuth, requireMembership, async (req, res, next) => {
  try {
    if (!canManage(req.workspaceRole)) return res.status(403).json({ message: "Owner/admin role required" });
    const { status, comments = "" } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "status must be approved or rejected" });
    const approval = await QuizApproval.findOne({ _id: req.params.approvalId, workspace: req.params.workspaceId });
    if (!approval) return res.status(404).json({ message: "Approval not found" });
    approval.status = status;
    approval.comments = comments;
    approval.reviewer = req.user.userId;
    approval.decidedAt = new Date();
    await approval.save();
    await audit(req.params.workspaceId, req.user.userId, `approval.${status}`, "QuizApproval", approval._id);
    res.status(200).json({ id: String(approval._id), status: approval.status });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
