const SupportRequest = require("./SupportRequest");

function normalizeRequest(request) {
  return {
    id: String(request._id),
    requester: request.requester
      ? {
          id: String(request.requester._id || request.requester),
          name: request.requester.name || "",
          email: request.requester.email || "",
        }
      : null,
    category: request.category,
    subject: request.subject,
    description: request.description,
    status: request.status,
    priority: request.priority,
    adminNote: request.adminNote || "",
    attachments: request.attachments || [],
    messages: (request.messages || []).map((message) => ({
      id: String(message._id),
      author: message.author,
      body: message.body,
      attachments: message.attachments || [],
      createdAt: message.createdAt,
    })),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

async function listSupportRequests(req, res, next) {
  try {
    const isAdminLike = ["admin", "admin_player"].includes(req.user.role);
    const filter = isAdminLike ? {} : { requester: req.user.userId };
    const requests = await SupportRequest.find(filter)
      .populate("requester", "name email")
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.status(200).json(requests.map(normalizeRequest));
  } catch (error) {
    return next(error);
  }
}

async function createSupportRequest(req, res, next) {
  try {
    const { category = "other", subject, description, priority = "normal", attachments = [] } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ message: "subject and description are required" });
    }

    const request = await SupportRequest.create({
      requester: req.user.userId,
      category,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      attachments: Array.isArray(attachments) ? attachments : [],
      messages: [{ author: req.user.userId, body: description.trim(), attachments: Array.isArray(attachments) ? attachments : [] }],
    });

    await request.populate("requester", "name email");
    return res.status(201).json(normalizeRequest(request));
  } catch (error) {
    return next(error);
  }
}

async function addSupportMessage(req, res, next) {
  try {
    const { body, attachments = [] } = req.body;
    const request = await SupportRequest.findById(req.params.requestId).populate("requester", "name email");
    if (!request) return res.status(404).json({ message: "Support request not found" });
    const isAdminLike = ["admin", "admin_player"].includes(req.user.role);
    const ownsRequest = String(request.requester?._id || request.requester) === String(req.user.userId);
    if (!isAdminLike && !ownsRequest) return res.status(403).json({ message: "Access denied" });
    if (!body?.trim()) return res.status(400).json({ message: "message body is required" });
    request.messages.push({ author: req.user.userId, body: body.trim(), attachments: Array.isArray(attachments) ? attachments : [] });
    if (request.status === "closed") request.status = "open";
    await request.save();
    return res.status(200).json(normalizeRequest(request));
  } catch (error) {
    return next(error);
  }
}

async function updateSupportRequest(req, res, next) {
  try {
    const { status, adminNote, priority } = req.body;
    const request = await SupportRequest.findById(req.params.requestId);

    if (!request) {
      return res.status(404).json({ message: "Support request not found" });
    }

    const ownsRequest = String(request.requester) === String(req.user.userId);
    const isAdminLike = ["admin", "admin_player"].includes(req.user.role);
    if (!isAdminLike && !ownsRequest) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (isAdminLike) {
      if (status) request.status = status;
      if (typeof adminNote === "string") request.adminNote = adminNote.trim();
      if (priority) request.priority = priority;
    } else if (status === "closed") {
      request.status = "closed";
    }

    await request.save();
    await request.populate("requester", "name email");
    return res.status(200).json(normalizeRequest(request));
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createSupportRequest,
  addSupportMessage,
  listSupportRequests,
  normalizeRequest,
  updateSupportRequest,
};
