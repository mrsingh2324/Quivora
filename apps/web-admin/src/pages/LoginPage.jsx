import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const IS_DEV = import.meta.env.DEV;

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(searchParams.get("error") ? "OAuth sign-in failed. Please try again." : "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate("/", { replace: true });
  }, [isAuthenticated, navigate]);

  function setField(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register"
        ? { name: form.name, email: form.email, password: form.password }
        : { email: form.email, password: form.password };

      const data = await apiPost(path, body);
      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    setError("");
    setLoading(true);
    try {
      const data = await apiPost("/api/auth/dev-login", {});
      login(data.token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <header className="entry-nav">
        <div className="entry-brand">
          <div className="login-logo">Q</div>
          <strong>Quivora Admin</strong>
        </div>
        <nav className="entry-links" aria-label="Entry page navigation">
          <a href="#features">Features</a>
          <a href="#signin">Sign in</a>
          <button type="button" onClick={() => setMode("register")}>
            Create account
          </button>
        </nav>
      </header>

      <main className="entry-main">
        <section className="entry-hero animate-rise">
          <p className="entry-kicker">For tests, workshops, and quick checks</p>
          <h1>Create a polished quiz whenever you need one.</h1>
          <p className="entry-copy">
            Turn any topic into a ready-to-share quiz for a class test, hiring screen, training session, or post-workshop assessment in minutes.
          </p>

          <div className="entry-cta-row">
            <button className="entry-primary-cta" type="button" onClick={() => setMode("register")}>
              Sign up with an email
            </button>
            <button className="entry-secondary-cta" type="button" onClick={() => setMode("login")}>
              I already have an account
            </button>
          </div>

          <div className="entry-proof">
            <span>Trusted workspace</span>
            <strong>4.8</strong>
            <span>Live sessions</span>
            <strong>AI-ready</strong>
            <span>Reports</span>
            <strong>CSV export</strong>
          </div>

          <div className="entry-preview" aria-label="Quiz builder preview">
            <div className="preview-window">
              <div className="preview-toolbar">
                <span />
                <span />
                <span />
              </div>
              <div className="preview-content">
                <div className="preview-form">
                  <div className="preview-form-head">
                    <span>Generating using AI</span>
                    <strong>Topic: Python</strong>
                  </div>
                  <p>Create a 10-question workshop recap quiz</p>
                  <div className="preview-input wide">Difficulty: Intermediate</div>
                  <div className="preview-input">Audience: Beginners after live session</div>
                  <div className="preview-choice active">Drafting MCQs with answer explanations</div>
                  <div className="preview-choice">Adding join code and QR link</div>
                  <div className="preview-choice">Preparing instant score report</div>
                </div>
                <div className="preview-stats">
                  <strong>2m</strong>
                  <span>to first draft</span>
                  <strong>10</strong>
                  <span>AI questions</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="login-card animate-rise" id="signin">
          <div className="login-brand">
            <h2>{mode === "register" ? "Create your workspace" : "Welcome back"}</h2>
            <p>{mode === "register" ? "Start building quizzes in seconds." : "Sign in to manage quizzes and sessions."}</p>
          </div>

        {IS_DEV && (
          <div className="dev-banner">
            <span className="dev-badge">DEV</span>
            <span>Dev mode active</span>
            <button
              className="dev-login-btn"
              type="button"
              disabled={loading}
              onClick={handleDevLogin}
            >
              One-click Dev Login
            </button>
          </div>
        )}

        <div className="oauth-row">
          <a
            className="oauth-btn oauth-google"
            href={`${API_URL}/api/auth/google`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </a>

          <a
            className="oauth-btn oauth-github"
            href={`${API_URL}/api/auth/github`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
            Continue with GitHub
          </a>
        </div>

        <div className="login-divider"><span>or</span></div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label className="login-field">
                <span>Full name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={setField("name")}
                  placeholder="Your name"
                  required
                  autoComplete="name"
                />
              </label>
            </>
          )}

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={setField("email")}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={setField("password")}
              placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
              required
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
          </label>

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>

        <p className="login-switch">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button type="button" onClick={() => { setMode("register"); setError(""); }}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => { setMode("login"); setError(""); }}>
                Sign in
              </button>
            </>
          )}
        </p>
        </aside>
      </main>

      <section className="entry-features" id="features">
        <article>
          <span>Occasional tests</span>
          <h3>No quiz bank required</h3>
          <p>Paste a topic like Python basics, workplace safety, or sales training and get a structured quiz draft instantly.</p>
        </article>
        <article>
          <span>After workshops</span>
          <h3>Check retention fast</h3>
          <p>Run a quick room with a join code, collect answers live, and see who understood the session.</p>
        </article>
        <article>
          <span>Ready reports</span>
          <h3>Know what to teach next</h3>
          <p>Spot weak topics, export scores, and follow up with the exact concepts your audience missed.</p>
        </article>
      </section>
    </div>
  );
}

export default LoginPage;
