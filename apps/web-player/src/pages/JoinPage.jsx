import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useQuiz } from "../context/QuizContext";
import {
  clearParticipantSession,
  joinQuiz,
  loadParticipantSession,
  saveParticipantSession,
} from "../services/api";
import { getSocket } from "../services/socket";

function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    setAsyncMode,
    setAttemptId,
    setJoinCode,
    setPlayerName,
    setPhase,
    setQuestion,
    setQuizId,
    setRemainingSeconds,
  } = useQuiz();

  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() || "");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedSession, setSavedSession] = useState(null);
  const checkedRef = useRef(false);

  // On mount: pull query code and check for a saved session for that code
  useEffect(() => {
    const queryCode = searchParams.get("code")?.toUpperCase() || "";
    if (queryCode) setCode(queryCode);

    if (queryCode && !checkedRef.current) {
      checkedRef.current = true;
      const stored = loadParticipantSession(queryCode);
      if (stored) {
        setSavedSession(stored);
        setName(stored.playerName);
      }
    }
  }, [searchParams]);

  async function doJoin(joinCode, playerName, existingAttemptId) {
    const result = await joinQuiz(joinCode, playerName, existingAttemptId);

    const resultQuizId = result.quiz?.id || result.quiz?._id || "";
    saveParticipantSession(joinCode, result.attemptId, result.participant.name, {
      asyncMode: Boolean(result.asyncMode),
      quizId: resultQuizId,
    });
    setJoinCode(result.quiz.joinCode);
    setPlayerName(result.participant.name);
    setAttemptId(result.attemptId);
    setQuizId(resultQuizId);
    setAsyncMode(Boolean(result.asyncMode));

    if (result.asyncMode) {
      setQuestion(result.question);
      setPhase("async_question");
      setRemainingSeconds(result.quiz?.questionTimeLimitSeconds || 30);
      navigate("/live");
      return;
    }

    const socket = getSocket();
    socket.emit(
      "room:join",
      {
        joinCode: result.quiz.joinCode,
        role: "participant",
        attemptId: result.attemptId,
        name: result.participant.name,
      },
      (response) => {
        if (response.ok) {
          setRemainingSeconds(response.data?.remainingSeconds || 30);
          setPhase(response.data?.phase || "waiting_for_players");
          if (response.data?.activeQuestion) {
            setQuestion(response.data.activeQuestion);
          }
        }
      }
    );

    navigate("/live");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();

    if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) {
      setMessage("Game code must be 6 letters or numbers.");
      return;
    }

    if (normalizedName.length < 2) {
      setMessage("Name must be at least 2 characters.");
      return;
    }

    setLoading(true);
    setMessage("Joining…");

    try {
      // If the user typed a different name than the stored one, clear the saved session
      // so they join fresh rather than rejoin as someone else's name.
      const existingAttemptId =
        savedSession && savedSession.playerName === normalizedName
          ? savedSession.attemptId
          : null;

      if (!existingAttemptId && savedSession) {
        clearParticipantSession(normalizedCode);
        setSavedSession(null);
      }

      await doJoin(normalizedCode, normalizedName, existingAttemptId);
    } catch (error) {
      setMessage(error.message || "Unable to join. Check the code and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="join-scene">
      <div className="join-card animate-pop">
        <div className="join-logo">Q</div>

        <p className="eyebrow">Live Quiz</p>
        <h1>Join the game</h1>
        <p className="support-copy">
          {message ||
            (savedSession
              ? `Welcome back, ${savedSession.playerName}! Tap Join to resume.`
              : "Enter the game code and your name to jump in.")}
        </p>

        <form className="join-form" onSubmit={handleSubmit}>
          <div className="join-input-wrap">
            <input
              className="code-input"
              placeholder="ABC123"
              value={code}
              maxLength={6}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setCode(v);
                // Check for saved session whenever code changes
                const stored = loadParticipantSession(v);
                setSavedSession(stored);
                if (stored && !name) setName(stored.playerName);
              }}
              required
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>

          <div className="join-input-wrap">
            <input
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="nickname"
            />
          </div>

          <button className="join-btn" type="submit" disabled={loading}>
            {loading
              ? "Joining…"
              : savedSession && savedSession.playerName === name.trim()
                ? "Resume session →"
                : "Join Now →"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinPage;
