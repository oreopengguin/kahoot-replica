// Tiny WebAudio synth for game sounds — no audio assets needed.
"use client";

let ctx: AudioContext | null = null;
let muted = false;
let lobbyTimer: ReturnType<typeof setInterval> | null = null;

if (typeof window !== "undefined") {
  muted = localStorage.getItem("lexvex.muted") === "1";
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  if (typeof window !== "undefined") localStorage.setItem("lexvex.muted", m ? "1" : "0");
  if (m) stopLobbyMusic();
}

function tone(
  freq: number,
  startIn: number,
  duration: number,
  opts: { type?: OscillatorType; gain?: number; slideTo?: number } = {}
) {
  const ac = audio();
  if (!ac || muted) return;
  const t0 = ac.currentTime + startIn;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = opts.type ?? "triangle";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + duration);
  const peak = opts.gain ?? 0.12;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export const sfx = {
  /** Player tapped an answer. */
  select() {
    tone(660, 0, 0.12, { type: "square", gain: 0.08 });
    tone(880, 0.06, 0.1, { type: "square", gain: 0.06 });
  },
  correct() {
    tone(523, 0, 0.15);
    tone(659, 0.12, 0.15);
    tone(784, 0.24, 0.3, { gain: 0.15 });
  },
  wrong() {
    tone(220, 0, 0.25, { type: "sawtooth", gain: 0.08, slideTo: 140 });
  },
  /** Question intro sting. */
  intro() {
    tone(440, 0, 0.12);
    tone(554, 0.1, 0.12);
    tone(659, 0.2, 0.25, { gain: 0.14 });
  },
  /** Last-5-seconds countdown tick. */
  tick() {
    tone(1200, 0, 0.05, { type: "square", gain: 0.05 });
  },
  reveal() {
    tone(392, 0, 0.1);
    tone(523, 0.08, 0.1);
    tone(659, 0.16, 0.1);
    tone(784, 0.24, 0.35, { gain: 0.15 });
  },
  playerJoined() {
    tone(700, 0, 0.08, { type: "sine", gain: 0.07 });
    tone(1000, 0.07, 0.1, { type: "sine", gain: 0.07 });
  },
  podium() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((n, i) => tone(n, i * 0.15, 0.25, { gain: 0.13 }));
  },
};

const LOBBY_RIFF = [262, 330, 392, 330, 440, 392, 330, 294];
let lobbyStep = 0;

export function startLobbyMusic() {
  if (lobbyTimer || muted) return;
  lobbyStep = 0;
  lobbyTimer = setInterval(() => {
    if (muted) return;
    const note = LOBBY_RIFF[lobbyStep % LOBBY_RIFF.length];
    tone(note, 0, 0.28, { type: "sine", gain: 0.05 });
    tone(note / 2, 0, 0.4, { type: "triangle", gain: 0.03 });
    lobbyStep++;
  }, 320);
}

export function stopLobbyMusic() {
  if (lobbyTimer) {
    clearInterval(lobbyTimer);
    lobbyTimer = null;
  }
}
