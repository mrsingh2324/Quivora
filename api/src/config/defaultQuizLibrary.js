const Question = require("../modules/question-bank/Question");
const Quiz = require("../modules/quiz-publishing/Quiz");
const User = require("../modules/participants/User");
const generateJoinCode = require("../modules/quiz-publishing/generateJoinCode");

const LIBRARY_OWNER_EMAIL = "library@quivora.local";
const LIBRARY_SIZE = 50;
const QUESTIONS_PER_QUIZ = 50;

const quizFamilies = [
  ["Python Fundamentals", "programming"],
  ["JavaScript Essentials", "programming"],
  ["React Basics", "frontend"],
  ["Node.js APIs", "backend"],
  ["MongoDB Queries", "database"],
  ["SQL Practice", "database"],
  ["DevOps Basics", "devops"],
  ["Kubernetes Starter", "devops"],
  ["AWS Cloud Basics", "cloud"],
  ["Cybersecurity Awareness", "security"],
  ["Data Structures", "computer-science"],
  ["Algorithms Practice", "computer-science"],
  ["HTML and CSS", "frontend"],
  ["Git and GitHub", "tools"],
  ["System Design Basics", "architecture"],
  ["Mathematics Grade 6", "school"],
  ["Mathematics Grade 8", "school"],
  ["Algebra Practice", "school"],
  ["Geometry Practice", "school"],
  ["Physics Basics", "science"],
  ["Chemistry Basics", "science"],
  ["Biology Basics", "science"],
  ["Environmental Science", "science"],
  ["World History", "history"],
  ["Indian History", "history"],
  ["Geography Basics", "geography"],
  ["Civics and Government", "social-studies"],
  ["English Grammar", "language"],
  ["Reading Comprehension", "language"],
  ["Vocabulary Builder", "language"],
  ["Business Communication", "business"],
  ["Sales Training", "business"],
  ["Customer Support", "business"],
  ["Leadership Basics", "business"],
  ["Project Management", "business"],
  ["HR Compliance", "workplace"],
  ["Workplace Safety", "workplace"],
  ["Financial Literacy", "finance"],
  ["Accounting Basics", "finance"],
  ["Marketing Fundamentals", "marketing"],
  ["Digital Marketing", "marketing"],
  ["Data Science Basics", "data"],
  ["Machine Learning Basics", "data"],
  ["Statistics Practice", "data"],
  ["NEET Biology Prep", "exam-prep"],
  ["JEE Physics Prep", "exam-prep"],
  ["JEE Math Prep", "exam-prep"],
  ["Interview Aptitude", "career"],
  ["Logical Reasoning", "career"],
  ["General Knowledge", "general"],
];

function buildQuestion(family, quizIndex, questionIndex) {
  const [title, category] = family;
  const number = questionIndex + 1;

  return {
    prompt: `${title}: practice question ${number}. Which option best matches the core idea for ${category}?`,
    questionType: "multiple_choice",
    options: [
      `Correct ${title} concept ${number}`,
      `Distractor ${title} concept ${number} A`,
      `Distractor ${title} concept ${number} B`,
      `Distractor ${title} concept ${number} C`,
    ],
    correctOptionIndex: 0,
    sourceType: "manual",
    difficulty: number % 3 === 0 ? "hard" : number % 2 === 0 ? "medium" : "easy",
    explanation: `This default-library question checks a reusable ${title} concept.`,
    tags: ["default-library", category, `quiz-${quizIndex + 1}`],
    reusable: true,
    qualityScore: 80,
  };
}

async function createLibraryQuiz(owner, family, quizIndex) {
  const [title, category] = family;
  const questions = await Question.insertMany(
    Array.from({ length: QUESTIONS_PER_QUIZ }, (_, questionIndex) =>
      buildQuestion(family, quizIndex, questionIndex)
    )
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await Quiz.create({
        title,
        description: `${QUESTIONS_PER_QUIZ} ready-to-use questions for ${title}.`,
        category,
        createdBy: owner._id,
        questions: questions.map((question) => question._id),
        status: "published",
        totalQuestions: QUESTIONS_PER_QUIZ,
        questionTimeLimitSeconds: 30,
        resultsWindowSeconds: 5,
        joinCode: generateJoinCode(),
        isDefaultLibrary: true,
        libraryKey: `default-${quizIndex + 1}`,
      });
    } catch (error) {
      if (error.code !== 11000 || attempt === 9) {
        throw error;
      }
    }
  }

  return null;
}

async function seedDefaultQuizLibrary() {
  const existingCount = await Quiz.countDocuments({ isDefaultLibrary: true });

  if (existingCount >= LIBRARY_SIZE) {
    return;
  }

  const owner = await User.findOneAndUpdate(
    { email: LIBRARY_OWNER_EMAIL },
    {
      name: "Quivora Default Library",
      email: LIBRARY_OWNER_EMAIL,
      role: "admin",
      authProvider: "local",
      isVerified: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  for (let index = existingCount; index < LIBRARY_SIZE; index += 1) {
    await createLibraryQuiz(owner, quizFamilies[index], index);
  }

  console.log(`[Default Library] Ready: ${LIBRARY_SIZE} quizzes x ${QUESTIONS_PER_QUIZ} questions`);
}

module.exports = { seedDefaultQuizLibrary };
