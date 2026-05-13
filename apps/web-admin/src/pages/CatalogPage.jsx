import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import GlobalSearchBar from "../components/GlobalSearchBar";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../context/AuthContext";
import { createQuiz } from "../services/api";

const marketplaceTemplates = [
  {
    title: "Coding Interview Templates",
    description: "Data structures, algorithms, language fundamentals, and senior engineer screening.",
    available: true,
    category: "Coding",
    count: "2,480",
    questions: [
      ["What does Big O describe?", ["Code style", "Algorithm complexity", "Variable naming", "Package size"], 1],
      ["Which structure is FIFO?", ["Stack", "Queue", "Tree", "Graph"], 1],
      ["What is a hash map optimized for?", ["Constant-time lookup", "Image rendering", "Sorting only", "Thread sleeping"], 0],
      ["Which traversal visits a tree level by level?", ["DFS", "BFS", "Binary search", "Merge sort"], 1],
      ["What should a good code review prioritize?", ["Correctness and maintainability", "Only formatting", "Long comments", "More dependencies"], 0],
    ],
  },
  {
    title: "School Exam Templates",
    description: "Classroom tests for science, math, language arts, history, and quick checks.",
    available: true,
    category: "Education",
    count: "6,993",
    questions: [
      ["Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Saturn"], 1],
      ["What is 12 x 8?", ["84", "92", "96", "108"], 2],
      ["A noun names what?", ["An action", "A person, place, or thing", "A description", "A question"], 1],
      ["Water freezes at what temperature in Celsius?", ["0", "32", "50", "100"], 0],
      ["Which source is primary?", ["Textbook summary", "Original diary", "Movie review", "Encyclopedia entry"], 1],
    ],
  },
  {
    title: "Corporate Training Templates",
    description: "Onboarding, policy, compliance, security awareness, and internal enablement checks.",
    available: true,
    category: "Business",
    count: "1,766",
    questions: [
      ["What is the first step after detecting a security incident?", ["Ignore it", "Report it", "Delete evidence", "Share publicly"], 1],
      ["A good onboarding quiz should verify what?", ["Role-critical knowledge", "Personal opinions", "Salary history", "Random trivia"], 0],
      ["Which data should be handled carefully?", ["Public blog posts", "PII", "Published docs", "Marketing slogans"], 1],
      ["What does compliance training reduce?", ["Policy risk", "Keyboard use", "Team size", "Network speed"], 0],
      ["When should passwords be shared?", ["Never", "With friends", "In chat", "In spreadsheets"], 0],
    ],
  },
  {
    title: "HR Screening Templates",
    description: "Role-fit screens for communication, culture, aptitude, and hiring workflows.",
    available: false,
    category: "Hiring",
    count: "Upcoming",
  },
  {
    title: "Cybersecurity Quiz Templates",
    description: "Phishing, access control, incident response, secure coding, and awareness quizzes.",
    available: false,
    category: "Security",
    count: "Upcoming",
  },
  {
    title: "AWS/DevOps Quiz Templates",
    description: "Cloud fundamentals, CI/CD, containers, Kubernetes, monitoring, and incident response.",
    available: false,
    category: "Cloud",
    count: "Upcoming",
  },
  {
    title: "Language Learning Templates",
    description: "Vocabulary, grammar, listening checks, translation practice, and speaking prep.",
    available: false,
    category: "Language",
    count: "Upcoming",
  },
  {
    title: "NEET Readiness Rank Challenge",
    description: "Run a free medical entrance diagnostic and identify counseling-ready learners.",
    available: true,
    category: "Entrance Exams",
    count: "1,840",
  },
  {
    title: "JEE Main Scholarship Qualifier",
    description: "Invite engineering aspirants to compete for a scholarship or free course seat.",
    available: true,
    category: "Entrance Exams",
    count: "2,120",
  },
  {
    title: "UPSC Foundation Diagnostic Test",
    description: "Find serious civil services aspirants and segment them by current preparation level.",
    available: true,
    category: "Entrance Exams",
    count: "1,480",
  },
  {
    title: "CAT Quant Percentile Challenge",
    description: "Create a short quantitative aptitude ranking quiz for MBA aspirants.",
    available: true,
    category: "Entrance Exams",
    count: "1,260",
  },
  {
    title: "Banking Exam Speed Test",
    description: "Attract banking aspirants with a timed reasoning and numeracy score challenge.",
    available: true,
    category: "Entrance Exams",
    count: "1,110",
  },
  {
    title: "SSC CGL Aptitude Benchmark",
    description: "Show candidates where they stand in aptitude basics.",
    available: true,
    category: "Entrance Exams",
    count: "990",
  },
  {
    title: "GATE CS Concept Check",
    description: "Qualify computer science GATE aspirants by operating system, DBMS, and DSA readiness.",
    available: true,
    category: "Tech Careers",
    count: "920",
  },
  {
    title: "CLAT Legal Reasoning Challenge",
    description: "Rank law entrance prospects with legal reasoning and reading-comprehension questions.",
    available: true,
    category: "Entrance Exams",
    count: "810",
  },
  {
    title: "CUET Commerce Readiness Test",
    description: "Capture commerce students looking for CUET prep and identify weak areas quickly.",
    available: true,
    category: "School & College",
    count: "880",
  },
  {
    title: "IELTS Band Predictor Quiz",
    description: "Give learners a quick English proficiency signal before a counseling call.",
    available: true,
    category: "Language",
    count: "1,330",
  },
  {
    title: "Spoken English Placement Quiz",
    description: "Place learners into beginner, intermediate, or advanced spoken English cohorts.",
    available: true,
    category: "Language",
    count: "1,760",
  },
  {
    title: "Data Science Career Readiness Quiz",
    description: "Score prospects on statistics, Python, SQL, and machine learning basics.",
    available: true,
    category: "Tech Careers",
    count: "2,260",
  },
  {
    title: "Full Stack Developer Screening Quiz",
    description: "Check bootcamp readiness across web fundamentals, APIs, databases, and debugging.",
    available: true,
    category: "Tech Careers",
    count: "2,540",
  },
  {
    title: "Python Beginner Skill Check",
    description: "Turn beginner Python interest into a short ranked skills challenge.",
    available: true,
    category: "Tech Careers",
    count: "2,910",
  },
  {
    title: "JavaScript Placement Challenge",
    description: "Assess DOM, async, arrays, and web basics for front-end readiness.",
    available: true,
    category: "Tech Careers",
    count: "2,050",
  },
  {
    title: "DevOps Career Fit Quiz",
    description: "Identify learners ready for Linux, CI/CD, containers, and cloud operations courses.",
    available: true,
    category: "Tech Careers",
    count: "1,120",
  },
  {
    title: "Cloud Computing Readiness Quiz",
    description: "Assess cloud-course readiness across networking, Linux, storage, and deployment knowledge.",
    available: true,
    category: "Tech Careers",
    count: "1,070",
  },
  {
    title: "Cybersecurity Aptitude Quiz",
    description: "Check security-course readiness with phishing, password, and network safety scenarios.",
    available: true,
    category: "Tech Careers",
    count: "1,340",
  },
  {
    title: "Digital Marketing Skill Score",
    description: "Rank learners on SEO, ads, analytics, funnels, and digital strategy basics.",
    available: true,
    category: "Marketing",
    count: "1,970",
  },
  {
    title: "UI/UX Design Aptitude Quiz",
    description: "Identify design-course readiness through product thinking, usability, and visual basics.",
    available: true,
    category: "Creative Careers",
    count: "870",
  },
  {
    title: "Product Management Readiness Quiz",
    description: "Qualify PM-course prospects on prioritization, metrics, users, and launch thinking.",
    available: true,
    category: "Business Careers",
    count: "760",
  },
  {
    title: "MBA Entrance Mini Mock",
    description: "Run a quick MBA prep contest with quant, verbal, and reasoning sections.",
    available: true,
    category: "Entrance Exams",
    count: "1,140",
  },
  {
    title: "GMAT Quant Starter Challenge",
    description: "Attract study-abroad learners with a ranked mini GMAT quant diagnostic.",
    available: true,
    category: "Entrance Exams",
    count: "680",
  },
  {
    title: "GRE Vocabulary Benchmark",
    description: "Build a vocabulary and sentence-completion score quiz for GRE preparation.",
    available: true,
    category: "Language",
    count: "740",
  },
  {
    title: "SAT Math Readiness Quiz",
    description: "Rank high-school learners and route them into SAT prep counseling.",
    available: true,
    category: "School & College",
    count: "920",
  },
  {
    title: "Grade 10 Science Rank Test",
    description: "Help tuition centers run free science contests for local student acquisition.",
    available: true,
    category: "School & College",
    count: "1,610",
  },
  {
    title: "Grade 12 Physics Scholarship Quiz",
    description: "Qualify senior students for scholarship offers and intensive physics batches.",
    available: true,
    category: "School & College",
    count: "1,240",
  },
  {
    title: "Commerce Career Selector Quiz",
    description: "Guide learners toward CA, CS, BBA, finance, and commerce career paths.",
    available: true,
    category: "School & College",
    count: "710",
  },
  {
    title: "Coding Bootcamp Eligibility Quiz",
    description: "Score applicants by logic, persistence, and technical baseline before sales outreach.",
    available: true,
    category: "Tech Careers",
    count: "1,890",
  },
  {
    title: "AI/ML Foundations Diagnostic",
    description: "Measure learner readiness for AI programs across math, Python, and concepts.",
    available: true,
    category: "Tech Careers",
    count: "1,430",
  },
  {
    title: "Excel for Business Skill Quiz",
    description: "Assess office productivity, analytics, and business operations skills.",
    available: true,
    category: "Business Careers",
    count: "1,050",
  },
  {
    title: "Financial Modeling Readiness Quiz",
    description: "Find finance-course prospects through accounting, Excel, valuation, and logic checks.",
    available: true,
    category: "Business Careers",
    count: "690",
  },
  {
    title: "Stock Market Basics Quiz",
    description: "Use an investing literacy challenge for trading or finance-course readiness.",
    available: true,
    category: "Business Careers",
    count: "1,370",
  },
  {
    title: "Entrepreneurship Readiness Quiz",
    description: "Rank founder-program prospects by market, customer, pricing, and execution awareness.",
    available: true,
    category: "Business Careers",
    count: "640",
  },
  {
    title: "Sales Career Aptitude Quiz",
    description: "Attract sales-training candidates with qualification, objection, and communication scenarios.",
    available: true,
    category: "Business Careers",
    count: "820",
  },
  {
    title: "HR Analytics Skill Check",
    description: "Check HR upskilling readiness through metrics, dashboards, and workforce scenarios.",
    available: true,
    category: "Business Careers",
    count: "510",
  },
  {
    title: "Nursing Entrance Readiness Quiz",
    description: "Assess healthcare aspirants with biology, aptitude, and care-scenario checks.",
    available: true,
    category: "Healthcare",
    count: "940",
  },
  {
    title: "Medical Coding Eligibility Quiz",
    description: "Qualify prospects for medical coding courses through terminology and process basics.",
    available: true,
    category: "Healthcare",
    count: "620",
  },
  {
    title: "Pharmacy Entrance Mock Quiz",
    description: "Rank pharmacy aspirants with chemistry, biology, and general aptitude questions.",
    available: true,
    category: "Healthcare",
    count: "540",
  },
  {
    title: "Law Entrance Scholarship Test",
    description: "Run a legal aptitude contest for scholarships, webinars, and counselor follow-up.",
    available: true,
    category: "Entrance Exams",
    count: "730",
  },
  {
    title: "Teacher Eligibility Practice Quiz",
    description: "Attract teacher-exam candidates with pedagogy, reasoning, and subject-readiness checks.",
    available: true,
    category: "Education",
    count: "890",
  },
  {
    title: "Spoken French Level Finder",
    description: "Route language learners into the right French cohort using a quick placement quiz.",
    available: true,
    category: "Language",
    count: "410",
  },
  {
    title: "German A1 Placement Quiz",
    description: "Collect study-abroad and language learners interested in German beginner programs.",
    available: true,
    category: "Language",
    count: "460",
  },
  {
    title: "Kids Coding Aptitude Quiz",
    description: "Help coding schools run parent-friendly logic challenges for young learners.",
    available: true,
    category: "School & College",
    count: "1,320",
  },
  {
    title: "Robotics Beginner Challenge",
    description: "Create a STEM readiness quiz with basic electronics, logic, and robotics interest questions.",
    available: true,
    category: "Creative Careers",
    count: "560",
  },
  {
    title: "Blockchain Basics Quiz",
    description: "Find learners ready for blockchain courses through wallet, ledger, and crypto basics.",
    available: true,
    category: "Tech Careers",
    count: "480",
  },
  {
    title: "Prompt Engineering Skill Check",
    description: "Score learners on AI prompting, task design, evaluation, and workflow basics.",
    available: true,
    category: "Tech Careers",
    count: "1,290",
  },
  {
    title: "Data Analytics Placement Quiz",
    description: "Check analytics readiness across Excel, SQL, charts, statistics, and business interpretation.",
    available: true,
    category: "Tech Careers",
    count: "1,620",
  },
  {
    title: "Business Communication Quiz",
    description: "Qualify soft-skills learners through email, presentation, and workplace communication.",
    available: true,
    category: "Business Careers",
    count: "780",
  },
  {
    title: "Course Scholarship Mega Challenge",
    description: "A flexible top-100 challenge where the top 3 can receive free course access.",
    available: true,
    category: "Ranked Challenges",
    count: "3,200",
  },
];

const products = [
  ["Quiz Builder", "Create, publish, AI-edit, and launch quizzes from one workspace.", true, "Core", "Ready"],
  ["Forms", "Create response forms, scholarship applications, counseling requests, and surveys.", false, "Forms", "Upcoming"],
  ["Live Session Manager", "Host real-time quizzes with join codes, QR links, and player rooms.", true, "Engagement", "Ready"],
  ["Question Bank", "Store reusable questions by topic, difficulty, source, and performance.", true, "Content", "Ready"],
  ["AI Quiz Agent", "Workspace assistant for quiz creation, edits, launch help, templates, docs, and reports.", true, "AI", "Ready"],
  ["Report Builder", "Build custom reporting dashboards for attempts and hard questions.", false, "Analytics", "Upcoming"],
  ["Team Workspace", "Shared folders, roles, approvals, and team question banks.", false, "Teams", "Upcoming"],
  ["Integrations", "Google Sheets, Slack, Teams, webhooks, LMS exports, and automation triggers.", false, "Automation", "Upcoming"],
  ["Assignments", "Assign quizzes, due dates, reminders, and learner-specific follow-ups.", false, "Learning", "Upcoming"],
];

const productFilters = ["All", "Ready", "Forms", "Analytics", "Teams", "Automation", "Learning"];

function defaultTemplateQuestions(template) {
  const pools = {
    "Entrance Exams": [
      ["A percentile score mainly compares a candidate against what?", ["Other test takers", "Only their previous score", "The number of questions", "The exam fee"], 0],
      ["In reading comprehension, the safest answer is usually the one that is what?", ["Directly supported by the passage", "Most emotional", "Longest in length", "Opposite of the title"], 0],
      ["Which habit improves timed mock-test performance?", ["Reviewing errors after each attempt", "Skipping all hard questions forever", "Memorizing option letters", "Avoiding sectional practice"], 0],
      ["A speed-distance question is best solved by first identifying what?", ["Rate, time, and distance relationship", "The longest answer choice", "The exam date", "The candidate name"], 0],
      ["Which learner should be routed to intensive prep?", ["High intent with clear weak areas", "No attempt submitted", "Random duplicate entry", "No contact details and no score"], 0],
    ],
    "Tech Careers": [
      ["Which skill is essential for debugging API failures?", ["Reading request and response errors", "Changing colors randomly", "Ignoring logs", "Deleting tests"], 0],
      ["What does SQL primarily help with?", ["Querying structured data", "Designing icons only", "Compiling mobile apps", "Sending push notifications"], 0],
      ["Why are projects useful in career readiness?", ["They prove applied problem solving", "They replace all fundamentals", "They avoid feedback", "They hide code quality"], 0],
      ["Which concept is central to machine learning readiness?", ["Training data and evaluation", "Only file naming", "Browser bookmarks", "Manual formatting"], 0],
      ["A strong developer screening quiz should include what?", ["Concepts plus practical reasoning", "Only trivia", "Only personal opinions", "Unscored questions"], 0],
    ],
    Language: [
      ["Which activity best measures vocabulary in context?", ["Choosing meaning from a sentence", "Counting letters only", "Typing random words", "Ignoring grammar"], 0],
      ["A placement quiz should identify what?", ["Current proficiency band", "Favorite color", "Payment method", "Device model"], 0],
      ["Which skill is tested by sentence completion?", ["Grammar and contextual meaning", "Screen brightness", "Typing speed only", "File upload size"], 0],
      ["What is a useful follow-up after a language diagnostic?", ["Recommend the right level cohort", "Hide the result", "Delete the learner", "Send unrelated material"], 0],
      ["Pronunciation practice is most useful when paired with what?", ["Feedback and repetition", "No listening", "Only written marks", "Silent reading only"], 0],
    ],
    default: [
      ["What should a readiness quiz measure first?", ["Current knowledge and weak areas", "Only contact details", "The longest response", "Random guessing style"], 0],
      ["Which question is highest quality?", ["Clear prompt with one correct answer", "Ambiguous prompt", "Duplicate options", "No explanation"], 0],
      ["What makes a live challenge fair?", ["Same rules and timing for all players", "Changing answers mid-session", "Hidden scoring", "Late unrestricted joins"], 0],
      ["Which report metric is most actionable?", ["Hardest questions and accuracy", "Logo color", "Browser width", "Button label"], 0],
      ["What should happen after results are available?", ["Review scores and plan next learning step", "Ignore all attempts", "Reuse stale data blindly", "Remove all questions"], 0],
    ],
  };
  return pools[template.category] || pools.default;
}

function makeQuestions(template) {
  const sourceQuestions = template.questions?.length ? template.questions : defaultTemplateQuestions(template);
  return sourceQuestions.map(([prompt, options, correctOptionIndex]) => ({
    prompt,
    options,
    correctOptionIndex,
    difficulty: "medium",
    sourceType: "manual",
    explanation: `This answer is correct for the ${template.title.toLowerCase()} template.`,
  }));
}

function productTarget(title) {
  if (title === "Question Bank") return "/question-bank";
  if (title === "Live Session Manager") return "/active-quizzes";
  if (title === "Quiz Builder" || title === "AI Quiz Agent") return "/build";
  return "/";
}

function CatalogPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Popular");
  const [statusText, setStatusText] = useState("");
  const [creatingTitle, setCreatingTitle] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const isProducts = location.pathname.includes("products");
  const filters = isProducts
    ? productFilters
    : ["Popular", ...Array.from(new Set(marketplaceTemplates.map((item) => item.category)))];

  useEffect(() => {
    setActiveFilter(isProducts ? "All" : "Popular");
  }, [isProducts]);

  const templateItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return marketplaceTemplates.filter((template) => {
      const matchesFilter = activeFilter === "Popular" || template.category === activeFilter;
      const matchesSearch =
        !needle ||
        template.title.toLowerCase().includes(needle) ||
        template.description.toLowerCase().includes(needle) ||
        template.category.toLowerCase().includes(needle);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, search]);

  const productItems = useMemo(
    () =>
      products.filter((product) => {
        if (activeFilter === "Popular" || activeFilter === "All") return true;
        return activeFilter === "Ready" ? product[2] : product[3] === activeFilter;
      }),
    [activeFilter]
  );

  async function handleUseTemplate(template) {
    if (!template.available) return;

    setCreatingTitle(template.title);
    setStatusText(`Creating "${template.title}"...`);

    try {
      const quiz = await createQuiz({
        title: template.title.replace("Templates", "Quiz"),
        description: template.description,
        category: template.category,
        adminId: user?.id,
        adminName: user?.name,
        adminEmail: user?.email,
        questions: makeQuestions(template),
        status: "draft",
      });
      setStatusText(`Created "${quiz.title}". Open My Workspace to edit or launch it.`);
    } catch (error) {
      setStatusText(error.message);
    } finally {
      setCreatingTitle("");
    }
  }

  return (
    <>
      <SiteHeader variant="light" />
      <GlobalSearchBar placeholder={isProducts ? "Search products, quizzes, templates, support..." : "Search in all Quiz Templates and your workspace"} />
      <main className="catalog-page">
        <section className="catalog-hero">
          <Link to="/">← Back to workspace</Link>
          <p className="eyebrow">{isProducts ? "Products" : "Templates"}</p>
          <h1>{isProducts ? "Quivora products" : "Quiz templates for classes, courses, and skill checks"}</h1>
          <p>
            {isProducts
              ? "Explore quizzes, forms, AI assistance, live sessions, reports, teams, and integrations for education workflows."
              : "Launch ranked challenges, scholarship qualifiers, skill checks, and course-readiness quizzes from ready templates."}
          </p>
          {!isProducts ? (
            <label className="catalog-search">
              <span>⌕</span>
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search in all Quiz Templates"
                value={search}
              />
              <button type="button">➤</button>
            </label>
          ) : null}
          {statusText ? <p className="catalog-status">{statusText}</p> : null}
        </section>

        <section className="catalog-marketplace">
          <aside className="catalog-filters">
            <h2>{isProducts ? "Product Types" : "Template Types"}</h2>
            {filters.map((filter) => (
              <button
                className={activeFilter === filter ? "active" : ""}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {filter}
                <span>
                  {isProducts
                    ? filter === "All"
                      ? products.length
                      : filter === "Ready"
                        ? products.filter((product) => product[2]).length
                        : products.filter((product) => product[3] === filter).length || "Soon"
                    : filter === "Popular"
                      ? marketplaceTemplates.length
                      : marketplaceTemplates.filter((template) => template.category === filter).length}
                </span>
              </button>
            ))}
          </aside>

          <div className="catalog-grid">
            {(isProducts ? productItems : templateItems).map((item) => {
              const title = isProducts ? item[0] : item.title;
              const description = isProducts ? item[1] : item.description;
              const available = isProducts ? item[2] : item.available;
              const category = isProducts ? item[3] : item.category;
              const count = isProducts ? item[4] : item.count;

              return (
                <article className="catalog-card" key={title}>
                  <div className="catalog-preview">
                    <span className="catalog-preview-line wide" />
                    <span className="catalog-preview-line" />
                    <span className="catalog-preview-option" />
                    <span className="catalog-preview-option short" />
                  </div>
                  <div>
                    <span className={available ? "catalog-tag ready" : "catalog-tag"}>{available ? "Available" : "Upcoming"}</span>
                    <h2>{title}</h2>
                  </div>
                  <p>{description}</p>
                  <div className="catalog-meta">
                    <span>{category}</span>
                    <strong>{count}</strong>
                  </div>
                  {isProducts ? (
                    available ? <Link to={productTarget(title)}>Open</Link> : <button type="button" disabled>Notify me</button>
                  ) : available ? (
                    <div className="build-success-actions">
                      <button type="button" onClick={() => setPreviewTemplate(item)}>Preview</button>
                      <button
                        onClick={() => handleUseTemplate(item)}
                        type="button"
                        disabled={creatingTitle === title}
                      >
                        {creatingTitle === title ? "Creating..." : "Use template"}
                      </button>
                    </div>
                  ) : (
                    <button type="button" disabled>Notify me</button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
        {previewTemplate ? (
          <div className="build-success-overlay" role="dialog" aria-modal="true">
            <div className="build-success-card">
              <p className="eyebrow">Template preview</p>
              <h2>{previewTemplate.title}</h2>
              <p>{previewTemplate.description}</p>
              <ol>
                {makeQuestions(previewTemplate).slice(0, 5).map((question) => (
                  <li key={question.prompt}>{question.prompt}</li>
                ))}
              </ol>
              <div className="build-success-actions">
                <button className="secondary-button" type="button" onClick={() => setPreviewTemplate(null)}>Close</button>
                <button className="primary-button" type="button" onClick={() => handleUseTemplate(previewTemplate)}>Use template</button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}

export default CatalogPage;
