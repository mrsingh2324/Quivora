import { Link, useParams } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";

const supportPages = {
  "contact-support": {
    title: "Contact Support",
    eyebrow: "Get Help",
    description: "Reach the Quivora support team for account, workspace, live-session, and reporting issues.",
    bullets: [
      ["Submit a support request", "Open Profile > Support Requests, choose a category, and include the quiz title, join code, browser, and exact error text."],
      ["Share useful context", "For live-session issues, include the launch time and whether players were in the lobby, answering, or viewing results."],
      ["Track the response", "Requests move through Open, In review, Resolved, and Closed so the workspace has a visible support history."],
    ],
  },
  "support-requests": {
    title: "My Support Requests",
    eyebrow: "Get Help",
    description: "Review open and resolved support conversations for your workspace.",
    bullets: [
      ["Open requests", "Every request created from the account page is stored with category, status, priority, and requester details."],
      ["Resolution history", "Resolved and closed requests stay visible so repeated quiz/report issues can be compared later."],
      ["Status tracking", "Admins can update request status directly from the support request list."],
    ],
  },
  "help-center": {
    title: "Help Center",
    eyebrow: "Get Help",
    description: "Browse practical guides for creating, launching, and analyzing quizzes.",
    bullets: [
      ["Workspace setup", "Sign in, create your first quiz from a topic, upload material, or start from a ready template."],
      ["Quiz publishing", "Review each MCQ, confirm the correct answer, tune timing/theme/sharing, then publish when the quiz is ready."],
      ["Live rooms and reports", "Launch a room, share the join code before starting, block late joins after start, then review the session report."],
    ],
  },
  faq: {
    title: "FAQ",
    eyebrow: "Get Help",
    description: "Quick answers to common questions about accounts, quiz creation, and participant access.",
    bullets: [
      ["Account access", "Email accounts can update profile details and passwords. OAuth accounts use their provider for password management."],
      ["Sharing controls", "Published quizzes can be launched into fresh sessions so repeated launches do not mix results."],
      ["Participant troubleshooting", "Players should join before the host starts. After start, late joins are blocked with a clear message."],
    ],
  },
  "user-guide": {
    title: "User Guide",
    eyebrow: "Learn",
    description: "A step-by-step guide to using Quivora from first quiz to final report.",
    bullets: [
      ["Create quizzes", "Use Build Quiz for Gemini topic generation, document upload, or templates. Drafts remain editable before launch."],
      ["Host sessions", "Open Active quizzes after launch, wait for participants, then start the room from the host controls."],
      ["Export results", "Reports show participant scores, accuracy by question, hardest questions, and CSV download for spreadsheet analysis."],
    ],
  },
  books: {
    title: "Quivora Books",
    eyebrow: "Learn",
    description: "Curated learning material for educators, trainers, and teams building better assessments.",
    bullets: [
      ["Assessment design", "Write one clear learning objective per quiz and keep answer choices mutually exclusive."],
      ["Live engagement", "Share the code first, confirm players appear in the lobby, then start when everyone is ready."],
      ["Analytics workflows", "Use hardest-question data to improve ambiguous questions before relaunching the same quiz."],
    ],
  },
  blog: {
    title: "Blog",
    eyebrow: "Learn",
    description: "Product updates, teaching ideas, and workflow notes from the Quivora team.",
    bullets: [
      ["Release notes", "Track changes to quiz creation, assignments, reports, and integrations."],
      ["Best practices", "Use shorter quizzes for live rooms and longer assignments for self-paced preparation."],
      ["Customer stories", "Document how teams use quizzes for training, course readiness, hiring, and classroom checks."],
    ],
  },
  videos: {
    title: "Videos",
    eyebrow: "Learn",
    description: "Watch walkthroughs for quiz generation, live sessions, reports, and integrations.",
    bullets: [
      ["Feature demos", "Record the create, review, launch, join, answer, leaderboard, and report workflow end to end."],
      ["Admin tutorials", "Show how to publish a quiz, launch a fresh session, and export results."],
      ["Participant flows", "Show joining with a code, waiting in the lobby, answering questions, and viewing final rank."],
    ],
  },
  academy: {
    title: "Quivora Academy",
    eyebrow: "Learn",
    description: "Structured lessons to help teams get productive with the platform.",
    bullets: [
      ["Beginner tracks", "Create a five-question quiz and run it with two test participants."],
      ["Advanced hosting", "Test reconnects, late joins, and two launches of the same quiz back to back."],
      ["Reporting mastery", "Compare session reports and use CSV exports for offline analysis."],
    ],
  },
  "customer-stories": {
    title: "Customer Stories",
    eyebrow: "Learn",
    description: "See how teams use Quivora to run live knowledge checks and training sessions.",
    bullets: [
      ["Team training", "Use assignments for prep material and live sessions for knowledge checks."],
      ["Classroom engagement", "Run short live quizzes and review question-level accuracy immediately after class."],
      ["Hiring assessments", "Create interview-style MCQs and export participant reports for review panels."],
    ],
  },
  podcasts: {
    title: "Podcasts",
    eyebrow: "Learn",
    description: "Conversations about learning design, assessment, and interactive tools.",
    bullets: [
      ["Expert interviews", "Discuss assessment design, fairness, and feedback loops."],
      ["Product conversations", "Cover quiz generation, live hosting, assignments, and integrations."],
      ["Community episodes", "Share workflows from trainers, teachers, recruiters, and course teams."],
    ],
  },
  "professional-services": {
    title: "Professional Services",
    eyebrow: "Support",
    description: "Get implementation help for larger teams, custom workflows, and reporting rollouts.",
    bullets: [
      ["Workspace setup", "Use the support request flow for implementation help until team workspaces are enabled."],
      ["Custom training", "Document required workflows, roles, content types, and reporting needs."],
      ["Launch support", "Run a rehearsal session and verify player join, answer submission, and report export."],
    ],
  },
  "report-abuse": {
    title: "Report Abuse",
    eyebrow: "Support",
    description: "Report harmful content, misuse, or suspicious activity on Quivora.",
    bullets: [
      ["Content review", "Include the quiz title, join code, screenshots, and why the content is harmful or abusive."],
      ["Account safety", "Report suspicious access, impersonation, or unwanted participant behavior."],
      ["Policy enforcement", "Requests are reviewed and tracked through the support request workflow."],
    ],
  },
  "copyright-issue": {
    title: "Report Copyright Issue",
    eyebrow: "Support",
    description: "Submit copyright concerns for quiz content, images, or uploaded documents.",
    bullets: [
      ["Ownership details", "Include your name, organization, and relationship to the copyrighted material."],
      ["Content URL", "Share the quiz URL, join code, document title, or screenshot that identifies the content."],
      ["Review process", "The workspace owner receives a tracked request while the content is reviewed."],
    ],
  },
  "recover-account": {
    title: "Recover Quivora Account",
    eyebrow: "Support",
    description: "Recover access to a workspace when login, email, or OAuth access is unavailable.",
    bullets: [
      ["Verify ownership", "Use the same email or OAuth provider originally used for the workspace."],
      ["Reset credentials", "Email accounts can update passwords from Profile after sign-in."],
      ["Restore workspace access", "Create a support request with workspace name, owner email, and recent quiz titles."],
    ],
  },
};

function StaticSupportPage() {
  const { slug = "help-center" } = useParams();
  const page = supportPages[slug] || supportPages["help-center"];

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search help, quizzes, templates, products..." />
      <main className="static-page-shell">
        <section className="static-hero">
          <Link className="static-back-link" to="/">← Back to workspace</Link>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p>{page.description}</p>
        </section>

        <section className="static-content-grid">
          {page.bullets.map(([title, detail], index) => (
            <article key={title} className="static-info-card">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h2>{title}</h2>
              <p>{detail}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

export { supportPages };
export default StaticSupportPage;
