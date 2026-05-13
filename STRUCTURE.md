# MERN Workspace Structure

## Root

- `apps/web-admin` React app for quiz creators and admins
- `apps/web-player` React app for participants joining by code or QR
- `api` Express + MongoDB backend for core business logic
- `services/ai-orchestrator` Gemini-Based AI pipeline service
- `services/document-processor` reserved for file parsing and extraction
- `services/realtime-gateway` reserved for live quiz sockets and timers
- `packages/*` shared utilities, types, config, and reusable UI assets
- `docs/*` product, API, architecture, and setup documentation

## Backend

- `api/src/config` environment and database setup
- `api/src/modules/auth` admin authentication and session logic
- `api/src/modules/documents` uploaded document metadata and parsing lifecycle
- `api/src/modules/ai-processing` AI job status and review workflow
- `api/src/modules/question-bank` canonical question storage
- `api/src/modules/quiz-drafts` editable drafts before publishing
- `api/src/modules/quiz-publishing` join code generation and published quiz APIs
- `api/src/modules/live-sessions` live room state and active quiz session data
- `api/src/modules/participants` admin/participant identity records
- `api/src/modules/answers` answer attempts and submissions
- `api/src/modules/scoring` score computation
- `api/src/modules/leaderboard` rank snapshots and summaries
- `api/src/modules/analytics` reporting and metrics
- `api/src/routes`, `api/src/middleware`, `api/src/jobs`, and `api/src/integrations` support shared backend concerns

## Frontend

- `apps/web-admin/src` contains upload, topic entry, AI review, quiz editor, launch, and reporting flows
- `apps/web-player/src` contains join, lobby, timed question play, answer summary, and final leaderboard flows
- Both frontend apps use the same React-oriented internal folders: `app`, `pages`, `features`, `components`, `services`, `context`, `hooks`, `layouts`, `styles`, `utils`, and `assets`

## AI and Realtime

- `services/ai-orchestrator` analyzes text, parses MCQs, and generates quizzes
- `services/document-processor` will later handle PDF/DOC parsing and OCR
- `services/realtime-gateway` will later manage sockets, timers, and live sessions
