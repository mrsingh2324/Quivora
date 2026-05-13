const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || `Request failed: ${response.status}`);
  }

  return data;
}

const SESSION_KEY = (joinCode) => `qz_session_${joinCode.toUpperCase()}`;
const LAST_SESSION_KEY = "qz_last_session";

export function saveParticipantSession(joinCode, attemptId, playerName, extra = {}) {
  try {
    const session = { joinCode: joinCode.toUpperCase(), attemptId, playerName, ts: Date.now(), ...extra };
    sessionStorage.setItem(
      SESSION_KEY(joinCode),
      JSON.stringify(session)
    );
    sessionStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage unavailable (private browsing edge cases) — ignore
  }
}

export function loadParticipantSession(joinCode) {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY(joinCode));
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard sessions older than 4 hours
    if (Date.now() - data.ts > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(SESSION_KEY(joinCode));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function loadLatestParticipantSession() {
  try {
    const raw = sessionStorage.getItem(LAST_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.joinCode || Date.now() - data.ts > 4 * 60 * 60 * 1000) {
      sessionStorage.removeItem(LAST_SESSION_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearParticipantSession(joinCode) {
  try {
    sessionStorage.removeItem(SESSION_KEY(joinCode));
  } catch {
    // ignore
  }
}

export async function joinQuiz(joinCode, participantName, existingAttemptId = null) {
  return request(`/api/quizzes/${joinCode}/join`, {
    method: "POST",
    body: JSON.stringify({
      participantName,
      ...(existingAttemptId ? { attemptId: existingAttemptId } : {}),
    }),
  });
}

export async function fetchQuizLeaderboard(quizId) {
  return request(`/api/quizzes/${quizId}/leaderboard`);
}

export async function submitAsyncAnswer(quizId, payload) {
  return request(`/api/quizzes/${quizId}/async-submit`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAsyncAttemptState(quizId, attemptId) {
  return request(`/api/quizzes/${quizId}/async-attempts/${attemptId}`);
}

export function getCertificateUrl(attemptId) {
  return `${API_URL}/api/attempts/${attemptId}/certificate`;
}
