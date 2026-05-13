# Team Workspace Plan

## Goal

Let multiple admins collaborate inside one workspace without mixing ownership, permissions, approvals, or reports.

## Data Model

- `Workspace`: name, owner, status, settings.
- `WorkspaceMember`: workspace, user, role, invite status.
- `WorkspaceFolder`: shared folders for quizzes/questions/assignments.
- `WorkspaceInvite`: email, role, token, expiry, acceptedAt.
- `WorkspaceAuditLog`: actor, action, target type/id, metadata.
- `QuizApproval`: quiz, reviewer, status, comments, decidedAt.

## Roles

- `owner`: billing-free ownership, workspace settings, members, delete/archive.
- `admin`: manage quizzes, sessions, assignments, reports, members except owner.
- `editor`: create/edit drafts and question bank items.
- `viewer`: read quizzes, reports, and assignments without edits.

## Build Order

1. Add workspace and member models.
2. Attach every quiz, assignment, document, support request, and report query to a workspace.
3. Add invite creation/acceptance.
4. Add role checks in API middleware.
5. Add shared workspace switcher in the sidebar.
6. Add team folders for quizzes and question bank.
7. Add approval workflow: draft -> review -> approved -> published.
8. Add audit log feed in Admin Console.

## Acceptance Criteria

- A user can belong to more than one workspace.
- A viewer cannot create, edit, publish, or launch.
- An editor cannot publish without approval when approvals are enabled.
- Reports and support requests are filtered by selected workspace.
- Audit log records member invites, quiz edits, launches, exports, and approval decisions.
