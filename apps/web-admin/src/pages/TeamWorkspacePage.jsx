import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import {
  createTeamWorkspace,
  createWorkspaceFolder,
  createWorkspaceInvite,
  decideQuizApproval,
  fetchTeamWorkspace,
  fetchTeamWorkspaces,
} from "../services/api";

function TeamWorkspacePage() {
  const [searchParams] = useSearchParams();
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("Loading workspaces...");
  const [workspaceName, setWorkspaceName] = useState("");
  const [invite, setInvite] = useState({ email: "", role: "viewer" });
  const [folder, setFolder] = useState({ name: "", description: "" });

  async function loadWorkspaces(nextId = selectedId) {
    try {
      const data = await fetchTeamWorkspaces();
      setWorkspaces(data);
      const id = nextId || data[0]?.id || "";
      setSelectedId(id);
      if (id) {
        const nextDetail = await fetchTeamWorkspace(id);
        setDetail(nextDetail);
      }
      setStatus(data.length ? `${data.length} workspace${data.length === 1 ? "" : "s"} available.` : "Create your first team workspace.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  useEffect(() => {
    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setStatus("Create a team workspace, then invite members and shared folders.");
    }
  }, [searchParams]);

  async function handleCreateWorkspace(event) {
    event.preventDefault();
    setStatus("Creating workspace...");
    try {
      const workspace = await createTeamWorkspace({ name: workspaceName, approvalsEnabled: true });
      setWorkspaceName("");
      await loadWorkspaces(workspace.id);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleSelect(event) {
    const id = event.target.value;
    setSelectedId(id);
    setStatus("Loading workspace...");
    try {
      setDetail(await fetchTeamWorkspace(id));
      setStatus("Workspace loaded.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleInvite(event) {
    event.preventDefault();
    setStatus("Creating invite...");
    try {
      const result = await createWorkspaceInvite(selectedId, invite);
      setInvite({ email: "", role: "viewer" });
      setStatus(`Invite created. Token: ${result.token}`);
      setDetail(await fetchTeamWorkspace(selectedId));
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function handleFolder(event) {
    event.preventDefault();
    setStatus("Creating folder...");
    try {
      await createWorkspaceFolder(selectedId, folder);
      setFolder({ name: "", description: "" });
      setDetail(await fetchTeamWorkspace(selectedId));
      setStatus("Folder created.");
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function decide(approvalId, nextStatus) {
    setStatus("Updating approval...");
    try {
      await decideQuizApproval(selectedId, approvalId, { status: nextStatus });
      setDetail(await fetchTeamWorkspace(selectedId));
      setStatus(`Approval ${nextStatus}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search teams, members, folders, approvals..." />
      <main className="static-page-shell">
        <section className="static-hero">
          <Link className="static-back-link" to="/">Back to workspace</Link>
          <p className="eyebrow">Team Workspace</p>
          <h1>Members, folders, approvals, audit logs</h1>
          <p>{status}</p>
        </section>

        <section className="assignments-layout">
          <div className="account-detail-panel">
            <form className="support-request-form" onSubmit={handleCreateWorkspace}>
              <div className="create-panel-heading">
                <div>
                  <p className="eyebrow">Create</p>
                  <h2>New workspace</h2>
                </div>
              </div>
              <label className="field">
                <span>Name</span>
                <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required />
              </label>
              <button className="primary-button" type="submit">Create workspace</button>
            </form>

            {workspaces.length ? (
              <label className="field">
                <span>Active workspace</span>
                <select value={selectedId} onChange={handleSelect}>
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>{workspace.name} ({workspace.role})</option>
                  ))}
                </select>
              </label>
            ) : null}

            {detail ? (
              <>
                <div className="account-card-grid">
                  <article className="account-card"><span>Members</span><strong>{detail.members.length}</strong></article>
                  <article className="account-card"><span>Invites</span><strong>{detail.invites.length}</strong></article>
                  <article className="account-card"><span>Folders</span><strong>{detail.folders.length}</strong></article>
                  <article className="account-card"><span>Approvals</span><strong>{detail.approvals.length}</strong></article>
                </div>

                <div className="admin-console-grid">
                  <section>
                    <h3>Members</h3>
                    {detail.members.map((member) => (
                      <p key={member.id}><strong>{member.role}</strong> {member.user.name} ({member.user.email})</p>
                    ))}
                  </section>
                  <section>
                    <h3>Approvals</h3>
                    {detail.approvals.length === 0 ? <p>No approvals yet.</p> : detail.approvals.map((approval) => (
                      <p key={approval.id}>
                        <strong>{approval.status}</strong> {approval.quiz?.title || "Quiz"}
                        {approval.status === "pending" ? (
                          <>
                            {" "}
                            <button type="button" onClick={() => decide(approval.id, "approved")}>Approve</button>
                            <button type="button" onClick={() => decide(approval.id, "rejected")}>Reject</button>
                          </>
                        ) : null}
                      </p>
                    ))}
                  </section>
                </div>

                <section>
                  <h3>Audit log</h3>
                  {detail.auditLogs.map((log) => (
                    <p key={log.id}><strong>{log.action}</strong> by {log.actor?.name || "User"} · {new Date(log.createdAt).toLocaleString()}</p>
                  ))}
                </section>
              </>
            ) : null}
          </div>

          <aside className="account-detail-panel">
            <form onSubmit={handleInvite} className="support-request-form">
              <h3>Invite member</h3>
              <label className="field">
                <span>Email</span>
                <input type="email" value={invite.email} onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))} required />
              </label>
              <label className="field">
                <span>Role</span>
                <select value={invite.role} onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button className="primary-button" type="submit" disabled={!selectedId}>Create invite</button>
            </form>
            <form onSubmit={handleFolder} className="support-request-form">
              <h3>Shared folder</h3>
              <label className="field">
                <span>Name</span>
                <input value={folder.name} onChange={(event) => setFolder((current) => ({ ...current, name: event.target.value }))} required />
              </label>
              <label className="field">
                <span>Description</span>
                <textarea rows={3} value={folder.description} onChange={(event) => setFolder((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <button className="primary-button" type="submit" disabled={!selectedId}>Create folder</button>
            </form>
          </aside>
        </section>
      </main>
    </>
  );
}

export default TeamWorkspacePage;
