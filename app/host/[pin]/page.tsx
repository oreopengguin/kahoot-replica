"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ANSWER_BG, ANSWER_FG, AnswerShape } from "@/components/AnswerShape";
import { Confetti } from "@/components/Confetti";
import { QuestionTypeBadge } from "@/components/QuestionTypeBadge";
import { RevealChoices } from "@/components/RevealChoices";
import { DistributionChart } from "@/components/DistributionChart";
import { Podium } from "@/components/Podium";
import { TimerRing } from "@/components/TimerRing";
import { api, loadHostSession, usePoll } from "@/lib/client";
import { sfx, startLobbyMusic, stopLobbyMusic } from "@/lib/sounds";
import { HostStateSnapshot } from "@/lib/types";

export default function HostPage() {
  const params = useParams<{ pin: string }>();
  const pin = params.pin;
  const [token, setToken] = useState<string | null>(null);
  const [noSession, setNoSession] = useState(false);

  useEffect(() => {
    const s = loadHostSession();
    if (s && s.pin === pin) setToken(s.token);
    else setNoSession(true);
  }, [pin]);

  const url = token ? `/api/games/${pin}/state?role=host&token=${token}` : null;
  const { data: state, error, gone } = usePoll<HostStateSnapshot>(url, 600);

  // ----- Phase-transition sounds -----
  const prevPhase = useRef<string | null>(null);
  const prevCount = useRef(0);
  useEffect(() => {
    if (!state) return;
    if (state.phase === "lobby") {
      startLobbyMusic();
      if (state.players.length > prevCount.current) sfx.playerJoined();
      prevCount.current = state.players.length;
    } else {
      stopLobbyMusic();
    }
    if (prevPhase.current !== state.phase) {
      if (state.phase === "intro") sfx.intro();
      if (state.phase === "reveal") sfx.reveal();
      if (state.phase === "podium") sfx.podium();
      prevPhase.current = state.phase;
    }
    return () => stopLobbyMusic();
  }, [state]);

  // Countdown ticks in the last 5 seconds of answering.
  const lastTicked = useRef(-1);
  useEffect(() => {
    if (!state || state.phase !== "answering" || state.msRemaining === null) return;
    const s = Math.ceil(state.msRemaining / 1000);
    if (s <= 5 && s >= 1 && s !== lastTicked.current) {
      lastTicked.current = s;
      sfx.tick();
    }
  }, [state]);

  const act = async (action: string, playerId?: string) => {
    if (!token) return;
    await api(`/api/games/${pin}/host`, {
      method: "POST",
      body: JSON.stringify({ token, action, playerId }),
    });
  };

  if (noSession) {
    return (
      <CenterMessage emoji="🔑" title="No host session for this game">
        Host sessions live in the tab that created the game.{" "}
        <Link href="/dashboard" className="font-bold text-brand underline">
          Back to dashboard
        </Link>
      </CenterMessage>
    );
  }
  if (gone) {
    return (
      <CenterMessage emoji="⌛" title="This game has expired">
        <Link href="/dashboard" className="font-bold text-brand underline">
          Host a new one from your dashboard
        </Link>
      </CenterMessage>
    );
  }
  if (!state) {
    return (
      <CenterMessage emoji="🎮" title="Connecting…">
        {error ?? "Setting up your game"}
      </CenterMessage>
    );
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          {state.phase !== "lobby" && state.phase !== "podium" && state.phase !== "ended" && (
            <span className="rounded-full bg-surface px-3 py-1 text-sm font-bold shadow-card">
              Question {state.currentIndex + 1} / {state.questionCount}
            </span>
          )}
          <span className="rounded-full bg-surface px-3 py-1 font-mono text-sm font-bold shadow-card">
            PIN {state.pin}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeSwitcher />
          {state.phase !== "podium" && state.phase !== "ended" && (
            <ConfirmButton
              label="End game"
              confirmLabel="End for everyone?"
              onConfirm={() => void act("end")}
            />
          )}
        </div>
      </header>

      {state.phase === "lobby" && <Lobby state={state} act={act} />}
      {state.phase === "intro" && <Intro state={state} act={act} />}
      {state.phase === "answering" && <Answering state={state} act={act} />}
      {(state.phase === "reveal" || state.phase === "scoreboard") && (
        <RevealAndScoreboard state={state} act={act} />
      )}
      {(state.phase === "podium" || state.phase === "ended") && (
        <Finale state={state} pin={pin} token={token!} />
      )}
    </main>
  );
}

/** Two-step inline confirm: first click arms it for 3s, second click fires. */
function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={
        className ??
        `rounded-full px-4 py-2 text-sm font-bold transition-all hover:scale-105 ${
          armed ? "bg-bad text-white" : "bg-bad-soft text-bad"
        }`
      }
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

function CenterMessage({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="text-6xl" aria-hidden>{emoji}</div>
      <h1 className="text-2xl font-black">{title}</h1>
      <div className="text-mut">{children}</div>
    </main>
  );
}

function Lobby({
  state,
  act,
}: {
  state: HostStateSnapshot;
  act: (a: string, p?: string) => Promise<void>;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin.replace(/^https?:\/\//, "")), []);

  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-10">
      <div className="anim-pop mt-4 flex flex-col items-center rounded-3xl bg-surface px-8 py-6 text-center shadow-pop sm:px-16">
        <p className="text-sm font-bold uppercase tracking-widest text-mut">
          Join at <span className="text-brand">{origin || "…"}</span> with PIN
        </p>
        <button
          className="mt-2 font-mono text-6xl font-black tracking-[0.15em] text-ink transition-transform hover:scale-105 sm:text-8xl"
          title="Click to copy join link"
          onClick={() => {
            navigator.clipboard
              .writeText(`${window.location.origin}/play?pin=${state.pin}`)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => {});
          }}
        >
          {state.pin}
        </button>
        <p className="mt-1 h-5 text-sm font-bold text-ok" aria-live="polite">
          {copied ? "✓ Join link copied!" : ""}
        </p>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <span className="rounded-full bg-surface px-4 py-2 font-bold shadow-card">
          👥 {state.players.length} player{state.players.length === 1 ? "" : "s"}
        </span>
        <button
          onClick={() => act(state.locked ? "unlock" : "lock")}
          aria-pressed={state.locked}
          className={`rounded-full px-4 py-2 font-bold shadow-card transition-colors ${
            state.locked ? "bg-bad-soft text-bad" : "bg-surface"
          }`}
        >
          {state.locked ? "🔒 Locked" : "🔓 Open"}
        </button>
        <button
          onClick={() => act("start")}
          disabled={state.players.length === 0}
          className="rounded-full bg-gradient-to-r from-brand to-brand-2 px-8 py-2.5 text-lg font-black text-white shadow-pop transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
        >
          Start game →
        </button>
      </div>

      <p className="mt-2 text-sm text-mut">{state.setTitle} · {state.questionCount} questions</p>

      <div className="mt-8 flex max-w-4xl flex-wrap items-start justify-center gap-2">
        {state.players.length === 0 && (
          <p className="anim-pulse-soft text-lg text-mut">Waiting for players to join…</p>
        )}
        {state.players.map((p, i) => (
          <PlayerChip key={p.id} name={p.name} index={i} onKick={() => void act("kick", p.id)} />
        ))}
      </div>
    </div>
  );
}

/** Lobby chip: click once to arm removal, click again to kick. */
function PlayerChip({ name, index, onKick }: { name: string; index: number; onKick: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={() => {
        if (armed) onKick();
        else setArmed(true);
      }}
      title={armed ? `Remove ${name}?` : `${name} — click to remove`}
      className={`anim-pop rounded-full px-4 py-2 font-bold shadow-card transition-all ${
        armed ? "bg-bad text-white" : "bg-surface hover:bg-bad-soft hover:text-bad"
      }`}
      style={{ animationDelay: `${(index % 12) * 0.04}s` }}
    >
      {armed ? `Remove ${name}?` : name}
    </button>
  );
}

function Intro({
  state,
  act,
}: {
  state: HostStateSnapshot;
  act: (a: string) => Promise<void>;
}) {
  const q = state.question!;
  const seconds = state.msRemaining !== null ? Math.ceil(state.msRemaining / 1000) : null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16 text-center">
      <p className="anim-pop text-sm font-black uppercase tracking-[0.3em] text-mut">
        Question {q.index + 1} of {q.total}
        {q.points === "double" && <span className="ml-2 text-gold">· ⚡ DOUBLE POINTS</span>}
      </p>
      <QuestionTypeBadge type={q.type} multiSelect={q.multiSelect} size="lg" className="anim-pop mt-4" />
      {q.emoji && <div className="anim-float mt-4 text-7xl">{q.emoji}</div>}
      <h1 className="anim-slide-up mt-4 max-w-3xl text-3xl font-black sm:text-5xl">{q.text}</h1>
      {seconds !== null && (
        <div
          key={seconds}
          className="anim-pop mt-8 font-mono text-7xl font-black text-brand"
          role="timer"
          aria-label={`Answering opens in ${seconds} seconds`}
        >
          {seconds}
        </div>
      )}
      <div className="anim-pulse-soft mt-2 text-lg font-bold text-mut">Get ready…</div>
      <button onClick={() => act("skip")} className="mt-4 rounded-full bg-surface px-5 py-2 text-sm font-bold shadow-card hover:scale-105">
        Skip countdown ⏩
      </button>
    </div>
  );
}

function Answering({
  state,
  act,
}: {
  state: HostStateSnapshot;
  act: (a: string) => Promise<void>;
}) {
  const q = state.question!;
  const openEnded = q.type === "typeanswer" || q.type === "slider";

  return (
    <div className="flex flex-1 flex-col px-4 pb-8 sm:px-10">
      <div className="flex items-center justify-between gap-4">
        <TimerRing msRemaining={state.msRemaining ?? 0} totalMs={q.timeLimit * 1000} size={84} />
        <h1 className="flex-1 text-center text-2xl font-black sm:text-4xl">{q.text}</h1>
        <div className="flex flex-col items-center rounded-2xl bg-surface px-4 py-2 shadow-card">
          <span className="font-mono text-3xl font-black text-brand">{state.answeredCount}</span>
          <span className="text-xs font-bold uppercase text-mut">answered</span>
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col items-center justify-center">
        <QuestionTypeBadge type={q.type} multiSelect={q.multiSelect} className="mb-4" />
        {q.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.image} alt="" className="mb-4 max-h-56 rounded-2xl object-contain shadow-card" />
        )}
        {q.emoji && !q.image && <div className="anim-float mb-4 text-8xl">{q.emoji}</div>}

        {!openEnded && (
          <div className="grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2">
            {q.choices.map((c, i) =>
              c.trim() ? (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-2xl px-5 py-5 text-lg font-black shadow-card sm:text-2xl ${ANSWER_BG[i]} ${ANSWER_FG[i]}`}
                >
                  <AnswerShape index={i} className="h-7 w-7 shrink-0" />
                  {c}
                </div>
              ) : null
            )}
          </div>
        )}
        {q.type === "typeanswer" && (
          <p className="anim-pulse-soft text-2xl font-bold text-mut">
            ⌨️ Players are typing their answers…
          </p>
        )}
        {q.type === "slider" && (
          <p className="anim-pulse-soft text-2xl font-bold text-mut">
            🎚️ Players are picking a number between {q.sliderMin} and {q.sliderMax}…
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => act("skip")}
          className="rounded-full bg-surface px-6 py-2.5 font-bold shadow-card transition-transform hover:scale-105"
        >
          Skip to results ⏩
        </button>
      </div>
    </div>
  );
}

function RevealAndScoreboard({
  state,
  act,
}: {
  state: HostStateSnapshot;
  act: (a: string) => Promise<void>;
}) {
  const q = state.question!;
  const isReveal = state.phase === "reveal";
  const isLast = state.currentIndex >= state.questionCount - 1;
  const openEnded = q.type === "typeanswer" || q.type === "slider";
  const top = useMemo(() => state.players.slice(0, 8), [state.players]);

  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-8">
      {isReveal ? (
        <>
          <h1 className="anim-slide-up mt-2 max-w-3xl text-center text-2xl font-black sm:text-3xl">
            {q.text}
          </h1>
          {q.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.image} alt="" className="mt-3 max-h-32 rounded-2xl object-contain shadow-card" />
          )}
          <div className="anim-pop mt-3 rounded-2xl bg-ok-soft px-5 py-2 text-center font-bold text-ok">
            {answerSummary(state)}
          </div>
          <div className="mt-4 w-full max-w-4xl">
            {openEnded ? (
              <div className="rounded-3xl bg-surface p-6 shadow-card">
                <DistributionChart reveal={state.reveal!} type={q.type} choices={q.choices} />
              </div>
            ) : (
              <RevealChoices
                question={q}
                correct={state.reveal!.correct}
                distribution={state.reveal!.distribution}
              />
            )}
            <p className="mt-3 text-center text-sm text-mut">
              {state.reveal!.answeredCount} of {state.reveal!.totalPlayers} answered
              {!openEnded && " · numbers show how many picked each answer"}
            </p>
          </div>
        </>
      ) : (
        <>
          <h1 className="anim-slide-up mt-2 text-3xl font-black">Scoreboard</h1>
          <div className="mt-6 w-full max-w-2xl space-y-2">
            {top.map((p, i) => (
              <div
                key={p.id}
                className="anim-slide-up flex items-center gap-3 rounded-2xl bg-surface px-5 py-3 shadow-card"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <span className="w-8 font-mono text-lg font-black text-mut">#{p.rank}</span>
                <span className="min-w-0 flex-1 truncate text-lg font-bold">
                  {p.name}
                  {p.streak >= 2 && (
                    <span className="ml-2 text-sm" title={`${p.streak} answer streak`}>
                      🔥{p.streak}
                    </span>
                  )}
                </span>
                <span className="font-mono text-lg font-black">{p.score.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <button
        onClick={() => act("next")}
        className="mt-8 rounded-full bg-gradient-to-r from-brand to-brand-2 px-10 py-3.5 text-xl font-black text-white shadow-pop transition-transform hover:scale-105 active:scale-95"
      >
        {isLast ? "🏆 Podium" : isReveal ? "Next →" : "Next question →"}
      </button>
      {state.settings.autoAdvance && state.msRemaining !== null && (
        <p className="mt-2 text-sm text-mut">
          Auto-advancing in {Math.ceil(state.msRemaining / 1000)}s
        </p>
      )}
    </div>
  );
}

function answerSummary(state: HostStateSnapshot): string {
  const q = state.question!;
  const r = state.reveal!;
  if (q.type === "poll") return "📊 Poll results";
  if (q.type === "typeanswer") return `✓ Accepted: ${(r.acceptedAnswers ?? []).join(", ")}`;
  if (q.type === "slider") return `✓ Correct value: ${r.sliderCorrect}`;
  const names = r.correct.map((i) => q.choices[i]).filter(Boolean);
  return `✓ Correct: ${names.join("  ·  ")}`;
}

interface Report {
  players: { rank: number; name: string; score: number; correctCount: number; answeredCount: number; accuracy: number }[];
  questions: { index: number; text: string; type: string; answered: number; correct: number; accuracy: number; avgTimeMs: number }[];
}

function Finale({ state, pin, token }: { state: HostStateSnapshot; pin: string; token: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    void api<Report>(`/api/games/${pin}/report?token=${token}`).then((r) => {
      if (r.ok) setReport(r.data);
    });
  }, [pin, token]);

  return (
    <div className="flex flex-1 flex-col items-center px-4 pb-10">
      <Confetti />
      <h1 className="anim-pop mt-2 text-center text-3xl font-black sm:text-4xl">
        🎉 {state.setTitle}
      </h1>
      {state.podium && state.podium.length > 0 ? (
        <div className="mt-8 w-full max-w-2xl">
          <Podium top3={state.podium} />
        </div>
      ) : (
        <p className="mt-8 text-mut">No players finished the game.</p>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => setShowReport((s) => !s)}
          className="rounded-full bg-surface px-6 py-3 font-bold shadow-card transition-transform hover:scale-105"
        >
          📋 {showReport ? "Hide" : "View"} full report
        </button>
        <a
          href={`/api/games/${pin}/report?token=${token}&format=csv`}
          download
          className="rounded-full bg-surface px-6 py-3 font-bold shadow-card transition-transform hover:scale-105"
        >
          ⬇️ Download CSV
        </a>
        <Link
          href="/dashboard"
          className="rounded-full bg-gradient-to-r from-brand to-brand-2 px-6 py-3 font-black text-white shadow-card transition-transform hover:scale-105"
        >
          Host another game →
        </Link>
      </div>

      {showReport && report && (
        <div className="anim-slide-up mt-8 w-full max-w-4xl space-y-6">
          <div className="overflow-x-auto rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="mb-3 text-xl font-black">Players</h2>
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-mut">
                  <th className="pb-2 pr-3">Rank</th>
                  <th className="pb-2 pr-3">Nickname</th>
                  <th className="pb-2 pr-3">Score</th>
                  <th className="pb-2 pr-3">Correct</th>
                  <th className="pb-2">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {report.players.map((p) => (
                  <tr key={p.name} className="border-t border-surface-2">
                    <td className="py-2 pr-3 font-mono font-bold">#{p.rank}</td>
                    <td className="py-2 pr-3 font-bold">{p.name}</td>
                    <td className="py-2 pr-3 font-mono">{p.score.toLocaleString()}</td>
                    <td className="py-2 pr-3">{p.correctCount} / {p.answeredCount}</td>
                    <td className="py-2">{p.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-3xl bg-surface p-5 shadow-card">
            <h2 className="mb-3 text-xl font-black">Questions</h2>
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-mut">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Question</th>
                  <th className="pb-2 pr-3">Answered</th>
                  <th className="pb-2 pr-3">Accuracy</th>
                  <th className="pb-2">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {report.questions.map((qq) => (
                  <tr key={qq.index} className="border-t border-surface-2">
                    <td className="py-2 pr-3 font-mono font-bold">{qq.index + 1}</td>
                    <td className="max-w-[280px] truncate py-2 pr-3">{qq.text}</td>
                    <td className="py-2 pr-3">{qq.answered}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          qq.accuracy >= 70 ? "bg-ok-soft text-ok" : qq.accuracy >= 40 ? "bg-brand-soft text-brand" : "bg-bad-soft text-bad"
                        }`}
                      >
                        {qq.accuracy}%
                      </span>
                    </td>
                    <td className="py-2 font-mono">{(qq.avgTimeMs / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
