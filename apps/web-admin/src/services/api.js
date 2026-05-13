const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TOKEN_KEY = "qz_admin_token";
const ADMIN_KEY = "admin";

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
    }

    const parts = [data?.message || `Request failed: ${response.status}`];
    if (data?.details) parts.push(data.details);
    throw new Error(parts.join(" "));
  }

  return data;
}

function toQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchQuizzes(params = {}) {
  const data = await request(`/api/quizzes${toQueryString(params)}`);
  return Array.isArray(data) ? data : data.items || [];
}

export async function fetchQuizPage(params = {}) {
  return request(`/api/quizzes${toQueryString(params)}`);
}

export async function fetchQuizDrafts() {
  return request("/api/quiz-drafts");
}

export async function createQuizDraft(payload) {
  return request("/api/quiz-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateQuizDraft(draftId, payload) {
  return request(`/api/quiz-drafts/${draftId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function globalSearch(params = {}) {
  return request(`/api/search${toQueryString(params)}`);
}

export async function fetchQuestionBank(params = {}) {
  return request(`/api/question-bank${toQueryString(params)}`);
}

export async function createQuestionBankItem(payload) {
  return request("/api/question-bank", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function addQuestionToQuiz(questionId, quizId) {
  return request(`/api/question-bank/${questionId}/add-to-quiz/${quizId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function fetchQuizById(quizId) {
  return request(`/api/quizzes/${quizId}`);
}

export async function createQuiz(payload) {
  return request("/api/quizzes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function publishQuiz(quizId) {
  return request(`/api/quizzes/${quizId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function generateQuizFromTopic(payload) {
  return request("/api/quizzes/generate-from-topic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function aiEditQuiz(quizId, payload) {
  return request(`/api/quizzes/${quizId}/ai-edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateQuizSettings(quizId, payload) {
  return request(`/api/quizzes/${quizId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateQuestion(quizId, questionId, payload) {
  return request(`/api/quizzes/${quizId}/questions/${questionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function deleteQuestion(quizId, questionId) {
  return request(`/api/quizzes/${quizId}/questions/${questionId}`, {
    method: "DELETE",
  });
}

export async function askWorkspaceAssistant(payload) {
  return request("/api/workspace-assistant/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadDocumentForQuiz(payload) {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("file", payload.file);

  if (payload.admin) formData.append("admin", payload.admin);
  if (payload.difficulty) formData.append("difficulty", payload.difficulty);
  if (payload.count !== undefined && payload.count !== "") {
    formData.append("count", payload.count);
  }

  return request("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function createLiveSession(payload) {
  return request("/api/live-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchLiveSessions() {
  return request("/api/live-sessions");
}

export async function startLiveSession(sessionId) {
  return request(`/api/live-sessions/${sessionId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function endLiveSession(sessionId) {
  return request(`/api/live-sessions/${sessionId}/end`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function fetchSessionQr(sessionId) {
  return request(`/api/live-sessions/${sessionId}/qr`);
}

export async function fetchSessionReport(sessionId) {
  return request(`/api/live-sessions/${sessionId}/report`);
}

export async function fetchSessionAiSummary(sessionId) {
  return request(`/api/analytics/sessions/${sessionId}/ai-summary`);
}

export async function fetchQuizLaunchHistory(quizId) {
  return request(`/api/live-sessions/quizzes/${quizId}/history`);
}

export async function fetchQuizReport(quizId) {
  return request(`/api/live-sessions/quizzes/${quizId}/report`);
}

export function getQuizReportCsvUrl(quizId) {
  const token = getToken();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${API_URL}/api/live-sessions/quizzes/${quizId}/report.csv${tokenParam}`;
}

export async function launchQuizAgain(quizId, payload = {}) {
  return request(`/api/live-sessions/quizzes/${quizId}/launch-again`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateProfile(payload) {
  return request("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function upgradeAdminAccess(payload) {
  return request("/api/auth/admin-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchSupportRequests() {
  return request("/api/support-requests");
}

export async function createSupportRequest(payload) {
  return request("/api/support-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateSupportRequest(requestId, payload) {
  return request(`/api/support-requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function addSupportMessage(requestId, payload) {
  return request(`/api/support-requests/${requestId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function searchSupportArticles(params = {}) {
  return request(`/api/support-requests/articles/search${toQueryString(params)}`);
}

export async function saveSupportArticle(payload) {
  return request("/api/support-requests/articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminConsoleSummary() {
  return request("/api/admin-console/summary");
}

export async function fetchAssignments() {
  return request("/api/assignments");
}

export async function createAssignment(payload) {
  return request("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function selectAssignment(assignmentId) {
  return request(`/api/assignments/${assignmentId}/select`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function updateAssignmentSelection(assignmentId, payload) {
  return request(`/api/assignments/${assignmentId}/selection`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchTeamWorkspaces() {
  return request("/api/team-workspaces");
}

export async function createTeamWorkspace(payload) {
  return request("/api/team-workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchTeamWorkspace(workspaceId) {
  return request(`/api/team-workspaces/${workspaceId}`);
}

export async function createWorkspaceInvite(workspaceId, payload) {
  return request(`/api/team-workspaces/${workspaceId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createWorkspaceFolder(workspaceId, payload) {
  return request(`/api/team-workspaces/${workspaceId}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function requestQuizApproval(workspaceId, payload) {
  return request(`/api/team-workspaces/${workspaceId}/approvals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function decideQuizApproval(workspaceId, approvalId, payload) {
  return request(`/api/team-workspaces/${workspaceId}/approvals/${approvalId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function fetchIntegrations() {
  return request("/api/integrations");
}

export async function updateIntegrationConnection(provider, payload) {
  return request(`/api/integrations/connections/${provider}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function syncQuizToGoogleSheets(quizId) {
  return request(`/api/integrations/google-sheets/sync/${quizId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function createWebhookEndpoint(payload) {
  return request("/api/integrations/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function testWebhookEndpoint(endpointId) {
  return request(`/api/integrations/webhooks/${endpointId}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function retryIntegrationLog(logId) {
  return request(`/api/integrations/logs/${logId}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
}

export async function importDriveUrl(payload) {
  return request("/api/integrations/drive/import-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
