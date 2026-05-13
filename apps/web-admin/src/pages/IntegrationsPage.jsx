import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import {
  createWebhookEndpoint,
  fetchIntegrations,
  importDriveUrl,
  retryIntegrationLog,
  syncQuizToGoogleSheets,
  testWebhookEndpoint,
  updateIntegrationConnection,
  fetchQuizzes,
} from "../services/api";

function IntegrationsPage() {
  const [data, setData] = useState({ connections: [], webhooks: [], logs: [] });
  const [status, setStatus] = useState("Loading integrations...");
  const [webhook, setWebhook] = useState({ name: "", url: "", events: "quiz.launched,report.generated" });
  const [drive, setDrive] = useState({ title: "", url: "" });
  const [quizzes, setQuizzes] = useState([]);
  const [sheetQuizId, setSheetQuizId] = useState("");

  async function load() {
    try {
      const next = await fetchIntegrations();
      setData(next);
      setStatus("Integration states and delivery logs loaded.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    load();
    fetchQuizzes({ limit: 50 }).then(setQuizzes).catch(() => setQuizzes([]));
  }, []);

  async function markConnected(provider) {
    setStatus(`Updating ${provider}...`);
    try {
      await updateIntegrationConnection(provider, { status: "connected", config: {} });
      await load();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function createWebhook(event) {
    event.preventDefault();
    setStatus("Creating webhook endpoint...");
    try {
      const result = await createWebhookEndpoint({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setWebhook({ name: "", url: "", events: "quiz.launched,report.generated" });
      setStatus(`Webhook created. Secret: ${result.secret}`);
      await load();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function testWebhook(id) {
    setStatus("Sending webhook test...");
    try {
      const result = await testWebhookEndpoint(id);
      setStatus(`Webhook test ${result.status}${result.error ? `: ${result.error}` : ""}`);
      await load();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function retryLog(id) {
    setStatus("Retrying delivery...");
    try {
      await retryIntegrationLog(id);
      await load();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleDriveImport(event) {
    event.preventDefault();
    setStatus("Importing Drive URL...");
    try {
      const result = await importDriveUrl(drive);
      setDrive({ title: "", url: "" });
      setStatus(`Drive URL imported into document ${result.documentId}.`);
      await load();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleSheetsSync() {
    if (!sheetQuizId) {
      setStatus("Choose a quiz to sync.");
      return;
    }
    setStatus("Syncing quiz report to Google Sheets...");
    try {
      const result = await syncQuizToGoogleSheets(sheetQuizId);
      setStatus(`Google Sheets sync ${result.status}; ${result.rows} rows prepared.`);
      await load();
    } catch (error) {
      setStatus(error.message);
      await load();
    }
  }

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search integrations, webhooks, delivery logs..." />
      <main className="static-page-shell">
        <section className="static-hero">
          <Link className="static-back-link" to="/">Back to workspace</Link>
          <p className="eyebrow">Integrations</p>
          <h1>Sheets, Drive, email, webhooks</h1>
          <p>{status}</p>
        </section>
        <section className="account-detail-panel">
          <div className="integration-status-grid">
            {data.connections.map((connection) => (
              <span key={connection.provider}>
                <strong>{connection.provider.replace("_", " ")}</strong>: {connection.status}
                {connection.status !== "connected" ? <button type="button" onClick={() => markConnected(connection.provider)}>Mark configured</button> : null}
              </span>
            ))}
          </div>

          <div className="assignments-layout">
            <form className="support-request-form" onSubmit={createWebhook}>
              <h3>Webhook builder</h3>
              <label className="field"><span>Name</span><input value={webhook.name} onChange={(event) => setWebhook((current) => ({ ...current, name: event.target.value }))} required /></label>
              <label className="field"><span>URL</span><input value={webhook.url} onChange={(event) => setWebhook((current) => ({ ...current, url: event.target.value }))} required /></label>
              <label className="field"><span>Events</span><input value={webhook.events} onChange={(event) => setWebhook((current) => ({ ...current, events: event.target.value }))} /></label>
              <button className="primary-button" type="submit">Create signed webhook</button>
            </form>
            <form className="support-request-form" onSubmit={handleDriveImport}>
              <h3>Google Drive URL import</h3>
              <label className="field"><span>Title</span><input value={drive.title} onChange={(event) => setDrive((current) => ({ ...current, title: event.target.value }))} required /></label>
              <label className="field"><span>Public/export URL</span><input value={drive.url} onChange={(event) => setDrive((current) => ({ ...current, url: event.target.value }))} required /></label>
              <button className="primary-button" type="submit">Import as document</button>
            </form>
            <section className="support-request-form">
              <h3>Google Sheets sync</h3>
              <label className="field">
                <span>Quiz report</span>
                <select value={sheetQuizId} onChange={(event) => setSheetQuizId(event.target.value)}>
                  <option value="">Choose quiz</option>
                  {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
                </select>
              </label>
              <button className="primary-button" type="button" onClick={handleSheetsSync}>Sync to configured sheet</button>
              <p className="support-copy">Requires Google Sheets connection config with access token and spreadsheet ID.</p>
            </section>
          </div>

          <section>
            <h3>Webhook endpoints</h3>
            {data.webhooks.length === 0 ? <p>No webhooks configured.</p> : data.webhooks.map((endpoint) => (
              <article className="support-request-card" key={endpoint.id}>
                <div>
                  <strong>{endpoint.name}</strong>
                  <p>{endpoint.url}</p>
                  <small>{endpoint.events.join(", ")} · secret {endpoint.secretPreview}</small>
                </div>
                <button type="button" onClick={() => testWebhook(endpoint.id)}>Send test</button>
              </article>
            ))}
          </section>

          <section>
            <h3>Delivery logs</h3>
            {data.logs.length === 0 ? <p>No deliveries yet.</p> : data.logs.map((log) => (
              <article className="support-request-card" key={log.id}>
                <div>
                  <strong>{log.provider} · {log.event}</strong>
                  <p>{log.status} · attempts {log.attempts} · HTTP {log.responseStatus || "-"}</p>
                  {log.error ? <small>{log.error}</small> : null}
                </div>
                {log.status === "failed" ? <button type="button" onClick={() => retryLog(log.id)}>Retry</button> : null}
              </article>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}

export default IntegrationsPage;
