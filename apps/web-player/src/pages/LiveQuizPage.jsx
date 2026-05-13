import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";
import {
  fetchAsyncAttemptState,
  loadLatestParticipantSession,
  loadParticipantSession,
  submitAsyncAnswer,
} from "../services/api";
import { getSocket } from "../services/socket";

const OPTION_LETTERS = ["A", "B", "C", "D"];

// SVG circle math for the timer ring
const RING_R = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function timerStroke(remaining, total) {
  if (!total || total <= 0) return RING_CIRCUMFERENCE;
  const fraction = Math.max(0, Math.min(1, remaining / total));
  return RING_CIRCUMFERENCE * (1 - fraction);
}

function timerColor(remaining, total) {
  if (!total) return "#a78bfa";
  const pct = remaining / total;
  if (pct > 0.5) return "#43d68a";
  if (pct > 0.2) return "#ffc857";
  return "#ff4b57";
}

function LiveQuizPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    attemptId,
    asyncMode,
    joinCode,
    phase,
    playerName,
    setAttemptId,
    setAsyncMode,
    setJoinCode,
    question,
    quizId,
    remainingSeconds,
    setLastSummary,
    setLeaderboard,
    setPhase,
    setPlayerName,
    setQuestion,
    setQuizId,
    setRemainingSeconds,
  } = useQuiz();

  const [selectedOption, setSelectedOption] = useState(null);
  const [summaryData, setSummaryData] = useState(null); // { counts, correctOptionIndex, durationSeconds }
  const [summaryCountdown, setSummaryCountdown] = useState(0);
  const summaryTimerRef = useRef(null);

  // Total seconds for the current question (used to drive the ring fill)
  const totalSecondsRef = useRef(remainingSeconds);
  useEffect(() => {
    if (phase === "question_live") {
      totalSecondsRef.current = remainingSeconds;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const queryCode = searchParams.get("code")?.toUpperCase();
    const savedSession =
      (queryCode ? loadParticipantSession(queryCode) : null) ||
      (joinCode && attemptId ? { joinCode, attemptId, playerName } : null) ||
      loadLatestParticipantSession();

    if (!savedSession?.joinCode || !savedSession?.attemptId) {
      navigate("/", { replace: true });
      return undefined;
    }

    const activeJoinCode = savedSession.joinCode.toUpperCase();
    const activeAttemptId = savedSession.attemptId;
    const activeName = savedSession.playerName || playerName || "Player";

    if (joinCode !== activeJoinCode) setJoinCode(activeJoinCode);
    if (attemptId !== activeAttemptId) setAttemptId(activeAttemptId);
    if (savedSession.quizId && quizId !== savedSession.quizId) setQuizId(savedSession.quizId);
    if (savedSession.asyncMode) {
      setAsyncMode(true);
      setPhase("async_question");
      if (savedSession.quizId && activeAttemptId) {
        fetchAsyncAttemptState(savedSession.quizId, activeAttemptId)
          .then((state) => {
            if (state.complete) {
              setLeaderboard([{ rank: 1, attemptId: activeAttemptId, participant: activeName, score: state.score, status: "completed" }]);
              navigate("/leaderboard", { replace: true });
              return;
            }
            setQuestion(state.question);
          })
          .catch(() => navigate("/", { replace: true }));
      }
      return undefined;
    }
    if (!playerName && activeName) setPlayerName(activeName);

    const socket = getSocket();
    let cancelled = false;

    function rejoinRoom() {
      if (cancelled) return;
      socket.emit(
        "room:join",
        {
          joinCode: activeJoinCode,
          role: "participant",
          attemptId: activeAttemptId,
          name: activeName,
        },
        (response) => {
          if (!response?.ok || cancelled) return;
          const snapshot = response.data || {};
          setRemainingSeconds(snapshot.remainingSeconds || 30);
          setPhase(snapshot.phase || "waiting_for_players");
          if (snapshot.activeQuestion) setQuestion(snapshot.activeQuestion);
        }
      );
    }

    rejoinRoom();
    socket.on("connect", rejoinRoom);

    return () => {
      cancelled = true;
      socket.off("connect", rejoinRoom);
    };
  }, [
    attemptId,
    joinCode,
    navigate,
    playerName,
    quizId,
    searchParams,
    setAttemptId,
    setAsyncMode,
    setJoinCode,
    setPhase,
    setPlayerName,
    setQuestion,
    setQuizId,
    setRemainingSeconds,
  ]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (
        document.visibilityState !== "hidden" ||
        !joinCode ||
        !attemptId ||
        phase !== "question_live"
      ) {
        return;
      }

      getSocket().emit("participant:tab-away", {
        joinCode,
        attemptId,
        reason: "tab_hidden",
        timestamp: new Date().toISOString(),
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [attemptId, joinCode, phase]);

  useEffect(() => {
    const socket = getSocket();

    function handleQuestionBroadcast(payload) {
      setPhase(payload.phase);
      setQuestion(payload.question);
      setRemainingSeconds(payload.remainingSeconds);
      totalSecondsRef.current = payload.remainingSeconds;
      setSelectedOption(null);
      setSummaryData(null);
      setSummaryCountdown(0);
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
    }

    function handleTimerTick(payload) {
      setRemainingSeconds(payload.remainingSeconds);
    }

    function handleTimerSync(payload) {
      setPhase(payload.phase);
      setRemainingSeconds(payload.remainingSeconds);
      if (payload.phase === "question_live") {
        totalSecondsRef.current = payload.remainingSeconds;
      }
    }

    function handleSummary(payload) {
      setPhase("answer_summary");
      setLastSummary(payload);
      setSummaryData(payload);

      const dur = payload.durationSeconds || 5;
      setSummaryCountdown(dur);

      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
      summaryTimerRef.current = setInterval(() => {
        setSummaryCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(summaryTimerRef.current);
            summaryTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    function handleAnswersLoading(payload) {
      setPhase("answers_loading");
      setRemainingSeconds(payload.durationSeconds || 2);
      setSummaryData(null);
      setSummaryCountdown(0);
      if (summaryTimerRef.current) {
        clearInterval(summaryTimerRef.current);
        summaryTimerRef.current = null;
      }
    }

    function handleLeaderboard(payload) {
      setLeaderboard(payload);
    }

    function handleFinished(payload) {
      if (payload.leaderboard) setLeaderboard(payload.leaderboard);
      navigate("/leaderboard");
    }

    socket.on("question:broadcast", handleQuestionBroadcast);
    socket.on("timer:tick", handleTimerTick);
    socket.on("timer:sync", handleTimerSync);
    socket.on("answers:loading", handleAnswersLoading);
    socket.on("question:summary", handleSummary);
    socket.on("leaderboard:update", handleLeaderboard);
    socket.on("quiz:finished", handleFinished);

    return () => {
      socket.off("question:broadcast", handleQuestionBroadcast);
      socket.off("timer:tick", handleTimerTick);
      socket.off("timer:sync", handleTimerSync);
      socket.off("answers:loading", handleAnswersLoading);
      socket.off("question:summary", handleSummary);
      socket.off("leaderboard:update", handleLeaderboard);
      socket.off("quiz:finished", handleFinished);
      if (summaryTimerRef.current) clearInterval(summaryTimerRef.current);
    };
  }, [navigate, setLastSummary, setLeaderboard, setPhase, setQuestion, setRemainingSeconds]);

  async function handleSelectOption(optionIndex) {
    if (!joinCode || !attemptId || !question?.id) return;
    if (selectedOption !== null || !["question_live", "async_question"].includes(phase)) return;

    setSelectedOption(optionIndex);

    if (asyncMode) {
      try {
        const result = await submitAsyncAnswer(quizId, {
          attemptId,
          questionId: question.id,
          selectedOptionIndex: optionIndex,
        });
        if (result.complete) {
          setLeaderboard([{ rank: 1, attemptId, participant: playerName || "You", score: result.score, status: "completed" }]);
          navigate("/leaderboard");
          return;
        }
        setQuestion(result.question);
        setSelectedOption(null);
        setPhase("async_question");
      } catch {
        setSelectedOption(null);
      }
      return;
    }

    getSocket().emit(
      "player:submit-answer",
      { joinCode, attemptId, questionId: question.id, selectedOptionIndex: optionIndex },
      (response) => {
        if (!response.ok) {
          // Roll back selection on error
          setSelectedOption(null);
        }
      }
    );
  }

  if (phase === "waiting_for_players") {
    return (
      <main className="player-shell">
        <div className="cosmos-card animate-pop">
          <div className="waiting-screen">
            <div className="waiting-pulse" />
            <h2>You are in, {playerName || "player"}.</h2>
            <p>Waiting for the organiser to start the quiz. You will enter automatically when it begins.</p>
          </div>
        </div>
      </main>
    );
  }

  const progress =
    question?.totalQuestions > 0
      ? ((question.index + 1) / question.totalQuestions) * 100
      : 0;

  const isSummary = phase === "answer_summary" && summaryData;
  const isLoadingAnswers = phase === "answers_loading";

  return (
    <main className="player-shell">
      <div className="cosmos-card animate-pop">
        {/* Top bar */}
        <div className="live-topbar">
          <div className="player-chip">
            <div className="player-avatar">
              {(playerName || "G")[0].toUpperCase()}
            </div>
            <span className="player-chip-name">{playerName || "Guest"}</span>
          </div>

          {/* Circular timer */}
          <div className="timer-ring-wrap">
            <svg className="timer-ring-svg" viewBox="0 0 64 64">
              <circle
                className="timer-ring-track"
                cx="32" cy="32" r={RING_R}
              />
              <circle
                className="timer-ring-fill"
                cx="32" cy="32" r={RING_R}
                stroke={timerColor(remainingSeconds, totalSecondsRef.current)}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={timerStroke(remainingSeconds, totalSecondsRef.current)}
              />
            </svg>
            <div
              className="timer-ring-number"
              style={{ color: timerColor(remainingSeconds, totalSecondsRef.current) }}
            >
              {Math.max(0, remainingSeconds)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="question-progress">
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="q-label">
            {question?.index + 1 || 1} / {question?.totalQuestions || 1}
          </span>
        </div>

        {/* Question text */}
        <p className="question-text">{question?.prompt || "Waiting for host…"}</p>

        {/* Options */}
        <div className="option-grid">
          {(question?.options || []).map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = isSummary && summaryData.correctOptionIndex === idx;
            const isWrong = isSummary && !isCorrect;

            // percentage fill
            let pct = 0;
            if (isSummary) {
              const total = summaryData.totalParticipants || 0;
              const count = summaryData.counts?.find((c) => c.optionIndex === idx)?.count || 0;
              pct = total > 0 ? Math.round((count / total) * 100) : 0;
            }

            let classes = `option-btn opt-${idx}`;
            if (isCorrect) classes += " opt-correct";
            else if (isSummary && isSelected) classes += " opt-wrong opt-selected";
            else if (isSummary) classes += " opt-wrong";
            else if (isSelected) classes += " opt-selected";

            return (
              <button
                key={option}
                className={classes}
                onClick={() => handleSelectOption(idx)}
                disabled={isSummary || isLoadingAnswers || selectedOption !== null || !["question_live", "async_question"].includes(phase)}
                type="button"
              >
                <span className="opt-letter">{OPTION_LETTERS[idx]}</span>
                <span className="opt-text">{option}</span>
                {isSummary && (
                  <span className="opt-pct">{pct}%</span>
                )}
                {isCorrect && (
                  <span className="opt-badge">✓</span>
                )}
                {isSummary && isSelected && !isCorrect && (
                  <span className="opt-badge">✗</span>
                )}
                {isSummary && (
                  <div
                    className="opt-result-bar"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {isLoadingAnswers && (
          <div className="answer-loading-window">
            <span className="answer-loading-spinner" />
            <strong>Loading answers</strong>
            <p>Building the option percentages...</p>
          </div>
        )}

        {/* Summary countdown strip */}
        {isSummary && summaryCountdown > 0 && (
          <div className="summary-strip">
            <span>
              {selectedOption === summaryData.correctOptionIndex
                ? "✓ Correct!"
                : selectedOption !== null
                  ? "✗ Not quite"
                  : "Time's up"}
            </span>
            <span>Next in <strong>{summaryCountdown}s</strong></span>
          </div>
        )}

        {/* Status line */}
        {!isSummary && (
          <p className="status-line">
            {phase === "question_live" && selectedOption === null && "Tap your answer before time runs out"}
            {phase === "question_live" && selectedOption !== null && "Answer locked in — waiting for others…"}
            {phase === "async_question" && selectedOption === null && "Choose an answer to continue"}
            {phase === "async_question" && selectedOption !== null && "Saving your answer..."}
            {phase === "answers_loading" && "Answers are loading..."}
          </p>
        )}
      </div>
    </main>
  );
}

export default LiveQuizPage;
