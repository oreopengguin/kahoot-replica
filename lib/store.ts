// Server-side in-memory game store.
//
// State lives in a globalThis singleton so it survives dev-server HMR and is
// shared across route handlers within one server process. For a multi-instance
// serverless deployment, swap GameStore's Map for a shared backend (e.g. Redis)
// — every access goes through the functions in this file.

import {
  DEFAULT_SETTINGS,
  GamePhase,
  GameSettings,
  HostStateSnapshot,
  LiveQuestion,
  PlayerAnswer,
  PlayerPublic,
  PlayerStateSnapshot,
  Question,
  QuestionSet,
  RevealInfo,
} from "./types";

const INTRO_MS = 5000;
const AUTO_REVEAL_MS = 8000;
const AUTO_SCOREBOARD_MS = 6000;
// A player counts as connected if they polled recently. Generous on purpose:
// phones lock and browsers throttle background tabs, and a briefly-idle player
// should not cause "everyone answered" to fire early without them.
const ACTIVE_WINDOW_MS = 30000;
const GAME_TTL_MS = 6 * 60 * 60 * 1000;
const ENDED_TTL_MS = 30 * 60 * 1000;

export interface ServerPlayer {
  id: string;
  token: string;
  name: string;
  score: number;
  streak: number;
  correctCount: number;
  answers: (PlayerAnswer | null)[];
  kicked: boolean;
  joinedAt: number;
  lastSeen: number;
}

export interface Game {
  pin: string;
  hostToken: string;
  setTitle: string;
  questions: Question[]; // already shuffled/remapped per settings
  settings: GameSettings;
  phase: GamePhase;
  currentIndex: number;
  /** When the current timed phase (intro/answering, or auto-advance timers) ends. */
  phaseEndsAt: number | null;
  /** When answering opened, for elapsed-time scoring. */
  answeringOpenedAt: number | null;
  locked: boolean;
  players: Map<string, ServerPlayer>;
  /** Uploaded question images (id → data URL), served via /api/games/[pin]/image/[id]. */
  images: Map<string, string>;
  createdAt: number;
  endedAt: number | null;
}

interface Store {
  games: Map<string, Game>;
}

const store: Store = ((globalThis as Record<string, unknown>).__lexvexStore ??= {
  games: new Map<string, Game>(),
}) as Store;

function randId(len = 21): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function makePin(): string {
  for (let tries = 0; tries < 100; tries++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!store.games.has(pin)) return pin;
  }
  throw new Error("Could not allocate a game PIN");
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gcGames(now: number) {
  for (const [pin, g] of store.games) {
    const dead =
      now - g.createdAt > GAME_TTL_MS ||
      (g.endedAt !== null && now - g.endedAt > ENDED_TTL_MS);
    if (dead) store.games.delete(pin);
  }
}

export function createGame(set: QuestionSet, settings: Partial<GameSettings>): {
  pin: string;
  hostToken: string;
} {
  const now = Date.now();
  gcGames(now);
  const merged: GameSettings = { ...DEFAULT_SETTINGS, ...settings };
  const pin = makePin();

  let questions = set.questions.map((q) => ({ ...q, choices: [...q.choices], correct: [...q.correct] }));

  // Uploaded images arrive as data URLs inside the set. Park them in the game
  // and rewrite to a short cached URL so polled snapshots stay small.
  const images = new Map<string, string>();
  questions = questions.map((q, i) => {
    if (q.image?.startsWith("data:image/")) {
      const id = `q${i}-${randId(8)}`;
      images.set(id, q.image);
      return { ...q, image: `/api/games/${pin}/image/${id}` };
    }
    return q;
  });
  if (merged.randomizeQuestions) questions = shuffled(questions);
  if (merged.randomizeAnswers) {
    questions = questions.map((q) => {
      if ((q.type !== "quiz" && q.type !== "poll") || q.choices.length < 2) return q;
      const order = shuffled(q.choices.map((_, i) => i));
      return {
        ...q,
        choices: order.map((oi) => q.choices[oi]),
        correct: q.correct.map((ci) => order.indexOf(ci)),
      };
    });
  }

  const game: Game = {
    pin,
    hostToken: randId(),
    setTitle: set.title,
    questions,
    settings: merged,
    phase: "lobby",
    currentIndex: -1,
    phaseEndsAt: null,
    answeringOpenedAt: null,
    locked: false,
    players: new Map(),
    images,
    createdAt: now,
    endedAt: null,
  };
  store.games.set(game.pin, game);
  return { pin: game.pin, hostToken: game.hostToken };
}

export function getGame(pin: string): Game | null {
  const g = store.games.get(pin);
  if (!g) return null;
  tick(g);
  return g;
}

function activePlayers(g: Game): ServerPlayer[] {
  const now = Date.now();
  return [...g.players.values()].filter((p) => !p.kicked && now - p.lastSeen < ACTIVE_WINDOW_MS);
}

function livingPlayers(g: Game): ServerPlayer[] {
  return [...g.players.values()].filter((p) => !p.kicked);
}

/** Advance phases whose timers have elapsed. Called lazily on every access. */
function tick(g: Game) {
  const now = Date.now();
  // Loop in case multiple timed phases elapsed between polls.
  for (let guard = 0; guard < 10; guard++) {
    if (g.phaseEndsAt === null || now < g.phaseEndsAt) break;
    if (g.phase === "intro") {
      openAnswering(g);
    } else if (g.phase === "answering") {
      closeAnswering(g);
    } else if (g.phase === "reveal" && g.settings.autoAdvance) {
      toScoreboard(g);
    } else if (g.phase === "scoreboard" && g.settings.autoAdvance) {
      advance(g);
    } else {
      g.phaseEndsAt = null;
    }
  }
  // End answering early once every connected player has answered.
  if (g.phase === "answering") {
    const active = activePlayers(g);
    if (active.length > 0 && active.every((p) => p.answers[g.currentIndex])) {
      closeAnswering(g);
    }
  }
}

function openAnswering(g: Game) {
  const q = g.questions[g.currentIndex];
  g.phase = "answering";
  g.answeringOpenedAt = Date.now();
  g.phaseEndsAt = g.answeringOpenedAt + q.timeLimit * 1000;
}

function closeAnswering(g: Game) {
  // Players who never answered: break their streak.
  for (const p of livingPlayers(g)) {
    if (!p.answers[g.currentIndex]) p.streak = 0;
  }
  g.phase = "reveal";
  g.phaseEndsAt = g.settings.autoAdvance ? Date.now() + AUTO_REVEAL_MS : null;
}

function toScoreboard(g: Game) {
  const last = g.currentIndex >= g.questions.length - 1;
  if (last) {
    finish(g);
    return;
  }
  g.phase = "scoreboard";
  g.phaseEndsAt = g.settings.autoAdvance ? Date.now() + AUTO_SCOREBOARD_MS : null;
}

function advance(g: Game) {
  if (g.currentIndex >= g.questions.length - 1) {
    finish(g);
    return;
  }
  g.currentIndex += 1;
  g.phase = "intro";
  g.phaseEndsAt = Date.now() + INTRO_MS;
}

function finish(g: Game) {
  g.phase = g.settings.showPodium ? "podium" : "ended";
  g.phaseEndsAt = null;
  g.endedAt = Date.now();
}

export type HostAction = "start" | "next" | "skip" | "lock" | "unlock" | "kick" | "end";

export function hostAction(
  g: Game,
  action: HostAction,
  targetPlayerId?: string
): { ok: true } | { ok: false; error: string } {
  switch (action) {
    case "start":
      if (g.phase !== "lobby") return { ok: false, error: "Game already started" };
      if (livingPlayers(g).length === 0) return { ok: false, error: "No players have joined yet" };
      advance(g);
      return { ok: true };
    case "next":
      if (g.phase === "reveal") toScoreboard(g);
      else if (g.phase === "scoreboard") advance(g);
      else return { ok: false, error: "Nothing to advance" };
      return { ok: true };
    case "skip":
      if (g.phase === "answering") closeAnswering(g);
      else if (g.phase === "intro") openAnswering(g);
      else return { ok: false, error: "Nothing to skip" };
      return { ok: true };
    case "lock":
      g.locked = true;
      return { ok: true };
    case "unlock":
      g.locked = false;
      return { ok: true };
    case "kick": {
      const p = targetPlayerId ? g.players.get(targetPlayerId) : undefined;
      if (!p) return { ok: false, error: "Player not found" };
      p.kicked = true;
      return { ok: true };
    }
    case "end":
      finish(g);
      return { ok: true };
  }
}

export function joinGame(
  g: Game,
  nickname: string
): { ok: true; playerId: string; token: string } | { ok: false; error: string } {
  if (g.locked) return { ok: false, error: "This game is locked" };
  if (g.phase === "podium" || g.phase === "ended") return { ok: false, error: "This game has ended" };
  if (g.phase !== "lobby" && !g.settings.lateJoin)
    return { ok: false, error: "This game has already started" };
  if (livingPlayers(g).length >= g.settings.playerLimit)
    return { ok: false, error: "This game is full" };

  const name = nickname.trim().slice(0, 20);
  if (!name) return { ok: false, error: "Please enter a nickname" };
  const taken = livingPlayers(g).some((p) => p.name.toLowerCase() === name.toLowerCase());
  if (taken) return { ok: false, error: "That nickname is taken" };

  const now = Date.now();
  const player: ServerPlayer = {
    id: randId(12),
    token: randId(),
    name,
    score: 0,
    streak: 0,
    correctCount: 0,
    answers: [],
    kicked: false,
    joinedAt: now,
    lastSeen: now,
  };
  g.players.set(player.id, player);
  return { ok: true, playerId: player.id, token: player.token };
}

export function authPlayer(g: Game, playerId: string, token: string): ServerPlayer | null {
  const p = g.players.get(playerId);
  if (!p || p.token !== token) return null;
  p.lastSeen = Date.now();
  return p;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function submitAnswer(
  g: Game,
  p: ServerPlayer,
  payload: { choices?: number[]; text?: string; sliderValue?: number }
): { ok: true } | { ok: false; error: string } {
  if (g.phase !== "answering") return { ok: false, error: "Answering is closed" };
  if (p.kicked) return { ok: false, error: "You were removed from the game" };
  if (p.answers[g.currentIndex]) return { ok: false, error: "Already answered" };

  const q = g.questions[g.currentIndex];
  const elapsedMs = Math.max(0, Date.now() - (g.answeringOpenedAt ?? Date.now()));
  const timeLimitMs = q.timeLimit * 1000;

  let correct = false;
  let proximity = 1; // slider partial-credit factor

  if (q.type === "quiz" || q.type === "truefalse") {
    const chosen = (payload.choices ?? []).filter(
      (i) => Number.isInteger(i) && i >= 0 && i < q.choices.length
    );
    if (chosen.length === 0) return { ok: false, error: "No answer given" };
    if (q.multiSelect && q.type === "quiz") {
      const want = new Set(q.correct);
      correct = chosen.length === want.size && chosen.every((c) => want.has(c));
    } else {
      correct = q.correct.includes(chosen[0]);
    }
    payload.choices = chosen;
  } else if (q.type === "poll") {
    const chosen = (payload.choices ?? []).filter(
      (i) => Number.isInteger(i) && i >= 0 && i < q.choices.length
    );
    if (chosen.length === 0) return { ok: false, error: "No answer given" };
    correct = true; // polls have no wrong answers
    payload.choices = chosen;
  } else if (q.type === "typeanswer") {
    const text = normalizeText(payload.text ?? "");
    if (!text) return { ok: false, error: "No answer given" };
    correct = (q.acceptedAnswers ?? []).some((a) => normalizeText(a) === text);
  } else if (q.type === "slider") {
    const v = payload.sliderValue;
    if (typeof v !== "number" || Number.isNaN(v)) return { ok: false, error: "No answer given" };
    const min = q.sliderMin ?? 0;
    const max = q.sliderMax ?? 100;
    const target = q.sliderCorrect ?? min;
    const tol = q.sliderTolerance ?? 0;
    const dist = Math.abs(v - target);
    correct = dist <= tol;
    // Partial credit fades to zero once you're off by >25% of the range.
    const fadeZone = Math.max((max - min) * 0.25, 1e-9);
    proximity = correct ? 1 : Math.max(0, 1 - (dist - tol) / fadeZone);
  }

  let pointsEarned = 0;
  if (q.points !== "none" && q.type !== "poll") {
    const base = q.points === "double" ? 2000 : 1000;
    const speedFactor = 1 - Math.min(elapsedMs / timeLimitMs, 1) / 2;
    if (correct) {
      pointsEarned = Math.round(base * speedFactor);
      if (g.settings.streakBonus) pointsEarned += Math.min(p.streak, 5) * 100;
    } else if (q.type === "slider" && proximity > 0) {
      pointsEarned = Math.round(base * speedFactor * proximity * 0.5);
    }
  }

  if (correct && q.type !== "poll") {
    p.streak += 1;
    p.correctCount += 1;
  } else if (q.type !== "poll") {
    p.streak = 0;
  }
  p.score += pointsEarned;

  p.answers[g.currentIndex] = {
    questionIndex: g.currentIndex,
    choices: payload.choices,
    text: payload.text,
    sliderValue: payload.sliderValue,
    elapsedMs,
    correct,
    pointsEarned,
    streakAfter: p.streak,
  };

  tick(g); // may close answering if everyone has now answered
  return { ok: true };
}

// ---------- Snapshots ----------

function ranked(g: Game): (ServerPlayer & { rank: number })[] {
  const list = livingPlayers(g).sort(
    (a, b) => b.score - a.score || a.joinedAt - b.joinedAt || a.name.localeCompare(b.name)
  );
  let rank = 0;
  let prevScore: number | null = null;
  return list.map((p, i) => {
    if (p.score !== prevScore) {
      rank = i + 1;
      prevScore = p.score;
    }
    return Object.assign(p, { rank });
  });
}

function toPublic(g: Game, p: ServerPlayer & { rank: number }): PlayerPublic {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    streak: p.streak,
    correctCount: p.correctCount,
    answeredCurrent: g.currentIndex >= 0 ? !!p.answers[g.currentIndex] : false,
    rank: p.rank,
  };
}

function liveQuestion(g: Game): LiveQuestion | null {
  if (g.currentIndex < 0 || g.currentIndex >= g.questions.length) return null;
  const q = g.questions[g.currentIndex];
  return {
    index: g.currentIndex,
    total: g.questions.length,
    type: q.type,
    text: q.text,
    image: q.image,
    emoji: q.emoji,
    choices: q.type === "typeanswer" || q.type === "slider" ? [] : q.choices,
    multiSelect: q.multiSelect && q.type === "quiz",
    timeLimit: q.timeLimit,
    points: q.points,
    sliderMin: q.sliderMin,
    sliderMax: q.sliderMax,
  };
}

function revealInfo(g: Game): RevealInfo | null {
  if (g.currentIndex < 0) return null;
  const q = g.questions[g.currentIndex];
  const living = livingPlayers(g);
  const answers = living.map((p) => p.answers[g.currentIndex]).filter(Boolean) as PlayerAnswer[];

  let distribution: number[];
  if (q.type === "typeanswer" || q.type === "slider") {
    distribution = [
      answers.filter((a) => a.correct).length,
      answers.filter((a) => !a.correct).length,
    ];
  } else {
    distribution = q.choices.map(
      (_, i) => answers.filter((a) => a.choices?.includes(i)).length
    );
  }

  return {
    correct: q.type === "poll" ? [] : q.correct,
    acceptedAnswers: q.type === "typeanswer" ? q.acceptedAnswers : undefined,
    sliderCorrect: q.type === "slider" ? q.sliderCorrect : undefined,
    distribution,
    answeredCount: answers.length,
    totalPlayers: living.length,
  };
}

function podium(g: Game): PlayerPublic[] | null {
  if (g.phase !== "podium" && g.phase !== "ended") return null;
  return ranked(g).slice(0, 3).map((p) => toPublic(g, p));
}

export function hostSnapshot(g: Game): HostStateSnapshot {
  const rankedPlayers = ranked(g);
  return {
    pin: g.pin,
    phase: g.phase,
    setTitle: g.setTitle,
    settings: g.settings,
    locked: g.locked,
    players: rankedPlayers.map((p) => toPublic(g, p)),
    question: g.phase === "lobby" ? null : liveQuestion(g),
    reveal: g.phase === "reveal" || g.phase === "scoreboard" ? revealInfo(g) : null,
    msRemaining: g.phaseEndsAt ? Math.max(0, g.phaseEndsAt - Date.now()) : null,
    answeredCount:
      g.currentIndex >= 0
        ? livingPlayers(g).filter((p) => p.answers[g.currentIndex]).length
        : 0,
    questionCount: g.questions.length,
    currentIndex: g.currentIndex,
    podium: podium(g),
  };
}

export function playerSnapshot(g: Game, p: ServerPlayer): PlayerStateSnapshot {
  const rankedPlayers = ranked(g);
  const meRanked = rankedPlayers.find((r) => r.id === p.id) ?? null;
  const showReveal = g.phase === "reveal" || g.phase === "scoreboard";
  const q = g.currentIndex >= 0 ? g.questions[g.currentIndex] : null;
  const myAnswer = g.currentIndex >= 0 ? p.answers[g.currentIndex] ?? null : null;

  return {
    pin: g.pin,
    phase: g.phase,
    setTitle: g.setTitle,
    me: meRanked ? toPublic(g, meRanked) : null,
    playerCount: livingPlayers(g).length,
    question: g.phase === "lobby" ? null : liveQuestion(g),
    answered: !!myAnswer,
    lastResult:
      showReveal && q
        ? {
            correct: myAnswer?.correct ?? false,
            pointsEarned: myAnswer?.pointsEarned ?? 0,
            streak: p.streak,
            rank: meRanked?.rank ?? 0,
            scoreAfter: p.score,
            correctChoices: q.type === "poll" ? [] : q.correct,
            myChoices: myAnswer?.choices,
            acceptedAnswers: q.type === "typeanswer" ? q.acceptedAnswers : undefined,
            sliderCorrect: q.type === "slider" ? q.sliderCorrect : undefined,
          }
        : null,
    msRemaining: g.phaseEndsAt ? Math.max(0, g.phaseEndsAt - Date.now()) : null,
    podium: podium(g),
    finalRank:
      g.phase === "podium" || g.phase === "ended" ? meRanked?.rank ?? null : null,
    kicked: p.kicked,
  };
}

/** Full end-of-game report for the host. */
export function gameReport(g: Game) {
  const rankedPlayers = ranked(g);
  return {
    pin: g.pin,
    setTitle: g.setTitle,
    playedAt: g.createdAt,
    questionCount: g.questions.length,
    playerCount: rankedPlayers.length,
    questions: g.questions.map((q, qi) => {
      const answers = rankedPlayers
        .map((p) => p.answers[qi])
        .filter(Boolean) as PlayerAnswer[];
      const correct = answers.filter((a) => a.correct).length;
      return {
        index: qi,
        text: q.text,
        type: q.type,
        answered: answers.length,
        correct,
        accuracy: answers.length ? Math.round((correct / answers.length) * 100) : 0,
        avgTimeMs: answers.length
          ? Math.round(answers.reduce((s, a) => s + a.elapsedMs, 0) / answers.length)
          : 0,
      };
    }),
    players: rankedPlayers.map((p) => ({
      rank: p.rank,
      name: p.name,
      score: p.score,
      correctCount: p.correctCount,
      answeredCount: p.answers.filter(Boolean).length,
      accuracy: p.answers.filter(Boolean).length
        ? Math.round((p.correctCount / p.answers.filter(Boolean).length) * 100)
        : 0,
    })),
  };
}
