import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import { fetchAssignments, fetchQuizzes, fetchTeamWorkspaces } from "../services/api";

const pageCopy = {
  shared: {
    eyebrow: "Shared Workspace",
    title: "Shared with me",
    empty: "No shared team workspaces are available yet.",
  },
  attempted: {
    eyebrow: "Attempts",
    title: "Previously attempted",
    empty: "No learner attempts are attached to this account yet.",
  },
  sent: {
    eyebrow: "Sent",
    title: "Sent quizzes and assignments",
    empty: "No sent quiz workflows exist yet.",
  },
};

function WorkspaceCollectionPage() {
  const { collection = "shared" } = useParams();
  const copy = pageCopy[collection] || pageCopy.shared;
  const [statusText, setStatusText] = useState("Loading workspace view...");
  const [teams, setTeams] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        if (collection === "shared") {
          const data = await fetchTeamWorkspaces();
          if (!active) return;
          setTeams(data);
          setStatusText(data.length ? `${data.length} shared workspace${data.length === 1 ? "" : "s"} available.` : copy.empty);
          return;
        }

        if (collection === "attempted") {
          const data = await fetchAssignments();
          if (!active) return;
          setAssignments(data.filter((assignment) => assignment.selection));
          setStatusText(copy.empty);
          return;
        }

        const [quizData, assignmentData] = await Promise.all([
          fetchQuizzes({ limit: 100 }),
          fetchAssignments(),
        ]);
        if (!active) return;
        setQuizzes(quizData.filter((quiz) => !quiz.isDefaultLibrary));
        setAssignments(assignmentData);
        setStatusText("Review quizzes you created and assignments you published.");
      } catch (error) {
        if (active) setStatusText(error.message);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [collection, copy.empty]);

  const selectedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.selection),
    [assignments]
  );

  function renderShared() {
    if (!teams.length) {
      return (
        <div className="empty-state">
          <p>{copy.empty}</p>
          <Link className="primary-button" to="/team-workspace?create=1">Create team</Link>
        </div>
      );
    }

    return (
      <div className="workspace-quiz-grid">
        {teams.map((team) => (
          <article className="workspace-quiz-card" key={team.id}>
            <span>{team.role}</span>
            <h3>{team.name}</h3>
            <p>{team.approvalsEnabled ? "Approvals enabled" : "Approvals disabled"}</p>
            <Link className="workspace-card-action" to="/team-workspace">Open workspace</Link>
          </article>
        ))}
      </div>
    );
  }

  function renderAttempted() {
    if (!selectedAssignments.length) {
      return (
        <div className="empty-state">
          <p>{copy.empty}</p>
          <Link className="primary-button" to="/assignments">Browse assignments</Link>
        </div>
      );
    }

    return (
      <div className="workspace-quiz-grid">
        {selectedAssignments.map((assignment) => (
          <article className="workspace-quiz-card" key={assignment.id}>
            <span>{assignment.selection.status}</span>
            <h3>{assignment.title}</h3>
            <p>{assignment.selection.progressPercent || 0}% complete</p>
            <Link className="workspace-card-action" to="/assignments">Open prep</Link>
          </article>
        ))}
      </div>
    );
  }

  function renderSent() {
    const hasContent = quizzes.length || assignments.length;

    if (!hasContent) {
      return (
        <div className="empty-state">
          <p>{copy.empty}</p>
          <Link className="primary-button" to="/build">Create quiz</Link>
        </div>
      );
    }

    return (
      <div className="workspace-quiz-grid">
        {quizzes.map((quiz) => (
          <article className="workspace-quiz-card" key={quiz.id}>
            <span>{quiz.status}</span>
            <h3>{quiz.title}</h3>
            <p>{quiz.totalQuestions} questions</p>
            <Link className="workspace-card-action" to={`/quizzes/${quiz.id}/history`}>Open history</Link>
          </article>
        ))}
        {assignments.map((assignment) => (
          <article className="workspace-quiz-card" key={assignment.id}>
            <span>Assignment</span>
            <h3>{assignment.title}</h3>
            <p>{assignment.selectionsCount || 0} selected</p>
            <Link className="workspace-card-action" to="/assignments">Open assignment</Link>
          </article>
        ))}
      </div>
    );
  }

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search workspace collections..." />
      <main className="static-page-shell">
        <section className="static-hero">
          <Link className="static-back-link" to="/">Back to workspace</Link>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{statusText}</p>
        </section>

        <section className="workspace-panel">
          {collection === "shared" ? renderShared() : null}
          {collection === "attempted" ? renderAttempted() : null}
          {collection === "sent" ? renderSent() : null}
        </section>
      </main>
    </>
  );
}

export default WorkspaceCollectionPage;
