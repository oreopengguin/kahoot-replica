// Shared types between client and server.

export type QuestionType = "quiz" | "truefalse" | "typeanswer" | "slider" | "poll";

export type PointsMode = "standard" | "double" | "none";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  /** Optional image URL shown with the question. */
  image?: string;
  /** Optional emoji shown large next to the question. */
  emoji?: string;
  /** Answer choices. 4 for quiz/poll, 2 for true/false, unused for typeanswer/slider. */
  choices: string[];
  /** Indices into `choices` that are correct (1–4 for quiz, 1 for true/false). */
  correct: number[];
  /**
   * Quiz only: when true, players must select ALL correct answers to score.
   * When false, selecting any one correct answer scores.
   */
  multiSelect: boolean;
  /** Seconds players have to answer. */
  timeLimit: number;
  points: PointsMode;
  /** typeanswer: accepted answers (case/space-insensitive match). */
  acceptedAnswers?: string[];
  /** slider: numeric range and correct value. */
  sliderMin?: number;
  sliderMax?: number;
  sliderCorrect?: number;
  /** slider: full points within this tolerance of the correct value. */
  sliderTolerance?: number;
}

export interface QuestionSet {
  id: string;
  title: string;
  description: string;
  coverEmoji: string;
  questions: Question[];
  createdAt: number;
  updatedAt: number;
}

export interface GameSettings {
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  /** Automatically move from reveal to scoreboard to next question. */
  autoAdvance: boolean;
  streakBonus: boolean;
  /** Require players to use generated nicknames. */
  nicknameGenerator: boolean;
  showPodium: boolean;
  /** Allow players to join after the game has started. */
  lateJoin: boolean;
  playerLimit: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  randomizeQuestions: false,
  randomizeAnswers: false,
  autoAdvance: false,
  streakBonus: true,
  nicknameGenerator: false,
  showPodium: true,
  lateJoin: true,
  playerLimit: 400,
};

export type GamePhase =
  | "lobby"
  | "intro" // "Get ready" — question text shown, answering not yet open
  | "answering"
  | "reveal" // correct answer + distribution
  | "scoreboard"
  | "podium"
  | "ended";

/** What a player submitted for one question. */
export interface PlayerAnswer {
  questionIndex: number;
  /** Choice indices for quiz/truefalse/poll (post-shuffle mapped back to original). */
  choices?: number[];
  text?: string;
  sliderValue?: number;
  /** ms taken to answer, from when answering opened. */
  elapsedMs: number;
  correct: boolean;
  pointsEarned: number;
  streakAfter: number;
}

/** Public player info sent to host + players. */
export interface PlayerPublic {
  id: string;
  name: string;
  score: number;
  streak: number;
  correctCount: number;
  answeredCurrent: boolean;
  rank: number;
}

/** Question as shown to players/host during a game (correct answers stripped for players). */
export interface LiveQuestion {
  index: number;
  total: number;
  type: QuestionType;
  text: string;
  image?: string;
  emoji?: string;
  choices: string[];
  multiSelect: boolean;
  timeLimit: number;
  points: PointsMode;
  sliderMin?: number;
  sliderMax?: number;
}

export interface RevealInfo {
  correct: number[];
  acceptedAnswers?: string[];
  sliderCorrect?: number;
  /** Count of players who picked each choice index (or for slider/typeanswer, [correctCount, wrongCount]). */
  distribution: number[];
  answeredCount: number;
  totalPlayers: number;
}

export interface HostStateSnapshot {
  pin: string;
  phase: GamePhase;
  setTitle: string;
  settings: GameSettings;
  locked: boolean;
  players: PlayerPublic[];
  question: LiveQuestion | null;
  reveal: RevealInfo | null;
  /** Server ms remaining in the current timed phase (intro/answering). */
  msRemaining: number | null;
  answeredCount: number;
  questionCount: number;
  currentIndex: number;
  podium: PlayerPublic[] | null;
}

export interface PlayerStateSnapshot {
  pin: string;
  phase: GamePhase;
  setTitle: string;
  me: PlayerPublic | null;
  playerCount: number;
  question: LiveQuestion | null;
  /** Whether this player already answered the current question. */
  answered: boolean;
  /** After reveal: result for the current question. */
  lastResult: {
    correct: boolean;
    pointsEarned: number;
    streak: number;
    rank: number;
    scoreAfter: number;
    correctChoices: number[];
    acceptedAnswers?: string[];
    sliderCorrect?: number;
  } | null;
  msRemaining: number | null;
  podium: PlayerPublic[] | null;
  finalRank: number | null;
  kicked: boolean;
}
