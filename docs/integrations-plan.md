# Integrations Plan

## Goal

Make exports and notifications operational, visible, and trustworthy with connection state, delivery history, and error handling.

## Google Sheets

1. Add OAuth connection model with encrypted tokens.
2. Add sheet picker and create-sheet flow.
3. Map report columns to sheet columns.
4. Add manual export button and automatic sync after session completion.
5. Store sync runs with status, row count, error message, and retry button.

## Slack And Teams

1. Add workspace connection flow.
2. Store selected channel per quiz or workspace.
3. Support events: quiz launched, participant completed, report ready, low score.
4. Add message preview before enabling.
5. Store delivery logs with provider response.

## LMS

1. Start with CSV export profiles for Classroom/Moodle/Canvas-compatible formats.
2. Add assignment export: title, due date, quiz link, preparation material.
3. Later add OAuth/API connectors for Google Classroom, Moodle, Canvas, Blackboard.

## Webhooks

1. Add webhook endpoints per workspace/quiz.
2. Add event selector: `quiz.launched`, `participant.joined`, `quiz.completed`, `score.below_threshold`, `report.generated`.
3. Sign payloads with a webhook secret.
4. Add retry policy with exponential backoff.
5. Add delivery log UI with payload preview, response status, and replay.

## Acceptance Criteria

- Every integration has Connected, Needs setup, Error, or Disabled state.
- Every outbound event is logged.
- Failed deliveries are visible and retryable.
- No UI claims real Google Sheets/Slack/Teams/LMS sync until the connector is configured.
