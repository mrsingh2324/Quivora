import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchQuizzes, globalSearch } from "../services/api";

const staticResults = [
  { type: "Action", title: "Build a quiz", description: "Generate from a topic or upload a document.", to: "/build", keywords: "create build generate ai quiz topic upload document" },
  { type: "Template", title: "Coding Interview Templates", description: "Ready quiz templates for technical interviews.", to: "/templates", keywords: "coding interview templates algorithms python javascript" },
  { type: "Template", title: "School Exam Templates", description: "Classroom tests, recap quizzes, and knowledge checks.", to: "/templates", keywords: "school exam test classroom education" },
  { type: "Template", title: "Corporate Training Templates", description: "Post-workshop and internal training assessments.", to: "/templates", keywords: "corporate training workshop onboarding compliance" },
  { type: "Template", title: "Course Scholarship Mega Challenge", description: "Top-100 ranked challenge where the top 3 win free course access.", to: "/templates", keywords: "scholarship ranked challenge top 100 top 3 course free access" },
  { type: "Template", title: "NEET Readiness Rank Challenge", description: "Medical entrance diagnostic for student readiness checks.", to: "/templates", keywords: "neet medical entrance rank challenge students" },
  { type: "Template", title: "JEE Main Scholarship Qualifier", description: "Engineering aspirant scholarship quiz template.", to: "/templates", keywords: "jee engineering scholarship qualifier quiz" },
  { type: "Template", title: "Data Science Career Readiness Quiz", description: "Readiness template for analytics and data science courses.", to: "/templates", keywords: "data science analytics career readiness" },
  { type: "Template", title: "AWS/DevOps Quiz Templates", description: "Cloud, CI/CD, containers, and operations checks.", to: "/templates", keywords: "aws devops cloud kubernetes docker" },
  { type: "Product", title: "Quiz Builder", description: "Create, edit, publish, and launch quizzes.", to: "/products", keywords: "quiz builder product create edit publish" },
  { type: "Product", title: "Live Session Manager", description: "Host quizzes with join codes and QR links.", to: "/products", keywords: "live session launch host join code qr" },
  { type: "Product", title: "Report Builder", description: "Review scores, attempts, and hardest questions.", to: "/products", keywords: "reports analytics scores results csv" },
  { type: "Support", title: "Help Center", description: "Guides for quiz creation, live rooms, and reports.", to: "/support/help-center", keywords: "help center guide support docs" },
  { type: "Support", title: "Contact Support", description: "Get help with workspace and account issues.", to: "/account/support-requests", keywords: "contact support ticket issue" },
  { type: "Account", title: "Profile and Settings", description: "Open account, workspace, and support options.", to: "/account/profile", keywords: "profile settings support logout" },
];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function resultScore(result, query) {
  const haystack = normalize(`${result.title} ${result.description} ${result.keywords || ""}`);
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function GlobalSearchBar({ placeholder = "Search across quizzes, templates, products, support...", revealOnScroll = true }) {
  const navigate = useNavigate();
  const shellRef = useRef(null);
  const [query, setQuery] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [remoteResults, setRemoteResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(!revealOnScroll);

  useEffect(() => {
    let active = true;
    fetchQuizzes()
      .then((data) => {
        if (active) setQuizzes(data);
      })
      .catch(() => {
        if (active) setQuizzes([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRemoteResults([]);
      return undefined;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      globalSearch({ q: trimmed, limit: 10 })
        .then((data) => {
          if (active) setRemoteResults(Array.isArray(data) ? data : []);
        })
        .catch(() => {
          if (active) setRemoteResults([]);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!revealOnScroll) return undefined;

    function handleScroll() {
      setVisible(window.scrollY > 72);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [revealOnScroll]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (shellRef.current && !shellRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const quizResults = useMemo(
    () =>
      quizzes.map((quiz) => ({
        id: quiz.id || quiz._id || quiz.joinCode || quiz.title,
        type: "Quiz",
        title: quiz.title,
        description: `${quiz.totalQuestions || 0} questions · ${quiz.status || "draft"} · Launch to create a join code`,
        to: "/",
        keywords: `${quiz.category || ""} ${quiz.description || ""}`,
      })),
    [quizzes]
  );

  const results = useMemo(() => {
    const allResults = remoteResults.length ? remoteResults : [...quizResults, ...staticResults];
    const trimmed = query.trim();
    if (!trimmed) return allResults.slice(0, 7);

    if (remoteResults.length) return remoteResults.slice(0, 8);

    return allResults
      .map((result) => ({ ...result, score: resultScore(result, trimmed) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
      .slice(0, 8);
  }, [query, quizResults, remoteResults]);

  function submitSearch(event) {
    event.preventDefault();
    const target = results[0];
    if (!target) return;
    setOpen(false);
    navigate(target.to);
  }

  return (
    <div className={visible ? "global-search-shell visible" : "global-search-shell"} ref={shellRef}>
      <Link className="global-search-brand" to="/">
        <img className="workspace-logo" src="/quivora-icon.svg" alt="" />
        <strong>Quivora</strong>
      </Link>

      <form className="global-search-form" onSubmit={submitSearch}>
        <span className="global-search-icon">⌕</span>
        <input
          aria-label="Search the whole website"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
        />
        <button type="submit" aria-label="Open top search result">➤</button>

        {open ? (
          <div className="global-search-results">
            {results.length === 0 ? (
              <p>No results found. Try “templates”, “reports”, “create”, or a quiz title.</p>
            ) : (
              results.map((result, index) => (
                <Link
                  key={`${result.type}-${result.id || result.to}-${result.title}-${index}`}
                  to={result.to}
                  onMouseDown={() => setOpen(false)}
                >
                  <span>{result.type}</span>
                  <strong>{result.title}</strong>
                  <small>{result.description}</small>
                </Link>
              ))
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export default GlobalSearchBar;
