import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import {
  createQuizDraft,
  fetchQuizDrafts,
  generateQuizFromTopic,
  updateQuizDraft,
  uploadDocumentForQuiz,
} from "../services/api";

const initialTopicForm = {
  title: "",
  topic: "",
  difficulty: "medium",
  count: 5,
};

const creationSteps = [
  "Understanding your topic",
  "Searching question patterns",
  "Creating MCQs",
  "Designing answer explanations",
  "Preparing your workspace draft",
];

const buildModes = [
  {
    key: "topic",
    label: "Any concept",
    title: "Create from Topic",
    description: "Build from a topic, pasted notes, or a quiz idea.",
    to: "/build/topic",
  },
  {
    key: "materials",
    label: "Learning materials",
    title: "Build from PDF or DOCX",
    description: "Upload course material, notes, or a worksheet and turn it into a quiz.",
    to: "/build/materials",
  },
  {
    key: "campaign",
    label: "Template quiz",
    title: "Start from a template",
    description: "Use ranked challenges, scholarship qualifiers, and skill checks.",
    to: "/build/campaign",
  },
];

function BuildProgressOverlay({ title }) {
  return (
    <div className="build-progress-overlay">
      <div className="build-progress-card">
        <div className="build-progress-orbit">
          <span />
          <span />
          <span />
        </div>
        <p>Building with AI</p>
        <h2>{title || "Creating your quiz"}</h2>
        <div className="build-progress-steps">
          {creationSteps.map((step, index) => (
            <span key={step} style={{ animationDelay: `${index * 0.42}s` }}>
              {step}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuildSuccessModal({ quiz, onClose }) {
  const reviewPath = quiz?.id ? `/quizzes/${quiz.id}/review` : "/";

  return (
    <div className="build-success-overlay" role="dialog" aria-modal="true" aria-labelledby="build-success-title">
      <div className="build-success-card">
        <div className="build-success-icon">✓</div>
        <p className="eyebrow">Quiz built</p>
        <h2 id="build-success-title">{quiz?.title || "Your quiz is ready"}</h2>
        <p>
          Your quiz has been saved to the workspace. You can review the questions,
          edit details, and launch it from there.
        </p>
        {quiz?.joinCode ? (
          <div className="build-success-code">
            <span>Join code</span>
            <strong>{quiz.joinCode}</strong>
          </div>
        ) : null}
        <div className="build-success-actions">
          <Link className="primary-button" to={reviewPath}>
            {quiz?.id ? "Review quiz" : "Go to workspace"}
          </Link>
          <button className="secondary-button" type="button" onClick={onClose}>
            Build another quiz
          </button>
        </div>
      </div>
    </div>
  );
}

function BuildPage() {
  const { mode = "topic" } = useParams();
  const { isAuthenticated, loading: authLoading, token, user } = useAuth();
  const activeMode = buildModes.some((item) => item.key === mode) ? mode : "topic";
  const activeModeConfig = buildModes.find((item) => item.key === activeMode) || buildModes[0];
  const [topicForm, setTopicForm] = useState(initialTopicForm);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [statusText, setStatusText] = useState("Build from a topic, pasted notes, or an uploaded document.");
  const [loading, setLoading] = useState(false);
  const [successQuiz, setSuccessQuiz] = useState(null);
  const [draftId, setDraftId] = useState("");
  const autosaveTimerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !token) return undefined;
    let active = true;
    fetchQuizDrafts()
      .then((drafts) => {
        if (!active || !drafts.length || topicForm.title || topicForm.topic) return;
        const latest = drafts[0];
        if (latest?.sourceType === "topic" && latest.payload) {
          setDraftId(latest.id);
          setTopicForm((current) => ({
            ...current,
            title: latest.title || current.title,
            topic: latest.payload.topic || current.topic,
            difficulty: latest.payload.difficulty || current.difficulty,
            count: latest.payload.count || current.count,
          }));
          setStatusText(`Restored draft saved ${new Date(latest.lastSavedAt || latest.updatedAt).toLocaleString()}.`);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  // Load only once after auth is ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || activeMode !== "topic") return undefined;
    const title = topicForm.title.trim();
    const topic = topicForm.topic.trim();
    if (!title && !topic) return undefined;

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(async () => {
      const payload = {
        title: title || "Untitled draft",
        sourceType: "topic",
        payload: {
          topic,
          difficulty: topicForm.difficulty,
          count: Number(topicForm.count) || 5,
        },
      };
      try {
        const saved = draftId
          ? await updateQuizDraft(draftId, payload)
          : await createQuizDraft(payload);
        setDraftId(saved.id);
        setStatusText(`Draft saved at ${new Date(saved.lastSavedAt).toLocaleTimeString()}.`);
      } catch {
        // Keep creation flow uninterrupted if autosave fails.
      }
    }, 30_000);

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [activeMode, draftId, isAuthenticated, token, topicForm]);

  async function handleTopicSubmit(event) {
    event.preventDefault();

    if (authLoading) {
      setStatusText("Checking your login session. Please try again in a moment.");
      return;
    }

    if (!isAuthenticated || !token) {
      setStatusText("Your login session is missing. Please sign in again before creating a quiz.");
      return;
    }

    if (!topicForm.title.trim() || !topicForm.topic.trim()) {
      setStatusText("Title and topic are required.");
      return;
    }

    setLoading(true);
    setStatusText("Creating, designing, and preparing your quiz...");

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

      setStatusText(`Quiz "${result.title}" is ready in your workspace with code ${result.joinCode}.`);
      setSuccessQuiz({
        id: result.id || result._id,
        title: result.title,
        joinCode: result.joinCode,
      });
      setTopicForm(initialTopicForm);
    } catch (error) {
      setStatusText(
        /authentication|required|invalid|expired/i.test(error.message)
          ? "Your login session expired. Please sign in again and create the quiz."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadSubmit(event) {
    event.preventDefault();

    if (authLoading) {
      setStatusText("Checking your login session. Please try again in a moment.");
      return;
    }

    if (!isAuthenticated || !token) {
      setStatusText("Your login session is missing. Please sign in again before uploading a document.");
      return;
    }

    if (!uploadTitle.trim() || !uploadFile) {
      setStatusText("Upload title and file are required.");
      return;
    }

    setLoading(true);
    setStatusText("Reading your document and building a quiz draft...");

    try {
      const result = await uploadDocumentForQuiz({
        title: uploadTitle.trim(),
        file: uploadFile,
        difficulty: topicForm.difficulty,
        count: Number(topicForm.count),
        admin: user?.id,
      });

      setStatusText(
        result.aiResult.action === "error"
          ? `Document uploaded, but AI analysis failed. ${result.aiResult.message}`
          : `Document processed. Review the generated quiz draft before publishing.`
      );
      if (result.aiResult.action !== "error" && result.draftQuiz) {
        setSuccessQuiz({
          id: result.draftQuiz.id || result.draftQuiz._id,
          title: result.draftQuiz.title || uploadTitle.trim(),
          joinCode: result.draftQuiz.joinCode,
        });
      } else if (result.aiResult.action !== "error") {
        setStatusText("Document processed, but no quiz questions were generated. Try a document with clearer assessment content.");
      }
      setUploadTitle("");
      setUploadFile(null);
    } catch (error) {
      setStatusText(
        /authentication|required|invalid|expired/i.test(error.message)
          ? "Your login session expired. Please sign in again and upload the document."
          : error.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="build-page">
      <SiteHeader variant="dark" />
      <GlobalSearchBar />

      {loading ? <BuildProgressOverlay title={topicForm.title || uploadTitle} /> : null}
      {successQuiz ? <BuildSuccessModal quiz={successQuiz} onClose={() => setSuccessQuiz(null)} /> : null}

      <main className="build-shell">
        <section className="build-center">
          <Link className="static-back-link" to="/">← Back to workspace</Link>
          <p className="eyebrow">Build using AI</p>
          <h1>{activeModeConfig.title}</h1>
          <p>{statusText || activeModeConfig.description}</p>

          <div className="build-layout">
            <aside className="build-side-nav" aria-label="Build options">
              {buildModes.map((item) => (
                <Link className={activeMode === item.key ? "active" : ""} key={item.key} to={item.to}>
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </Link>
              ))}
            </aside>

            <div className="build-content-panel">
              {activeMode === "topic" ? (
                <div className="build-grid build-grid-single">
                  <form className="panel build-primary-panel" onSubmit={handleTopicSubmit}>
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">AI Topic Generator</p>
                        <h3>Create from Topic</h3>
                      </div>
                    </div>

                    <label className="field">
                      <span>Quiz title</span>
                      <input
                        value={topicForm.title}
                        onChange={(event) => setTopicForm((form) => ({ ...form, title: event.target.value }))}
                        placeholder="Python Workshop Recap"
                        required
                      />
                    </label>

                    <label className="field">
                      <span>Topic or study material</span>
                      <textarea
                        value={topicForm.topic}
                        onChange={(event) => setTopicForm((form) => ({ ...form, topic: event.target.value }))}
                        rows={7}
                        placeholder="Paste a workshop outline, test topic, or study notes..."
                        required
                      />
                    </label>

                    <div className="inline-fields">
                      <label className="field">
                        <span>Difficulty</span>
                        <select
                          value={topicForm.difficulty}
                          onChange={(event) => setTopicForm((form) => ({ ...form, difficulty: event.target.value }))}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </label>

                      <label className="field">
                        <span>Question count</span>
                        <input
                          min="1"
                          max="20"
                          type="number"
                          value={topicForm.count}
                          onChange={(event) => setTopicForm((form) => ({ ...form, count: event.target.value }))}
                        />
                      </label>
                    </div>

                    <button className="primary-button" disabled={loading} type="submit">
                      Create Quiz
                    </button>
                  </form>

                  <aside className="build-steps-panel">
                    <h2>What happens after you click Create Quiz?</h2>
                    <ol>
                      <li>
                        <strong>AI reads your topic</strong>
                        <span>It extracts the concepts, audience, difficulty, and quiz intent.</span>
                      </li>
                      <li>
                        <strong>Questions are drafted</strong>
                        <span>The system creates MCQs, answer options, and explanations.</span>
                      </li>
                      <li>
                        <strong>Your quiz is saved</strong>
                        <span>A workspace draft appears with launch controls.</span>
                      </li>
                      <li>
                        <strong>You review and launch</strong>
                        <span>Edit questions, share the code, or run a live room immediately.</span>
                      </li>
                    </ol>
                  </aside>
                </div>
              ) : null}

              {activeMode === "materials" ? (
                <div className="build-grid build-grid-single">
                  <form className="panel build-primary-panel" onSubmit={handleUploadSubmit}>
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">Document Generator</p>
                        <h3>Build from PDF or DOCX</h3>
                      </div>
                    </div>
                    <label className="field">
                      <span>Document title</span>
                      <input
                        value={uploadTitle}
                        onChange={(event) => setUploadTitle(event.target.value)}
                        placeholder="Chapter 4 Notes"
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Choose file</span>
                      <input
                        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
                        type="file"
                        required
                      />
                    </label>
                    <div className="inline-fields">
                      <label className="field">
                        <span>Difficulty</span>
                        <select
                          value={topicForm.difficulty}
                          onChange={(event) => setTopicForm((form) => ({ ...form, difficulty: event.target.value }))}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </label>
                      <label className="field">
                        <span>Question count</span>
                        <input
                          min="1"
                          max="20"
                          type="number"
                          value={topicForm.count}
                          onChange={(event) => setTopicForm((form) => ({ ...form, count: event.target.value }))}
                        />
                      </label>
                    </div>
                    <button className="primary-button" disabled={loading} type="submit">
                      Upload and Build
                    </button>
                  </form>

                  <aside className="build-steps-panel">
                    <h2>Best for</h2>
                    <ol>
                      <li>
                        <strong>Course PDFs</strong>
                        <span>Turn lessons, notes, and handouts into quiz drafts.</span>
                      </li>
                      <li>
                        <strong>Workshop material</strong>
                        <span>Create recap quizzes from training documents.</span>
                      </li>
                      <li>
                        <strong>Readiness checks</strong>
                        <span>Convert study material into a focused assessment.</span>
                      </li>
                    </ol>
                  </aside>
                </div>
              ) : null}

              {activeMode === "campaign" ? (
                <div className="build-grid build-grid-single">
                  <section className="panel build-primary-panel build-campaign-panel">
                    <p className="eyebrow">Template Builder</p>
                    <h3>Use a ranked challenge template</h3>
                    <p>
                      Start with scholarship qualifiers, top-100 challenges, course readiness tests,
                      or skill score quizzes.
                    </p>
                    <div className="campaign-template-list">
                      <span>Course Scholarship Mega Challenge</span>
                      <span>JEE Main Scholarship Qualifier</span>
                      <span>Data Science Career Readiness Quiz</span>
                      <span>Digital Marketing Skill Score</span>
                    </div>
                    <Link className="primary-button" to="/templates">
                      Browse templates
                    </Link>
                  </section>

                  <aside className="build-steps-panel">
                    <h2>Template flow</h2>
                    <ol>
                      <li>
                        <strong>Pick a template</strong>
                        <span>Choose the audience and offer, such as top 3 free course seats.</span>
                      </li>
                      <li>
                        <strong>Launch with a unique code</strong>
                        <span>Share the join link in bulk messages or ads.</span>
                      </li>
                      <li>
                        <strong>Review ranked participants</strong>
                        <span>Use leaderboard and reports to follow up with the right learners.</span>
                      </li>
                    </ol>
                  </aside>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default BuildPage;
