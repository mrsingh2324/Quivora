import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import { useAuth } from "../context/AuthContext";
import {
  aiEditQuiz as aiEditQuizRequest,
  askWorkspaceAssistant,
  createLiveSession,
  fetchLiveSessions,
  fetchQuizzes,
  generateQuizFromTopic,
  upgradeAdminAccess,
  uploadDocumentForQuiz,
} from "../services/api";
import { getAdminSocket } from "../services/socket";

const initialTopicForm = {
  title: "",
  topic: "",
  difficulty: "medium",
  count: 5,
};

const ragKnowledge = [
  {
    keywords: ["create", "generate", "quiz", "topic"],
    answer: "To create a quiz, use + CREATE, enter a title and topic, choose difficulty and count, then click Generate Quiz.",
  },
  {
    keywords: ["launch", "live", "session", "code"],
    answer: "To launch a live session, select one of your quizzes and click Launch. The app creates a join code and QR link for players.",
  },
  {
    keywords: ["report", "score", "analytics", "results"],
    answer: "Reports show participant scores, answers, hardest questions, and CSV exports after a live quiz has attempts.",
  },
  {
    keywords: ["template", "templates"],
    answer: "Quiz Templates are available from the Templates page. Other template categories are marked Upcoming for now.",
  },
  {
    keywords: ["profile", "settings", "logout", "account"],
    answer: "Click the avatar on the top right to open profile, settings, admin console, and logout options.",
  },
];

function answerFromKnowledge(question, personalQuizzes) {
  const text = question.toLowerCase();
  const titles = personalQuizzes.map((quiz) => quiz.title).filter(Boolean);
  const matchedQuiz = personalQuizzes.find((quiz) => quiz.title && text.includes(quiz.title.toLowerCase()));

  if (matchedQuiz) {
    return `${matchedQuiz.title} has ${matchedQuiz.totalQuestions} questions, status ${matchedQuiz.status || "draft"}, and join code ${matchedQuiz.joinCode || "not generated yet"}. You can select it for bulk actions, launch it, or use the AI edit prompt in its row.`;
  }

  if (text.includes("how many") || text.includes("my quiz") || text.includes("workspace")) {
    if (!personalQuizzes.length) {
      return "Your workspace is empty. Create your first quiz with + CREATE, or open Templates to start from a quiz template.";
    }

    return `You have ${personalQuizzes.length} personal quiz${personalQuizzes.length === 1 ? "" : "zes"} here: ${titles.slice(0, 5).join(", ")}${titles.length > 5 ? ", and more" : ""}.`;
  }

  if (text.includes("ai edit") || text.includes("edit quiz") || text.includes("make harder") || text.includes("make easier")) {
    return "Use the AI edit field on any quiz row. Supported prompts include: make harder, make easier, add explanations, add 5 questions, convert to interview-style MCQs, or remove duplicate questions.";
  }

  const scored = ragKnowledge
    .map((item) => ({
      ...item,
      score: item.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  return scored?.score
    ? scored.answer
    : "I can help with quiz creation, templates, live launch, reports, and account settings. Try asking about one of those.";
}

const supportSlugs = {
  "Contact Support": "contact-support",
  "My Support Requests": "support-requests",
  "Help Center": "help-center",
  FAQ: "faq",
  "User Guide": "user-guide",
  "Quivora Books": "books",
  Blog: "blog",
  Videos: "videos",
  "Quivora Academy": "academy",
  "Customer Stories": "customer-stories",
  Podcasts: "podcasts",
  "Professional Services": "professional-services",
  "Report Abuse": "report-abuse",
  "Report Copyright Issue": "copyright-issue",
  "Recover Quivora Account": "recover-account",
};

function supportPath(label) {
  return `/support/${supportSlugs[label] || "help-center"}`;
}

const megaMenus = {
  templates: {
    eyebrow: "TEMPLATES",
    type: "templates",
    items: [
      ["📋", "Quiz Templates"],
      ["🏆", "Scholarship Templates"],
      ["🎯", "Ranked Challenge Templates"],
      ["🧩", "App Templates"],
      ["▦", "Table Templates"],
      ["📄", "PDF Templates"],
      ["✨", "AI Agent Templates"],
      ["💳", "Card Quiz Templates"],
      ["🛒", "Store Builder Templates"],
      ["🔀", "Workflow Templates"],
      ["✍", "Sign Templates"],
      ["▣", "Board Templates"],
    ],
  },
  products: {
    eyebrow: "PRODUCTS",
    type: "products",
    items: [
      ["📋", "Quiz Builder"],
      ["🧾", "Forms"],
      ["🧩", "Quivora Apps"],
      ["🛒", "Store Builder"],
      ["▦", "Quiz Tables"],
      ["📥", "Quiz Inbox"],
      ["📱", "Mobile App"],
      ["📊", "Report Builder"],
      ["📄", "Smart PDF Quizzes"],
      ["📝", "PDF Editor"],
      ["✍", "Quiz Sign"],
      ["🔀", "Quiz Workflows"],
      ["☁", "Quivora for Salesforce"],
      ["▣", "Quiz Boards"],
    ],
    features: [
      "Quivora AI",
      "Forms",
      "Forms",
      "Quivora Teams",
      "Prefill Quizzes",
      "Secure Quizzes",
      "Assign Quizzes",
      "Quiz Notifications",
      "Online Payments",
      "Widgets",
    ],
  },
  support: {
    eyebrow: "GET HELP",
    type: "support",
    help: ["Contact Support", "My Support Requests", "Help Center", "FAQ"],
    learn: ["User Guide", "Quivora Books", "Blog", "Videos", "Quivora Academy", "Customer Stories", "Podcasts"],
  },
};

function DashboardPage() {
  const { user, login } = useAuth();
  const { onLogout } = useOutletContext() || {};
  const isAdminLike = ["admin", "admin_player"].includes(user?.role);
  const [activeMegaMenu, setActiveMegaMenu] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const accountRef = useRef(null);
  const [selectedQuizIds, setSelectedQuizIds] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [aiEditDrafts, setAiEditDrafts] = useState({});
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [workspaceFilter, setWorkspaceFilter] = useState("personal");
  const [workspaceMode, setWorkspaceMode] = useState(() => localStorage.getItem("qz_workspace_mode") || "create");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", text: "Ask me about your workspace quizzes, templates, launching live sessions, reports, account settings, or AI quiz edits." },
  ]);

  const [quizzes, setQuizzes] = useState([]);
  const [topicForm, setTopicForm] = useState(initialTopicForm);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [statusText, setStatusText] = useState("Create a quiz from topic text or upload a document.");
  const [activeSessionCount, setActiveSessionCount] = useState(0);
  const [adminAccessCode, setAdminAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  function changeWorkspaceMode(mode) {
    localStorage.setItem("qz_workspace_mode", mode);
    setWorkspaceMode(mode);
  }

  useEffect(() => {
    if (!isAdminLike) {
      setActiveSessionCount(0);
      return undefined;
    }

    fetchLiveSessions()
      .then((sessions) => setActiveSessionCount(sessions.length))
      .catch(() => setActiveSessionCount(0));

    const socket = getAdminSocket();
    function handleQuizFinished() {
      setActiveSessionCount((current) => Math.max(0, current - 1));
    }

    socket.on("quiz:finished", handleQuizFinished);

    return () => {
      socket.off("quiz:finished", handleQuizFinished);
    };
  }, [isAdminLike]);

  useEffect(() => {
    if (!profileOpen) return undefined;

    function handlePointerDown(event) {
      if (accountRef.current && !accountRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [profileOpen]);

  useEffect(() => {
    if (!isAdminLike) {
      setQuizzes([]);
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(() => {
      fetchQuizzes({ q: workspaceSearch.trim(), limit: 100 })
        .then((data) => {
          if (active) setQuizzes(data);
        })
        .catch((err) => {
          if (active) setStatusText(err.message);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [isAdminLike, workspaceSearch]);

  const stats = useMemo(() => {
    const ownQuizzes = quizzes.filter((q) => q.createdBy?.id === user?.id);
    const libraryQuizzes = quizzes.filter((q) => q.isDefaultLibrary);
    const published = ownQuizzes.filter((q) => q.status === "published").length;
    return [
      { label: "My quizzes", value: ownQuizzes.length },
      { label: "Default library", value: libraryQuizzes.length },
      { label: "Published", value: published },
      { label: "Live ready", value: activeSessionCount },
    ];
  }, [activeSessionCount, quizzes, user?.id]);

  const personalQuizzes = useMemo(
    () => quizzes,
    [quizzes]
  );

  const ownQuizCount = quizzes.filter((quiz) => quiz.createdBy?.id === user?.id).length;

  const visiblePersonalQuizzes = useMemo(() => {
    if (workspaceFilter === "created") {
      return quizzes.filter((quiz) => quiz.createdBy?.id === user?.id);
    }

    return quizzes;
  }, [quizzes, user?.id, workspaceFilter]);

  function toggleQuizSelection(quizId) {
    setSelectedQuizIds((current) =>
      current.includes(quizId)
        ? current.filter((id) => id !== quizId)
        : [...current, quizId]
    );
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;

    const pendingMessage = { role: "assistant", text: "Searching your workspace..." };
    setChatMessages((current) => [
      ...current,
      { role: "user", text: question },
      pendingMessage,
    ]);
    setChatInput("");

    try {
      const result = await askWorkspaceAssistant({
        message: question,
        selectedQuizId: selectedQuizIds[0] || null,
      });

      if (result.refreshQuizzes) {
        await refreshQuizzes();
      }

      if (result.session) {
        setActiveSessionCount((current) => Math.max(current, 1));
      }

      const citationText = result.citations?.length
        ? `\n\nSources: ${result.citations.map((source) => `${source.type}: ${source.title}`).join("; ")}`
        : "";
      setStatusText(result.answer);
      setChatMessages((current) => [
        ...current.slice(0, -1),
        { role: "assistant", text: `${result.answer}${citationText}` },
      ]);
    } catch (error) {
      setChatMessages((current) => [
        ...current.slice(0, -1),
        { role: "assistant", text: answerFromKnowledge(question, personalQuizzes) },
      ]);
      setStatusText(error.message);
    }
  }

  async function handleAdminAccessSubmit(event) {
    event.preventDefault();
    const code = adminAccessCode.trim();

    if (!code) {
      setStatusText("Enter the admin access code.");
      return;
    }

    setLoading(true);
    setStatusText("Checking admin access code...");

    try {
      const result = await upgradeAdminAccess({ code });
      login(result.token, result.user);
      setAdminAccessCode("");
      setStatusText("Admin access enabled.");
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshQuizzes() {
    const data = await fetchQuizzes({ q: workspaceSearch.trim(), limit: 50 });
    setQuizzes(data);
  }

  async function handleTopicSubmit(event) {
    event.preventDefault();

    if (!topicForm.title.trim() || !topicForm.topic.trim()) {
      setStatusText("Title and topic are required.");
      return;
    }

    setLoading(true);
    setStatusText("Sending topic to AI and generating quiz…");

    try {
      const result = await generateQuizFromTopic({
        title: topicForm.title.trim(),
        topic: topicForm.topic.trim(),
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
        adminId: user?.id,
        adminName: user?.name,
        adminEmail: user?.email,
      });

      if (result.requiresPreferences) {
        setStatusText(result.aiResult.preferencePrompt || "AI needs more preferences.");
        return;
      }

      setStatusText(`Quiz "${result.title}" created with code ${result.joinCode}`);
      setTopicForm(initialTopicForm);
      await refreshQuizzes();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (!uploadTitle.trim() || !uploadFile) {
      setStatusText("Upload title and file are required.");
      return;
    }

    setLoading(true);
    setStatusText("Uploading document, extracting text, and sending to AI…");

    try {
      const result = await uploadDocumentForQuiz({
        title: uploadTitle.trim(),
        file: uploadFile,
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
        admin: user?.id,
      });

      setStatusText(
        result.aiResult.action === "needs_preferences"
          ? result.aiResult.preferencePrompt
          : result.aiResult.action === "error"
            ? `Document uploaded, but AI analysis failed. ${result.aiResult.message}`
            : `Document processed. AI action: ${result.aiResult.action}`
      );
      setUploadTitle("");
      setUploadFile(null);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLaunchSession(quiz) {
    setLoading(true);
    setStatusText(`Launching session for "${quiz.title}"…`);

    try {
      const session = await createLiveSession({ quizId: quiz._id || quiz.id });
      const socket = getAdminSocket();

      socket.emit(
        "room:join",
        { joinCode: session.joinCode, role: "host", name: user?.name || "Host" },
        () => {}
      );

      setActiveSessionCount((current) => current + 1);
      setStatusText(`Live room ready. Join code ${session.joinCode} is available in Active quizzes until the quiz starts.`);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAiEditQuiz(quiz) {
    const quizId = quiz.id || quiz._id;
    const prompt = (aiEditDrafts[quizId] || "").trim();

    if (!prompt) {
      setStatusText("Enter an AI edit prompt for this quiz.");
      return;
    }

    setLoading(true);
    setStatusText(`Applying AI edits to "${quiz.title}"...`);

    try {
      const result = await aiEditQuizRequest(quizId, { prompt });
      setStatusText(`${result.message} ${result.actions?.join("; ") || ""}`);
      setAiEditDrafts((current) => ({ ...current, [quizId]: "" }));
      await refreshQuizzes();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isAdminLike) {
    return (
      <div className="workspace-home">
        <header className="workspace-header">
          <div className="workspace-brand">
            <img className="workspace-logo" src="/quivora-icon.svg" alt="" />
            <strong>Quivora</strong>
            <span className="workspace-divider" />
            <span>Learner account</span>
          </div>
          <div className="workspace-account">
            <button className="workspace-avatar-button" type="button">
              <span className="workspace-avatar">{(user?.name || "L")[0].toUpperCase()}</span>
            </button>
            <button className="secondary-button" type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="workspace-content-pane" style={{ maxWidth: 720, margin: "64px auto" }}>
          <section className="workspace-panel">
            <p className="eyebrow">Admin access required</p>
            <h2>Enter your admin access code</h2>
            <p className="support-copy">
              Login is open to everyone. Admin tools and the default quiz library unlock only after a valid access code is applied to this account.
            </p>
            <form className="login-form" onSubmit={handleAdminAccessSubmit}>
              <label className="login-field">
                <span>Special admin code</span>
                <input
                  value={adminAccessCode}
                  onChange={(event) => setAdminAccessCode(event.target.value)}
                  placeholder="Enter admin code"
                  type="password"
                />
              </label>
              <button className="login-submit" disabled={loading} type="submit">
                {loading ? "Checking..." : "Enable admin access"}
              </button>
            </form>
            <p className="status-note">{statusText}</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="workspace-home">
      <div className="workspace-top-area" onMouseLeave={() => setActiveMegaMenu(null)}>
        <header className="workspace-header">
          <div className="workspace-brand">
            <img className="workspace-logo" src="/quivora-icon.svg" alt="" />
            <strong>Quivora</strong>
            <span className="workspace-divider" />
            <span>My Workspace⌄</span>
          </div>

          <nav className="workspace-topnav" aria-label="Workspace navigation">
            <Link className="workspace-build-link" to="/build">
              Build Quiz
            </Link>
            <Link className="workspace-nav-link" to="/templates">
              Templates⌄
            </Link>
            <Link className="workspace-nav-link" to="/products">
              Products⌄
            </Link>
            <button
              className={activeMegaMenu === "support" ? "active" : ""}
              type="button"
              onClick={() => setActiveMegaMenu(activeMegaMenu === "support" ? null : "support")}
              onMouseEnter={() => setActiveMegaMenu("support")}
            >
              Support⌄
            </button>
          </nav>

          <div className="workspace-account" ref={accountRef}>
            <button
              className="workspace-avatar-button"
              type="button"
              onClick={() => setProfileOpen((value) => !value)}
              aria-expanded={profileOpen}
            >
              <span className="workspace-avatar">{(user?.name || "A")[0].toUpperCase()}</span>
            </button>
            {profileOpen ? (
              <div className="profile-menu">
                <div className="profile-menu-head">
                  <div className="workspace-avatar">{(user?.name || "A")[0].toUpperCase()}</div>
                  <div>
                    <p>Hello,</p>
                    <strong>{user?.name || "Admin"}</strong>
                  </div>
                  <span>{user?.role === "admin_player" ? "Admin + Player" : user?.role || "admin"}</span>
                </div>
                <Link to="/account/profile">Profile</Link>
                <Link to="/account/admin-player">Admin + Player</Link>
                <Link to="/account/settings">Settings</Link>
                <Link to="/account/admin-console">Admin Console</Link>
                <Link to="/account/support-requests">Support Requests</Link>
                <button type="button" onClick={onLogout}>Logout</button>
              </div>
            ) : null}
          </div>
        </header>

        {activeMegaMenu ? (
          <div className={`workspace-mega-menu mega-${megaMenus[activeMegaMenu].type}`}>
            {activeMegaMenu === "support" ? (
              <>
                <div className="mega-column">
                  <p>{megaMenus.support.eyebrow}</p>
                  {megaMenus.support.help.map((item) => (
                    <Link key={item} to={supportPath(item)}>{item}</Link>
                  ))}
                </div>
                <div className="mega-column shaded">
                  <p>LEARN</p>
                  {megaMenus.support.learn.map((item) => (
                    <Link key={item} to={supportPath(item)}>{item}</Link>
                  ))}
                </div>
                <div className="mega-support-card">
                  <p>DEDICATED SUPPORT</p>
                  <h3>Get direct help with account, quiz, report, and live-session issues.</h3>
                  <div className="support-portrait-wrap">
                    <span className="support-portrait one" />
                    <span className="support-portrait two" />
                  </div>
                  <Link to="/account/support-requests">Create request</Link>
                </div>
                <div className="mega-footer">
                  <Link to={supportPath("Professional Services")}>Professional Services</Link>
                  <Link to={supportPath("Professional Services")}>Explore →</Link>
                </div>
              </>
            ) : (
              <>
                <div className="mega-products-main">
                  <p>{megaMenus[activeMegaMenu].eyebrow}</p>
                  <div className="mega-grid">
                    {megaMenus[activeMegaMenu].items.map(([icon, label], index) => (
                      <button key={label} className={`mega-item tone-${index % 8}`} type="button">
                        <span>{icon}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                  {activeMegaMenu === "products" ? (
                    <div className="mega-ai-strip">
                      <span>✨</span>
                      <strong>Quivora AI Agents</strong>
                      <button type="button">Discover Now</button>
                    </div>
                  ) : null}
                </div>

                {activeMegaMenu === "products" ? (
                  <aside className="mega-features">
                    <p>FEATURES</p>
                    {megaMenus.products.features.map((item, index) => (
                      <button key={item} type="button">
                        {item}
                        {index === 0 ? <span>NEW</span> : null}
                      </button>
                    ))}
                    <a href="#create-quiz">See more features ›</a>
                  </aside>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>

      <GlobalSearchBar />

      <div className="workspace-body">
        <aside className="workspace-side">
          <Link className="workspace-create" to="/build">+ CREATE</Link>

          <section className="side-section">
            <h3>Create your own quiz</h3>
            <p className="side-note">From any concept, PDF, notes, course material, or quiz idea.</p>
            <Link className="connect-pill" to="/build/topic">
              <span className="ai-dot">✺</span>
              Any concept
              <strong>Create ↗</strong>
            </Link>
            <Link className="connect-pill" to="/build/materials">
              <span className="ai-dot dark">◎</span>
              Learning materials
              <strong>Upload ↗</strong>
            </Link>
            <Link className="connect-pill" to="/templates">
              <span className="ai-dot warm">★</span>
              Template quiz
              <strong>Templates ↗</strong>
            </Link>
          </section>

          <section className="side-section">
            <div className="side-heading">
              <h3>My Workspace</h3>
              <span>⋮</span>
            </div>
            <button
              className={workspaceFilter === "personal" ? "workspace-menu active" : "workspace-menu subtle"}
              onClick={() => setWorkspaceFilter("personal")}
              type="button"
            >
              <span>▦</span>
              Personal workspace
              <strong>{personalQuizzes.length}</strong>
            </button>
            <Link className="workspace-menu subtle" to="/workspace/shared">
              <span>👥</span>
              Shared workspace
              <strong>0</strong>
            </Link>
            <button
              className={workspaceFilter === "created" ? "workspace-menu active" : "workspace-menu subtle"}
              onClick={() => setWorkspaceFilter("created")}
              type="button"
            >
              <span>◴</span>
              Previously created
              <strong>{ownQuizCount}</strong>
            </button>
            <Link className="workspace-menu subtle" to="/workspace/attempted">
              <span>✓</span>
              Previously attempted
              <strong>0</strong>
            </Link>
          </section>

          <section className="side-section">
            <div className="side-heading">
              <h3>Team Workspaces</h3>
              <span>⋮</span>
            </div>
            <Link className="workspace-menu subtle" to="/team-workspace?create=1">
              <span>＋</span>
              Create team
            </Link>
            <Link className="workspace-menu subtle" to="/team-workspace">
              <span>👥</span>
              Manage team
            </Link>
          </section>

          <section className="side-section side-links">
            <Link to="/workspace/shared">👥 Shared with me</Link>
            <Link to="/assignments">☷ Assigned to me</Link>
            <Link to="/workspace/sent">▰ Sent</Link>
          </section>

          <div className="workspace-ad">
            <span>Announcing</span>
            <strong>Assignments for preparation material</strong>
            <p>Open assigned prep from the workspace menu.</p>
          </div>
        </aside>

        <main className="workspace-content-pane">
          <div className="workspace-promo">
            <div>
              <strong>TODAY ONLY!</strong>
              <span>CREATE FASTER</span>
            </div>
            <p>Offer expires in <strong>23h : 52m : 34s</strong></p>
            <Link to="/build">Create Now</Link>
          </div>

          <div className="workspace-toolbar">
            {user?.role === "admin_player" ? (
              <div className="mode-switch" role="group" aria-label="Workspace mode">
                <button className={workspaceMode === "create" ? "active" : ""} type="button" onClick={() => changeWorkspaceMode("create")}>Create</button>
                <button className={workspaceMode === "prepare" ? "active" : ""} type="button" onClick={() => changeWorkspaceMode("prepare")}>Prepare</button>
                {workspaceMode === "prepare" ? <Link to="/assignments">Open prep</Link> : <Link to="/build">Build quiz</Link>}
              </div>
            ) : null}
            <Link className="active-quizzes-link" to="/active-quizzes">
              Active quizzes <span>{activeSessionCount}</span>
            </Link>
            <label>
              <span>⌕</span>
              <input
                placeholder="Search quizzes"
                value={workspaceSearch}
                onChange={(event) => setWorkspaceSearch(event.target.value)}
              />
            </label>
          </div>

          <section className="workspace-canvas">
            {personalQuizzes.length === 0 ? (
              <div className="workspace-empty">
                <div className="empty-illustration" aria-hidden="true">
                  <span className="empty-card card-one" />
                  <span className="empty-card card-two" />
                  <span className="empty-person" />
                  <span className="empty-bubble left" />
                  <span className="empty-bubble right" />
                </div>
                <h1>You don't have anything here yet.</h1>
                <p>Create your first quiz to start collecting answers.</p>
                <Link to="/build">+ CREATE</Link>
              </div>
            ) : (
              <div className="workspace-quiz-list">
                {selectedQuizIds.length > 0 ? (
                  <div className="quiz-bulk-actions">
                    <button type="button">Label as</button>
                    <button type="button">Move to Team</button>
                    <button type="button">More⌄</button>
                    <button className="danger" type="button">Move to Trash</button>
                  </div>
                ) : null}
                {visiblePersonalQuizzes.length === 0 ? (
                  <div className="workspace-empty compact">
                    <h1>No quizzes match your search.</h1>
                    <p>
                      {workspaceFilter === "created"
                        ? "Create a quiz to add it to your previously created list."
                        : "Try a different title, status, or category."}
                    </p>
                  </div>
                ) : null}
                {visiblePersonalQuizzes.map((quiz) => {
                  const quizId = quiz.id || quiz._id;
                  const selected = selectedQuizIds.includes(quizId);
                  return (
                    <article className={selected ? "workspace-quiz-row selected" : "workspace-quiz-row"} key={quizId}>
                      <input
                        aria-label={`Select ${quiz.title}`}
                        checked={selected}
                        onChange={() => toggleQuizSelection(quizId)}
                        type="checkbox"
                      />
                      <button className="quiz-star" type="button">★</button>
                      <span className="quiz-row-icon">▦</span>
                      <div>
                        <h3>{quiz.title}</h3>
                        <p>
                          {quiz.totalQuestions} questions · {quiz.isDefaultLibrary ? "Default library" : "Launch to create a join code"}
                        </p>
                      </div>
                      <button className="quiz-row-link" type="button">View Quiz</button>
                      <Link className="quiz-row-link" to={`/quizzes/${quizId}/history`} state={{ quiz }}>
                        More⌄
                      </Link>
                      <button
                        className="workspace-card-action"
                        onClick={() => handleLaunchSession(quiz)}
                        type="button"
                        disabled={loading}
                      >
                        Launch
                      </button>
                      {quiz.isDefaultLibrary ? null : (
                        <div className="quiz-ai-row">
                          <span>AI Edit</span>
                          <input
                            value={aiEditDrafts[quizId] || ""}
                            onChange={(event) =>
                              setAiEditDrafts((current) => ({
                                ...current,
                                [quizId]: event.target.value,
                              }))
                            }
                            placeholder="Try: make harder, add explanations, remove duplicate questions"
                          />
                          <button disabled={loading} onClick={() => handleAiEditQuiz(quiz)} type="button">
                            Apply
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <footer className="workspace-footer">
            <div className="footer-columns">
              <div className="footer-column">
                <h3>Quivora</h3>
                <Link to="/build">Create a Quiz</Link>
                <Link to="/">My Workspace</Link>
                <Link to="/templates">Templates</Link>
                <Link to="/question-bank">Question Bank</Link>
                <Link to="/assignments">Assignments</Link>
              </div>

              <div className="footer-column">
                <h3>Operations</h3>
                <Link to="/active-quizzes">Active quizzes</Link>
                <Link to="/reports">Reports</Link>
                <Link to="/team-workspace">Team workspace</Link>
                <Link to="/integrations">Integrations</Link>
              </div>

              <div className="footer-column">
                <h3>Support</h3>
                <Link to={supportPath("Contact Support")}>Contact Us</Link>
                <Link to={supportPath("User Guide")}>User Guide</Link>
                <Link to={supportPath("Help Center")}>Help Center</Link>
                <Link to="/account/support-requests">Support Requests</Link>
                <Link to={supportPath("Report Abuse")}>Report Abuse</Link>
              </div>

              <div className="footer-column">
                <h3>Account</h3>
                <Link to="/account/profile">Profile</Link>
                <Link to="/account/settings">Settings</Link>
                <Link to="/account/admin-console">Admin Console</Link>
                <Link to="/account/admin-player">Admin + Player</Link>
              </div>
            </div>

            <p className="footer-description">
              Quivora is an AI quiz workspace for drafting, reviewing, launching, and reporting on live assessments.
            </p>

            <div className="footer-identity">
              <div className="footer-mark">Q</div>
              <div>
                <p>Local workspace build</p>
                <p>Use production environment values before public deployment.</p>
              </div>
              <select aria-label="Footer language">
                <option>English</option>
                <option>Hindi</option>
              </select>
            </div>

            <div className="footer-bottom">
              <div className="footer-legal">
                <Link to={supportPath("Help Center")}>Security checklist</Link>
                <Link to={supportPath("User Guide")}>Accessibility notes</Link>
              </div>
            </div>
          </footer>
        </main>
      </div>

      <div className={chatOpen ? "workspace-chat open" : "workspace-chat"}>
        <button className="chat-pill" type="button" onClick={() => setChatOpen((value) => !value)}>
          <span>✨</span>
          <p>Ask Quiz AI anything</p>
          <strong>{chatOpen ? "×" : "▮▮"}</strong>
        </button>
        {chatOpen ? (
          <form className="chat-panel" onSubmit={handleChatSubmit}>
            <div className="chat-messages">
              {chatMessages.map((message, index) => (
                <div className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>
                  {message.text}
                </div>
              ))}
            </div>
            <label>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask about reports, launch, templates..."
              />
              <button type="submit">Send</button>
            </label>
          </form>
        ) : null}
      </div>
    </div>
  );
}

export default DashboardPage;
