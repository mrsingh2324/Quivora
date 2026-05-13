import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import {
  addSupportMessage,
  createSupportRequest,
  fetchAdminConsoleSummary,
  fetchSupportRequests,
  updateProfile,
  updateSupportRequest,
} from "../services/api";

const supportCategories = [
  ["account", "Account access"],
  ["bug", "Bug or broken page"],
  ["quiz_issue", "Quiz creation or editing"],
  ["report_issue", "Reports or CSV export"],
  ["live_session_issue", "Live session or player join"],
  ["integration_issue", "Integration setup"],
  ["other", "Other"],
];

function AccountNav({ section }) {
  const pages = [
    ["profile", "Profile"],
    ["admin-player", "Admin + Player"],
    ["settings", "Settings"],
    ["admin-console", "Admin Console"],
    ["support-requests", "Support Requests"],
  ];

  return (
    <aside className="account-nav" aria-label="Account sections">
      {pages.map(([key, label]) => (
        <Link className={key === section ? "active" : ""} key={key} to={`/account/${key}`}>
          {label}
        </Link>
      ))}
    </aside>
  );
}

function ProfileSection() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    avatar: user?.avatar || "",
    currentPassword: "",
    newPassword: "",
  });
  const [status, setStatus] = useState("Update the account identity used in quizzes, reports, and support requests.");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, name: user?.name || "", avatar: user?.avatar || "" }));
  }, [user?.name, user?.avatar]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("Saving profile...");

    try {
      const updated = await updateProfile(form);
      updateUser(updated);
      setForm((current) => ({ ...current, currentPassword: "", newPassword: "" }));
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="account-detail-panel" onSubmit={handleSubmit}>
      <div className="create-panel-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h2>Profile</h2>
        </div>
        <span>{status}</span>
      </div>
      <div className="account-card-grid">
        <article className="account-card">
          <span>Email</span>
          <strong>{user?.email || "No email"}</strong>
        </article>
        <article className="account-card">
          <span>Role</span>
          <strong>{user?.role || "admin"}</strong>
        </article>
        <article className="account-card">
          <span>Avatar</span>
          <strong>{(form.name || "A")[0].toUpperCase()}</strong>
        </article>
      </div>
      <label className="field">
        <span>Name</span>
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
      </label>
      <label className="field">
        <span>Avatar URL</span>
        <input value={form.avatar} onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))} placeholder="https://..." />
      </label>
      <div className="inline-fields">
        <label className="field">
          <span>Current password</span>
          <input type="password" value={form.currentPassword} onChange={(event) => setForm((current) => ({ ...current, currentPassword: event.target.value }))} />
        </label>
        <label className="field">
          <span>New password</span>
          <input type="password" value={form.newPassword} onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))} />
        </label>
      </div>
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}

function SettingsSection() {
  return (
    <section className="account-detail-panel">
      <div className="create-panel-heading">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Settings</h2>
        </div>
        <span>Operational defaults for quiz creation and live rooms.</span>
      </div>
      <div className="account-card-grid">
        <article className="account-card">
          <span>Default quiz status</span>
          <strong>Draft until published</strong>
        </article>
        <article className="account-card">
          <span>Participant collection</span>
          <strong>Name required</strong>
        </article>
        <article className="account-card">
          <span>Report exports</span>
          <strong>CSV enabled</strong>
        </article>
      </div>
    </section>
  );
}

function AdminPlayerSection() {
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState(
    user?.role === "admin_player"
      ? "Admin + Player mode is active for this account."
      : "Enable this mode when one person needs to create quizzes and also use learner preparation features."
  );
  const [saving, setSaving] = useState(false);

  async function enableAdminPlayer() {
    setSaving(true);
    setStatus("Enabling Admin + Player mode...");

    try {
      const updated = await updateProfile({ role: "admin_player" });
      updateUser(updated);
      setStatus("Admin + Player mode is active. This account can create, launch, report, select assignments, and use learner preparation.");
    } catch (error) {
      setStatus(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-detail-panel">
      <div className="create-panel-heading">
        <div>
          <p className="eyebrow">Dual Role</p>
          <h2>Admin + Player</h2>
        </div>
        <span>{status}</span>
      </div>
      <div className="account-card-grid">
        <article className="account-card">
          <span>Create</span>
          <strong>Build, review, publish, and launch quizzes</strong>
        </article>
        <article className="account-card">
          <span>Play</span>
          <strong>Select assignments and use preparation material</strong>
        </article>
        <article className="account-card">
          <span>Operate</span>
          <strong>Reports, support requests, search, and admin console</strong>
        </article>
      </div>
      <p className="support-copy">
        Use this role for a founder, teacher, trainer, or evaluator who needs full workspace access and also wants to experience learner flows without creating a separate account.
      </p>
      <div className="build-success-actions">
        <Link className="secondary-button" to="/assignments">Open assignments</Link>
        <Link className="secondary-button" to="/build">Create a quiz</Link>
        {user?.role !== "admin_player" ? (
          <button className="primary-button" disabled={saving} onClick={enableAdminPlayer} type="button">
            {saving ? "Enabling..." : "Enable Admin + Player"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function SupportRequestsSection() {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ category: "quiz_issue", subject: "", description: "" });
  const [status, setStatus] = useState("Loading support requests...");
  const [loading, setLoading] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});

  async function loadRequests() {
    try {
      const data = await fetchSupportRequests();
      setRequests(data);
      setStatus(data.length ? `${data.length} support request${data.length === 1 ? "" : "s"} loaded.` : "No support requests yet.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setStatus("Creating support request...");

    try {
      await createSupportRequest(form);
      setForm({ category: "quiz_issue", subject: "", description: "" });
      await loadRequests();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(requestId, nextStatus) {
    setStatus("Updating request...");
    try {
      await updateSupportRequest(requestId, { status: nextStatus });
      await loadRequests();
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleReply(requestId) {
    const body = replyDrafts[requestId];
    if (!body?.trim()) return;
    setStatus("Adding support message...");
    try {
      await addSupportMessage(requestId, { body });
      setReplyDrafts((current) => ({ ...current, [requestId]: "" }));
      await loadRequests();
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="account-detail-panel">
      <div className="create-panel-heading">
        <div>
          <p className="eyebrow">Support</p>
          <h2>Support Requests</h2>
        </div>
        <span>{status}</span>
      </div>

      <form className="support-request-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Category</span>
          <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
            {supportCategories.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Subject</span>
          <input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} required />
        </label>
        <label className="field">
          <span>Details</span>
          <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} required />
        </label>
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Creating..." : "Create request"}
        </button>
      </form>

      <div className="support-request-list">
        {requests.map((request) => (
          <article className="support-request-card" key={request.id}>
            <div>
              <span className={`status-badge status-${request.status}`}>{request.status.replace("_", " ")}</span>
              <h3>{request.subject}</h3>
              <p>{request.description}</p>
              {request.attachments?.length ? (
                <div className="support-copy">
                  Attachments: {request.attachments.map((attachment) => <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">{attachment.name || attachment.url}</a>)}
                </div>
              ) : null}
              {request.messages?.length ? (
                <div className="support-thread">
                  {request.messages.map((message) => (
                    <p key={message.id}><strong>{message.author?.name || "User"}:</strong> {message.body}</p>
                  ))}
                </div>
              ) : null}
              <label className="field">
                <span>Reply</span>
                <textarea rows={2} value={replyDrafts[request.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [request.id]: event.target.value }))} />
              </label>
              <button className="secondary-button compact-button" type="button" onClick={() => handleReply(request.id)}>Add message</button>
              <small>{supportCategories.find(([value]) => value === request.category)?.[1] || request.category}</small>
            </div>
            <select value={request.status} onChange={(event) => handleStatusChange(request.id, event.target.value)}>
              <option value="open">Open</option>
              <option value="in_review">In review</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminConsoleSection() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("Loading admin console...");

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await fetchAdminConsoleSummary();
        setSummary(data);
        setStatus("Workspace operations loaded from live data.");
      } catch (error) {
        setStatus(error.message);
      }
    }

    loadSummary();
  }, []);

  const stats = useMemo(() => summary?.stats || {}, [summary]);

  return (
    <section className="account-detail-panel">
      <div className="create-panel-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h2>Admin Console</h2>
        </div>
        <span>{status}</span>
      </div>
      <div className="account-card-grid">
        {[
          ["Quizzes", stats.quizzes || 0],
          ["Published", stats.published || 0],
          ["Attempts", stats.attempts || 0],
          ["Live rooms", stats.activeSessions || 0],
          ["Documents", stats.uploadedDocuments || 0],
          ["Support requests", stats.supportRequests || 0],
        ].map(([label, value]) => (
          <article className="account-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="admin-console-grid">
        <section>
          <h3>Readiness</h3>
          {(summary?.readiness || []).map((item) => (
            <p className={item.ok ? "readiness-ok" : "readiness-warn"} key={item.label}>
              <strong>{item.ok ? "Ready" : "Needs work"}</strong> {item.label}
            </p>
          ))}
        </section>
        <section>
          <h3>Recent support</h3>
          {(summary?.recentSupportRequests || []).length === 0 ? (
            <p>No support requests yet.</p>
          ) : (
            summary.recentSupportRequests.map((request) => (
              <p key={request.id}>
                <strong>{request.status}</strong> {request.subject}
              </p>
            ))
          )}
        </section>
      </div>
    </section>
  );
}

function AccountPage() {
  const { section = "profile" } = useParams();
  const activeSection = section;

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search account, settings, support, operations..." />
      <main className="static-page-shell account-page-shell">
        <section className="static-hero account-hero">
          <Link className="static-back-link" to="/">Back to workspace</Link>
          <p className="eyebrow">Workspace account</p>
          <h1>{activeSection === "admin-player" ? "Admin + Player" : activeSection === "admin-console" ? "Admin Console" : activeSection === "support-requests" ? "Support Requests" : activeSection === "settings" ? "Settings" : "Profile"}</h1>
          <p>Manage real account details, support tickets, and workspace operations from live application data.</p>
        </section>

        <section className="account-layout">
          <AccountNav section={activeSection} />
          {activeSection === "admin-player" ? <AdminPlayerSection /> : null}
          {activeSection === "support-requests" ? <SupportRequestsSection /> : null}
          {activeSection === "admin-console" ? <AdminConsoleSection /> : null}
          {activeSection === "settings" ? <SettingsSection /> : null}
          {!["admin-player", "support-requests", "admin-console", "settings"].includes(activeSection) ? <ProfileSection /> : null}
        </section>
      </main>
    </>
  );
}

export default AccountPage;
