"use client";

/** Circular countdown showing seconds remaining. */
export function TimerRing({
  msRemaining,
  totalMs,
  size = 72,
}: {
  msRemaining: number;
  totalMs: number;
  size?: number;
}) {
  const frac = Math.max(0, Math.min(1, msRemaining / Math.max(totalMs, 1)));
  const seconds = Math.ceil(msRemaining / 1000);
  const r = 42;
  const c = 2 * Math.PI * r;
  const urgent = seconds <= 5;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={urgent ? "var(--bad)" : "var(--brand)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
        />
      </svg>
      <span
        className={`font-mono text-xl font-black ${urgent ? "text-bad anim-pulse-soft" : "text-ink"}`}
      >
        {seconds}
      </span>
    </div>
  );
}
