import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  aiEditQuiz,
  deleteQuestion,
  fetchQuizById,
  getQuizReportCsvUrl,
  publishQuiz,
  updateQuestion,
  updateQuizSettings,
} from "../services/api";
import themePresets from "../data/themePresets";

const PLAYER_URL = import.meta.env.VITE_PLAYER_URL || "http://localhost:3001";

const workflowSteps = [
  { id: "review", label: "Review", caption: "Validate questions" },
  { id: "customize", label: "Customize", caption: "Tune settings" },
  { id: "preview", label: "Preview", caption: "Player view" },
  { id: "publish", label: "Publish", caption: "Open access" },
  { id: "launch", label: "Launch", caption: "Run live" },
];

function getQuizId(quiz, routeQuizId) {
  return routeQuizId || quiz?._id || quiz?.id;
}

function defaultTheme() {
  return {
    preset: "aurora",
    primaryColor: "#2563eb",
    accentColor: "#f59e0b",
    backgroundColor: "#0f172a",
    fontFamily: "Inter",
    logoText: "Quivora Live",
    coverImageUrl: "",
    playerStyle: "vibrant",
  };
}

function defaultSharing(quiz) {
  return {
    visibility: quiz?.sharing?.visibility || "public",
    accessPassword: "",
    availableFrom: toDateTimeInput(quiz?.sharing?.availableFrom),
    availableUntil: toDateTimeInput(quiz?.sharing?.availableUntil),
    maxParticipants: quiz?.sharing?.maxParticipants || 0,
    reusableLink: quiz?.sharing?.reusableLink !== false,
    customSlug: quiz?.sharing?.customSlug || "",
    embedEnabled: quiz?.sharing?.embedEnabled !== false,
  };
}

function defaultIntegrations(quiz) {
  return {
    googleSheetsEnabled: quiz?.integrations?.googleSheetsEnabled !== false,
    googleDriveImportUrl: quiz?.integrations?.googleDriveImportUrl || "",
    webhookUrl: quiz?.integrations?.webhookUrl || "",
    notificationEmail: quiz?.integrations?.notificationEmail || "",
  };
}

function toDateTimeInput(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function QuizReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { quizId } = useParams();

  const [activeStep, setActiveStep] = useState("review");
  const [quiz, setQuiz] = useState(location.state?.quiz || null);
  const [questions, setQuestions] = useState(location.state?.quiz?.questions || []);
  const [settingsDraft, setSettingsDraft] = useState({
    title: location.state?.quiz?.title || "",
    description: location.state?.quiz?.description || "",
    category: location.state?.quiz?.category || "general",
    questionTimeLimitSeconds: location.state?.quiz?.questionTimeLimitSeconds || 20,
    resultsWindowSeconds: location.state?.quiz?.resultsWindowSeconds || 5,
    adaptiveMode: Boolean(location.state?.quiz?.adaptiveMode),
    randomizeQuestions: Boolean(location.state?.quiz?.randomizeQuestions),
    randomizeOptions: Boolean(location.state?.quiz?.randomizeOptions),
    mode: location.state?.quiz?.mode || "live",
    theme: location.state?.quiz?.theme || defaultTheme(),
    sharing: defaultSharing(location.state?.quiz),
    integrations: defaultIntegrations(location.state?.quiz),
  });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [previewIndex, setPreviewIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiPreview, setAiPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const resolvedQuizId = getQuizId(quiz, quizId);

  useEffect(() => {
    async function loadQuiz() {
      const id = getQuizId(quiz, quizId);

      if (!id) {
        return;
      }

      try {
        const data = await fetchQuizById(id);
        setQuiz(data);
        setQuestions(data.questions || []);
        setSettingsDraft({
          title: data.title || "",
          description: data.description || "",
          category: data.category || "general",
          questionTimeLimitSeconds: data.questionTimeLimitSeconds || 20,
          resultsWindowSeconds: data.resultsWindowSeconds || 5,
          adaptiveMode: Boolean(data.adaptiveMode),
          randomizeQuestions: Boolean(data.randomizeQuestions),
          randomizeOptions: Boolean(data.randomizeOptions),
          mode: data.mode || "live",
          theme: data.theme || defaultTheme(),
          sharing: defaultSharing(data),
          integrations: defaultIntegrations(data),
        });
      } catch (err) {
        setStatus(err.message);
      }
    }

    loadQuiz();
  }, [quizId]);

  const workflowStatus = useMemo(() => {
    const hasQuestions = questions.length > 0;
    const isPublished = quiz?.status === "published";

    return {
      review: hasQuestions ? "complete" : "attention",
      customize: settingsDraft.title.trim() ? "complete" : "attention",
      preview: hasQuestions ? "complete" : "locked",
      publish: isPublished ? "complete" : hasQuestions ? "ready" : "locked",
      launch: isPublished ? "ready" : "locked",
    };
  }, [questions.length, quiz?.status, settingsDraft.title]);

  const activeQuestion = questions[previewIndex] || questions[0] || null;

  function goToStep(stepId) {
    if (workflowStatus[stepId] === "locked") {
      setStatus("Complete the earlier workflow steps first.");
      return;
    }
    setActiveStep(stepId);
    setStatus("");
  }

  function startEdit(question) {
    setEditingId(question._id || question.id);
    setEditDraft({
      prompt: question.prompt,
      options: [...(question.options || [])],
      correctOptionIndex: question.correctOptionIndex,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({});
  }

  async function saveEdit(question) {
    const questionId = question._id || question.id;

    if (!editDraft.prompt?.trim()) {
      setStatus("Question prompt is required.");
      return;
    }

    if (
      !Array.isArray(editDraft.options) ||
      editDraft.options.length < 2 ||
      editDraft.options.some((option) => !option.trim())
    ) {
      setStatus("Each question needs at least two non-empty options.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const updated = await updateQuestion(resolvedQuizId, questionId, {
        ...editDraft,
        options: editDraft.options.map((option) => option.trim()),
        prompt: editDraft.prompt.trim(),
      });
      setQuestions((current) =>
        current.map((item) =>
          item._id === questionId || item.id === questionId ? { ...item, ...updated } : item
        )
      );
      setEditingId(null);
      setEditDraft({});
      setStatus("Question saved.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(question) {
    const questionId = question._id || question.id;

    if (!window.confirm("Remove this question?")) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await deleteQuestion(resolvedQuizId, questionId);
      setQuestions((current) =>
        current.filter((item) => item._id !== questionId && item.id !== questionId)
      );
      setPreviewIndex(0);
      setStatus("Question removed.");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function previewAiEdit() {
    const instruction = aiInstruction.trim();
    if (!instruction) {
      setStatus("Enter an AI edit instruction first.");
      return;
    }
    setLoading(true);
    setStatus("Previewing AI edit...");
    try {
      const result = await aiEditQuiz(resolvedQuizId, { instruction, previewOnly: true });
      setAiPreview(result);
      setStatus(result.message);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function applyAiEdit() {
    const instruction = aiInstruction.trim();
    if (!instruction) return;
    setLoading(true);
    setStatus("Applying AI edit...");
    try {
      const result = await aiEditQuiz(resolvedQuizId, { instruction });
      setQuiz(result.quiz);
      setQuestions(result.quiz.questions || []);
      setAiPreview(null);
      setAiInstruction("");
      setStatus(result.message);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!settingsDraft.title.trim()) {
      setStatus("Quiz title is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const sharingPayload = {
        ...settingsDraft.sharing,
        maxParticipants: Number(settingsDraft.sharing?.maxParticipants || 0),
        availableFrom: settingsDraft.sharing?.availableFrom || null,
        availableUntil: settingsDraft.sharing?.availableUntil || null,
      };

      if (!settingsDraft.sharing?.accessPassword && quiz?.sharing?.hasPassword) {
        delete sharingPayload.accessPassword;
      }

      const updated = await updateQuizSettings(resolvedQuizId, {
        ...settingsDraft,
        questionTimeLimitSeconds: Number(settingsDraft.questionTimeLimitSeconds),
        resultsWindowSeconds: Number(settingsDraft.resultsWindowSeconds),
        adaptiveMode: Boolean(settingsDraft.adaptiveMode),
        randomizeQuestions: Boolean(settingsDraft.randomizeQuestions),
        randomizeOptions: Boolean(settingsDraft.randomizeOptions),
        mode: settingsDraft.mode || "live",
        theme: settingsDraft.theme,
        sharing: sharingPayload,
        integrations: settingsDraft.integrations,
      });
      setQuiz(updated);
      setQuestions(updated.questions || questions);
      setStatus("Quiz settings saved.");
      setActiveStep("preview");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (questions.length === 0) {
      setStatus("Add at least one question before publishing.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const updated = await publishQuiz(resolvedQuizId);
      setQuiz((current) => ({ ...current, ...updated, status: "published" }));
      setStatus("Quiz published. It is ready to launch.");
      setActiveStep("launch");
    } catch (err) {
      setStatus(err.message);
    } finally {
      setLoading(false);
    }
  }

  function renderReviewStep() {
    return (
      <section className="workflow-stage">
        <div className="stage-heading">
          <div>
            <p className="eyebrow">Step 1</p>
            <h3>Review generated questions</h3>
          </div>
          <button
            className="primary-button"
            disabled={questions.length === 0}
            onClick={() => setActiveStep("customize")}
            type="button"
          >
            Continue to Customize
          </button>
        </div>

        <div className="review-list">
          <div className="workspace-panel">
            <p className="eyebrow">AI Edit</p>
            <h3>Prompt-edit this quiz</h3>
            <label className="field">
              <span>Instruction</span>
              <input
                value={aiInstruction}
                onChange={(event) => setAiInstruction(event.target.value)}
                placeholder="Make question 2 easier, add explanations, add 3 harder questions"
              />
            </label>
            <div className="compact-actions">
              <button className="secondary-button compact-button" disabled={loading} onClick={previewAiEdit} type="button">
                Preview edit
              </button>
              <button className="primary-button compact-button" disabled={loading || !aiPreview} onClick={applyAiEdit} type="button">
                Apply preview
              </button>
            </div>
            {aiPreview ? (
              <p className="status-note">{aiPreview.actions?.join("; ")}</p>
            ) : null}
          </div>

          {questions.length === 0 ? (
            <div className="empty-state">No questions. Go back and generate another draft.</div>
          ) : null}

          {questions.map((question, index) => {
            const questionId = question._id || question.id;
            const isEditing = editingId === questionId;

            return (
              <article className="review-question" key={questionId}>
                <div className="question-row">
                  <p className="question-number">Q{index + 1}</p>
                  {!isEditing ? (
                    <div className="compact-actions">
                      <button className="secondary-button compact-button" onClick={() => startEdit(question)} type="button">
                        Edit
                      </button>
                      <button className="danger-button compact-button" onClick={() => handleDelete(question)} type="button">
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="edit-stack">
                    <label className="field">
                      <span>Question prompt</span>
                      <textarea
                        onChange={(event) =>
                          setEditDraft((current) => ({ ...current, prompt: event.target.value }))
                        }
                        rows={3}
                        value={editDraft.prompt}
                      />
                    </label>

                    {editDraft.options.map((option, optionIndex) => (
                      <label className="field" key={optionIndex}>
                        <span>
                          Option {String.fromCharCode(65 + optionIndex)}
                          {editDraft.correctOptionIndex === optionIndex ? " - correct" : ""}
                        </span>
                        <div className="option-edit-row">
                          <input
                            onChange={(event) => {
                              const nextOptions = [...editDraft.options];
                              nextOptions[optionIndex] = event.target.value;
                              setEditDraft((current) => ({ ...current, options: nextOptions }));
                            }}
                            value={option}
                          />
                          <button
                            className="secondary-button compact-button"
                            disabled={editDraft.correctOptionIndex === optionIndex}
                            onClick={() =>
                              setEditDraft((current) => ({
                                ...current,
                                correctOptionIndex: optionIndex,
                              }))
                            }
                            type="button"
                          >
                            Correct
                          </button>
                        </div>
                      </label>
                    ))}

                    <div className="compact-actions">
                      <button className="primary-button" disabled={loading} onClick={() => saveEdit(question)} type="button">
                        {loading ? <span className="spinner-label"><span className="spinner" /> Saving</span> : "Save"}
                      </button>
                      <button className="secondary-button" onClick={cancelEdit} type="button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="question-preview">
                    <div className="compact-actions">
                      <span className="status-note">Quality {question.qualityScore || 70}/100</span>
                      <span className="status-note">
                        {question.qualityMeta?.blooms || "understand"} · {question.qualityMeta?.ambiguityRisk || "medium"} risk
                      </span>
                    </div>
                    <p className="question-prompt">{question.prompt}</p>
                    <div className="review-options">
                      {(question.options || []).map((option, optionIndex) => (
                        <p
                          className={
                            question.correctOptionIndex === optionIndex
                              ? "review-option correct"
                              : "review-option"
                          }
                          key={`${questionId}-${optionIndex}`}
                        >
                          <span>{String.fromCharCode(65 + optionIndex)}</span>
                          {option}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderCustomizeStep() {
    function applyPreset(preset) {
      setSettingsDraft((current) => ({
        ...current,
        theme: {
          ...current.theme,
          ...preset,
          preset: preset.id,
        },
      }));
    }

    function updateSharing(key, value) {
      setSettingsDraft((current) => ({
        ...current,
        sharing: {
          ...current.sharing,
          [key]: value,
        },
      }));
    }

    function updateIntegration(key, value) {
      setSettingsDraft((current) => ({
        ...current,
        integrations: {
          ...current.integrations,
          [key]: value,
        },
      }));
    }

    const shareTarget = settingsDraft.sharing?.customSlug || quiz?.joinCode || "";
    const joinLink = shareTarget ? `${PLAYER_URL}/live?code=${shareTarget}` : `${PLAYER_URL}/`;
    const embedCode = `<iframe src="${joinLink}" width="100%" height="720" title="${settingsDraft.title || "Live Quiz"}"></iframe>`;

    return (
      <section className="workflow-stage">
        <div className="stage-heading">
          <div>
            <p className="eyebrow">Step 2</p>
            <h3>Customize quiz settings</h3>
          </div>
          <button className="primary-button" disabled={loading} onClick={handleSaveSettings} type="button">
            {loading ? <span className="spinner-label"><span className="spinner" /> Saving</span> : "Save and Preview"}
          </button>
        </div>

        <div className="customize-grid">
          <label className="field">
            <span>Quiz title</span>
            <input
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, title: event.target.value }))
              }
              value={settingsDraft.title}
            />
          </label>
          <label className="field">
            <span>Category</span>
            <input
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, category: event.target.value }))
              }
              value={settingsDraft.category}
            />
          </label>
          <label className="field field-wide">
            <span>Description</span>
            <textarea
              onChange={(event) =>
                setSettingsDraft((current) => ({ ...current, description: event.target.value }))
              }
              rows={3}
              value={settingsDraft.description}
            />
          </label>
          <label className="field">
            <span>Seconds per question</span>
            <input
              max="120"
              min="5"
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  questionTimeLimitSeconds: event.target.value,
                }))
              }
              type="number"
              value={settingsDraft.questionTimeLimitSeconds}
            />
          </label>
          <label className="field">
            <span>Answer summary seconds</span>
            <input
              max="30"
              min="1"
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  resultsWindowSeconds: event.target.value,
                }))
              }
              type="number"
              value={settingsDraft.resultsWindowSeconds}
            />
          </label>
          <label className="toggle-row field-wide">
            <input
              checked={Boolean(settingsDraft.adaptiveMode)}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  adaptiveMode: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>Adaptive difficulty ordering</span>
          </label>
          <label className="toggle-row field-wide">
            <input
              checked={Boolean(settingsDraft.randomizeQuestions)}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  randomizeQuestions: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>Randomize question order</span>
          </label>
          <label className="toggle-row field-wide">
            <input
              checked={Boolean(settingsDraft.randomizeOptions)}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  randomizeOptions: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>Randomize option order per player</span>
          </label>
          <label className="field field-wide">
            <span>Delivery mode</span>
            <select
              value={settingsDraft.mode || "live"}
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  mode: event.target.value,
                }))
              }
            >
              <option value="live">Live hosted session</option>
              <option value="async">Self-paced link</option>
            </select>
          </label>
          <div className="settings-section field-wide">
            <div>
              <p className="eyebrow">Sharing Controls</p>
              <h4>Audience, limits, and public links</h4>
            </div>
            <div className="customize-grid inner-grid">
              <label className="field">
                <span>Access</span>
                <select
                  onChange={(event) => updateSharing("visibility", event.target.value)}
                  value={settingsDraft.sharing?.visibility || "public"}
                >
                  <option value="public">Public</option>
                  <option value="private">Private with password</option>
                </select>
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  onChange={(event) => updateSharing("accessPassword", event.target.value)}
                  placeholder={quiz?.sharing?.hasPassword ? "Leave blank to keep current" : "Optional password"}
                  type="password"
                  value={settingsDraft.sharing?.accessPassword || ""}
                />
              </label>
              <label className="field">
                <span>Starts at</span>
                <input
                  onChange={(event) => updateSharing("availableFrom", event.target.value)}
                  type="datetime-local"
                  value={settingsDraft.sharing?.availableFrom || ""}
                />
              </label>
              <label className="field">
                <span>Ends at</span>
                <input
                  onChange={(event) => updateSharing("availableUntil", event.target.value)}
                  type="datetime-local"
                  value={settingsDraft.sharing?.availableUntil || ""}
                />
              </label>
              <label className="field">
                <span>Max participants</span>
                <input
                  min="0"
                  onChange={(event) => updateSharing("maxParticipants", event.target.value)}
                  type="number"
                  value={settingsDraft.sharing?.maxParticipants || 0}
                />
              </label>
              <label className="field">
                <span>Custom slug</span>
                <input
                  onChange={(event) => updateSharing("customSlug", event.target.value)}
                  placeholder="python-basics-live"
                  value={settingsDraft.sharing?.customSlug || ""}
                />
              </label>
              <label className="toggle-field">
                <input
                  checked={settingsDraft.sharing?.reusableLink !== false}
                  onChange={(event) => updateSharing("reusableLink", event.target.checked)}
                  type="checkbox"
                />
                <span>Reusable player link</span>
              </label>
              <label className="toggle-field">
                <input
                  checked={settingsDraft.sharing?.embedEnabled !== false}
                  onChange={(event) => updateSharing("embedEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span>Allow embed code</span>
              </label>
            </div>
            <div className="share-preview">
              <div>
                <span>Join link</span>
                <strong>{joinLink}</strong>
              </div>
              {settingsDraft.sharing?.embedEnabled !== false ? (
                <label className="field">
                  <span>Embed code</span>
                  <textarea readOnly rows={3} value={embedCode} />
                </label>
              ) : null}
            </div>
          </div>
          <div className="settings-section field-wide">
            <div>
              <p className="eyebrow">Integrations</p>
              <h4>Exports, saved references, webhooks, and notification setup</h4>
            </div>
            <div className="integration-status-grid">
              <span>CSV export: active for reports</span>
              <span>Drive URL: saved as source reference</span>
              <span>Webhook: sends launch/report events when URL is set</span>
              <span>Email: setup field only until a mail provider is connected</span>
            </div>
            <div className="customize-grid inner-grid">
              <label className="toggle-field">
                <input
                  checked={settingsDraft.integrations?.googleSheetsEnabled !== false}
                  onChange={(event) => updateIntegration("googleSheetsEnabled", event.target.checked)}
                  type="checkbox"
                />
                <span>Enable Google Sheets compatible CSV export</span>
              </label>
              <a
                className="integration-link"
                href={resolvedQuizId ? getQuizReportCsvUrl(resolvedQuizId) : "#"}
              >
                Download report CSV
              </a>
              <label className="field field-wide">
                <span>Google Drive import URL</span>
                <input
                  onChange={(event) => updateIntegration("googleDriveImportUrl", event.target.value)}
                  placeholder="Paste a shareable Drive document link"
                  value={settingsDraft.integrations?.googleDriveImportUrl || ""}
                />
              </label>
              <label className="field field-wide">
                <span>Webhook URL</span>
                <input
                  onChange={(event) => updateIntegration("webhookUrl", event.target.value)}
                  placeholder="https://example.com/webhooks/quiz"
                  value={settingsDraft.integrations?.webhookUrl || ""}
                />
              </label>
              <label className="field field-wide">
                <span>Email for launch/report notifications</span>
                <input
                  onChange={(event) => updateIntegration("notificationEmail", event.target.value)}
                  placeholder="admin@example.com"
                  type="email"
                  value={settingsDraft.integrations?.notificationEmail || ""}
                />
              </label>
            </div>
          </div>
          <div className="field field-wide">
            <span>Theme presets</span>
            <div className="theme-preset-grid">
              {themePresets.map((preset) => (
                <button
                  className={
                    settingsDraft.theme?.preset === preset.id
                      ? "theme-preset active"
                      : "theme-preset"
                  }
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  type="button"
                >
                  <span
                    className="theme-swatch"
                    style={{
                      "--swatch-primary": preset.primaryColor,
                      "--swatch-accent": preset.accentColor,
                      "--swatch-bg": preset.backgroundColor,
                    }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Logo text</span>
            <input
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  theme: { ...current.theme, logoText: event.target.value },
                }))
              }
              value={settingsDraft.theme?.logoText || ""}
            />
          </label>
          <label className="field">
            <span>Cover image URL</span>
            <input
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  theme: { ...current.theme, coverImageUrl: event.target.value },
                }))
              }
              placeholder="https://..."
              value={settingsDraft.theme?.coverImageUrl || ""}
            />
          </label>
          <label className="field">
            <span>Font style</span>
            <select
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  theme: { ...current.theme, fontFamily: event.target.value },
                }))
              }
              value={settingsDraft.theme?.fontFamily || "Inter"}
            >
              <option value="Inter">Inter</option>
              <option value="Segoe UI">Segoe UI</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
            </select>
          </label>
          <label className="field">
            <span>Player screen style</span>
            <select
              onChange={(event) =>
                setSettingsDraft((current) => ({
                  ...current,
                  theme: { ...current.theme, playerStyle: event.target.value },
                }))
              }
              value={settingsDraft.theme?.playerStyle || "vibrant"}
            >
              <option value="vibrant">Vibrant</option>
              <option value="focus">Focus</option>
              <option value="calm">Calm</option>
            </select>
          </label>
        </div>
      </section>
    );
  }

  function renderPreviewStep() {
    return (
      <section className="workflow-stage">
        <div className="stage-heading">
          <div>
            <p className="eyebrow">Step 3</p>
            <h3>Preview as player</h3>
          </div>
          <button className="primary-button" onClick={() => setActiveStep("publish")} type="button">
            Continue to Publish
          </button>
        </div>

        <div className="preview-grid">
          <aside className="preview-rail">
            {questions.map((question, index) => (
              <button
                className={previewIndex === index ? "preview-dot active" : "preview-dot"}
                key={question._id || question.id}
                onClick={() => setPreviewIndex(index)}
                type="button"
              >
                Q{index + 1}
              </button>
            ))}
          </aside>
          <article
            className={`player-preview-card player-preview-${settingsDraft.theme?.playerStyle || "vibrant"}`}
            style={{
              "--player-primary": settingsDraft.theme?.primaryColor || "#2563eb",
              "--player-accent": settingsDraft.theme?.accentColor || "#f59e0b",
              "--player-bg": settingsDraft.theme?.backgroundColor || "#0f172a",
              fontFamily: settingsDraft.theme?.fontFamily || "Inter",
            }}
          >
            <div className="live-topbar-preview">
              <div>
                <p className="eyebrow">{settingsDraft.theme?.logoText || "Quivora Live"}</p>
                <h3>{settingsDraft.title || quiz?.title || "Untitled quiz"}</h3>
              </div>
              <span className="timer-preview">{settingsDraft.questionTimeLimitSeconds}s</span>
            </div>
            <div className="question-meta-preview">
              <span>
                Question {previewIndex + 1} / {questions.length}
              </span>
              <span>{settingsDraft.category || "general"}</span>
            </div>
            {settingsDraft.theme?.coverImageUrl ? (
              <img
                alt="Quiz cover preview"
                className="player-cover-preview"
                src={settingsDraft.theme.coverImageUrl}
              />
            ) : null}
            <h4>{activeQuestion?.prompt || "No question selected"}</h4>
            <div className="preview-options">
              {(activeQuestion?.options || []).map((option, index) => (
                <button className="preview-option" key={`${activeQuestion?.id || activeQuestion?._id}-${index}`} type="button">
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>
    );
  }

  function renderPublishStep() {
    const isPublished = quiz?.status === "published";

    return (
      <section className="workflow-stage">
        <div className="publish-panel">
          <p className="eyebrow">Step 4</p>
          <h3>{isPublished ? "Quiz is published" : "Publish when everything is ready"}</h3>
          <p className="support-copy">
            Publishing opens the join code for participants and prepares the quiz for live launch.
          </p>
          <div className="publish-checklist">
            <span className="check-item complete">Questions reviewed</span>
            <span className="check-item complete">Settings configured</span>
            <span className="check-item complete">Player preview checked</span>
            <span className={isPublished ? "check-item complete" : "check-item"}>Join code enabled</span>
          </div>
          <div className="compact-actions">
            <button className="secondary-button" onClick={() => setActiveStep("preview")} type="button">
              Back to Preview
            </button>
            <button
              className="primary-button"
              disabled={loading || questions.length === 0 || isPublished}
              onClick={handlePublish}
              type="button"
            >
              {isPublished ? "Published" : loading ? <span className="spinner-label"><span className="spinner" /> Publishing</span> : "Publish Quiz"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  function renderLaunchStep() {
    const isPublished = quiz?.status === "published";
    const shareTarget = settingsDraft.sharing?.customSlug || quiz?.joinCode || "";
    const playerLink = shareTarget ? `${PLAYER_URL}/live?code=${shareTarget}` : `${PLAYER_URL}/`;
    const isAsync = (settingsDraft.mode || quiz?.mode) === "async";

    return (
      <section className="workflow-stage">
        <div className="launch-panel">
          <p className="eyebrow">Step 5</p>
          <h3>{isAsync ? "Share the self-paced link" : "Launch the live room"}</h3>
          <p className="support-copy">
            {isAsync
              ? "Share this link with participants. They can complete the quiz without a host being online."
              : "Create a live room, share the QR code, monitor joined participants, and start the quiz from Active quizzes."}
          </p>
          <div className="launch-summary">
            <span>{isAsync ? "Self-paced link" : "Join code"}</span>
            <strong>{isAsync ? playerLink : quiz?.joinCode || "Available after publish"}</strong>
          </div>
          <div className="compact-actions">
            <button className="secondary-button" onClick={() => navigate("/")} type="button">
              Back to Workspace
            </button>
            {isAsync ? (
              <a className={isPublished ? "primary-button" : "primary-button disabled"} href={isPublished ? playerLink : undefined} target="_blank" rel="noreferrer">
                Open Self-Paced Link
              </a>
            ) : (
              <button
                className="primary-button"
                disabled={!isPublished}
                onClick={() => navigate("/active-quizzes", { state: { quiz } })}
                type="button"
              >
                Create Live Room
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderActiveStep() {
    if (activeStep === "customize") {
      return renderCustomizeStep();
    }
    if (activeStep === "preview") {
      return renderPreviewStep();
    }
    if (activeStep === "publish") {
      return renderPublishStep();
    }
    if (activeStep === "launch") {
      return renderLaunchStep();
    }
    return renderReviewStep();
  }

  return (
    <div className="page-stack">
      <section className="workflow-hero animate-rise">
        <div>
          <p className="eyebrow">Builder Workflow</p>
          <h2>{quiz?.title || "Quiz Review"}</h2>
          <p className="support-copy">
            Generate to launch, with each step separated so the quiz is easy to inspect and run.
          </p>
        </div>
        {status ? <div className="status-pill">{status}</div> : null}
      </section>

      <section className="workflow-shell animate-rise">
        <aside className="workflow-stepper">
          {workflowSteps.map((step, index) => (
            <button
              className={activeStep === step.id ? "workflow-step active" : "workflow-step"}
              key={step.id}
              onClick={() => goToStep(step.id)}
              type="button"
            >
              <span>{index + 1}</span>
              <div>
                <strong>{step.label}</strong>
                <p>{step.caption}</p>
              </div>
              <em>{workflowStatus[step.id]}</em>
            </button>
          ))}
        </aside>
        <div className="workflow-content">{renderActiveStep()}</div>
      </section>
    </div>
  );
}

export default QuizReviewPage;
