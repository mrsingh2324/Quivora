# Quivora

Quivora is a live quiz platform for creating, reviewing, publishing, launching, and analyzing MCQ quizzes. It includes a creator/admin workspace, a participant player app, a Node.js API, real-time live quiz sessions, and a Gemini-based AI service for generating quiz questions from topics or documents.

## Features

- Admin workspace with dashboard, recent quizzes, templates, sessions, reports, and launch history.
- Quiz creation from topic text, uploaded documents, or predefined templates.
- Gemini-based AI question generation through a separate AI orchestrator service.
- Review workflow: Generate, Review, Customize, Preview as Player, Publish, Launch.
- Live quiz player with join code/link support, lobby, timer, answer submission, and leaderboard.
- Launch history with participant records and “launch again” support.
- Theme customization: color presets, fonts, cover image URL, logo text, and player style.
- Sharing controls: public/private quizzes, password protection, availability window, participant limit, custom slug, reusable link, and embed code.
- Admin reports: participant answers, timestamps, scores, correctness, question-wise accuracy, hardest questions, average score, time taken, and CSV export.
- Initial integrations: Google Sheets compatible CSV export, Google Drive import URL field, webhooks, and email notification target.

## Tech Stack

- Frontend: React, Vite, React Router, Socket.IO client
- Backend: Node.js, Express, MongoDB, Mongoose, Socket.IO
- AI Service: Node.js, Express, Google Gemini API
- Monorepo: npm workspaces

## Project Structure

```text
.
├── api/                         # Express API, MongoDB models, quiz/session/report logic
├── apps/
│   ├── web-admin/               # Creator/admin React app
│   └── web-player/              # Participant React app
├── services/
│   └── ai-orchestrator/         # Gemini-based AI quiz generation service
├── packages/                    # Reserved shared package folders
├── docs/                        # Documentation placeholders
├── STRUCTURE.md                 # Target architecture notes
├── JotForm.md                   # Product gap and roadmap notes
└── run_app.sh                   # Local multi-service startup script
```

## Prerequisites

- Node.js 18 or newer
- npm
- MongoDB connection string
- Google Gemini API key

## Environment Setup

Create local env files from the examples:

```bash
cp api/.env.example api/.env
cp services/ai-orchestrator/.env.example services/ai-orchestrator/.env
```

Required API env vars:

```env
PORT=4000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority
CLIENT_URL=http://localhost:3000,http://localhost:3001
PLAYER_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:4100/api/ai/analyze
```

Required AI service env vars:

```env
PORT=4100
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Optional frontend env vars:

```env
VITE_API_URL=http://localhost:4000
VITE_SOCKET_URL=http://localhost:4000
VITE_PLAYER_URL=http://localhost:3001
```

Do not commit real `.env` files or API keys.

## Install

```bash
npm install
```

## Run Locally

The easiest way to run all services:

```bash
./run_app.sh
```

Local URLs:

- Admin app: http://localhost:3000
- Player app: http://localhost:3001
- API: http://localhost:4000
- AI service: http://localhost:4100

You can also run services individually:

```bash
npm run dev:api
npm run dev:ai
npm run dev:admin
npm run dev:player
```

## Build

```bash
npm run build:admin
npm run build:player
```

## Main Workflows

1. Open the admin app.
2. Create or select a quiz from the workspace.
3. Generate questions from a topic, upload a document, or choose a template.
4. Review and edit generated questions.
5. Customize timing, theme, sharing controls, and integrations.
6. Preview the player experience.
7. Publish the quiz.
8. Launch a live session and share the join code/link/QR with participants.
9. Review leaderboard, launch history, attempts, answers, and reports.

## API Overview

Core API areas:

- `/api/quizzes` - quiz creation, publishing, settings, joining, questions, leaderboard
- `/api/live-sessions` - live session creation, launch history, QR code, report, CSV export
- `/api/attempts` - attempt lookup, answer submission, completion
- `/api/documents` - document upload and text extraction
- `/api/users` - demo/admin/participant user helpers

## Production Readiness Notes

Before deploying publicly, review and harden:

- Authentication and authorization for admin routes.
- Password hashing for quiz access passwords.
- Rate limiting and request validation.
- Secure webhook delivery, retries, and signed payloads.
- Real email provider integration instead of console-queued notifications.
- Google OAuth-based Drive/Sheets integrations if full import/export automation is needed.
- Centralized logging and monitoring.
- Test coverage for API controllers, socket events, and frontend flows.
- Deployment config for separate admin/player frontend origins.

## Git Hygiene

The repository ignores generated and sensitive files:

- `node_modules/`
- `dist/`, `build/`
- real `.env` files
- local caches
- logs and coverage
- local zip/tar archives
- `.claude/worktrees/`

Commit lockfiles and `.env.example` files, but never commit real secrets.
