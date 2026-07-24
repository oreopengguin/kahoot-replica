// Client-side helpers: API calls, polling hook, sessions.
"use client";

import { useEffect, useState } from "react";

export async function api<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: (data as { error?: string }).error ?? `Request failed (${res.status})` };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "Network error — check your connection" };
  }
}

/**
 * Poll a URL on an interval. Pauses while the tab is hidden? No — keep polling
 * so games advance even with a backgrounded host tab, but browsers throttle
 * hidden-tab timers to ~1/s which is still fine.
 */
export function usePoll<T>(url: string | null, intervalMs = 700) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false); // 404 — game no longer exists

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    const cycle = async () => {
      if (stopped) return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (stopped) return;
        if (res.status === 404) {
          setGone(true);
          return; // stop polling
        }
        if (res.ok) {
          setData((await res.json()) as T);
          setError(null);
        } else {
          const body = await res.json().catch(() => ({}));
          setError((body as { error?: string }).error ?? `Error ${res.status}`);
        }
      } catch {
        if (!stopped) setError("Connection lost — retrying…");
      }
      if (!stopped) timer = setTimeout(cycle, intervalMs);
    };

    void cycle();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [url, intervalMs]);

  return { data, error, gone };
}

// ---------- Teacher session ----------

const TEACHER_KEY = "lexvex.teacher.v1";

export function isTeacher(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(TEACHER_KEY) === "1";
}

export function setTeacher(on: boolean) {
  if (on) localStorage.setItem(TEACHER_KEY, "1");
  else localStorage.removeItem(TEACHER_KEY);
}

// ---------- Player session (survives refresh mid-game) ----------

const PLAYER_KEY = "lexvex.player.v1";

export interface PlayerSession {
  pin: string;
  playerId: string;
  token: string;
  nickname: string;
}

export function savePlayerSession(s: PlayerSession) {
  sessionStorage.setItem(PLAYER_KEY, JSON.stringify(s));
}

export function loadPlayerSession(): PlayerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PLAYER_KEY);
    return raw ? (JSON.parse(raw) as PlayerSession) : null;
  } catch {
    return null;
  }
}

export function clearPlayerSession() {
  sessionStorage.removeItem(PLAYER_KEY);
}

// ---------- Host session ----------

const HOST_KEY = "lexvex.host.v1";

export interface HostSession {
  pin: string;
  token: string;
}

export function saveHostSession(s: HostSession) {
  sessionStorage.setItem(HOST_KEY, JSON.stringify(s));
}

export function loadHostSession(): HostSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HOST_KEY);
    return raw ? (JSON.parse(raw) as HostSession) : null;
  } catch {
    return null;
  }
}
