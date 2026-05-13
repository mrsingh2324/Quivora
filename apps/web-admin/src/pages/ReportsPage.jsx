import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  fetchQuizReport,
  fetchQuizzes,
  fetchSessionAiSummary,
  fetchSessionReport,
  getQuizReportCsvUrl,
} from "../services/api";
import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";

function getQuizId(quiz) {
  return quiz._id || quiz.id;
}

function formatTime(seconds) {
  if (!seconds) {
    return "0s";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function ReportsPage() {
  const { sessionId } = useParams();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [report, setReport] = useState(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState("");
  const [statusText, setStatusText] = useState("Select a quiz to view detailed reports.");
  const [aiSummary, setAiSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      return undefined;
    }

    let active = true;

    async function loadQuizzes() {
      try {
        const data = await fetchQuizzes();
        if (!active) {
          return;
        }
        setQuizzes(data);
        setSelectedQuizId(getQuizId(data[0]) || "");
      } catch (error) {
        if (active) {
          setStatusText(error.message);
        }
      }
    }

    loadQuizzes();

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) {
      let active = true;

      async function loadSessionReport() {
        setLoading(true);
        setStatusText("Building session report...");
        try {
          const data = await fetchSessionReport(sessionId);
          if (!active) return;
          setReport(data);
          fetchSessionAiSummary(sessionId)
            .then(setAiSummary)
            .catch(() => setAiSummary(null));
          setExpandedAttemptId("");
          setStatusText(`Session report ready for ${data.quiz.title}.`);
        } catch (error) {
          if (active) {
            setStatusText(error.message);
            setReport(null);
          }
        } finally {
          if (active) setLoading(false);
        }
      }

      loadSessionReport();

      return () => {
        active = false;
      };
    }

    if (!selectedQuizId) {
      return undefined;
    }

    let active = true;

    async function loadReport() {
      setLoading(true);
      setStatusText("Building report...");
      try {
        const data = await fetchQuizReport(selectedQuizId);
        if (!active) {
          return;
        }
        setReport(data);
        setAiSummary(null);
        setExpandedAttemptId("");
        setStatusText(`Report ready for ${data.quiz.title}.`);
      } catch (error) {
        if (active) {
          setStatusText(error.message);
          setReport(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      active = false;
    };
  }, [selectedQuizId, sessionId]);

  const metrics = useMemo(() => {
    if (!report) {
      return [
        { label: "Attempts", value: 0 },
        { label: "Completed", value: 0 },
        { label: "Avg score", value: 0 },
        { label: "Avg time", value: "0s" },
      ];
    }

    return [
      { label: "Attempts", value: report.summary.attempts },
      { label: "Completed", value: report.summary.completed },
      { label: "Avg score", value: report.summary.averageScore },
      { label: "Avg time", value: formatTime(report.summary.averageTimeSeconds) },
    ];
  }, [report]);

  return (
    <>
      <SiteHeader variant="dark" />
      <GlobalSearchBar />
      <main className="site-workspace-page page-stack">
      <section className="workspace-topbar">
        <div>
          <p className="eyebrow">Reports</p>
          <h2>Performance center</h2>
        </div>
        <div className="workspace-actions">
          {!sessionId && (
            <label className="report-selector">
              <span>Quiz</span>
              <select
                onChange={(event) => setSelectedQuizId(event.target.value)}
                value={selectedQuizId}
              >
                {quizzes.map((quiz) => (
                  <option key={getQuizId(quiz)} value={getQuizId(quiz)}>
                    {quiz.title}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!sessionId && selectedQuizId ? (
            <a className="primary-button" href={getQuizReportCsvUrl(selectedQuizId)}>
              Download CSV
            </a>
          ) : null}
        </div>
      </section>

      <section className="stats-strip">
        {metrics.map((item) => (
          <article className="metric-card" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      {aiSummary ? (
        <section className="workspace-panel">
          <p className="eyebrow">AI Report Summary</p>
          <h3>What this session means</h3>
          <p className="support-copy">{aiSummary.summary}</p>
        </section>
      ) : null}

      <section className="dashboard-grid">
        <section className="workspace-panel">
          <div className="table-heading">
            <div>
              <p className="eyebrow">Question Analytics</p>
              <h3>Accuracy and difficulty</h3>
            </div>
            <span className="status-note">
              {loading ? <span className="spinner-label dark"><span className="spinner" /> Loading</span> : statusText}
            </span>
          </div>

          {!report ? (
            <div className="empty-state">No report loaded yet.</div>
          ) : (
            <div className="analytics-stack">
              {report.questionStats.map((question, index) => (
                <article className="accuracy-row" key={question.questionId}>
                  <div>
                    <strong>Q{index + 1}</strong>
                    <p>{question.prompt}</p>
                  </div>
                  <div className="accuracy-meter">
                    <span style={{ width: `${question.accuracy}%` }} />
                  </div>
                  <b>{question.accuracy}%</b>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="workspace-panel">
          <div className="table-heading">
            <div>
              <p className="eyebrow">Hardest Questions</p>
              <h3>Needs attention</h3>
            </div>
          </div>

          {!report || report.hardestQuestions.length === 0 ? (
            <div className="empty-state">No answered questions yet.</div>
          ) : (
            <div className="hardest-list">
              {report.hardestQuestions.map((question, index) => (
                <article className="hardest-card" key={question.questionId}>
                  <span>#{index + 1}</span>
                  <div>
                    <strong>{question.accuracy}% accuracy</strong>
                    <p>{question.prompt}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="workspace-panel">
        <div className="table-heading">
          <div>
            <p className="eyebrow">Submission Management</p>
            <h3>Participant responses</h3>
          </div>
          <Link className="secondary-button compact-button" to="/">
            Back to workspace
          </Link>
        </div>

        {!report || report.participants.length === 0 ? (
          <div className="empty-state">No participant attempts yet.</div>
        ) : (
          <div className="response-table">
            <div className="response-row response-row-head">
              <span>Participant</span>
              <span>Code</span>
              <span>Score</span>
              <span>Status</span>
              <span>Time</span>
              <span>Answers</span>
            </div>
            {report.participants.map((participant) => (
              <div className="response-row-wrap" key={participant.attemptId}>
                <button
                  className="response-row"
                  onClick={() =>
                    setExpandedAttemptId((current) =>
                      current === participant.attemptId ? "" : participant.attemptId
                    )
                  }
                  type="button"
                >
                  <strong>
                    {participant.flagged ? "⚠ " : ""}
                    {participant.participant}
                  </strong>
                  <span>{participant.joinCode || "-"}</span>
                  <span>{participant.score} pts</span>
                  <span>{participant.status}</span>
                  <span>{formatTime(participant.durationSeconds)}</span>
                  <span>{participant.answeredCount}</span>
                </button>

                {expandedAttemptId === participant.attemptId ? (
                  <div className="answer-detail-list">
                    {participant.cheatingSignals?.length ? (
                      <article className="answer-detail incorrect">
                        <div>
                          <strong>Integrity signals</strong>
                          <p>
                            {participant.cheatingSignals.length} warning
                            {participant.cheatingSignals.length === 1 ? "" : "s"} recorded for this attempt.
                          </p>
                        </div>
                        <div>
                          {participant.cheatingSignals.map((signal, index) => (
                            <span key={`${participant.attemptId}-signal-${index}`}>
                              {signal.type.replace(/_/g, " ")}
                              {signal.timestamp ? ` · ${new Date(signal.timestamp).toLocaleString()}` : ""}
                            </span>
                          ))}
                        </div>
                      </article>
                    ) : null}
                    {participant.answers.length === 0 ? (
                      <p className="support-copy">No answers submitted.</p>
                    ) : (
                      participant.answers.map((answer) => (
                        <article
                          className={answer.isCorrect ? "answer-detail correct" : "answer-detail incorrect"}
                          key={`${participant.attemptId}-${answer.questionId}`}
                        >
                          <div>
                            <strong>{answer.isCorrect ? "Correct" : "Incorrect"}</strong>
                            <p>{answer.prompt}</p>
                          </div>
                          <div>
                            <span>Selected: {answer.selectedOption || "No answer"}</span>
                            <span>Correct: {answer.correctOption}</span>
                            <span>Points: {answer.points || 0}</span>
                            {answer.responseTimeMs !== null && answer.responseTimeMs !== undefined ? (
                              <span>Response: {(answer.responseTimeMs / 1000).toFixed(1)}s</span>
                            ) : null}
                            <span>
                              {answer.answeredAt
                                ? new Date(answer.answeredAt).toLocaleString()
                                : "No timestamp"}
                            </span>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
      </main>
    </>
  );
}

export default ReportsPage;
