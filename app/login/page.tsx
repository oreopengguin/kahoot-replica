"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { api, setTeacher } from "@/lib/client";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<{ ok: boolean }>("/api/auth", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (res.ok) {
      setTeacher(true);
      router.push("/dashboard");
    } else {
      setError(res.error);
    }
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo />
        <ThemeSwitcher />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-20">
        <form
          onSubmit={submit}
          className={`anim-pop w-full max-w-sm rounded-3xl bg-surface p-8 shadow-pop ${error ? "anim-shake" : ""}`}
        >
          <div className="text-center text-4xl" aria-hidden>🎓</div>
          <h1 className="mt-2 text-center text-2xl font-black">Teacher sign in</h1>
          <p className="mt-1 text-center text-sm text-mut">
            Build question sets and host live games.
          </p>

          <label htmlFor="username" className="mt-6 block text-sm font-bold text-mut">
            Username
          </label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-4 py-3 font-medium focus:border-brand"
          />

          <label htmlFor="password" className="mt-4 block text-sm font-bold text-mut">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border-2 border-surface-2 bg-surface-2 px-4 py-3 font-medium focus:border-brand"
          />

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-bad-soft px-3 py-2 text-sm font-medium text-bad">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-3.5 text-lg font-black text-white shadow-card transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
