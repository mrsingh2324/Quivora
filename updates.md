# Quivora — Founder & PM Review
## Codebase Audit · Competitive Analysis · Codex-Ready Feature Roadmap

---

## Part 1 — What You've Actually Built (Honest Audit)

### Architecture
- **Monorepo** (npm workspaces): `api/` (Express + MongoDB), `apps/web-admin/` (React/Vite), `apps/web-player/` (React/Vite), `services/ai-orchestrator/` (Gemini 2.5)
- **Real-time**: Socket.IO with Redis adapter, wall-clock timers, crash recovery via Redis
- **Auth**: JWT + Google OAuth + GitHub OAuth, Passport.js
- **AI**: Gemini-powered question generation from topic text or uploaded PDF/DOCX

### What Works (Genuinely Production-Capable)
- Full live session lifecycle: create → publish → launch → leaderboard → report
- AI question generation from text + documents
- JWT-secured API and socket events (host authorization enforced)
- Redis-backed session store with horizontal scale support and crash recovery
- Correct-answer stripping from player payloads
- Rate limiting, file magic-byte validation, join code uniqueness (retry loop)
- Assignments module (models + controller)
- Team workspace data models (Workspace, WorkspaceMember, WorkspaceFolder, WorkspaceInvite, QuizApproval, WorkspaceAuditLog)
- Integration models (IntegrationConnection, WebhookEndpoint, IntegrationDeliveryLog)
- Support ticket models (SupportArticle, SupportRequest)
- CSV export, webhook fields, email notification target fields
- GitHub Actions CI/CD + Dockerfiles for API and admin

### What's Scaffolded But Hollow
- `api/src/modules/scoring/` — empty
- `api/src/modules/leaderboard/` — empty
- `api/src/modules/analytics/` — empty
- `api/src/modules/admins/` — empty
- `api/src/modules/quiz-drafts/` — empty
- `services/document-processor/` — empty
- `services/realtime-gateway/` — empty
- `packages/*` — all empty placeholders
- `AIJob` module — scaffolded but never invoked
- Document upload → quiz creation — dead end (returns raw action string, no UI to proceed)
- Player reconnection — not handled
- Global search backend — routes file exists, no controller
- Admin console — routes exist, no controller
- `localhost:3001` hardcoded in dashboard

### Known Remaining Issues (From FLAWS.md, Items 14–32)
Issues 1–13 are fixed. Outstanding: hardcoded localhost URLs, auto-start race on session launch, no loading states, document upload dead end, player reconnection, no request timeouts, Multer storing files in memory, health check not validating DB, 25+ `console.log` calls, sequential Gemini calls (not parallelized), no pagination on quiz list, orphaned Question docs, no tests, unstable model pin (`gemini-2.5-flash`), no DB indexes.

---

## Part 2 — Competitive Landscape

### The Field

| Platform | Core Strength | Core Weakness | Pricing Signal |
|---|---|---|---|
| **Kahoot!** | High-energy live game show | Rigid, speed-over-learning, no async | $4–$10/month/teacher |
| **Quivora / Wayground** | Self-paced + live hybrid, AI import | Rebranding confusion, UI clutter | Custom enterprise |
| **Mentimeter** | Presentation + polls, gorgeous viz | Quizzes are secondary, not a quiz tool | €9–€18/month |
| **Blooket** | Gamified game modes (tower, racing) | Shallow analytics, primarily K-12 | Free + premium |
| **Socrative** | Fast formative assessment | Dated UI, limited AI | Free tier + paid |
| **Nearpod** | Full lesson platform (video, VR, draw) | Complex, overkill for quiz use case | Per seat |
| **AhaSlides** | Slides + quiz hybrid | Not a dedicated quiz builder | Per host |
| **TriviaMaker** | TV-style game show, big screen | Not an assessment tool | Free + tiers |

### The Gaps Nobody Has Nailed
1. **AI that actually edits your quiz** — every platform generates, none let you prompt-edit (`"make question 3 harder"`)
2. **Per-user workspace isolation** — most platforms show a global library, not your quizzes only
3. **Adaptive difficulty mid-quiz** — no mainstream platform does this in live mode
4. **Actionable post-quiz AI** — nobody tells you *why* a question failed or recommends the next quiz
5. **Real RAG workspace assistant** — Quivora has a chatbot, it's decorative
6. **Question quality scoring** — nobody scores generated questions before you publish
7. **Anti-cheat signals** — basic tab-switch detection is absent on most platforms
8. **Certificates on pass** — almost nobody auto-generates them
9. **Webhook + automation layer** — most platforms have no event-driven automation

---

## Part 3 — Codex-Ready Feature Roadmap

> Every item below is a **discrete, shippable unit** with clear file targets, data model changes, and acceptance criteria. Each is written so Codex can execute it independently.

---

### TIER 1 — Fix The Broken Before Adding New
*These make the existing app trustworthy. Ship these first.*

---

#### F-01 · Fix Document Upload → Quiz Creation Flow
**Why**: The document upload path returns a raw JSON string. Users hit a dead end.
**Files to change**:
- `api/src/modules/documents/documentController.js` — after `textExtractionService` returns, call `analyzeTopicText` and create a draft quiz, return `{ quizId }`
- `apps/web-admin/src/pages/BuildPage.jsx` — on upload response, navigate to `/quiz/:quizId/review`
**Acceptance**: Upload a PDF → questions appear in the review editor.

---

#### F-02 · Fix Player Reconnection
**Why**: Network blip or tab sleep breaks the live quiz for participants.
**Files to change**:
- `apps/web-player/src/pages/LiveQuizPage.jsx` — on `connect` socket event (after initial join), re-emit `room:join` with stored `{ joinCode, attemptId }`
- `api/src/modules/live-sessions/socketService.js` — on `room:join`, if session is in progress, emit current question state to that socket only
**Acceptance**: Disconnect player mid-quiz, reconnect — they see the current question without losing score.

---

#### F-03 · Replace Hardcoded localhost URLs
**Files to change**:
- `apps/web-admin/src/pages/DashboardPage.jsx` line 216 — replace `"http://localhost:3001"` with `import.meta.env.VITE_PLAYER_URL`
- Audit all files: `grep -r "localhost:3001" apps/` and `grep -r "localhost:4000" apps/`
**Acceptance**: `VITE_PLAYER_URL=https://play.yourdomain.com` works in staging.

---

#### F-04 · Add Session Launch Loading State
**Files to change**:
- `apps/web-admin/src/pages/DashboardPage.jsx` — `handleLaunchSession`: add `setLaunching(true)` at start, `setLaunching(false)` in finally. Replace 800ms setTimeout with socket confirmation event `session:ready` before proceeding.
**Acceptance**: Launch button shows spinner, no race condition.

---

#### F-05 · Add DB Indexes
**Files to change** (add `index: true` or explicit index declarations):
- `api/src/modules/quiz-publishing/Quiz.js` — `joinCode` (unique), `createdBy`, `status`
- `api/src/modules/answers/Attempt.js` — `session`, `user`, `quiz`
- `api/src/modules/live-sessions/LiveSession.js` — `joinCode`, `status`, `hostUserId`
- `api/src/modules/participants/User.js` — `email`
**Acceptance**: `db.quizzes.getIndexes()` shows compound and single-field indexes.

---

#### F-06 · Health Check Validates DB
**Files to change**:
- `api/src/app.js` — health route: `await mongoose.connection.db.admin().ping()`, return `{ status: "ok", db: "connected" }` or 503 on failure
**Acceptance**: Kill Mongo connection → `/health` returns 503.

---

#### F-07 · Parallelize AI Generation Pipeline
**Files to change**:
- `services/ai-orchestrator/src/services/quizAnalysisService.js` — steps 2 (summarize) and 3 (extract concepts) are independent; wrap in `Promise.all([summarize(text), extractConcepts(text)])`
**Acceptance**: Generation time drops ~40–50% on typical inputs.

---

#### F-08 · Add Pagination to Quiz List
**Files to change**:
- `api/src/modules/quiz-publishing/quizController.js` `listQuizzes` — add `?page=1&limit=20`, use `.skip().limit()`, return `{ quizzes, total, page, pages }`
- `apps/web-admin/src/pages/DashboardPage.jsx` — add pagination controls
**Acceptance**: 100 quizzes in DB → only 20 load per page.

---

#### F-09 · Replace console.log with Structured Logger
**Files to change**: All files in `services/ai-orchestrator/src/` and `api/src/`
- Install `pino` in both services
- Replace all `console.log/error/warn` with `logger.info/error/warn({ ... }, 'message')`
**Acceptance**: `NODE_ENV=production` produces JSON log lines, no raw `console.log` visible.

---

### TIER 2 — Core Differentiating Features
*Build these after Tier 1. These are what separate you from Kahoot and Quivora.*

---

#### F-10 · Per-User Workspace Filtering
**Why**: Currently all quizzes are global. Quivora does the same — it's their most-complained-about UX issue.
**New behavior**: Dashboard shows only quizzes `createdBy: req.user._id`. Admins can toggle a global view.
**Files to change**:
- `api/src/modules/quiz-publishing/quizController.js` `listQuizzes` — add `filter.createdBy = req.user._id` (unless `?scope=workspace` + admin role)
- `apps/web-admin/src/pages/DashboardPage.jsx` — remove any client-side global quiz fetching
**Schema change**: None (Quiz already has `createdBy` field)
**Acceptance**: User A's quizzes never appear in User B's dashboard.

---

#### F-11 · AI Prompt-Based Quiz Editing
**Why**: The single biggest gap in the market. Quivora generates; nobody edits by prompt.
**User flow**: In quiz review editor → type "Make all questions harder" or "Add 3 more questions about recursion" → questions update.
**New API endpoint**: `POST /api/quizzes/:quizId/ai-edit`
  - Body: `{ instruction: string }`
  - Calls AI orchestrator with current questions + instruction
  - Returns updated question array (diff-mergeable)
**Files to create/change**:
- `api/src/modules/quiz-publishing/quizController.js` — add `aiEditQuiz` handler
- `api/src/modules/quiz-publishing/quizRoutes.js` — `POST /:quizId/ai-edit`
- `services/ai-orchestrator/src/services/quizAnalysisService.js` — add `editQuestionsFromInstruction(questions, instruction)` function (send questions as context + instruction to Gemini, parse diff)
- `apps/web-admin/src/pages/QuizReviewPage.jsx` — add AI edit input bar at top, show diff preview before applying
**Acceptance**: "Make question 2 easier" → only question 2 changes, others preserved.

---

#### F-12 · Question Quality Scoring
**Why**: Generated questions vary in quality. Surface signals before publish — this is a genuine moat.
**Score dimensions** (compute with a single Gemini call per batch):
- Clarity (0–10)
- Difficulty label (easy / medium / hard)
- Bloom's taxonomy level (remember / understand / apply / analyze)
- Ambiguity risk (low / medium / high)
- Duplicate risk (compare against existing question-bank embeddings — Phase 2)
**New API endpoint**: `POST /api/questions/quality-score`
  - Body: `{ questions: Question[] }`
  - Returns same array with `qualityMeta: { clarity, difficulty, blooms, ambiguityRisk }` on each
**Files to create/change**:
- `api/src/modules/question-bank/Question.js` — add `qualityMeta` subdocument
- `api/src/modules/question-bank/questionBankRoutes.js` — add `POST /quality-score`
- New file: `api/src/modules/question-bank/questionBankController.js`
- `services/ai-orchestrator/src/services/quizAnalysisService.js` — add `scoreQuestionQuality(questions)` function
- `apps/web-admin/src/pages/QuizReviewPage.jsx` — render quality badges per question
**Acceptance**: Review page shows clarity score and Bloom's level per question. Ambiguous questions highlighted in amber.

---

#### F-13 · Adaptive Difficulty (Live Mode)
**Why**: No mainstream platform does this. High-performing participants get harder questions; struggling ones get easier ones. Learners stay in flow state.
**Mechanism**: Track per-participant rolling accuracy. After question 3, classify participant as `advanced / intermediate / beginner`. For subsequent questions, filter the question pool by difficulty tier matching their classification.
**Files to change**:
- `api/src/modules/live-sessions/quizEngine.js` — add `getAdaptiveQuestion(state, participantId)` that scores recent attempts and selects from matching difficulty bucket
- `api/src/modules/live-sessions/socketService.js` — send personalized question payload per socket instead of broadcast (use `socket.emit` not `room:emit` when adaptive is on)
- `api/src/modules/quiz-publishing/Quiz.js` — add `settings.adaptiveMode: Boolean`
- `apps/web-admin/src/pages/BuildPage.jsx` — add adaptive mode toggle in quiz settings
**Acceptance**: Player answers 3/3 correctly → receives a `hard` question next. Player answers 0/3 → receives `easy`.

---

#### F-14 · Post-Quiz AI Report Summary
**Why**: Quivora shows a bar chart. Nobody tells you *what it means* or what to do next.
**New behavior**: After session ends, generate a natural-language summary: "73% of participants struggled with question 4 — the wording may be ambiguous. Consider revising the option for 'heap allocation'. Strongest topic: array traversal (92% correct). Recommended follow-up quiz: Pointers & Memory."
**New API endpoint**: `GET /api/live-sessions/:sessionId/ai-summary`
  - Aggregates attempt data from DB
  - Calls AI with structured stats → returns 3–5 sentence summary + 1 recommended next topic
**Files to create/change**:
- New file: `api/src/modules/analytics/analyticsController.js`
- `api/src/modules/analytics/analyticsRoutes.js` — add `GET /sessions/:sessionId/ai-summary`
- `services/ai-orchestrator/src/services/quizAnalysisService.js` — add `generateReportSummary(sessionStats)` function
- `apps/web-admin/src/pages/ReportsPage.jsx` — render AI summary card at top of report
**Acceptance**: Report page shows AI summary within 3 seconds of loading.

---

#### F-15 · Anti-Cheat Signals
**Why**: For professional use (HR screening, corporate training, certifications) — a genuine enterprise differentiator.
**Signals to implement**:
1. **Tab-switch detection**: `document.addEventListener('visibilitychange')` — record tab-away events with timestamps
2. **Time anomaly detection**: server-side, flag if answer submitted in under 1 second (faster than human reading)
3. **Duplicate participant detection**: flag if same `attemptId` pattern appears from two different IPs
**New data**: Add `cheatingSignals: [{ type, timestamp, meta }]` array to `Attempt` schema
**Files to change**:
- `api/src/modules/answers/Attempt.js` — add `cheatingSignals` array
- `api/src/modules/answers/attemptService.js` — add time-anomaly check on `submitAttemptAnswer`
- `api/src/modules/live-sessions/socketService.js` — add `participant:tab-away` event handler
- `apps/web-player/src/pages/LiveQuizPage.jsx` — emit `participant:tab-away` on `visibilitychange`
- `apps/web-admin/src/pages/ReportsPage.jsx` — show flag icons on flagged participants
**Acceptance**: Tab away during quiz → report shows warning icon on that participant's row.

---

#### F-16 · Auto-Generated Certificates
**Why**: Drives completion, sharing, virality. Kahoot and Quivora don't do this automatically.
**Flow**: Quiz has `settings.certificate: { enabled, passMark, template }`. On session completion, for any participant who scored ≥ `passMark`, generate a PDF certificate.
**Tech**: Use `pdfkit` on the API side. Certificate includes: participant name, quiz title, score, date, a unique verification UUID.
**New API endpoint**: `GET /api/attempts/:attemptId/certificate` → returns PDF stream
**Files to create/change**:
- New file: `api/src/modules/answers/certificateService.js` — `generateCertificate(attempt, quiz)` using pdfkit
- `api/src/modules/answers/attemptRoutes.js` — add `GET /:attemptId/certificate`
- `api/src/modules/answers/attemptController.js` — add `getCertificate` handler
- `api/src/modules/quiz-publishing/Quiz.js` — add `settings.certificate` subdocument
- `apps/web-admin/src/pages/BuildPage.jsx` — certificate settings section
- `apps/web-player/src/pages/LeaderboardPage.jsx` — "Download Certificate" button if passed
**Acceptance**: Score ≥ pass mark → LeaderboardPage shows download button → clicking returns a filled PDF.

---

#### F-17 · Real-Time Participant Insights (Per-Question Answer Distribution)
**Why**: Quivora shows a bar chart after each question. Make yours better: show live answer distribution *during* the countdown (anonymized), then reveal the correct answer with explanation.
**Current gap**: `question:summary` event is sent post-question but no live distribution during answering.
**Files to change**:
- `api/src/modules/live-sessions/quizEngine.js` — after each `submitQuizAnswer`, emit `question:live-distribution` to host socket only (not participants) with anonymized counts
- `api/src/modules/live-sessions/socketService.js` — add handler for new event
- `apps/web-admin/src/pages/ActiveQuizzesPage.jsx` or host dashboard view — add live bar chart updating in real time
**Acceptance**: Host screen shows bar chart updating live as participants answer, before revealing correct answer.

---

### TIER 3 — Platform Completions
*These fill in the hollow modules and turn scaffolded features real.*

---

#### F-18 · Global Search Backend
**Files to change**:
- `api/src/modules/search/searchRoutes.js` already exists — add controller
- New file: `api/src/modules/search/searchController.js`
  - `GET /api/search?q=` — query across: Quiz (title), Question (text), LiveSession (title, joinCode), User (name, email), SupportArticle (title)
  - Use MongoDB text indexes on each collection
  - Return `{ type, id, label, description, route }` per result
- `api/src/modules/quiz-publishing/Quiz.js` — add `{ text: true }` index on `title`
- `apps/web-admin/src/components/GlobalSearchBar.jsx` — wire to real API, render typed results
**Acceptance**: Search "python" returns quizzes with "python" in title.

---

#### F-19 · Quiz Drafts Module
**Why**: Currently quizzes jump straight to published state. Creators need a save-and-come-back-later flow.
**Files to create/change**:
- `api/src/modules/quiz-drafts/` — create `QuizDraft.js` model (mirrors Quiz schema + `isDraft: true`), `quizDraftController.js`, `quizDraftRoutes.js`
- `POST /api/quiz-drafts` — save draft
- `PUT /api/quiz-drafts/:id` — update draft  
- `POST /api/quiz-drafts/:id/publish` — promote draft to published Quiz
- `apps/web-admin/src/pages/BuildPage.jsx` — auto-save to draft every 30 seconds, show "Saved" indicator
**Acceptance**: Close browser mid-creation → reopen → draft is there.

---

#### F-20 · Scoring Module (Real Implementation)
**Files to change**:
- `api/src/modules/scoring/` — create `scoringService.js`
- Implement: base points per correct answer, speed bonus (points × time_remaining / time_limit), streak bonus (+10% per consecutive correct)
- `api/src/modules/answers/attemptService.js` → call `scoringService.calculateScore(answer, timeRemaining, timeLimitSeconds, streakCount)`
- `api/src/modules/live-sessions/quizEngine.js` — pass `timeLimitSeconds` and `questionStartedAt` to scoring
**Acceptance**: Fast correct answer scores more than slow correct answer. 3-question streak shows bonus indicator.

---

#### F-21 · Team Workspace — Member Invite Flow
**Why**: All the models exist (`Workspace`, `WorkspaceMember`, `WorkspaceInvite`). Wire them up.
**Files to create/change**:
- New file: `api/src/modules/team-workspaces/teamWorkspaceController.js`
  - `POST /workspaces` — create workspace
  - `POST /workspaces/:id/invite` — send invite (store in WorkspaceInvite, console.log email for now)
  - `POST /workspaces/accept-invite/:token` — accept invite, create WorkspaceMember
  - `GET /workspaces/:id/members` — list members
  - `PATCH /workspaces/:id/members/:userId/role` — change role
- `api/src/modules/team-workspaces/teamWorkspaceRoutes.js` — wire all routes (file exists, is empty)
- `apps/web-admin/src/pages/TeamWorkspacePage.jsx` — render real data from API
**Acceptance**: Invite link → recipient accepts → appears in member list with correct role.

---

#### F-22 · Admin Console (Real Stats)
**Files to create/change**:
- New file: `api/src/modules/admin-console/adminConsoleController.js`
  - `GET /api/admin/stats` — return: `{ quizCount, sessionCount, attemptCount, userCount, documentCount, supportRequestCount, recentSessions: [...last 5] }`
- `api/src/modules/admin-console/adminConsoleRoutes.js` — wire route (middleware: require admin role)
- `apps/web-admin/src/pages/DashboardPage.jsx` — replace hardcoded stats with real API call
**Acceptance**: Dashboard metrics match database counts.

---

#### F-23 · Webhook Delivery (Real HTTP POST)
**Why**: Models and UI fields exist. Actual delivery is never triggered.
**Files to change**:
- `api/src/services/integrationService.js` — implement `deliverWebhook(endpoint, event, payload)`:
  - Sign payload with `crypto.createHmac('sha256', endpoint.secret).update(JSON.stringify(payload)).digest('hex')`
  - POST to `endpoint.url` with `X-Quiz-Signature` header
  - Write result to `IntegrationDeliveryLog`
  - Retry up to 3× with exponential backoff on 5xx
- `api/src/modules/live-sessions/quizEngine.js` `finalizeQuiz` — call `deliverWebhook` for `quiz.completed` event
- `api/src/modules/live-sessions/socketService.js` — call `deliverWebhook` for `participant.joined`
**Acceptance**: Configure webhook URL → launch quiz → endpoint receives signed POST.

---

### TIER 4 — Premium Differentiators
*Build after Tier 2–3 are solid. These are the moat.*

---

#### F-24 · RAG Workspace Assistant
**Why**: Quivora's assistant is cosmetic. A real one that can answer "why did my last quiz perform poorly?" is a retention multiplier.
**Architecture**:
1. On quiz save/session end, extract searchable text chunks → store in a `WorkspaceEmbedding` collection with `{ source, sourceId, text, embedding }` (use Gemini `text-embedding-004`)
2. On assistant query: embed the query → cosine similarity search → retrieve top-K chunks → pass as context to Gemini
**Files to create/change**:
- New model: `api/src/modules/workspace-assistant/WorkspaceEmbedding.js`
- New service: `api/src/modules/workspace-assistant/embeddingService.js` — chunk + embed + upsert
- `api/src/modules/workspace-assistant/workspaceAssistantController.js` — already exists; replace placeholder with real RAG pipeline
- Trigger embedding generation in: quiz publish, session finalize, document upload
- `apps/web-admin/src/` — workspace assistant chat panel (connects to existing route)
**Acceptance**: "Which topic did participants struggle with most last week?" returns a data-grounded answer.

---

#### F-25 · Question Bank with Performance Tracking
**Why**: Reusable questions with accuracy history across sessions are a massive time-saver for repeat quiz creators.
**Files to change**:
- `api/src/modules/question-bank/Question.js` — add `usageCount`, `avgCorrectRate`, `sessions: [ObjectId]` fields
- New file: `api/src/modules/question-bank/questionBankController.js`
  - `GET /api/question-bank?topic=&difficulty=&minAccuracy=` — filtered browse
  - `POST /api/question-bank/add-to-quiz` — copy question into quiz draft
- On session finalize: update `avgCorrectRate` for each question used
- `apps/web-admin/src/pages/QuestionBankPage.jsx` — wire to real API
**Acceptance**: Use a question in 5 sessions → question bank shows `avgCorrectRate: 62%`.

---

#### F-26 · Self-Paced / Async Quiz Mode
**Why**: Kahoot is always live. Quivora does both. You need both. Async mode is critical for homework, onboarding, and certification prep.
**New setting**: `Quiz.settings.mode: 'live' | 'async'`
**Async behavior**: Participant visits link at their own pace, no host required. Timer runs per-question (or no timer). Score computed on completion.
**Files to change**:
- `api/src/modules/quiz-publishing/quizController.js` — add `startAsyncAttempt` and `submitAsyncAnswer` handlers
- `api/src/modules/quiz-publishing/quizRoutes.js` — `POST /:quizId/async-start`, `POST /:quizId/async-submit`
- `api/src/modules/quiz-publishing/Quiz.js` — add `settings.mode`
- `apps/web-player/src/pages/LiveQuizPage.jsx` — detect async mode, remove socket dependency, use REST polling
- `apps/web-admin/src/pages/BuildPage.jsx` — mode selector (Live / Self-Paced)
**Acceptance**: Share quiz link → participant completes without host being online → score recorded in reports.

---

#### F-27 · Randomized Question + Option Order (Anti-Cheat)
**Why**: Sitting next to someone and copying becomes impossible when question order and option labels differ.
**Files to change**:
- `api/src/modules/quiz-publishing/Quiz.js` — add `settings.randomizeQuestions: Boolean`, `settings.randomizeOptions: Boolean`
- `api/src/modules/live-sessions/quizEngine.js` — if `randomizeQuestions`, shuffle question array at session creation (store shuffled order in session state). If `randomizeOptions`, shuffle options per-participant per-question and map `correctOptionIndex` accordingly
- `apps/web-admin/src/pages/BuildPage.jsx` — checkboxes for both settings
**Acceptance**: Two participants on same quiz see questions in different order. Correct option is still scored correctly.

---

#### F-28 · Availability Window + Participant Limit Enforcement
**Why**: These fields exist on the Quiz schema but are never enforced server-side.
**Files to change**:
- `api/src/modules/quiz-publishing/quizController.js` `joinQuiz` handler:
  - Check `quiz.settings.availableFrom` / `availableUntil` — return 403 if outside window
  - Check `quiz.settings.participantLimit` against current `LiveSession.participantCount` — return 403 if full
- `apps/web-player/src/pages/JoinPage.jsx` — show "Quiz not yet available" / "Quiz is full" error states
**Acceptance**: Set limit of 10 → 11th person gets "Quiz is full" message.

---