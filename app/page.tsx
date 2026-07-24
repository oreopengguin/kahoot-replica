"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

const FEATURES = [
  { emoji: "🎮", title: "Live games for 400 players", text: "Host huge lobbies with a 6-digit PIN — no accounts, no player limit tricks, no paywall." },
  { emoji: "🧠", title: "Every question type", text: "Multiple choice, multi-select, true/false, type-the-answer, sliders, and polls." },
  { emoji: "⚡", title: "Speed-based scoring", text: "Up to 1,000 points per question — answer faster to earn more, and build answer streaks for bonus points." },
  { emoji: "🏆", title: "Podium & reports", text: "Top-3 podium finale with confetti, plus a full per-player and per-question report you can download as CSV." },
  { emoji: "🎨", title: "Three themes", text: "Light, dark, and a colorblind-friendly high-contrast mode. Answer buttons use distinct shapes, not just colors." },
  { emoji: "🛠️", title: "Powerful editor", text: "Unlimited question sets, reordering, duplication, per-question timers, double points, and JSON import/export." },
];

export default function Home() {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = pin.replace(/\D/g, "");
    if (clean.length !== 6) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    router.push(`/play?pin=${clean}`);
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <Link
            href="/login"
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white shadow-card transition-transform hover:scale-105"
          >
            Teacher login
          </Link>
        </div>
      </header>

      <section className="flex flex-col items-center px-4 pb-10 pt-8 text-center sm:pt-16">
        <h1 className="anim-slide-up max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Learning that feels like{" "}
          <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
            game night
          </span>
        </h1>
        <p className="anim-slide-up mt-4 max-w-xl text-lg text-mut" style={{ animationDelay: "0.1s" }}>
          Build question sets, host live games, and battle it out with your whole class — every
          feature free, forever.
        </p>

        <form
          onSubmit={join}
          className={`anim-slide-up mt-10 w-full max-w-sm rounded-3xl bg-surface p-6 shadow-pop ${shake ? "anim-shake" : ""}`}
          style={{ animationDelay: "0.2s" }}
        >
          <label htmlFor="pin" className="mb-3 block text-sm font-bold uppercase tracking-widest text-mut">
            Join a game
          </label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Game PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-full rounded-2xl border-2 border-surface-2 bg-surface-2 px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.3em] text-ink placeholder:text-mut/50 placeholder:tracking-normal focus:border-brand"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-4 text-xl font-black text-white shadow-card transition-transform hover:scale-[1.02] active:scale-95"
          >
            Enter
          </button>
        </form>

        <p className="mt-6 text-sm text-mut">
          Hosting?{" "}
          <Link href="/login" className="font-bold text-brand underline-offset-4 hover:underline">
            Sign in
          </Link>{" "}
          to build sets and start a lobby.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="anim-slide-up rounded-3xl bg-surface p-6 shadow-card transition-transform hover:-translate-y-1"
            style={{ animationDelay: `${0.25 + i * 0.06}s` }}
          >
            <div className="text-3xl" aria-hidden>{f.emoji}</div>
            <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-mut">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="pb-8 text-center text-sm text-mut">
        LexVex Sonion Quiz App — free forever, built for classrooms of any size.
      </footer>
    </main>
  );
}
