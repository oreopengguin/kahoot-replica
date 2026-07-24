"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { ANSWER_BG, ANSWER_FG, AnswerShape } from "@/components/AnswerShape";
import { isTeacher } from "@/lib/client";
import { blankQuestion, getSet, newId, upsertSet } from "@/lib/sets";
import { Question, QuestionSet, QuestionType } from "@/lib/types";

const TIME_OPTIONS = [5, 10, 20, 30, 45, 60, 90, 120, 240];
const EMOJIS = ["❓", "🔬", "🌍", "🧮", "📚", "🎨", "🎵", "⚽", "💻", "🏛️", "🧬", "🚀", "🐾", "🍎", "🎬", "⚡"];

const TYPE_INFO: Record<QuestionType, { label: string; icon: string; hint: string }> = {
  quiz: { label: "Quiz", icon: "🔘", hint: "4 choices, 1–4 correct" },
  truefalse: { label: "True / False", icon: "⚖️", hint: "Two choices" },
  typeanswer: { label: "Type answer", icon: "⌨️", hint: "Players type the answer" },
  slider: { label: "Slider", icon: "🎚️", hint: "Guess a number on a range" },
  poll: { label: "Poll", icon: "📊", hint: "Opinion — no right answer" },
};

function questionProblems(q: Question): string[] {
  const problems: string[] = [];
  if (!q.text.trim()) problems.push("Missing question text");
  if (q.type === "quiz" || q.type === "poll") {
    const filled = q.choices.filter((c) => c.trim()).length;
    if (filled < 2) problems.push("Needs at least 2 answer choices");
    if (q.type === "quiz") {
      if (q.correct.length === 0) problems.push("Mark at least one correct answer");
      if (q.correct.some((i) => !q.choices[i]?.trim())) problems.push("A correct answer is blank");
    }
  }
  if (q.type === "truefalse" && q.correct.length !== 1) problems.push("Pick True or False");
  if (q.type === "typeanswer" && !(q.acceptedAnswers ?? []).some((a) => a.trim()))
    problems.push("Add at least one accepted answer");
  if (q.type === "slider") {
    const { sliderMin = 0, sliderMax = 100, sliderCorrect = 0 } = q;
    if (sliderMin >= sliderMax) problems.push("Slider range is invalid");
    if (sliderCorrect < sliderMin || sliderCorrect > sliderMax)
      problems.push("Correct value is outside the range");
  }
  return problems;
}

export default function EditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [set, setSet] = useState<QuestionSet | null>(null);
  const [selected, setSelected] = useState(0);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [notFound, setNotFound] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTeacher()) {
      router.replace("/login");
      return;
    }
    const s = getSet(params.id);
    if (!s) setNotFound(true);
    else setSet(s);
  }, [params.id, router]);

  // Debounced autosave on any change.
  const update = useCallback((updater: (s: QuestionSet) => QuestionSet) => {
    setSet((prev) => {
      if (!prev) return prev;
      const next = updater(structuredClone(prev));
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        upsertSet(next);
        setSavedAt(Date.now());
      }, 400);
      return next;
    });
  }, []);

  const updateQ = useCallback(
    (index: number, updater: (q: Question) => void) => {
      update((s) => {
        const q = s.questions[index];
        if (q) updater(q);
        return s;
      });
    },
    [update]
  );

  const problems = useMemo(
    () => (set ? set.questions.map(questionProblems) : []),
    [set]
  );

  if (notFound) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-2xl font-bold">That set doesn’t exist.</p>
        <Link href="/dashboard" className="font-bold text-brand underline">
          Back to dashboard
        </Link>
      </main>
    );
  }
  if (!set) return null;

  const q = set.questions[selected];
  const totalProblems = problems.reduce((n, p) => n + p.length, 0);

  const addQuestion = (type: QuestionType) => {
    update((s) => {
      s.questions.push(blankQuestion(type));
      return s;
    });
    setSelected(set.questions.length);
  };

  const removeQuestion = (i: number) => {
    if (set.questions.length <= 1) return;
    update((s) => {
      s.questions.splice(i, 1);
      return s;
    });
    setSelected((cur) => Math.max(0, cur > i ? cur - 1 : Math.min(cur, set.questions.length - 2)));
  };

  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= set.questions.length) return;
    update((s) => {
      [s.questions[i], s.questions[j]] = [s.questions[j], s.questions[i]];
      return s;
    });
    setSelected(j);
  };

  const duplicateQuestion = (i: number) => {
    update((s) => {
      const copy = structuredClone(s.questions[i]);
      copy.id = newId();
      s.questions.splice(i + 1, 0, copy);
      return s;
    });
    setSelected(i + 1);
  };

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-surface-2 bg-surface/90 px-5 py-3 backdrop-blur sm:px-8">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <Link href="/dashboard" className="text-sm font-bold text-mut hover:text-ink">
            ← Sets
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-mut" aria-live="polite">
            {savedAt ? "✓ Saved" : "Autosaves as you type"}
          </span>
          <ThemeSwitcher withSound={false} />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* ----- Left: set meta + question list ----- */}
        <aside className="w-full shrink-0 lg:w-80">
          <div className="rounded-3xl bg-surface p-5 shadow-card">
            <label className="text-xs font-bold uppercase tracking-wider text-mut">Set title</label>
            <input
              value={set.title}
              onChange={(e) => update((s) => ({ ...s, title: e.target.value.slice(0, 80) }))}
              className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 font-bold focus:border-brand"
            />
            <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-mut">
              Description
            </label>
            <textarea
              value={set.description}
              onChange={(e) => update((s) => ({ ...s, description: e.target.value.slice(0, 300) }))}
              rows={2}
              className="mt-1 w-full resize-none rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 text-sm focus:border-brand"
            />
            <label className="mt-3 block text-xs font-bold uppercase tracking-wider text-mut">
              Cover emoji
            </label>
            <div className="mt-1 flex flex-wrap gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => update((s) => ({ ...s, coverEmoji: e }))}
                  className={`rounded-lg p-1.5 text-xl transition-transform hover:scale-125 ${
                    set.coverEmoji === e ? "bg-brand-soft ring-2 ring-ring-c" : ""
                  }`}
                  aria-label={`Use ${e} as cover`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-black">
                Questions{" "}
                <span className="font-mono text-sm text-mut">({set.questions.length})</span>
              </h2>
              {totalProblems > 0 && (
                <span className="rounded-full bg-bad-soft px-2 py-0.5 text-xs font-bold text-bad">
                  {totalProblems} issue{totalProblems === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <ul className="mt-2 max-h-[40vh] space-y-1.5 overflow-y-auto lg:max-h-[46vh]">
              {set.questions.map((qq, i) => (
                <li key={qq.id}>
                  <button
                    onClick={() => setSelected(i)}
                    className={`group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                      i === selected ? "bg-brand-soft ring-2 ring-ring-c" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="font-mono text-xs font-bold text-mut">{i + 1}</span>
                    <span aria-hidden>{TYPE_INFO[qq.type].icon}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {qq.text.trim() || <span className="italic text-mut">Untitled question</span>}
                    </span>
                    {problems[i]?.length > 0 && (
                      <span className="text-bad" title={problems[i].join(", ")} aria-label="Has issues">
                        ⚠
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <AddQuestionMenu onAdd={addQuestion} />
          </div>
        </aside>

        {/* ----- Right: question editor ----- */}
        {q && (
          <section className="min-w-0 flex-1">
            <div className="rounded-3xl bg-surface p-5 shadow-card sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-bold text-mut">
                  <span aria-hidden>{TYPE_INFO[q.type].icon}</span>
                  {TYPE_INFO[q.type].label} · Question {selected + 1} of {set.questions.length}
                </div>
                <div className="flex gap-1.5">
                  <IconBtn label="Move up" onClick={() => moveQuestion(selected, -1)} disabled={selected === 0}>↑</IconBtn>
                  <IconBtn label="Move down" onClick={() => moveQuestion(selected, 1)} disabled={selected === set.questions.length - 1}>↓</IconBtn>
                  <IconBtn label="Duplicate question" onClick={() => duplicateQuestion(selected)}>📄</IconBtn>
                  <IconBtn label="Delete question" onClick={() => removeQuestion(selected)} disabled={set.questions.length <= 1}>🗑️</IconBtn>
                </div>
              </div>

              <textarea
                value={q.text}
                onChange={(e) => updateQ(selected, (qq) => (qq.text = e.target.value.slice(0, 250)))}
                placeholder="Type your question…"
                rows={2}
                className="mt-4 w-full resize-none rounded-2xl border-2 border-surface-2 bg-surface-2 px-4 py-3 text-center text-xl font-bold focus:border-brand"
              />

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-mut">Time limit</span>
                  <select
                    value={q.timeLimit}
                    onChange={(e) => updateQ(selected, (qq) => (qq.timeLimit = Number(e.target.value)))}
                    className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 font-bold focus:border-brand"
                  >
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{t} seconds</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-mut">Points</span>
                  <select
                    value={q.points}
                    disabled={q.type === "poll"}
                    onChange={(e) => updateQ(selected, (qq) => (qq.points = e.target.value as Question["points"]))}
                    className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 font-bold focus:border-brand disabled:opacity-50"
                  >
                    <option value="standard">Standard (1000)</option>
                    <option value="double">Double (2000)</option>
                    <option value="none">No points</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-mut">Emoji (optional)</span>
                  <input
                    value={q.emoji ?? ""}
                    onChange={(e) => updateQ(selected, (qq) => (qq.emoji = e.target.value.slice(0, 4) || undefined))}
                    placeholder="e.g. 🪐"
                    className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 text-center focus:border-brand"
                  />
                </label>
              </div>

              <label className="mt-3 block">
                <span className="text-xs font-bold uppercase tracking-wider text-mut">Image URL (optional)</span>
                <input
                  value={q.image ?? ""}
                  onChange={(e) => updateQ(selected, (qq) => (qq.image = e.target.value.trim() || undefined))}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 text-sm focus:border-brand"
                />
              </label>

              <div className="mt-6">
                {(q.type === "quiz" || q.type === "poll") && (
                  <QuizChoicesEditor q={q} index={selected} updateQ={updateQ} />
                )}
                {q.type === "truefalse" && <TrueFalseEditor q={q} index={selected} updateQ={updateQ} />}
                {q.type === "typeanswer" && <TypeAnswerEditor q={q} index={selected} updateQ={updateQ} />}
                {q.type === "slider" && <SliderEditor q={q} index={selected} updateQ={updateQ} />}
              </div>

              {problems[selected]?.length > 0 && (
                <div className="mt-5 rounded-2xl bg-bad-soft p-4 text-sm font-medium text-bad">
                  {problems[selected].map((p) => (
                    <div key={p}>⚠ {p}</div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm font-bold transition-colors hover:bg-brand-soft disabled:opacity-30"
    >
      {children}
    </button>
  );
}

type UpdateQ = (index: number, updater: (q: Question) => void) => void;

function QuizChoicesEditor({ q, index, updateQ }: { q: Question; index: number; updateQ: UpdateQ }) {
  const isPoll = q.type === "poll";
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-mut">
          {isPoll ? "Poll options" : "Answer choices — tap ✓ to mark correct"}
        </h3>
        {!isPoll && (
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={q.multiSelect}
              onChange={(e) => updateQ(index, (qq) => (qq.multiSelect = e.target.checked))}
              className="h-4 w-4 accent-[var(--brand)]"
            />
            Players must select ALL correct answers
          </label>
        )}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {q.choices.map((choice, ci) => {
          const isCorrect = q.correct.includes(ci);
          return (
            <div
              key={ci}
              className={`flex items-center gap-2 rounded-2xl p-2 pl-3 ${ANSWER_BG[ci]} ${ANSWER_FG[ci]} shadow-card`}
            >
              <AnswerShape index={ci} className="h-5 w-5 shrink-0" />
              <input
                value={choice}
                onChange={(e) =>
                  updateQ(index, (qq) => (qq.choices[ci] = e.target.value.slice(0, 90)))
                }
                placeholder={`Answer ${ci + 1}${ci >= 2 ? " (optional)" : ""}`}
                className="min-w-0 flex-1 bg-transparent font-bold placeholder:text-current placeholder:opacity-50 focus:outline-none"
              />
              {!isPoll && (
                <button
                  onClick={() =>
                    updateQ(index, (qq) => {
                      qq.correct = isCorrect
                        ? qq.correct.filter((c) => c !== ci)
                        : [...qq.correct, ci].sort();
                    })
                  }
                  title={isCorrect ? "Correct — click to unmark" : "Mark as correct"}
                  aria-pressed={isCorrect}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg font-black transition-all ${
                    isCorrect
                      ? "bg-white text-ok ring-2 ring-white"
                      : "bg-black/20 text-white/60 hover:bg-black/30"
                  }`}
                >
                  ✓
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrueFalseEditor({ q, index, updateQ }: { q: Question; index: number; updateQ: UpdateQ }) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-mut">Which is correct?</h3>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {["True", "False"].map((label, ci) => (
          <button
            key={label}
            onClick={() => updateQ(index, (qq) => (qq.correct = [ci]))}
            aria-pressed={q.correct[0] === ci}
            className={`rounded-2xl py-6 text-2xl font-black shadow-card transition-all ${
              ci === 0 ? "bg-a1 text-a1fg" : "bg-a0 text-a0fg"
            } ${q.correct[0] === ci ? "ring-4 ring-ring-c scale-[1.02]" : "opacity-60 hover:opacity-90"}`}
          >
            {label} {q.correct[0] === ci && "✓"}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypeAnswerEditor({ q, index, updateQ }: { q: Question; index: number; updateQ: UpdateQ }) {
  const answers = q.acceptedAnswers ?? [""];
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-mut">
        Accepted answers (case-insensitive)
      </h3>
      <div className="mt-3 space-y-2">
        {answers.map((a, ai) => (
          <div key={ai} className="flex gap-2">
            <input
              value={a}
              onChange={(e) =>
                updateQ(index, (qq) => {
                  qq.acceptedAnswers = [...(qq.acceptedAnswers ?? [])];
                  qq.acceptedAnswers[ai] = e.target.value.slice(0, 60);
                })
              }
              placeholder={ai === 0 ? "The answer" : "Alternative spelling / synonym"}
              className="flex-1 rounded-xl border-2 border-surface-2 bg-surface-2 px-4 py-2.5 font-bold focus:border-brand"
            />
            {answers.length > 1 && (
              <button
                onClick={() =>
                  updateQ(index, (qq) => {
                    qq.acceptedAnswers = (qq.acceptedAnswers ?? []).filter((_, i) => i !== ai);
                  })
                }
                aria-label="Remove this accepted answer"
                className="rounded-xl bg-surface-2 px-3 font-bold hover:bg-bad-soft"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {answers.length < 8 && (
          <button
            onClick={() =>
              updateQ(index, (qq) => {
                qq.acceptedAnswers = [...(qq.acceptedAnswers ?? []), ""];
              })
            }
            className="rounded-xl bg-surface-2 px-4 py-2 text-sm font-bold hover:bg-brand-soft"
          >
            + Add alternative
          </button>
        )}
      </div>
    </div>
  );
}

function SliderEditor({ q, index, updateQ }: { q: Question; index: number; updateQ: UpdateQ }) {
  const fields: { key: "sliderMin" | "sliderMax" | "sliderCorrect" | "sliderTolerance"; label: string }[] = [
    { key: "sliderMin", label: "Range min" },
    { key: "sliderMax", label: "Range max" },
    { key: "sliderCorrect", label: "Correct value" },
    { key: "sliderTolerance", label: "Tolerance (±)" },
  ];
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wider text-mut">Slider settings</h3>
      <p className="mt-1 text-xs text-mut">
        Guesses within the tolerance score full points; near-misses earn partial credit.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-bold text-mut">{f.label}</span>
            <input
              type="number"
              value={q[f.key] ?? 0}
              onChange={(e) => updateQ(index, (qq) => (qq[f.key] = Number(e.target.value)))}
              className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-3 py-2 font-mono font-bold focus:border-brand"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function AddQuestionMenu({ onAdd }: { onAdd: (type: QuestionType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full rounded-xl bg-gradient-to-r from-brand to-brand-2 py-2.5 font-black text-white transition-transform hover:scale-[1.02]"
      >
        + Add question
      </button>
      {open && (
        <div className="anim-pop absolute bottom-full left-0 z-20 mb-2 w-full rounded-2xl bg-surface p-2 shadow-pop ring-1 ring-surface-2">
          {(Object.keys(TYPE_INFO) as QuestionType[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-brand-soft"
            >
              <span className="text-xl" aria-hidden>{TYPE_INFO[t].icon}</span>
              <span>
                <span className="block font-bold">{TYPE_INFO[t].label}</span>
                <span className="block text-xs text-mut">{TYPE_INFO[t].hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
