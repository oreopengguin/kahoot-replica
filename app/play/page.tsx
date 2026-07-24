"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ANSWER_BG, ANSWER_FG, AnswerShape, SHAPE_NAMES } from "@/components/AnswerShape";
import { Confetti } from "@/components/Confetti";
import { QuestionTypeBadge } from "@/components/QuestionTypeBadge";
import {
  api,
  clearPlayerSession,
  loadPlayerSession,
  savePlayerSession,
  usePoll,
} from "@/lib/client";
import { generateNickname } from "@/lib/names";
import { sfx } from "@/lib/sounds";
import { PlayerStateSnapshot } from "@/lib/types";

interface GameInfo {
  pin: string;
  setTitle: string;
  phase: string;
  locked: boolean;
  nicknameGenerator: boolean;
  lateJoin: boolean;
  playerCount: number;
}

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayFlow />
    </Suspense>
  );
}

function PlayFlow() {
  const searchParams = useSearchParams();
  const [session, setSession] = useState<{ pin: string; playerId: string; token: string } | null>(null);
  const [checkedSession, setCheckedSession] = useState(false);

  useEffect(() => {
    const s = loadPlayerSession();
    const urlPin = searchParams.get("pin");
    // Resume an existing session only if it matches the requested PIN (or none given).
    if (s && (!urlPin || s.pin === urlPin)) setSession(s);
    setCheckedSession(true);
  }, [searchParams]);

  if (!checkedSession) return null;

  return session ? (
    <GameScreen
      session={session}
      onLeave={() => {
        clearPlayerSession();
        setSession(null);
      }}
    />
  ) : (
    <JoinFlow onJoined={setSession} initialPin={searchParams.get("pin") ?? ""} />
  );
}

// ---------- Join flow ----------

function JoinFlow({
  onJoined,
  initialPin,
}: {
  onJoined: (s: { pin: string; playerId: string; token: string }) => void;
  initialPin: string;
}) {
  const router = useRouter();
  const [pin, setPin] = useState(initialPin);
  const [info, setInfo] = useState<GameInfo | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checkedInitial = useRef(false);

  const checkPin = async (p: string) => {
    setBusy(true);
    setError(null);
    const res = await api<GameInfo>(`/api/games/${p}/info`);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data.locked) {
      setError("This game is locked by the host");
      return;
    }
    if (res.data.phase !== "lobby" && !res.data.lateJoin) {
      setError("This game has already started");
      return;
    }
    if (res.data.phase === "podium" || res.data.phase === "ended") {
      setError("This game has ended");
      return;
    }
    if (res.data.nicknameGenerator) setNickname(generateNickname());
    setInfo(res.data);
  };

  useEffect(() => {
    if (initialPin.length === 6 && !checkedInitial.current) {
      checkedInitial.current = true;
      void checkPin(initialPin);
    }
     
  }, [initialPin]);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    setBusy(true);
    setError(null);
    const res = await api<{ playerId: string; token: string }>(`/api/games/${info.pin}/join`, {
      method: "POST",
      body: JSON.stringify({ nickname }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const session = { pin: info.pin, playerId: res.data.playerId, token: res.data.token, nickname };
    savePlayerSession(session);
    sfx.playerJoined();
    onJoined(session);
  };

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Logo size="sm" />
        <ThemeSwitcher />
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-24">
        {!info ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length === 6) void checkPin(pin);
            }}
            className={`anim-pop w-full max-w-sm rounded-3xl bg-surface p-8 text-center shadow-pop ${error ? "anim-shake" : ""}`}
          >
            <div className="text-5xl" aria-hidden>🎮</div>
            <h1 className="mt-2 text-2xl font-black">Join a game</h1>
            <input
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="Game PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-label="Game PIN"
              className="mt-6 w-full rounded-2xl border-2 border-surface-2 bg-surface-2 px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.3em] placeholder:tracking-normal placeholder:text-mut/50 focus:border-brand"
            />
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm font-bold text-bad">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || pin.length !== 6}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-4 text-xl font-black text-white shadow-card transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {busy ? "Checking…" : "Find game"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-3 text-sm font-bold text-mut hover:text-ink"
            >
              ← Home
            </button>
          </form>
        ) : (
          <form
            onSubmit={join}
            className={`anim-pop w-full max-w-sm rounded-3xl bg-surface p-8 text-center shadow-pop ${error ? "anim-shake" : ""}`}
          >
            <div className="text-5xl" aria-hidden>👋</div>
            <h1 className="mt-2 text-2xl font-black">{info.setTitle}</h1>
            <p className="mt-1 text-sm text-mut">
              {info.playerCount} player{info.playerCount === 1 ? "" : "s"} in ·{" "}
              {info.phase === "lobby" ? "waiting to start" : "in progress — jump in!"}
            </p>
            <div className="mt-6 flex gap-2">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                readOnly={info.nicknameGenerator}
                placeholder="Your nickname"
                aria-label="Nickname"
                autoFocus={!info.nicknameGenerator}
                className="min-w-0 flex-1 rounded-2xl border-2 border-surface-2 bg-surface-2 px-4 py-3.5 text-center text-xl font-black focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setNickname(generateNickname())}
                title="Random nickname"
                aria-label="Generate a random nickname"
                className="rounded-2xl bg-surface-2 px-4 text-2xl transition-transform hover:rotate-12 hover:scale-110"
              >
                🎲
              </button>
            </div>
            {info.nicknameGenerator && (
              <p className="mt-2 text-xs text-mut">
                The host turned on the nickname generator — roll the dice until you like one!
              </p>
            )}
            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm font-bold text-bad">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !nickname.trim()}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-4 text-xl font-black text-white shadow-card transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
            >
              {busy ? "Joining…" : "Let's go!"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

// ---------- In-game ----------

function GameScreen({
  session,
  onLeave,
}: {
  session: { pin: string; playerId: string; token: string };
  onLeave: () => void;
}) {
  const url = `/api/games/${session.pin}/state?playerId=${session.playerId}&token=${session.token}`;
  const { data: state, gone } = usePoll<PlayerStateSnapshot>(url, 600);

  // Play result sound once per reveal.
  const soundedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!state) return;
    if (state.phase === "reveal" && state.question) {
      const key = `q${state.question.index}`;
      if (soundedFor.current !== key) {
        soundedFor.current = key;
        if (state.answered) {
          if (state.lastResult?.correct) sfx.correct();
          else sfx.wrong();
        }
      }
    }
    if (state.phase === "podium" && soundedFor.current !== "podium") {
      soundedFor.current = "podium";
      sfx.podium();
    }
  }, [state]);

  if (gone || state?.kicked) {
    return (
      <FullScreen emoji={state?.kicked ? "🚪" : "⌛"} title={state?.kicked ? "You were removed from the game" : "This game has ended"}>
        <button onClick={onLeave} className="mt-4 rounded-full bg-brand px-6 py-3 font-black text-white">
          Join another game
        </button>
      </FullScreen>
    );
  }
  if (!state) {
    return <FullScreen emoji="📡" title="Connecting…" />;
  }

  const header = (
    <header className="flex items-center justify-between gap-2 px-4 py-3">
      <span className="rounded-full bg-surface px-3 py-1 text-sm font-bold shadow-card truncate max-w-[40vw]">
        {state.me?.name ?? "…"}
      </span>
      <div className="flex items-center gap-2">
        <ThemeSwitcher withSound />
        <span className="rounded-full bg-surface px-3 py-1 font-mono text-sm font-bold shadow-card">
          {state.me?.score.toLocaleString() ?? 0}
        </span>
      </div>
    </header>
  );

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      {header}
      {state.phase === "lobby" && (
        <FullScreen emoji="🎉" title="You're in!" inline>
          <p className="text-mut">See your name on the host screen? The game starts soon.</p>
          <p className="mt-3 rounded-full bg-surface px-4 py-1.5 text-sm font-bold text-mut shadow-card">
            👥 {state.playerCount} player{state.playerCount === 1 ? "" : "s"} · {state.setTitle}
          </p>
          <button onClick={onLeave} className="mt-6 text-sm font-bold text-mut underline-offset-4 hover:underline">
            Leave game
          </button>
        </FullScreen>
      )}
      {state.phase === "intro" && state.question && (
        <FullScreen emoji={state.question.emoji ?? "🧠"} title={state.question.text} inline>
          <QuestionTypeBadge
            type={state.question.type}
            multiSelect={state.question.multiSelect}
            className="anim-pop mt-4"
          />
          {state.msRemaining !== null && (
            <div
              key={Math.ceil(state.msRemaining / 1000)}
              className="anim-pop mt-5 font-mono text-6xl font-black text-brand"
              role="timer"
              aria-label={`Answering opens in ${Math.ceil(state.msRemaining / 1000)} seconds`}
            >
              {Math.ceil(state.msRemaining / 1000)}
            </div>
          )}
          <p className="anim-pulse-soft mt-2 font-bold text-mut">
            Get ready… question {state.question.index + 1} of {state.question.total}
          </p>
          {state.question.points === "double" && (
            <p className="mt-2 rounded-full bg-brand-soft px-4 py-1 font-black text-brand">⚡ Double points!</p>
          )}
        </FullScreen>
      )}
      {state.phase === "answering" && state.question && (
        state.answered ? (
          <FullScreen emoji="⏳" title="Answer locked in!" inline>
            <p className="anim-pulse-soft text-mut">Waiting for everyone else…</p>
          </FullScreen>
        ) : (
          <AnswerPad state={state} session={session} />
        )
      )}
      {(state.phase === "reveal" || state.phase === "scoreboard") && <ResultScreen state={state} />}
      {(state.phase === "podium" || state.phase === "ended") && (
        <FinalScreen state={state} onLeave={onLeave} />
      )}
    </main>
  );
}

function FullScreen({
  emoji,
  title,
  children,
  inline,
}: {
  emoji: string;
  title: string;
  children?: React.ReactNode;
  inline?: boolean;
}) {
  const content = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
      <div className="anim-float text-6xl" aria-hidden>{emoji}</div>
      <h1 className="anim-slide-up mt-4 max-w-lg text-2xl font-black sm:text-3xl">{title}</h1>
      {children}
    </div>
  );
  return inline ? content : <main className="flex min-h-screen flex-col">{content}</main>;
}

function AnswerPad({
  state,
  session,
}: {
  state: PlayerStateSnapshot;
  session: { pin: string; playerId: string; token: string };
}) {
  const q = state.question!;
  const [selected, setSelected] = useState<number[]>([]);
  const [text, setText] = useState("");
  const [slider, setSlider] = useState(((q.sliderMin ?? 0) + (q.sliderMax ?? 100)) / 2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMs = q.timeLimit * 1000;
  const frac = state.msRemaining !== null ? Math.max(0, Math.min(1, state.msRemaining / totalMs)) : 1;
  const seconds = state.msRemaining !== null ? Math.ceil(state.msRemaining / 1000) : null;
  const urgent = seconds !== null && seconds <= 5;

  const submit = async (payload: { choices?: number[]; text?: string; sliderValue?: number }) => {
    if (submitting) return;
    setSubmitting(true);
    sfx.select();
    const res = await api(`/api/games/${session.pin}/answer`, {
      method: "POST",
      body: JSON.stringify({ playerId: session.playerId, token: session.token, ...payload }),
    });
    if (!res.ok) {
      // "Answering is closed" just means time ran out — the next poll shows the reveal.
      if (!/closed/i.test(res.error)) setError(res.error);
      setSubmitting(false);
    }
    // On success stay "submitting" — the next poll flips to the waiting screen.
  };

  return (
    <div className="flex flex-1 flex-col px-3 pb-4">
      <div className="mx-1 mb-3 flex items-center gap-3">
        <span
          className={`min-w-11 text-center font-mono text-2xl font-black ${
            urgent ? "anim-pulse-soft text-bad" : "text-ink"
          }`}
          role="timer"
          aria-label={seconds !== null ? `${seconds} seconds remaining` : "Time remaining"}
        >
          {seconds ?? "–"}
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div
            className={`timer-bar h-full rounded-full ${urgent ? "bg-bad" : "bg-brand"}`}
            style={{ width: `${frac * 100}%` }}
          />
        </div>
      </div>
      {q.multiSelect && (
        <div className="mb-2 text-center">
          <QuestionTypeBadge type={q.type} multiSelect size="sm" />
        </div>
      )}
      {q.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={q.image}
          alt=""
          className="mx-auto mb-2 max-h-32 rounded-xl object-contain shadow-card"
        />
      )}
      <p className="mb-3 text-center text-lg font-bold leading-snug">{q.text}</p>

      {(q.type === "quiz" || q.type === "truefalse" || q.type === "poll") && (
        <>
          <div className={`grid flex-1 gap-3 ${q.choices.filter((c) => c.trim()).length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}>
            {q.choices.map((c, i) =>
              c.trim() ? (
                <button
                  key={i}
                  disabled={submitting}
                  onClick={() => {
                    if (q.multiSelect) {
                      setSelected((sel) =>
                        sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]
                      );
                      sfx.select();
                    } else {
                      void submit({ choices: [i] });
                    }
                  }}
                  aria-pressed={q.multiSelect ? selected.includes(i) : undefined}
                  className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-lg font-black shadow-card transition-all active:scale-95 sm:text-xl ${ANSWER_BG[i]} ${ANSWER_FG[i]} ${
                    q.multiSelect && selected.includes(i) ? "ring-4 ring-ring-c scale-[0.98]" : ""
                  } disabled:opacity-60`}
                >
                  <AnswerShape index={i} className="h-8 w-8" />
                  <span className="sr-only">{SHAPE_NAMES[i]}: </span>
                  <span className="break-words leading-tight">{c}</span>
                  {q.multiSelect && selected.includes(i) && <span aria-hidden>✓ selected</span>}
                </button>
              ) : null
            )}
          </div>
          {q.multiSelect && (
            <button
              onClick={() => void submit({ choices: selected })}
              disabled={selected.length === 0 || submitting}
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-4 text-xl font-black text-white shadow-pop transition-transform active:scale-95 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : `Submit ${selected.length} answer${selected.length === 1 ? "" : "s"}`}
            </button>
          )}
        </>
      )}

      {q.type === "typeanswer" && (
        <form
          className="flex flex-1 flex-col items-center justify-center gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void submit({ text });
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            autoFocus
            placeholder="Type your answer…"
            aria-label="Your answer"
            className="w-full max-w-md rounded-2xl border-2 border-surface-2 bg-surface px-4 py-4 text-center text-2xl font-black shadow-card focus:border-brand"
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="w-full max-w-md rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-4 text-xl font-black text-white shadow-pop transition-transform active:scale-95 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </form>
      )}

      {q.type === "slider" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5">
          <div className="font-mono text-6xl font-black text-brand">{slider}</div>
          <input
            type="range"
            min={q.sliderMin ?? 0}
            max={q.sliderMax ?? 100}
            step={1}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
            aria-label="Your guess"
            className="w-full max-w-md"
          />
          <div className="flex w-full max-w-md justify-between font-mono text-sm text-mut">
            <span>{q.sliderMin}</span>
            <span>{q.sliderMax}</span>
          </div>
          <button
            onClick={() => void submit({ sliderValue: slider })}
            disabled={submitting}
            className="w-full max-w-md rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-4 text-xl font-black text-white shadow-pop transition-transform active:scale-95 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Lock it in"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-center text-sm font-bold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

function ResultScreen({ state }: { state: PlayerStateSnapshot }) {
  const r = state.lastResult;
  const answered = state.answered;
  const isPoll = state.question?.type === "poll";

  if (!r) return <FullScreen emoji="📊" title="Results…" inline />;

  const good = isPoll ? true : r.correct;
  return (
    <div
      className={`flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center ${
        isPoll ? "" : good && answered ? "bg-ok/10" : "bg-bad/10"
      }`}
    >
      {isPoll ? (
        <>
          <div className="anim-pop text-7xl" aria-hidden>📊</div>
          <h1 className="anim-slide-up mt-3 text-3xl font-black">Thanks for voting!</h1>
        </>
      ) : answered ? (
        <>
          <div className="anim-pop text-7xl" aria-hidden>{good ? "✅" : "❌"}</div>
          <h1 className="anim-slide-up mt-3 text-3xl font-black">
            {good ? "Correct!" : "Not quite…"}
          </h1>
          {good && (
            <p className="anim-pop mt-2 font-mono text-2xl font-black text-ok" style={{ animationDelay: "0.15s" }}>
              +{r.pointsEarned.toLocaleString()}
            </p>
          )}
          {!good && r.pointsEarned > 0 && (
            <p className="anim-pop mt-2 font-mono text-xl font-black text-brand">
              +{r.pointsEarned.toLocaleString()} for a close guess!
            </p>
          )}
          {r.streak >= 2 && (
            <p className="mt-2 rounded-full bg-surface px-4 py-1.5 font-bold shadow-card">
              🔥 {r.streak} answer streak!
            </p>
          )}
        </>
      ) : (
        <>
          <div className="anim-pop text-7xl" aria-hidden>⏰</div>
          <h1 className="anim-slide-up mt-3 text-3xl font-black">Time&apos;s up!</h1>
        </>
      )}

      {!isPoll && !good && (
        <p className="mt-3 max-w-sm text-sm font-medium text-mut">
          {state.question?.type === "typeanswer" && r.acceptedAnswers?.length
            ? `Answer: ${r.acceptedAnswers[0]}`
            : state.question?.type === "slider"
              ? `Answer: ${r.sliderCorrect}`
              : state.question
                ? `Answer: ${r.correctChoices.map((i) => state.question!.choices[i]).filter(Boolean).join(", ")}`
                : ""}
        </p>
      )}

      <div className="mt-8 rounded-2xl bg-surface px-6 py-4 shadow-card">
        <p className="font-mono text-3xl font-black">{r.scoreAfter.toLocaleString()}</p>
        <p className="text-sm font-bold text-mut">
          You&apos;re in {ordinal(r.rank)} place
        </p>
      </div>
    </div>
  );
}

function FinalScreen({ state, onLeave }: { state: PlayerStateSnapshot; onLeave: () => void }) {
  const rank = state.finalRank;
  const onPodium = rank !== null && rank <= 3;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
      {onPodium && <Confetti pieces={90} />}
      <div className="anim-pop text-7xl" aria-hidden>
        {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏁"}
      </div>
      <h1 className="anim-slide-up mt-4 text-3xl font-black">
        {onPodium ? `You made the podium!` : "Game over!"}
      </h1>
      {rank !== null && (
        <p className="mt-2 text-lg font-bold text-mut">
          {ordinal(rank)} place · {state.me?.score.toLocaleString() ?? 0} points ·{" "}
          {state.me?.correctCount ?? 0} correct
        </p>
      )}
      <button
        onClick={onLeave}
        className="mt-8 rounded-full bg-gradient-to-r from-brand to-brand-2 px-8 py-3.5 text-lg font-black text-white shadow-pop transition-transform hover:scale-105"
      >
        Play again
      </button>
      <Link href="/" className="mt-4 text-sm font-bold text-mut underline-offset-4 hover:underline">
        Home
      </Link>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
