# Production-Readiness Flaws

> **Status:** Flaws 1–13 resolved. See commit history for implementation details.

## Critical — Security

**1. Zero authentication or authorization** ✅ FIXED
_JWT auth with email/password, Google OAuth, GitHub OAuth. Dev one-click login. Protected routes._
Every API endpoint and Socket.io event is open to the public. There are no JWTs, sessions, or API keys. Any anonymous user can create quizzes, launch sessions, or read all answers.

**2. Socket events have no host authorization** ✅ FIXED
_JWT extracted from socket handshake auth. host:start-quiz and host:next-question verify userId matches session hostUserId._
`host:start-quiz` and `host:next-question` (`api/src/modules/live-sessions/socketService.js:46-74`) check only that a `joinCode` is provided — not that the caller is the host. Any participant can start or skip questions by emitting these events.

**3. Correct answers exposed in quiz list** ✅ FIXED
_normalizeQuestion strips correctOptionIndex/explanation. Only question:summary event (post-question) sends the correct answer with green highlight._
`listQuizzes` (`api/src/modules/quiz-publishing/quizController.js:205-215`) fully populates all `Question` documents, including `correctOptionIndex` and `explanation`. Anyone can fetch all answers before a quiz starts.

**4. CORS allows `*` by default** ✅ INTENTIONAL (dev phase)
_Kept as-is per product decision. Tighten CLIENT_URL in .env when deploying._
`api/src/app.js:14-22` falls back to `"*"` when `CLIENT_URL` is not set, opening the API to any origin.

**5. No rate limiting** ✅ FIXED
_express-rate-limit applied: global 300/15min, AI endpoints 20/hr, auth endpoints 10/15min. All skipped in NODE_ENV!=production so dev is unaffected._
AI generation endpoints have no throttle. A single user can hammer the Gemini API, running up unbounded costs.

**6. File upload validates extension only, not content** ✅ FIXED
_validateFileBytes checks magic bytes: %PDF for PDF, PK\x03\x04 for DOCX/ZIP. Runs before text extraction._
A malicious file named `payload.pdf` passes the Multer check. The actual file bytes are never verified.

---

## Critical — Data Integrity

**7. New admin created on every page load** ✅ FIXED
_Admin dashboard now behind JWT auth wall. DashboardPage uses useAuth() to get the authenticated user; createAdmin call removed entirely. Dev user (dev@quivora.local) preserved via devSeed._
`apps/web-admin/src/pages/DashboardPage.jsx:38-43` calls `createAdmin` with `creator-${Date.now()}@example.com` on mount. Every browser refresh creates a new orphaned admin row and the previous admin's quizzes become inaccessible.

**8. New participant user created on every join** ✅ FIXED
_joinQuiz accepts optional attemptId for rejoin. If valid attempt found for this quiz, returns existing user/attempt without creating new ones. Frontend stores attemptId in sessionStorage (4-hr TTL) and sends it back on rejoin._
`api/src/modules/quiz-publishing/quizController.js:301-306` always calls `User.create`. Refreshing the join page creates a duplicate user and a duplicate attempt, polluting the leaderboard.

**9. Race condition in join-code generation** ✅ FIXED
_createQuizDocument() wraps Quiz.create in a retry loop (max 10). On E11000 duplicate-key error for joinCode, it retries with a new code. No TOCTOU window._
`api/src/modules/quiz-publishing/quizController.js:15-25` uses a `findOne → generate → findOne` loop with no atomic guarantee. Two simultaneous quiz creations can receive the same join code.

**10. Answer deduplication gap in quiz engine** ✅ FIXED
_submitQuizAnswer checks state.answeredAttemptIds before incrementing answerCounts. Double-submit still calls submitAttemptAnswer (idempotent) but skips the count increment._
`api/src/modules/live-sessions/quizEngine.js:314-316` increments `answerCounts` without checking whether this attempt already voted. A client that submits twice will skew the answer distribution bar chart.

---

## Critical — Architecture

**11. In-memory session store is not horizontally scalable** ✅ FIXED
_socketSessionStore rewritten as Redis write-through: local Map is primary (sync reads), Redis is async secondary (fire-and-forget). Socket.io uses @socket.io/redis-adapter so all workers share the same room. REDIS_URL env var activates both; absent = single-process in-memory mode unchanged._
`api/src/modules/live-sessions/socketSessionStore.js` is a plain `Map`. Any multi-process or multi-instance deployment (PM2 cluster, Kubernetes) breaks all live sessions — each worker has a separate map.

**12. Server restart loses all live sessions** ✅ FIXED
_recoverSessionsFromRedis() called at boot: scans qzsession:* keys, restores non-terminal sessions into the local Map (timers not restored — quizEngine restarts them on next host event). LiveSession.questionStartedAt persisted to DB so wall-clock timer is correct after recovery._
Timer state, participant sets, and current question index live only in RAM. A restart mid-quiz silently loses everything with no recovery path.

**13. Timer drift under load** ✅ FIXED
_Timer now uses wall-clock: remaining = Math.max(0, timeLimitSeconds - Math.floor((Date.now() - questionStartedAt) / 1000)). setInterval jitter no longer accumulates._
`api/src/modules/live-sessions/quizEngine.js:118-130` uses `setInterval(1000)` with no drift correction. Under CPU load the countdown diverges from wall time, causing players to see different remaining seconds than what the server tracks.

---

## High — Frontend

**14. `localhost:3001` hardcoded in production code**
`apps/web-admin/src/pages/DashboardPage.jsx:216`: `const playerUrl = "http://localhost:3001/live?code=..."`. This only works on the developer's machine.

**15. Quiz auto-starts on an 800 ms `setTimeout`**
`apps/web-admin/src/pages/DashboardPage.jsx:201-203` fires `startQuizForSession` 800ms after session creation, before the socket handshake is confirmed complete. On a slow connection the host emits `start-quiz` before joining the room and the event is silently dropped.

**16. No loading state during session launch**
`handleLaunchSession` is async but never calls `setLoading(true)`, so the UI gives no feedback while the session is being created.

**17. Document upload has no follow-through**
The upload flow returns `aiResult.action` but never creates a quiz. The admin just sees a raw action string with no button to proceed. It is a dead end.

**18. Player reconnection is unhandled**
If the player's browser disconnects and reconnects (network blip, tab sleep), `apps/web-player/src/pages/LiveQuizPage.jsx` does not re-emit `room:join`, so the server never re-adds the socket to the room and the player receives no further events.

---

## High — Reliability & Operations

**19. No request timeout middleware**
Long-running AI calls (5 sequential Gemini requests) can hold an HTTP connection open indefinitely. There is no server-side timeout to reclaim the connection.

**20. Uploaded files stored in memory (no `dest` on Multer)**
All PDF/DOCX bytes live in `req.file.buffer` until the request finishes. A 10 MB file (the configured max) held by concurrent uploads can exhaust Node's heap.

**21. `/health` endpoint doesn't check the database**
`api/src/app.js:32-34` returns `{status: "ok"}` unconditionally. A load balancer or container orchestrator using this endpoint will route traffic to a pod that has lost its MongoDB connection.

**22. No environment variable validation at startup**
Missing `GEMINI_API_KEY`, `MONGODB_URI`, etc. produce cryptic runtime failures deep in request handling rather than a clear error at boot.

---

## Medium — Code Quality & Maintainability

**23. Pervasive `console.log` in production paths**
`services/ai-orchestrator/src/services/quizAnalysisService.js` alone has 15+ `console.log` calls with raw data. There is no structured logging, no log levels, and no way to silence debug output in production.

**24. AI pipeline is 5 sequential Gemini calls**
Steps 2 (summarize) and 3 (extract concepts) are independent of each other and could be parallelised with `Promise.all`, cutting latency roughly in half.

**25. No pagination on `listQuizzes`**
`api/src/modules/quiz-publishing/quizController.js:205-215` loads every quiz and all its populated questions in a single unbounded query. This will time out or OOM on any real data set.

**26. Orphaned `Question` documents**
There is no cascade delete. Deleting or replacing a quiz leaves its `Question` documents in the collection forever.

**27. `AIJob` schema exists but is never used end-to-end**
The `AIJob` module (`api/src/modules/ai-processing/aiJobController.js`) is scaffolded but never called during quiz generation, so there is no audit trail of AI operations.

---

## Low — Missing Production Essentials

**28. No tests**
No unit, integration, or end-to-end tests anywhere in the monorepo.

**29. No CI/CD pipeline**
No GitHub Actions or equivalent workflow file.

**30. No error monitoring**
No Sentry, Datadog, or similar for capturing and alerting on runtime exceptions.

**31. No database indexes**
No indexes declared on `joinCode`, `quiz`, `user`, or other frequently queried fields beyond Mongoose's default `_id`, guaranteeing full collection scans at scale.

**32. `gemini-2.5-flash` is a preview/unstable model**
Production should pin to a GA model version or handle model deprecation gracefully.
