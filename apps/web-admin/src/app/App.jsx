import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";
import AdminLayout from "../layouts/AdminLayout";
import AccountPage from "../pages/AccountPage";
import ActiveQuizzesPage from "../pages/ActiveQuizzesPage";
import AssignmentsPage from "../pages/AssignmentsPage";
import AuthCallbackPage from "../pages/AuthCallbackPage";
import BuildPage from "../pages/BuildPage";
import CatalogPage from "../pages/CatalogPage";
import DashboardPage from "../pages/DashboardPage";
import IntegrationsPage from "../pages/IntegrationsPage";
import LoginPage from "../pages/LoginPage";
import QuizHistoryPage from "../pages/QuizHistoryPage";
import QuestionBankPage from "../pages/QuestionBankPage";
import QuizReviewPage from "../pages/QuizReviewPage";
import ReportsPage from "../pages/ReportsPage";
import StaticSupportPage from "../pages/StaticSupportPage";
import TeamWorkspacePage from "../pages/TeamWorkspacePage";
import WorkspaceCollectionPage from "../pages/WorkspaceCollectionPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/account/:section" element={<AccountPage />} />
        <Route path="/active-quizes" element={<ActiveQuizzesPage />} />
        <Route path="/active-quizzes" element={<ActiveQuizzesPage />} />
        <Route path="/assignments" element={<AssignmentsPage />} />
        <Route path="/build" element={<BuildPage />} />
        <Route path="/build/:mode" element={<BuildPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/quizzes/:quizId/history" element={<QuizHistoryPage />} />
        <Route path="/question-bank" element={<QuestionBankPage />} />
        <Route path="/quizzes/:quizId/review" element={<QuizReviewPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/reports/:sessionId" element={<ReportsPage />} />
        <Route path="/templates" element={<CatalogPage />} />
        <Route path="/products" element={<CatalogPage />} />
        <Route path="/support/:slug" element={<StaticSupportPage />} />
        <Route path="/team-workspace" element={<TeamWorkspacePage />} />
        <Route path="/workspace/:collection" element={<WorkspaceCollectionPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
