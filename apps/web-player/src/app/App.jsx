import { Navigate, Route, Routes } from "react-router-dom";

import JoinPage from "../pages/JoinPage";
import LeaderboardPage from "../pages/LeaderboardPage";
import LiveQuizPage from "../pages/LiveQuizPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/live" element={<LiveQuizPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
