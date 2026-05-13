import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import {
  fetchQuizById,
  fetchQuizLaunchHistory,
  fetchSessionQr,
  launchQuizAgain,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";

function QuizHistoryPage() {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: admin } = useAuth();
  const [quiz, setQuiz] = useState(location.state?.quiz || null);
  const [history, setHistory] = useState([]);
  const [qrInfo, setQrInfo] = useState(null);
  const [statusText, setStatusText] = useState("Loading launch history...");
  const [loading, setLoading] = useState(false);

  const adminId = admin?._id || admin?.id;

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const [loadedQuiz, loadedHistory] = await Promise.all([
          fetchQuizById(quizId),
          fetchQuizLaunchHistory(quizId),
        ]);

        if (!active) {
          return;
        }

        setQuiz(loadedQuiz);
        setHistory(loadedHistory);
        setStatusText(
          loadedHistory.length
            ? `Showing the latest ${loadedHistory.length} launches.`
            : "No launches yet. Start a fresh live room."
        );
      } catch (error) {
        if (active) {
          setStatusText(error.message);
        }
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, [quizId]);

  async function handleLaunchAgain() {
    if (!adminId) {
      setStatusText("Workspace user is not ready.");
      return;
    }

    setLoading(true);
    setStatusText("Creating a fresh launch code...");

    try {
      const session = await launchQuizAgain(quizId, { hostId: adminId });
      const qr = await fetchSessionQr(session._id || session.id);
      const loadedHistory = await fetchQuizLaunchHistory(quizId);

      setHistory(loadedHistory);
      setQrInfo(qr);
      setStatusText(`New launch ready. Join code ${session.joinCode}`);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader variant="dark" />
      <GlobalSearchBar />
      <main className="site-workspace-page page-stack">
        <section className="workflow-hero history-hero">
          <div>
            <p className="eyebrow">Launch History</p>
            <h2>{quiz?.title || "Quiz history"}</h2>
            <p className="support-copy">
              Review live runs, participant scores, reports, and relaunch with a new code.
            </p>
          </div>
          <div className="compact-actions">
            <button className="secondary-button" onClick={() => navigate("/")} type="button">
              Workspace
            </button>
            <button className="primary-button" disabled={loading} onClick={handleLaunchAgain} type="button">
              {loading ? <span className="spinner-label"><span className="spinner" /> Launching</span> : "Launch Again"}
            </button>
          </div>
        </section>

        <section className="history-layout">
          <aside className="history-tabs" aria-label="Quiz history sections">
            <a href="#saved-history" className="active">
              <strong>Saved history</strong>
              <span>{history.length} launches</span>
            </a>
            <a href="#fresh-launch">
              <strong>Fresh launch</strong>
              <span>{qrInfo ? qrInfo.joinCode : "No code yet"}</span>
            </a>
            <Link to={`/reports${history[0]?.id ? `/${history[0].id}` : ""}`}>
              <strong>Reports</strong>
              <span>Session analytics</span>
            </Link>
          </aside>

          <div className="history-content-stack">
            <section className="workspace-panel history-section-card" id="saved-history">
          <div className="table-heading">
            <div>
              <p className="eyebrow">Previous Runs</p>
              <h3>Saved history</h3>
            </div>
            <span className="status-note">{statusText}</span>
          </div>

          <div className="history-list">
            {history.length === 0 ? (
              <div className="empty-state">No launch history exists for this quiz yet.</div>
            ) : (
              history.map((session) => (
                <article className="history-card" key={session.id}>
                  <div className="history-card-head">
                    <div>
                      <strong>Code {session.joinCode}</strong>
                      <p>
                        {new Date(session.createdAt || session.startedAt || Date.now()).toLocaleString()}
                      </p>
                    </div>
                    <span className={`status-badge status-${session.status}`}>{session.status}</span>
                  </div>

                  <div className="history-metrics">
                    <span>{session.participants.length} participants</span>
                    <span>{session.participants.reduce((best, item) => Math.max(best, item.score), 0)} top score</span>
                    <span>Q{session.currentQuestionIndex + 1}</span>
                  </div>

                  <Link className="secondary-button compact-button" to={`/reports/${session.id}`}>
                    View session report
                  </Link>

                  <div className="participant-score-list">
                    {session.participants.length === 0 ? (
                      <p className="support-copy">No participants joined this launch.</p>
                    ) : (
                      session.participants.map((participant) => (
                        <div className="participant-score-row" key={participant.attemptId}>
                          <span>#{participant.rank}</span>
                          <strong>{participant.name}</strong>
                          <em>{participant.status}</em>
                          <b>{participant.score} pts</b>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
            </section>

            <section className="workspace-panel history-section-card" id="fresh-launch">
          <div className="table-heading">
            <div>
              <p className="eyebrow">Fresh Launch</p>
              <h3>New code</h3>
            </div>
          </div>

          {!qrInfo ? (
            <div className="empty-state">Click Launch Again to create a new code and QR.</div>
          ) : (
            <div className="qr-panel">
              <img alt="Quiz join QR code" className="qr-image" src={qrInfo.qrCodeDataUrl} />
              <p>
                Join code: <strong>{qrInfo.joinCode}</strong>
              </p>
              <a className="ghost-link-dark" href={qrInfo.joinUrl} target="_blank" rel="noreferrer">
                Open player join link
              </a>
              <button className="primary-button" onClick={() => navigate("/active-quizzes")} type="button">
                Open Active Quiz
              </button>
            </div>
          )}
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

export default QuizHistoryPage;
