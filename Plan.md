Implementation Plan

Phase 1: Remove Misleading Surfaces

Comment/hide Pricing sections from header, dashboard, footer, and support links.
Comment/hide Enterprise sections from header/dashboard/footer.
Remove Plan/Billing references from profile menus, account pages, product copy, and help text.
Remove Quiz Views from profile/account navigation.
Keep Coming Soon products, but move them after working/ready surfaces.
Phase 2: Complete Account Surfaces

Profile
Show real logged-in user data.
Add editable name/profile fields.
Add password/account basics if compatible with existing auth.
Support Requests
Add DB model for support tickets.
Add create/list/detail/status flow.
Add categories: bug, billing removed/replaced with account, quiz issue, report issue, live session issue.
Admin Console
Show real workspace stats: quizzes, sessions, attempts, uploads, support requests.
Add admin-only controls where available.
Add activity/readiness sections based on actual data.
Phase 3: Fix Broken/Stale Routes

Replace stale /create links with /build.
Replace stale /sessions links with /active-quizes or proper launch route.
Fix missing /quizzes/:quizId/review route or point actions to the current review flow.
Remove or quarantine unused WorkspacePage.jsx and .bak files if not needed.
Verify every visible nav/header/footer/profile/search result link works.
Phase 4: Assignments

Add DB models:
Assignment
AssignmentEnrollment or AssignmentSelection
optional AssignmentMaterial
Admin can create assignments from quizzes/materials.
Normal logged-in users can browse/select assignments as preparation material.
Player/learner flow should show:
assigned quiz/material
progress
status
recommended prep
Connect assignments to reports later.
Phase 5: Team Workspace Plan For Later

Define workspace/team data model.
Add members/invites.
Add roles: owner, admin, editor, viewer.
Add shared folders/question bank.
Add approvals: draft → review → approved → published.
Add audit logs.
Phase 6: Integrations Plan For Later

Google Sheets
OAuth connection.
Sheet picker/create sheet.
Manual export and auto-sync.
Sync history/errors.
Slack/Teams
Workspace connection.
Channel selection.
Events: quiz launched, participant completed, report ready, low score.
LMS
Start with export/import structure.
Later add Google Classroom, Moodle, Canvas.
Webhooks
Event builder.
Signing secret.
Retry policy.
Delivery logs.
Phase 7: Make Semi-Thin Surfaces Real

AI Quiz Assistant
Make it RAG-based over quizzes, questions, attempts, reports, uploaded docs, help docs.
Add retrieval/indexing layer.
Replace placeholder question generation with real AI generation where expected.
Global Search
Search real quizzes, questions, reports, participants, docs, assignments, support docs.
Add backend search endpoint.
Templates
Remove generic placeholder questions where possible.
Add real template question sets.
Push upcoming templates after working templates.
Question Bank
Add dedicated surface for reusable questions.
Filter by topic, difficulty, source, usage, performance.
Support/Help Pages
Replace static pages with complete detailed help content.
Add guides for creation, live sessions, reports, assignments, troubleshooting, integrations.
Phase 8: Make Current Integrations Feel Real

Keep CSV export but label it accurately.
For Drive URL, either implement import or clearly make it a saved reference field.
Replace fake email queue with real provider integration or visible “not connected” setup state.
Add integration status panels and event logs.
Phase 9: Verification

Test admin path: login → create quiz → publish → launch → report.
Test learner path: login as normal user → select assignment → prepare/take quiz.
Test player path: join code → answer → leaderboard.
Test all nav/menu/search links.
Check empty states, error states, and mobile player flow.