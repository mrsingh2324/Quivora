import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import { addQuestionToQuiz, createQuestionBankItem, fetchQuestionBank, fetchQuizzes } from "../services/api";

function QuestionBankPage() {
  const [questions, setQuestions] = useState([]);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [statusText, setStatusText] = useState("Loading question bank...");
  const [quizzes, setQuizzes] = useState([]);
  const [targetQuizId, setTargetQuizId] = useState("");
  const [form, setForm] = useState({
    prompt: "",
    options: ["", "", "", ""],
    correctOptionIndex: 0,
    difficulty: "medium",
    explanation: "",
    tags: "",
  });

  useEffect(() => {
    let active = true;

    fetchQuestionBank({ q: query, difficulty })
      .then((data) => {
        if (!active) return;
        setQuestions(data);
        setStatusText(data.length ? `${data.length} reusable question${data.length === 1 ? "" : "s"} found.` : "No questions match this filter.");
      })
      .catch((error) => {
        if (active) setStatusText(error.message);
      });

    return () => {
      active = false;
    };
  }, [query, difficulty]);

  useEffect(() => {
    fetchQuizzes({ limit: 50 }).then(setQuizzes).catch(() => setQuizzes([]));
  }, []);

  const sourceTypes = useMemo(
    () => Array.from(new Set(questions.map((question) => question.sourceType || "manual"))),
    [questions]
  );

  async function createQuestion(event) {
    event.preventDefault();
    setStatusText("Creating reusable question...");
    try {
      await createQuestionBankItem({
        ...form,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      setForm({ prompt: "", options: ["", "", "", ""], correctOptionIndex: 0, difficulty: "medium", explanation: "", tags: "" });
      setQuestions(await fetchQuestionBank({ q: query, difficulty }));
      setStatusText("Reusable question created.");
    } catch (error) {
      setStatusText(error.message);
    }
  }

  async function addToQuiz(questionId) {
    if (!targetQuizId) {
      setStatusText("Choose a target quiz first.");
      return;
    }
    try {
      await addQuestionToQuiz(questionId, targetQuizId);
      setQuestions(await fetchQuestionBank({ q: query, difficulty }));
      setStatusText("Question added to quiz.");
    } catch (error) {
      setStatusText(error.message);
    }
  }

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder="Search question bank, quizzes, topics..." />
      <main className="static-page-shell question-bank-page">
        <section className="static-hero">
          <Link className="static-back-link" to="/">Back to workspace</Link>
          <p className="eyebrow">Question Bank</p>
          <h1>Reusable questions</h1>
          <p>{statusText}</p>
        </section>

        <section className="account-detail-panel">
          <form className="support-request-form" onSubmit={createQuestion}>
            <div className="create-panel-heading">
              <div>
                <p className="eyebrow">Reusable</p>
                <h2>Add standalone question</h2>
              </div>
              <span>Quality score is calculated from clarity signals, duplicate options, and explanation coverage.</span>
            </div>
            <label className="field"><span>Prompt</span><input value={form.prompt} onChange={(event) => setForm((current) => ({ ...current, prompt: event.target.value }))} required /></label>
            <div className="workspace-create-grid">
              {form.options.map((option, index) => (
                <label className="field" key={index}>
                  <span>Option {index + 1}</span>
                  <input value={option} onChange={(event) => setForm((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} required />
                </label>
              ))}
            </div>
            <div className="inline-fields">
              <label className="field"><span>Correct option</span><select value={form.correctOptionIndex} onChange={(event) => setForm((current) => ({ ...current, correctOptionIndex: Number(event.target.value) }))}>{form.options.map((_, index) => <option key={index} value={index}>Option {index + 1}</option>)}</select></label>
              <label className="field"><span>Tags</span><input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="python, recursion" /></label>
            </div>
            <label className="field"><span>Explanation</span><textarea rows={3} value={form.explanation} onChange={(event) => setForm((current) => ({ ...current, explanation: event.target.value }))} /></label>
            <button className="primary-button" type="submit">Create question</button>
          </form>
          <div className="inline-fields">
            <label className="field">
              <span>Search prompt</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="recursion, SQL, IELTS..." />
            </label>
            <label className="field">
              <span>Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                <option value="">All difficulties</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label className="field">
              <span>Add selected questions to quiz</span>
              <select value={targetQuizId} onChange={(event) => setTargetQuizId(event.target.value)}>
                <option value="">Choose quiz</option>
                {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
              </select>
            </label>
          </div>
          {sourceTypes.length ? <p className="support-copy">Sources in view: {sourceTypes.join(", ")}</p> : null}
          <div className="question-bank-list">
            {questions.map((question) => (
              <article className="assignment-card" key={question.id}>
                <span className={`status-badge status-${question.difficulty}`}>{question.difficulty}</span>
                <h3>{question.prompt}</h3>
                <ol>
                  {question.options.map((option, index) => (
                    <li key={`${question.id}-${option}`}>
                      {option} {index === question.correctOptionIndex ? "(correct)" : ""}
                    </li>
                  ))}
                </ol>
                {question.explanation ? <p>{question.explanation}</p> : null}
                <p className="support-copy">Quality {question.qualityScore || 70}/100 · used {question.usageCount || 0} time{question.usageCount === 1 ? "" : "s"}</p>
                {question.qualityNotes?.length ? <small>{question.qualityNotes.join(" ")}</small> : null}
                <button className="primary-button compact-button" type="button" onClick={() => addToQuiz(question.id)}>Add to selected quiz</button>
                {question.quiz ? (
                  <Link className="secondary-button compact-button" to={`/quizzes/${question.quiz.id}/review`}>
                    Open {question.quiz.title}
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

export default QuestionBankPage;
