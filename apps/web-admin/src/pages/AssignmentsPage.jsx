import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import {
  createAssignment,
  fetchAssignments,
  fetchQuizzes,
  selectAssignment,
  updateAssignmentSelection,
} from "../services/api";

const emptyMaterial = { title: "", type: "note", body: "", url: "" };

function AssignmentsPage() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [statusText, setStatusText] = useState("Loading assignments...");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    quizId: "",
    difficulty: "medium",
    tags: "",
    material: emptyMaterial,
  });

  const isAdmin = ["admin", "admin_player"].includes(user?.role);

  async function loadAssignments() {
    try {
      const data = await fetchAssignments();
      setAssignments(data);
      setStatusText(data.length ? `${data.length} preparation assignment${data.length === 1 ? "" : "s"} available.` : "No assignments have been published yet.");
    } catch (error) {
      setStatusText(error.message);
    }
  }

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadQuizzes() {
      try {
        setQuizzes(await fetchQuizzes({ limit: 50 }));
      } catch {
        setQuizzes([]);
      }
    }

    loadQuizzes();
  }, [isAdmin]);

  const selectedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.selection),
    [assignments]
  );

  async function handleCreate(event) {
    event.preventDefault();
    setCreating(true);
    setStatusText("Publishing assignment...");

    try {
      const material = form.material.title.trim()
        ? [{ ...form.material, title: form.material.title.trim() }]
        : [];
      await createAssignment({
        title: form.title,
        description: form.description,
        quizId: form.quizId || null,
        difficulty: form.difficulty,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        materials: material,
        status: "published",
      });
      setForm({
        title: "",
        description: "",
        quizId: "",
        difficulty: "medium",
        tags: "",
        material: emptyMaterial,
      });
      await loadAssignments();
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleSelect(assignmentId) {
    setStatusText("Adding assignment to your preparation list...");
    try {
      await selectAssignment(assignmentId);
      await loadAssignments();
    } catch (error) {
      setStatusText(error.message);
    }
  }

  async function handleComplete(assignmentId) {
    setStatusText("Marking assignment complete...");
    try {
      await updateAssignmentSelection(assignmentId, { status: "completed", progressPercent: 100 });
      await loadAssignments();
    } catch (error) {
      setStatusText(error.message);
    }
  }

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search assignments, quizzes, prep materials..." />
      <main className="static-page-shell assignments-page">
        <section className="static-hero">
          <Link className="static-back-link" to="/">Back to workspace</Link>
          <p className="eyebrow">Preparation</p>
          <h1>Assignments</h1>
          <p>{statusText}</p>
        </section>

        {isAdmin ? (
          <form className="account-detail-panel assignment-builder" onSubmit={handleCreate}>
            <div className="create-panel-heading">
              <div>
                <p className="eyebrow">Admin</p>
                <h2>Create preparation assignment</h2>
              </div>
              <span>Publish quiz-linked prep for logged-in learners to select.</span>
            </div>
            <div className="inline-fields">
              <label className="field">
                <span>Title</span>
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label className="field">
                <span>Quiz</span>
                <select value={form.quizId} onChange={(event) => setForm((current) => ({ ...current, quizId: event.target.value }))}>
                  <option value="">Preparation material only</option>
                  {quizzes.map((quiz) => (
                    <option key={quiz.id || quiz._id} value={quiz.id || quiz._id}>{quiz.title}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="inline-fields">
              <label className="field">
                <span>Difficulty</span>
                <select value={form.difficulty} onChange={(event) => setForm((current) => ({ ...current, difficulty: event.target.value }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="field">
                <span>Tags</span>
                <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="python, interview, basics" />
              </label>
            </div>
            <div className="inline-fields">
              <label className="field">
                <span>Prep material title</span>
                <input value={form.material.title} onChange={(event) => setForm((current) => ({ ...current, material: { ...current.material, title: event.target.value } }))} />
              </label>
              <label className="field">
                <span>Material URL</span>
                <input value={form.material.url} onChange={(event) => setForm((current) => ({ ...current, material: { ...current.material, url: event.target.value, type: event.target.value ? "link" : "note" } }))} />
              </label>
            </div>
            <label className="field">
              <span>Prep notes</span>
              <textarea rows={3} value={form.material.body} onChange={(event) => setForm((current) => ({ ...current, material: { ...current.material, body: event.target.value } }))} />
            </label>
            <button className="primary-button" disabled={creating} type="submit">
              {creating ? "Publishing..." : "Publish assignment"}
            </button>
          </form>
        ) : null}

        <section className="assignments-layout">
          <div className="account-detail-panel">
            <div className="create-panel-heading">
              <div>
                <p className="eyebrow">Available</p>
                <h2>Preparation library</h2>
              </div>
              <span>Select assignments for your own preparation list.</span>
            </div>
            <div className="assignment-card-grid">
              {assignments.map((assignment) => (
                <article className="assignment-card" key={assignment.id}>
                  <span className={`status-badge status-${assignment.difficulty}`}>{assignment.difficulty}</span>
                  <h3>{assignment.title}</h3>
                  <p>{assignment.description || "Preparation assignment"}</p>
                  {assignment.quiz ? <strong>{assignment.quiz.totalQuestions} quiz questions</strong> : <strong>Material only</strong>}
                  {assignment.materials?.length ? (
                    <ul>
                      {assignment.materials.map((material) => (
                        <li key={material._id || material.title}>
                          {material.url ? <a href={material.url} target="_blank" rel="noreferrer">{material.title}</a> : material.title}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {assignment.selection ? (
                    <button className="secondary-button compact-button" type="button" onClick={() => handleComplete(assignment.id)} disabled={assignment.selection.status === "completed"}>
                      {assignment.selection.status === "completed" ? "Completed" : "Mark complete"}
                    </button>
                  ) : (
                    <button className="primary-button compact-button" type="button" onClick={() => handleSelect(assignment.id)}>
                      Select for prep
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>

          <aside className="account-detail-panel">
            <div className="create-panel-heading">
              <div>
                <p className="eyebrow">Mine</p>
                <h2>Selected prep</h2>
              </div>
            </div>
            {selectedAssignments.length === 0 ? (
              <p>No assignments selected yet.</p>
            ) : (
              selectedAssignments.map((assignment) => (
                <p key={assignment.id}>
                  <strong>{assignment.selection.status}</strong> {assignment.title}
                </p>
              ))
            )}
          </aside>
        </section>
      </main>
    </>
  );
}

export default AssignmentsPage;
