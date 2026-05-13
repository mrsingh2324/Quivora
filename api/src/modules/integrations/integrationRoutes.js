const crypto = require("crypto");
const express = require("express");
const axios = require("axios");

const IntegrationConnection = require("./IntegrationConnection");
const IntegrationDeliveryLog = require("./IntegrationDeliveryLog");
const WebhookEndpoint = require("./WebhookEndpoint");
const UploadedDocument = require("../documents/UploadedDocument");
const Quiz = require("../quiz-publishing/Quiz");
const Attempt = require("../answers/Attempt");
const { requireAdmin } = require("../../middleware/auth");

const router = express.Router();

function signPayload(secret, payload) {
  return crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
}

async function deliverWebhook(endpoint, event, payload) {
  const log = await IntegrationDeliveryLog.create({
    owner: endpoint.owner,
    provider: "webhook",
    event,
    target: endpoint.url,
    requestPayload: payload,
  });

  try {
    const signature = signPayload(endpoint.secret, payload);
    const response = await axios.post(endpoint.url, payload, {
      timeout: 5000,
      headers: { "X-Quivora-Signature": signature, "Content-Type": "application/json" },
    });
    log.status = "delivered";
    log.attempts = 1;
    log.responseStatus = response.status;
    log.responseBody = typeof response.data === "string" ? response.data.slice(0, 1000) : JSON.stringify(response.data).slice(0, 1000);
  } catch (error) {
    log.status = "failed";
    log.attempts = 1;
    log.responseStatus = error.response?.status || 0;
    log.error = error.message;
    log.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);
  }

  await log.save();
  return log;
}

router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const [connections, webhooks, logs] = await Promise.all([
      IntegrationConnection.find({ owner: req.user.userId }).sort({ provider: 1 }),
      WebhookEndpoint.find({ owner: req.user.userId }).sort({ updatedAt: -1 }),
      IntegrationDeliveryLog.find({ owner: req.user.userId }).sort({ updatedAt: -1 }).limit(50),
    ]);

    const providers = ["google_sheets", "google_drive", "email", "webhook"];
    const connectionMap = new Map(connections.map((item) => [item.provider, item]));

    res.status(200).json({
      connections: providers.map((provider) => {
        const item = connectionMap.get(provider);
        return {
          provider,
          status: item?.status || "needs_setup",
          config: item?.config || {},
          lastError: item?.lastError || "",
          connectedAt: item?.connectedAt || null,
        };
      }),
      webhooks: webhooks.map((endpoint) => ({
        id: String(endpoint._id),
        name: endpoint.name,
        url: endpoint.url,
        events: endpoint.events,
        status: endpoint.status,
        secretPreview: `${endpoint.secret.slice(0, 6)}...`,
      })),
      logs: logs.map((log) => ({
        id: String(log._id),
        provider: log.provider,
        event: log.event,
        target: log.target,
        status: log.status,
        attempts: log.attempts,
        responseStatus: log.responseStatus,
        error: log.error,
        nextRetryAt: log.nextRetryAt,
        updatedAt: log.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.put("/connections/:provider", requireAdmin, async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { status = "connected", config = {} } = req.body;
    if (!["google_sheets", "google_drive", "email", "webhook"].includes(provider)) {
      return res.status(400).json({ message: "Unsupported provider" });
    }
    const connection = await IntegrationConnection.findOneAndUpdate(
      { owner: req.user.userId, provider },
      { owner: req.user.userId, provider, status, config, connectedAt: status === "connected" ? new Date() : null, lastError: "" },
      { upsert: true, new: true }
    );
    res.status(200).json(connection);
  } catch (error) {
    next(error);
  }
});

router.get("/google-sheets/oauth-url", requireAdmin, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({ message: "GOOGLE_CLIENT_ID is not configured" });
  }
  const redirectUri = process.env.GOOGLE_SHEETS_REDIRECT_URI || `${(process.env.API_BASE_URL || "http://localhost:4000").replace(/\/$/, "")}/api/integrations/google-sheets/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/spreadsheets",
    access_type: "offline",
    prompt: "consent",
  });
  return res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

router.post("/google-sheets/sync/:quizId", requireAdmin, async (req, res, next) => {
  try {
    const connection = await IntegrationConnection.findOne({ owner: req.user.userId, provider: "google_sheets" });
    const quiz = await Quiz.findOne({ _id: req.params.quizId, createdBy: req.user.userId });
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const attempts = await Attempt.find({ quiz: quiz._id }).populate("user", "name email").sort({ createdAt: -1 });
    const values = [
      ["Participant", "Email", "Score", "Status", "Joined At", "Completed At"],
      ...attempts.map((attempt) => [
        attempt.user?.name || "",
        attempt.user?.email || "",
        attempt.score || 0,
        attempt.status,
        attempt.joinedAt?.toISOString?.() || "",
        attempt.completedAt?.toISOString?.() || "",
      ]),
    ];
    const log = await IntegrationDeliveryLog.create({
      owner: req.user.userId,
      provider: "google_sheets",
      event: "report.synced",
      target: connection?.config?.spreadsheetId || "",
      requestPayload: { quizId: String(quiz._id), rows: values.length },
    });

    if (!connection?.config?.accessToken || !connection?.config?.spreadsheetId) {
      log.status = "failed";
      log.attempts = 1;
      log.error = "Google Sheets accessToken and spreadsheetId are required in integration config";
      await log.save();
      return res.status(400).json({ message: log.error, logId: String(log._id) });
    }

    const range = connection.config.range || "Quivora Report!A1";
    const response = await axios.post(
      `https://sheets.googleapis.com/v4/spreadsheets/${connection.config.spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
      { values },
      { headers: { Authorization: `Bearer ${connection.config.accessToken}` }, timeout: 8000 }
    );

    log.status = "delivered";
    log.attempts = 1;
    log.responseStatus = response.status;
    log.responseBody = JSON.stringify(response.data).slice(0, 1000);
    await log.save();
    res.status(200).json({ logId: String(log._id), rows: values.length, status: "synced" });
  } catch (error) {
    next(error);
  }
});

router.post("/webhooks", requireAdmin, async (req, res, next) => {
  try {
    const { name, url, events = ["quiz.launched", "report.generated"] } = req.body;
    if (!name?.trim() || !url?.trim()) return res.status(400).json({ message: "name and url are required" });
    const endpoint = await WebhookEndpoint.create({
      owner: req.user.userId,
      name,
      url,
      events,
      secret: crypto.randomBytes(24).toString("hex"),
    });
    res.status(201).json({ id: String(endpoint._id), name: endpoint.name, url: endpoint.url, events: endpoint.events, status: endpoint.status, secret: endpoint.secret });
  } catch (error) {
    next(error);
  }
});

router.post("/webhooks/:endpointId/test", requireAdmin, async (req, res, next) => {
  try {
    const endpoint = await WebhookEndpoint.findOne({ _id: req.params.endpointId, owner: req.user.userId });
    if (!endpoint) return res.status(404).json({ message: "Webhook not found" });
    const log = await deliverWebhook(endpoint, "webhook.test", { event: "webhook.test", sentAt: new Date().toISOString(), payload: { ok: true } });
    res.status(200).json({ id: String(log._id), status: log.status, responseStatus: log.responseStatus, error: log.error });
  } catch (error) {
    next(error);
  }
});

router.post("/logs/:logId/retry", requireAdmin, async (req, res, next) => {
  try {
    const previous = await IntegrationDeliveryLog.findOne({ _id: req.params.logId, owner: req.user.userId });
    if (!previous) return res.status(404).json({ message: "Delivery log not found" });
    if (previous.provider !== "webhook") return res.status(400).json({ message: "Only webhook logs can be retried here" });
    const endpoint = await WebhookEndpoint.findOne({ owner: req.user.userId, url: previous.target, status: "active" });
    if (!endpoint) return res.status(404).json({ message: "Webhook endpoint not found" });
    const log = await deliverWebhook(endpoint, previous.event, previous.requestPayload);
    res.status(200).json({ id: String(log._id), status: log.status, error: log.error });
  } catch (error) {
    next(error);
  }
});

router.post("/drive/import-url", requireAdmin, async (req, res, next) => {
  try {
    const { title = "Drive import", url } = req.body;
    if (!url?.trim()) return res.status(400).json({ message: "url is required" });
    const response = await axios.get(url, { timeout: 8000, responseType: "text" });
    const rawText = typeof response.data === "string" ? response.data.slice(0, 250000) : JSON.stringify(response.data).slice(0, 250000);
    const document = await UploadedDocument.create({
      admin: req.user.userId,
      title,
      fileName: url,
      mimeType: response.headers["content-type"] || "text/plain",
      sourceType: "google_drive_url",
      rawText,
      status: "processed",
    });
    await IntegrationConnection.findOneAndUpdate(
      { owner: req.user.userId, provider: "google_drive" },
      { owner: req.user.userId, provider: "google_drive", status: "connected", connectedAt: new Date(), config: { lastImportUrl: url } },
      { upsert: true }
    );
    res.status(201).json({ documentId: String(document._id), title: document.title, textLength: rawText.length });
  } catch (error) {
    await IntegrationConnection.findOneAndUpdate(
      { owner: req.user.userId, provider: "google_drive" },
      { owner: req.user.userId, provider: "google_drive", status: "error", lastError: error.message },
      { upsert: true }
    ).catch(() => {});
    next(error);
  }
});

module.exports = router;

module.exports.deliverWebhook = deliverWebhook;
