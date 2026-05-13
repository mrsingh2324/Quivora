import { useEffect, useMemo, useState } from "react";

import { createLiveSession, fetchQuizzes, fetchSessionQr, startLiveSession } from "../services/api";
import { getAdminSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

function SessionsPage() {
  const { user: admin } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [qrInfo, setQrInfo] = useState(null);
  const [statusText, setStatusText] = useState("Choose a published quiz to prepare a live room.");

  const adminId = admin?._id || admin?.id;

  useEffect(() => {
    async function loadQuizzes() {
      try {
        setQuizzes(await fetchQuizzes());
      } catch (error) {
        setStatusText(error.message);
      }
    }

    loadQuizzes();
  }, []);

  useEffect(() => {
    if (!activeSession?.joinCode) {
      return undefined;
    }

    const socket = getAdminSocket();
    const joinCode = activeSession.joinCode;

    function handlePresence(payload) {
      if (payload?.joinCode === joinCode) {
        setParticipantCount(payload.participantsConnected || 0);
      }
    }

    function handleParticipantJoined(payload) {
      setParticipantCount((payload?.participants || []).length);
    }

    socket.on("room:presence", handlePresence);
    socket.on("room:participant-joined", handleParticipantJoined);

    return () => {
      socket.off("room:presence", handlePresence);
      socket.off("room:participant-joined", handleParticipantJoined);
    };
  }, [activeSession?.joinCode]);

  const publishedQuizzes = useMemo(
    () => quizzes.filter((quiz) => quiz.status === "published"),
    [quizzes]
  );

  async function handleLaunchSession(quiz) {
    if (!adminId) {
      setStatusText("Workspace user is not ready.");
      return;
    }

    setStatusText(`Preparing live room for ${quiz.title}...`);

    try {
      const session = await createLiveSession({
        quizId: quiz._id || quiz.id,
        hostId: adminId,
      });
      const qr = await fetchSessionQr(session._id || session.id);

      getAdminSocket().emit(
        "room:join",
        {
          joinCode: session.joinCode,
          role: "host",
          name: admin?.name || "Host",
        },
        (response) => {
          if (response?.ok) {
            setParticipantCount(response.data?.participantsConnected || 0);
          }
        }
      );

      setActiveSession(session);
      setParticipantCount(session.participantCount || 0);
      setQrInfo(qr);
      setStatusText(`Live room ready. Join code ${session.joinCode}`);
    } catch (error) {
      setStatusText(error.message);
    }
  }

  function handleStartQuiz() {
    if (!activeSession?.joinCode) {
      setStatusText("Launch a live room first.");
      return;
    }

    setStatusText("Starting live quiz...");

    getAdminSocket().emit(
      "host:start-quiz",
      { joinCode: activeSession.joinCode },
      async (response) => {
        if (response.ok) {
          setActiveSession((current) =>
            current ? { ...current, status: "question_live" } : current
          );
          setStatusText("Live quiz started.");
        } else {
          try {
            await startLiveSession(activeSession._id || activeSession.id);
            setActiveSession((current) =>
              current ? { ...current, status: "question_live" } : current
            );
            setStatusText("Live quiz started.");
          } catch (error) {
            setStatusText(error.message || response.message || "Unable to start.");
          }
        }
      }
    );
  }

  return (
    <div className="page-stack">
      <section className="workspace-topbar">
        <div>
          <p className="eyebrow">Live Sessions</p>
          <h2>Launch center</h2>
        </div>
        <span className="status-note">{statusText}</span>
      </section>

      <section className="dashboard-grid">
        <section className="workspace-panel">
          <div className="table-heading">
            <div>
              <p className="eyebrow">Published Quizzes</p>
              <h3>Ready to launch</h3>
            </div>
          </div>
          <div className="quiz-list">
            {publishedQuizzes.length === 0 ? (
              <div className="empty-state">No published quizzes yet.</div>
            ) : (
              publishedQuizzes.map((quiz) => (
                <article className="quiz-item" key={quiz._id || quiz.id}>
                  <div>
                    <h4>{quiz.title}</h4>
                    <p>
                      Code: <strong>{quiz.joinCode}</strong> - {quiz.totalQuestions} questions
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => handleLaunchSession(quiz)}
                    type="button"
                  >
                    Launch
                  </button>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="workspace-panel">
          <div className="table-heading">
            <div>
              <p className="eyebrow">Host Controls</p>
              <h3>QR and start</h3>
            </div>
          </div>
          {!activeSession || !qrInfo ? (
            <div className="empty-state">Launch a session to generate its QR code.</div>
          ) : (
            <div className="qr-panel">
              <img alt="Quiz join QR code" className="qr-image" src={qrInfo.qrCodeDataUrl} />
              <p>
                Join code: <strong>{qrInfo.joinCode}</strong>
              </p>
              <a className="ghost-link-dark" href={qrInfo.joinUrl} target="_blank" rel="noreferrer">
                Open player join link
              </a>
              <button className="primary-button" onClick={handleStartQuiz} type="button">
                Start Live Quiz
              </button>
              <p className="support-copy">
                Participants joined: <strong>{participantCount}</strong>
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

export default SessionsPage;
