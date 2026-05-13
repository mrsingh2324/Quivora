const axios = require("axios");
const crypto = require("crypto");

const IntegrationDeliveryLog = require("../modules/integrations/IntegrationDeliveryLog");
const WebhookEndpoint = require("../modules/integrations/WebhookEndpoint");

function buildEventPayload(quiz, event, payload = {}) {
  return {
    event,
    quiz: {
      id: String(quiz._id || quiz.id),
      title: quiz.title,
      joinCode: quiz.joinCode,
      customSlug: quiz.sharing?.customSlug || "",
    },
    payload,
    sentAt: new Date().toISOString(),
  };
}

async function dispatchQuizIntegrationEvent(quiz, event, payload = {}) {
  if (!quiz?.integrations) {
    return;
  }

  const eventPayload = buildEventPayload(quiz, event, payload);

  if (quiz.integrations.webhookUrl) {
    axios
      .post(quiz.integrations.webhookUrl, eventPayload, { timeout: 3000 })
      .catch((error) => {
        console.warn("[Integrations] Webhook delivery failed:", error.message);
      });
  }

  const owner = quiz.createdBy?._id || quiz.createdBy;
  if (owner) {
    const endpoints = await WebhookEndpoint.find({
      owner,
      status: "active",
      events: { $in: [event] },
    });

    await Promise.all(endpoints.map(async (endpoint) => {
      const eventPayloadWithOwner = buildEventPayload(quiz, event, payload);
      const log = await IntegrationDeliveryLog.create({
        owner,
        provider: "webhook",
        event,
        target: endpoint.url,
        requestPayload: eventPayloadWithOwner,
      });
      const signature = crypto
        .createHmac("sha256", endpoint.secret)
        .update(JSON.stringify(eventPayloadWithOwner))
        .digest("hex");

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const response = await axios.post(endpoint.url, eventPayloadWithOwner, {
            timeout: 5000,
            headers: { "X-Quivora-Signature": signature },
          });
          log.status = "delivered";
          log.responseStatus = response.status;
          log.attempts = attempt;
          break;
        } catch (error) {
          log.status = "failed";
          log.responseStatus = error.response?.status || 0;
          log.error = error.message;
          log.attempts = attempt;
          if (attempt < 3 && (!error.response || error.response.status >= 500)) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 250));
            continue;
          }
          log.nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);
          break;
        }
      }
      await log.save();
    }));
  }

  if (quiz.integrations.notificationEmail) {
    const owner = quiz.createdBy?._id || quiz.createdBy;
    const log = owner ? await IntegrationDeliveryLog.create({
      owner,
      provider: "email",
      event,
      target: quiz.integrations.notificationEmail,
      requestPayload: eventPayload,
    }) : null;

    if (process.env.EMAIL_PROVIDER_URL) {
      try {
        const response = await axios.post(
          process.env.EMAIL_PROVIDER_URL,
          {
            to: quiz.integrations.notificationEmail,
            subject: `Quiz event: ${event}`,
            text: JSON.stringify(eventPayload, null, 2),
          },
          {
            timeout: 5000,
            headers: process.env.EMAIL_PROVIDER_API_KEY
              ? { Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}` }
              : {},
          }
        );
        if (log) {
          log.status = "delivered";
          log.attempts = 1;
          log.responseStatus = response.status;
          await log.save();
        }
      } catch (error) {
        if (log) {
          log.status = "failed";
          log.attempts = 1;
          log.error = error.message;
          log.responseStatus = error.response?.status || 0;
          await log.save();
        }
      }
    } else if (log) {
      log.status = "failed";
      log.attempts = 1;
      log.error = "EMAIL_PROVIDER_URL is not configured";
      await log.save();
    }
  }
}

module.exports = {
  dispatchQuizIntegrationEvent,
};
