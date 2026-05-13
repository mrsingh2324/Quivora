// Session store for live quiz state.
//
// Primary store: in-memory Map (always present, fast, process-local).
// Secondary store: Redis (optional, activated when REDIS_URL is set).
//   Redis is used as an async write-through layer so that:
//     1. A second API process can read serialized session state.
//     2. Sessions survive a server restart (recovery is done on startup).
//
// Non-serializable fields (timers, socket ref Maps) always stay in the
// local Map only — they are process-bound by nature.

const REDIS_TTL_SECONDS = 4 * 60 * 60; // 4 hours
const REDIS_KEY = (joinCode) => `qzsession:${joinCode}`;

let redisClient = null;

function setRedisClient(client) {
  redisClient = client;
}

// ── Serialization helpers ────────────────────────────────────────────────────

function serializeState(state) {
  return JSON.stringify({
    joinCode: state.joinCode,
    quizId: state.quizId,
    sessionId: state.sessionId,
    hostUserId: state.hostUserId,
    currentQuestionIndex: state.currentQuestionIndex,
    phase: state.phase,
    questionTimeLimitSeconds: state.questionTimeLimitSeconds,
    resultsWindowSeconds: state.resultsWindowSeconds,
    remainingSeconds: state.remainingSeconds,
    questionStartedAt: state.questionStartedAt,
    answeredAttemptIds: [...(state.answeredAttemptIds || [])],
    answerCounts: Object.fromEntries(state.answerCounts || new Map()),
  });
}

function mergeDeserializedState(raw, local) {
  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    answeredAttemptIds: new Set(parsed.answeredAttemptIds || []),
    answerCounts: new Map(Object.entries(parsed.answerCounts || {})),
    // Process-local fields from the overlay (or safe defaults)
    questions: local?.questions ?? null,
    participantSockets: local?.participantSockets ?? new Map(),
    questionTimer: local?.questionTimer ?? null,
    summaryTimer: local?.summaryTimer ?? null,
    loadingTimer: local?.loadingTimer ?? null,
  };
}

// ── Async Redis write-through (fire-and-forget) ──────────────────────────────

function persistToRedis(joinCode, state) {
  if (!redisClient) return;
  try {
    redisClient
      .setex(REDIS_KEY(joinCode), REDIS_TTL_SECONDS, serializeState(state))
      .catch(() => {});
  } catch {
    // Never let Redis errors break the live session
  }
}

function deleteFromRedis(joinCode) {
  if (!redisClient) return;
  try {
    redisClient.del(REDIS_KEY(joinCode)).catch(() => {});
  } catch {
    // ignore
  }
}

// ── Local in-memory Map ──────────────────────────────────────────────────────

const sessionStateByCode = new Map();

function getSessionState(joinCode) {
  return sessionStateByCode.get(joinCode) ?? null;
}

function setSessionState(joinCode, state) {
  sessionStateByCode.set(joinCode, state);
  persistToRedis(joinCode, state);
  return state;
}

function removeSessionState(joinCode) {
  const state = sessionStateByCode.get(joinCode);

  if (state) {
    if (state.questionTimer) clearInterval(state.questionTimer);
    if (state.summaryTimer) clearTimeout(state.summaryTimer);
    if (state.loadingTimer) clearTimeout(state.loadingTimer);
  }

  sessionStateByCode.delete(joinCode);
  deleteFromRedis(joinCode);
}

// ── Startup recovery ─────────────────────────────────────────────────────────
// Called once at boot. Scans Redis for any serialized sessions left over from
// a previous process and pre-loads them into the local Map (without timers —
// quizEngine will restart timers when the first socket event arrives for that
// session, or the host uses host:start-quiz / host:next-question).

async function recoverSessionsFromRedis() {
  if (!redisClient) return 0;

  let keys = [];
  try {
    keys = await redisClient.keys("qzsession:*");
  } catch {
    return 0;
  }

  let recovered = 0;

  for (const key of keys) {
    try {
      const raw = await redisClient.get(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const joinCode = parsed.joinCode;

      if (!joinCode || sessionStateByCode.has(joinCode)) continue;

      // Skip sessions that are already in terminal phases
      if (parsed.phase === "final_results" || parsed.phase === "closed") {
        await redisClient.del(key).catch(() => {});
        continue;
      }

      sessionStateByCode.set(joinCode, {
        ...parsed,
        answeredAttemptIds: new Set(parsed.answeredAttemptIds || []),
        answerCounts: new Map(Object.entries(parsed.answerCounts || {})),
        questions: null, // re-fetched from DB by initializeQuizSession on first use
        participantSockets: new Map(),
        questionTimer: null,
        summaryTimer: null,
        loadingTimer: null,
      });

      recovered++;
    } catch {
      // Skip corrupted entries
    }
  }

  if (recovered > 0) {
    console.log(`[Session Store] Recovered ${recovered} session(s) from Redis`);
  }

  return recovered;
}

module.exports = {
  getSessionState,
  setSessionState,
  removeSessionState,
  setRedisClient,
  recoverSessionsFromRedis,
};
