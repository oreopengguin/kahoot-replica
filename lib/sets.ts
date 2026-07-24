// Client-side question-set library, persisted to localStorage.

import { Question, QuestionSet, QuestionType } from "./types";

const KEY = "lexvex.sets.v1";
const SEEDED_KEY = "lexvex.seeded.v1";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function blankQuestion(type: QuestionType = "quiz"): Question {
  const base: Question = {
    id: newId(),
    type,
    text: "",
    choices: ["", "", "", ""],
    correct: [],
    multiSelect: false,
    timeLimit: 20,
    points: "standard",
  };
  if (type === "truefalse") {
    base.choices = ["True", "False"];
    base.timeLimit = 10;
  }
  if (type === "typeanswer") {
    base.choices = [];
    base.acceptedAnswers = [""];
  }
  if (type === "slider") {
    base.choices = [];
    base.sliderMin = 0;
    base.sliderMax = 100;
    base.sliderCorrect = 50;
    base.sliderTolerance = 5;
    base.timeLimit = 20;
  }
  if (type === "poll") {
    base.points = "none";
  }
  return base;
}

export function loadSets(): QuestionSet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    const sets = raw ? (JSON.parse(raw) as QuestionSet[]) : [];
    return Array.isArray(sets) ? sets : [];
  } catch {
    return [];
  }
}

export function saveSets(sets: QuestionSet[]) {
  localStorage.setItem(KEY, JSON.stringify(sets));
}

export function getSet(id: string): QuestionSet | null {
  return loadSets().find((s) => s.id === id) ?? null;
}

export function upsertSet(set: QuestionSet) {
  const sets = loadSets();
  const i = sets.findIndex((s) => s.id === set.id);
  set.updatedAt = Date.now();
  if (i >= 0) sets[i] = set;
  else sets.unshift(set);
  saveSets(sets);
}

export function deleteSet(id: string) {
  saveSets(loadSets().filter((s) => s.id !== id));
}

export function duplicateSet(id: string): QuestionSet | null {
  const src = getSet(id);
  if (!src) return null;
  const copy: QuestionSet = {
    ...structuredClone(src),
    id: newId(),
    title: `${src.title} (copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questions: src.questions.map((q) => ({ ...structuredClone(q), id: newId() })),
  };
  upsertSet(copy);
  return copy;
}

/** Validate an imported JSON blob into a QuestionSet, or throw with a reason. */
export function importSet(json: unknown): QuestionSet {
  const o = json as Partial<QuestionSet>;
  if (!o || typeof o !== "object") throw new Error("Not a valid question set file");
  if (typeof o.title !== "string" || !Array.isArray(o.questions) || o.questions.length === 0) {
    throw new Error("File is missing a title or questions");
  }
  const questions: Question[] = o.questions.map((raw) => {
    const q = raw as Partial<Question>;
    if (typeof q.text !== "string") throw new Error("A question is missing its text");
    const type: QuestionType = (["quiz", "truefalse", "typeanswer", "slider", "poll"] as const).includes(
      q.type as QuestionType
    )
      ? (q.type as QuestionType)
      : "quiz";
    return {
      ...blankQuestion(type),
      ...q,
      id: newId(),
      type,
      choices: Array.isArray(q.choices) ? q.choices.map(String) : blankQuestion(type).choices,
      correct: Array.isArray(q.correct) ? q.correct.filter((n) => Number.isInteger(n)) : [],
      timeLimit: typeof q.timeLimit === "number" && q.timeLimit >= 5 ? Math.min(q.timeLimit, 240) : 20,
    } as Question;
  });
  const set: QuestionSet = {
    id: newId(),
    title: o.title.slice(0, 80),
    description: typeof o.description === "string" ? o.description.slice(0, 300) : "",
    coverEmoji: typeof o.coverEmoji === "string" ? o.coverEmoji : "❓",
    questions,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  upsertSet(set);
  return set;
}

function q(partial: Partial<Question> & { text: string }): Question {
  return { ...blankQuestion(partial.type ?? "quiz"), ...partial, id: newId() };
}

export function seedSampleSets() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEEDED_KEY)) return;
  const existing = loadSets();

  const samples: QuestionSet[] = [
    {
      id: newId(),
      title: "Science Sampler",
      description: "A tour of physics, biology, and space — shows off every question type.",
      coverEmoji: "🔬",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      questions: [
        q({ text: "Which planet is known as the Red Planet?", emoji: "🪐", choices: ["Mars", "Venus", "Jupiter", "Mercury"], correct: [0], timeLimit: 20 }),
        q({ text: "Which of these are mammals?", emoji: "🐾", choices: ["Dolphin", "Shark", "Bat", "Penguin"], correct: [0, 2], multiSelect: true, timeLimit: 25 }),
        q({ type: "truefalse", text: "Sound travels faster in water than in air.", emoji: "🔊", choices: ["True", "False"], correct: [0], timeLimit: 10 }),
        q({ type: "typeanswer", text: "What gas do plants absorb from the atmosphere?", emoji: "🌱", choices: [], correct: [], acceptedAnswers: ["carbon dioxide", "co2"], timeLimit: 30 }),
        q({ type: "slider", text: "How many bones are in the adult human body?", emoji: "🦴", choices: [], correct: [], sliderMin: 100, sliderMax: 300, sliderCorrect: 206, sliderTolerance: 5, timeLimit: 20 }),
        q({ text: "What is the chemical symbol for gold?", emoji: "🥇", choices: ["Au", "Ag", "Gd", "Go"], correct: [0], points: "double", timeLimit: 15 }),
        q({ type: "poll", text: "Which science topic is your favorite?", emoji: "🧪", choices: ["Space", "Animals", "Chemistry", "The human body"], correct: [], points: "none", timeLimit: 15 }),
      ],
    },
    {
      id: newId(),
      title: "World Capitals Challenge",
      description: "Ten quick-fire capital cities from around the globe.",
      coverEmoji: "🌍",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      questions: [
        q({ text: "What is the capital of Australia?", choices: ["Canberra", "Sydney", "Melbourne", "Perth"], correct: [0], timeLimit: 15 }),
        q({ text: "What is the capital of Canada?", choices: ["Ottawa", "Toronto", "Vancouver", "Montreal"], correct: [0], timeLimit: 15 }),
        q({ text: "What is the capital of Brazil?", choices: ["Brasília", "Rio de Janeiro", "São Paulo", "Salvador"], correct: [0], timeLimit: 15 }),
        q({ text: "What is the capital of Japan?", choices: ["Tokyo", "Osaka", "Kyoto", "Nagoya"], correct: [0], timeLimit: 10 }),
        q({ text: "What is the capital of Turkey?", choices: ["Ankara", "Istanbul", "Izmir", "Antalya"], correct: [0], timeLimit: 15 }),
        q({ type: "truefalse", text: "Amsterdam is the capital of the Netherlands.", choices: ["True", "False"], correct: [0], timeLimit: 10 }),
        q({ text: "What is the capital of Egypt?", choices: ["Cairo", "Alexandria", "Giza", "Luxor"], correct: [0], timeLimit: 15 }),
        q({ text: "What is the capital of New Zealand?", choices: ["Wellington", "Auckland", "Christchurch", "Hamilton"], correct: [0], points: "double", timeLimit: 15 }),
        q({ type: "typeanswer", text: "Type the capital of France.", choices: [], correct: [], acceptedAnswers: ["paris"], timeLimit: 20 }),
        q({ text: "Which of these cities are capitals?", choices: ["Nairobi", "Lagos", "Hanoi", "Zurich"], correct: [0, 2], multiSelect: true, timeLimit: 25 }),
      ],
    },
    {
      id: newId(),
      title: "Math Mental Sprint",
      description: "Fast arithmetic and number sense for warm-ups.",
      coverEmoji: "🧮",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      questions: [
        q({ text: "What is 7 × 8?", choices: ["56", "54", "64", "48"], correct: [0], timeLimit: 10 }),
        q({ text: "What is 15% of 200?", choices: ["30", "15", "45", "20"], correct: [0], timeLimit: 15 }),
        q({ type: "truefalse", text: "A prime number has exactly two factors.", choices: ["True", "False"], correct: [0], timeLimit: 10 }),
        q({ type: "slider", text: "Estimate: what is 47 × 21?", choices: [], correct: [], sliderMin: 0, sliderMax: 2000, sliderCorrect: 987, sliderTolerance: 30, timeLimit: 20 }),
        q({ text: "Which fractions equal one half?", choices: ["4/8", "3/5", "6/12", "5/8"], correct: [0, 2], multiSelect: true, timeLimit: 20 }),
        q({ type: "typeanswer", text: "What is the square root of 144?", choices: [], correct: [], acceptedAnswers: ["12", "twelve"], timeLimit: 15 }),
        q({ text: "What is 9 + 10?", choices: ["19", "21", "18", "910"], correct: [0], points: "double", timeLimit: 10 }),
      ],
    },
  ];

  saveSets([...samples, ...existing]);
  localStorage.setItem(SEEDED_KEY, "1");
}
