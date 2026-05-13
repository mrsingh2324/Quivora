import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      navigate("/login?error=oauth_failed", { replace: true });
      return;
    }

    async function resolveUser() {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error("Token validation failed");

        const user = await res.json();
        login(token, user);
        navigate("/", { replace: true });
      } catch {
        navigate("/login?error=oauth_failed", { replace: true });
      }
    }

    resolveUser();
  }, [searchParams, login, navigate]);

  return (
    <div className="auth-loading">
      <div className="auth-loading-spinner" />
      <p>Completing sign-in…</p>
    </div>
  );
}

export default AuthCallbackPage;
