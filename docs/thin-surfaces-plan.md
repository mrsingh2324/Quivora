# Thin Surfaces Completion Plan

## AI Quiz Assistant

- Add retrieval over quizzes, questions, attempts, reports, uploaded documents, assignments, and support docs.
- Store compact searchable text for each source.
- Return citations/source cards with each answer.
- Use Gemini for generation and editing, not placeholder question builders.
- Add guardrails: never publish directly, always create or edit drafts for admin review.

## Global Search

- Add backend search endpoint.
- Search quizzes, questions, reports/sessions, participants, uploaded docs, assignments, support docs, and templates.
- Return typed results with route, label, description, and match reason.
- Keep static product/help entries only as fallback content.

## Templates

- Ensure every available template has real question sets.
- Move upcoming templates after available templates.
- Add preview before creating a quiz.
- Track template source, topic, difficulty, and usage count.

## Question Bank

- Add a dedicated route for reusable questions.
- Filter by topic, difficulty, source type, usage count, and performance.
- Let admins add selected questions to a quiz draft.
- Show question quality signals: duplicate risk, ambiguity, and accuracy trend.

## Help And Support

- Replace generic cards with detailed operational guides.
- Connect “Contact Support” to the real support request page.
- Add troubleshooting docs for login, AI generation, document upload, player join, live sessions, reports, and CSV export.

## Acceptance Criteria

- No visible “dummy” copy.
- Search results come from database-backed content where possible.
- AI assistant answers use retrieved workspace context.
- Available templates create usable quizzes without placeholder questions.
