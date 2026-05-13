import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { createLiveSession, endLiveSession, fetchLiveSessions, startLiveSession } from "../services/api";
import { getAdminSocket } from "../services/socket";
import { useAuth } from "../context/AuthContext";

function statusLabel(status) {
  if (status === "question_live") return "Running";
  if (status === "answers_loading") return "Loading answers";
  if (status === "answer_summary") return "Showing answers";
  return "Waiting for players";
}

function getOptionPercent(summary, optionIndex) {
  const total = summary?.totalParticipants || summary?.participantCount || 0;
  const count = summary?.counts?.find((item) => item.optionIndex === optionIndex)?.count || 0;
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function canCloseWaitingSession(session, now) {
  if (session.status !== "waiting_for_players") return false;
  const createdAt = Date.parse(session.createdAt || session.startedAt || "");
  if (Number.isNaN(createdAt)) return false;
  return now - createdAt >= 2 * 60 * 1000;
}

function ActiveQuizzesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const launchedFromStateRef = useRef("");
  const [sessions, setSessions] = useState([]);
  const [statusText, setStatusText] = useState("Loading active quizzes...");
  const [startingId, setStartingId] = useState("");
  const [closingId, setClosingId] = useState("");
  const [now, setNow] = useState(Date.now());

  async function loadSessions() {
    try {
      const data = await fetchLiveSessions();
      setSessions(data);
      setStatusText(
        data.length
          ? "Share a QR code or join link, watch players arrive, then start the quiz."
          : "No live quizzes are active right now."
      );
    } catch (error) {
      setStatusText(error.message);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    const quiz = location.state?.quiz;
    const quizId = quiz?.id || quiz?._id;

    if (!quizId || launchedFromStateRef.current === quizId) {
      return;
    }

    launchedFromStateRef.current = quizId;
    setStatusText(`Creating live room for ${quiz.title || "quiz"}...`);

    createLiveSession({ quizId })
      .then((session) => {
        getAdminSocket().emit(
          "room:join",
          { joinCode: session.joinCode, role: "host", name: user?.name || "Host" },
          () => {}
        );
        setStatusText(`Live room ready. Share code ${session.joinCode}, then start when players join.`);
        return loadSessions();
      })
      .catch((error) => {
        launchedFromStateRef.current = "";
        setStatusText(error.message);
      })
      .finally(() => {
        navigate("/active-quizzes", { replace: true, state: null });
      });
  }, [location.state, navigate, user?.name]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (sessions.length === 0) return undefined;

    const socket = getAdminSocket();

    sessions.forEach((session) => {
      socket.emit(
        "room:join",
        { joinCode: session.joinCode, role: "host", name: "Host" },
        (response) => {
          if (!response.ok) return;

          const snapshot = response.data || {};
          setSessions((current) =>
            current.map((item) =>
              item.joinCode === session.joinCode
                ? {
                    ...item,
                    status: snapshot.phase || item.status,
                    activeQuestion: snapshot.activeQuestion || item.activeQuestion,
                    answerSummary: snapshot.answerSummary || item.answerSummary,
                    answersLoading: snapshot.phase === "answers_loading",
                    answeredCount: snapshot.answeredCount || item.answeredCount || 0,
                    participantCount: snapshot.participantsConnected ?? item.participantCount,
                  }
                : item
            )
          );
        }
      );
    });

    function handleParticipantJoined(payload) {
      if (!payload?.joinCode) return;

      setSessions((current) =>
        current.map((session) =>
          session.joinCode === payload.joinCode
            ? {
                ...session,
                participantCount: payload.participants?.length || session.participantCount,
                liveParticipants: payload.participants || [],
              }
            : session
        )
      );
    }

    function handlePresence(payload) {
      if (!payload?.joinCode) return;

      setSessions((current) =>
        current.map((session) =>
          session.joinCode === payload.joinCode
            ? {
                ...session,
                participantCount: payload.participantsConnected ?? session.participantCount,
                status: payload.phase || session.status,
              }
            : session
        )
      );
    }

    function updateSessionByJoinCode(payload, updater) {
      if (!payload?.joinCode) return;

      setSessions((current) =>
        current.map((session) =>
          session.joinCode === payload.joinCode ? updater(session, payload) : session
        )
      );
    }

    function handleQuestionBroadcast(payload) {
      updateSessionByJoinCode(payload, (session) => ({
        ...session,
        status: "question_live",
        activeQuestion: payload.question,
        answerSummary: null,
        liveDistribution: null,
        answersLoading: false,
        answeredCount: payload.answeredCount || 0,
        participantCount: payload.participantCount ?? session.participantCount,
      }));
    }

    function handleAnswersProgress(payload) {
      updateSessionByJoinCode(payload, (session) => ({
        ...session,
        answeredCount: payload.answeredCount || 0,
        participantCount: payload.participantCount ?? session.participantCount,
      }));
    }

    function handleLiveDistribution(payload) {
      updateSessionByJoinCode(payload, (session) => ({
        ...session,
        liveDistribution: payload,
        answeredCount: payload.answeredCount || 0,
        participantCount: payload.participantCount ?? session.participantCount,
      }));
    }

    function handleAnswersLoading(payload) {
      updateSessionByJoinCode(payload, (session) => ({
        ...session,
        status: "answers_loading",
        answersLoading: true,
        answeredCount: payload.answeredCount || session.answeredCount || 0,
        participantCount: payload.participantCount ?? session.participantCount,
      }));
    }

    function handleQuestionSummary(payload) {
      updateSessionByJoinCode(payload, (session) => ({
        ...session,
        status: "answer_summary",
        answersLoading: false,
        answerSummary: payload,
      }));
    }

    function handleQuizFinished(payload) {
      if (!payload?.joinCode) return;

      setSessions((current) =>
        current.filter((session) => session.joinCode !== payload.joinCode)
      );
      setStatusText("Quiz finished. No active room remains for that launch.");
    }

    socket.on("room:participant-joined", handleParticipantJoined);
    socket.on("room:presence", handlePresence);
    socket.on("question:broadcast", handleQuestionBroadcast);
    socket.on("answers:progress", handleAnswersProgress);
    socket.on("question:live-distribution", handleLiveDistribution);
    socket.on("answers:loading", handleAnswersLoading);
    socket.on("question:summary", handleQuestionSummary);
    socket.on("quiz:finished", handleQuizFinished);

    return () => {
      socket.off("room:participant-joined", handleParticipantJoined);
      socket.off("room:presence", handlePresence);
      socket.off("question:broadcast", handleQuestionBroadcast);
      socket.off("answers:progress", handleAnswersProgress);
      socket.off("question:live-distribution", handleLiveDistribution);
      socket.off("answers:loading", handleAnswersLoading);
      socket.off("question:summary", handleQuestionSummary);
      socket.off("quiz:finished", handleQuizFinished);
    };
  }, [sessions.map((session) => session.joinCode).join("|")]);

  async function handleStart(session) {
    setStartingId(session.id);
    setStatusText(`Starting ${session.quiz?.title || "quiz"}...`);

    getAdminSocket().emit(
      "host:start-quiz",
      { joinCode: session.joinCode },
      async (response) => {
        if (!response.ok) {
          try {
            await startLiveSession(session.id);
          } catch (error) {
            setStatusText(error.message || response.message || "Unable to start quiz.");
            setStartingId("");
            return;
          }
        }

        setSessions((current) =>
          current.map((item) =>
            item.id === session.id ? { ...item, status: "question_live" } : item
          )
        );
        setStatusText(`${session.quiz?.title || "Quiz"} is running.`);
        setStartingId("");
      }
    );
  }

  async function handleClose(session) {
    setClosingId(session.id);
    setStatusText(`Closing ${session.quiz?.title || "quiz"}...`);

    try {
      await endLiveSession(session.id);
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setStatusText(`${session.quiz?.title || "Quiz"} has been closed.`);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setClosingId("");
    }
  }

  return (
    <div className="active-quizzes-page">
      <section className="workspace-topbar active-quizzes-topbar">
        <div>
          <p className="eyebrow">Live rooms</p>
          <h2>Active quizzes</h2>
        </div>
        <div className="active-quizzes-actions">
          <span className="status-note">{statusText}</span>
          <Link className="secondary-button" to="/">Back to workspace</Link>
        </div>
      </section>

      {sessions.length === 0 ? (
        <section className="workspace-canvas">
          <div className="workspace-empty">
            <div className="empty-illustration" aria-hidden="true">
              <span className="empty-card card-one" />
              <span className="empty-card card-two" />
              <span className="empty-person" />
              <span className="empty-bubble left" />
              <span className="empty-bubble right" />
            </div>
            <h1>No active quizzes yet.</h1>
            <p>Launch a quiz from your workspace to generate a QR code and waiting room.</p>
            <Link to="/">Go to workspace</Link>
          </div>
        </section>
      ) : (
        <section className="active-quizzes-list">
          {sessions.map((session) => {
            const participants = session.liveParticipants || session.participants || [];
            const isRunning =
              session.status === "question_live" ||
              session.status === "answers_loading" ||
              session.status === "answer_summary";
            const activeQuestion = session.activeQuestion;
            const answerSummary = session.answerSummary;
            const liveDistribution = session.liveDistribution;
            const answeredCount = session.answeredCount || 0;
            const participantCount = participants.length || session.participantCount || 0;
            const canClose = canCloseWaitingSession(session, now);

            return (
              <article className="active-quiz-card" key={session.id}>
                {activeQuestion && (
                  <div className="host-live-panel host-live-panel-top">
                    <div className="host-live-heading">
                      <div>
                        <p className="eyebrow">Question {activeQuestion.index + 1} of {activeQuestion.totalQuestions}</p>
                        <h4>{activeQuestion.prompt}</h4>
                      </div>
                      <strong>{answeredCount}/{participantCount} answered</strong>
                    </div>

                    {session.answersLoading ? (
                      <div className="answers-loading-panel">
                        <span className="loading-dot" />
                        <p>Loading answers...</p>
                      </div>
                    ) : (
                      <div className="host-option-list">
                        {(activeQuestion.options || []).map((option, optionIndex) => {
                          const distribution = answerSummary || liveDistribution;
                          const percent = getOptionPercent(distribution, optionIndex);
                          const isCorrect = answerSummary?.correctOptionIndex === optionIndex;

                          return (
                            <div
                              className={isCorrect ? "host-option-row correct" : "host-option-row"}
                              key={`${activeQuestion.id}-${option}`}
                            >
                              <span>{String.fromCharCode(65 + optionIndex)}</span>
                              <p>{option}</p>
                              {distribution ? <strong>{percent}%</strong> : <strong>--</strong>}
                              {distribution && <i style={{ width: `${percent}%` }} />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="active-quiz-main">
                  <span className={isRunning ? "live-status running" : "live-status"}>
                    {statusLabel(session.status)}
                  </span>
                  <h3>{session.quiz?.title || "Untitled quiz"}</h3>
                  <p>
                    {session.quiz?.totalQuestions || 0} questions
                    {!isRunning && (
                      <>
                        {" "}· Code <strong>{session.joinCode}</strong>
                      </>
                    )}
                  </p>
                  {!isRunning && (
                    <div className="active-join-box">
                      <div>
                        <span>Player website</span>
                        <a href={session.joinUrl} target="_blank" rel="noreferrer">
                          {session.joinUrl}
                        </a>
                      </div>
                      <div>
                        <span>Join code</span>
                        <strong>{session.joinCode}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="active-quiz-side">
                  {!isRunning && (
                    <img alt={`${session.joinCode} QR code`} className="active-qr-image" src={session.qrCodeDataUrl} />
                  )}
                  <div className="joined-panel">
                    <div>
                      <p className="eyebrow">Joined users</p>
                      <strong>{participants.length || session.participantCount || 0}</strong>
                    </div>
                    {participants.length === 0 ? (
                      <p className="support-copy">Waiting for players to join.</p>
                    ) : (
                      <div className="joined-list">
                        {participants.map((participant, index) => (
                          <span key={participant.attemptId || `${session.id}-${participant}-${index}`}>
                            {typeof participant === "string" ? participant : participant.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="primary-button active-start-button"
                  disabled={isRunning || startingId === session.id}
                  onClick={() => handleStart(session)}
                  type="button"
                >
                  {isRunning ? "Quiz Running" : startingId === session.id ? "Starting..." : "Start Quiz"}
                </button>
                {canClose ? (
                  <button
                    className="secondary-button active-close-button"
                    disabled={closingId === session.id}
                    onClick={() => handleClose(session)}
                    type="button"
                  >
                    {closingId === session.id ? "Closing..." : "Close waiting quiz"}
                  </button>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default ActiveQuizzesPage;
