import { createContext, useContext, useMemo, useState } from "react";

const QuizContext = createContext(null);

const sampleQuestion = {
  id: "sample-question-1",
  prompt: "Which planet is known as the Red Planet?",
  options: ["Earth", "Mars", "Jupiter", "Venus"],
  difficulty: "easy",
  index: 0,
  totalQuestions: 5,
};

const defaultTheme = {
  preset: "aurora",
  primaryColor: "#2563eb",
  accentColor: "#f59e0b",
  backgroundColor: "#0f172a",
  fontFamily: "Inter",
  logoText: "Quivora Live",
  coverImageUrl: "",
  playerStyle: "vibrant",
};

export function QuizProvider({ children }) {
  const [joinCode, setJoinCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [quizId, setQuizId] = useState("");
  const [asyncMode, setAsyncMode] = useState(false);
  const [phase, setPhase] = useState("waiting_for_players");
  const [remainingSeconds, setRemainingSeconds] = useState(20);
  const [question, setQuestion] = useState(sampleQuestion);
  const [leaderboard, setLeaderboard] = useState([]);
  const [lastSummary, setLastSummary] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [theme, setTheme] = useState(defaultTheme);

  const value = useMemo(
    () => ({
      joinCode,
      setJoinCode,
      playerName,
      setPlayerName,
      attemptId,
      setAttemptId,
      quizId,
      setQuizId,
      asyncMode,
      setAsyncMode,
      phase,
      setPhase,
      remainingSeconds,
      setRemainingSeconds,
      question,
      setQuestion,
      leaderboard,
      setLeaderboard,
      lastSummary,
      setLastSummary,
      participants,
      setParticipants,
      theme,
      setTheme,
    }),
    [
      attemptId,
      asyncMode,
      joinCode,
      lastSummary,
      leaderboard,
      participants,
      phase,
      playerName,
      question,
      remainingSeconds,
      theme,
      quizId,
    ]
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const context = useContext(QuizContext);

  if (!context) {
    throw new Error("useQuiz must be used inside QuizProvider");
  }

  return context;
}
