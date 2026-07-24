"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { api, isTeacher, saveHostSession, setTeacher } from "@/lib/client";
import {
  blankQuestion,
  deleteSet,
  duplicateSet,
  importSet,
  loadSets,
  newId,
  seedSampleSets,
  upsertSet,
} from "@/lib/sets";
import { DEFAULT_SETTINGS, GameSettings, QuestionSet } from "@/lib/types";

const TYPE_BADGES: Record<string, string> = {
  quiz: "Quiz",
  truefalse: "T/F",
  typeanswer: "Type",
  slider: "Slider",
  poll: "Poll",
};

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [search, setSearch] = useState("");
  const [hostTarget, setHostTarget] = useState<QuestionSet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<QuestionSet | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isTeacher()) {
      router.replace("/login");
      return;
    }
    seedSampleSets();
    setSets(loadSets());
    setReady(true);
  }, [router]);

  const refresh = () => setSets(loadSets());

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const createSet = () => {
    const set: QuestionSet = {
      id: newId(),
      title: "Untitled set",
      description: "",
      coverEmoji: "❓",
      questions: [blankQuestion()],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    upsertSet(set);
    router.push(`/editor/${set.id}`);
  };

  const exportSet = (set: QuestionSet) => {
    const blob = new Blob([JSON.stringify(set, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${set.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "question-set"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const set = importSet(JSON.parse(await file.text()));
      refresh();
      flash(`Imported “${set.title}”`);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Could not import that file");
    }
  };

  if (!ready) return null;

  const filtered = sets.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <button
            onClick={() => {
              setTeacher(false);
              router.push("/");
            }}
            className="rounded-full bg-surface-2 px-4 py-2 text-sm font-bold text-mut shadow-card transition-colors hover:text-ink"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Your question sets</h1>
            <p className="mt-1 text-mut">
              {sets.length} set{sets.length === 1 ? "" : "s"} · stored in this browser
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl bg-surface px-4 py-2.5 font-bold shadow-card transition-transform hover:scale-105"
            >
              📥 Import
            </button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={onImportFile} />
            <button
              onClick={createSet}
              className="rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-5 py-2.5 font-black text-white shadow-card transition-transform hover:scale-105"
            >
              + New set
            </button>
          </div>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sets…"
          aria-label="Search question sets"
          className="mt-6 w-full max-w-md rounded-2xl border-2 border-surface-2 bg-surface px-4 py-3 shadow-card focus:border-brand"
        />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((set) => {
            const typeCounts = new Map<string, number>();
            for (const q of set.questions) {
              typeCounts.set(q.type, (typeCounts.get(q.type) ?? 0) + 1);
            }
            return (
              <div
                key={set.id}
                className="anim-slide-up flex flex-col rounded-3xl bg-surface p-5 shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="flex items-start gap-3">
                  <div className="text-4xl" aria-hidden>{set.coverEmoji}</div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold">{set.title}</h2>
                    <p className="text-sm text-mut">
                      {set.questions.length} question{set.questions.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {set.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-mut">{set.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...typeCounts.entries()].map(([type, n]) => (
                    <span
                      key={type}
                      className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand"
                    >
                      {n}× {TYPE_BADGES[type]}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2 border-t border-surface-2 pt-4">
                  <button
                    onClick={() => setHostTarget(set)}
                    disabled={set.questions.length === 0}
                    className="flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-2 py-2.5 font-black text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    ▶ Host
                  </button>
                  <Link
                    href={`/editor/${set.id}`}
                    className="rounded-xl bg-surface-2 px-3 py-2.5 font-bold transition-colors hover:bg-brand-soft"
                    title="Edit"
                  >
                    ✏️
                  </Link>
                  <button
                    onClick={() => {
                      duplicateSet(set.id);
                      refresh();
                      flash("Set duplicated");
                    }}
                    className="rounded-xl bg-surface-2 px-3 py-2.5 font-bold transition-colors hover:bg-brand-soft"
                    title="Duplicate"
                  >
                    📄
                  </button>
                  <button
                    onClick={() => exportSet(set)}
                    className="rounded-xl bg-surface-2 px-3 py-2.5 font-bold transition-colors hover:bg-brand-soft"
                    title="Export as JSON"
                  >
                    📤
                  </button>
                  <button
                    onClick={() => setConfirmDelete(set)}
                    className="rounded-xl bg-surface-2 px-3 py-2.5 font-bold transition-colors hover:bg-bad-soft"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="mt-16 text-center text-mut">
            {search ? "No sets match your search." : "No sets yet — create your first one!"}
          </div>
        )}
      </div>

      {hostTarget && (
        <HostModal
          set={hostTarget}
          onClose={() => setHostTarget(null)}
          onError={(msg) => flash(msg)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
          <div className="anim-pop w-full max-w-sm rounded-3xl bg-surface p-6 shadow-pop">
            <h2 className="text-xl font-black">Delete “{confirmDelete.title}”?</h2>
            <p className="mt-2 text-sm text-mut">
              This permanently removes the set and its {confirmDelete.questions.length} question
              {confirmDelete.questions.length === 1 ? "" : "s"}. Export it first if you want a backup.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl bg-surface-2 py-2.5 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteSet(confirmDelete.id);
                  setConfirmDelete(null);
                  refresh();
                  flash("Set deleted");
                }}
                className="flex-1 rounded-xl bg-bad py-2.5 font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="anim-pop fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 font-bold text-bg shadow-pop">
          {toast}
        </div>
      )}
    </main>
  );
}

function HostModal({
  set,
  onClose,
  onError,
}: {
  set: QuestionSet;
  onClose: () => void;
  onError: (msg: string) => void;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [busy, setBusy] = useState(false);

  const toggle = (key: keyof GameSettings) =>
    setSettings((s) => ({ ...s, [key]: !s[key as keyof GameSettings] }));

  const start = async () => {
    setBusy(true);
    const res = await api<{ pin: string; hostToken: string }>("/api/games", {
      method: "POST",
      body: JSON.stringify({ set, settings }),
    });
    setBusy(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    saveHostSession({ pin: res.data.pin, token: res.data.hostToken });
    router.push(`/host/${res.data.pin}`);
  };

  const OPTIONS: { key: keyof GameSettings; label: string; hint: string }[] = [
    { key: "randomizeQuestions", label: "Shuffle question order", hint: "Ask questions in a random order" },
    { key: "randomizeAnswers", label: "Shuffle answer order", hint: "Randomize where each choice appears" },
    { key: "autoAdvance", label: "Auto-advance", hint: "Move through results automatically without clicking Next" },
    { key: "streakBonus", label: "Answer streak bonus", hint: "+100 per consecutive correct answer (max +500)" },
    { key: "nicknameGenerator", label: "Nickname generator", hint: "Players must use a fun generated name" },
    { key: "lateJoin", label: "Allow late joining", hint: "Players can join after the game starts" },
    { key: "showPodium", label: "Podium finale", hint: "Celebrate the top 3 with a podium at the end" },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal>
      <div className="anim-pop max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-surface p-6 shadow-pop">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>{set.coverEmoji}</span>
          <div>
            <h2 className="text-xl font-black">Host “{set.title}”</h2>
            <p className="text-sm text-mut">{set.questions.length} questions · up to 400 players</p>
          </div>
        </div>

        <div className="mt-5 space-y-1">
          {OPTIONS.map((o) => (
            <label
              key={o.key}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2"
            >
              <span>
                <span className="block font-bold">{o.label}</span>
                <span className="block text-xs text-mut">{o.hint}</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(settings[o.key])}
                onChange={() => toggle(o.key)}
                className="h-5 w-5 accent-[var(--brand)]"
              />
            </label>
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl bg-surface-2 py-3 font-bold">
            Cancel
          </button>
          <button
            onClick={start}
            disabled={busy}
            className="flex-1 rounded-xl bg-gradient-to-r from-brand to-brand-2 py-3 font-black text-white disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create lobby →"}
          </button>
        </div>
      </div>
    </div>
  );
}
