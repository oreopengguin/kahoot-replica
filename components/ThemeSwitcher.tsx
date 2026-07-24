"use client";

import { useEffect, useState } from "react";
import { Theme, useTheme } from "./ThemeProvider";
import { isMuted, setMuted } from "@/lib/sounds";

const OPTIONS: { value: Theme; label: string; icon: string; title: string }[] = [
  { value: "light", label: "Light", icon: "☀️", title: "Light mode" },
  { value: "dark", label: "Dark", icon: "🌙", title: "Dark mode" },
  { value: "colorblind", label: "CB", icon: "👁️", title: "Colorblind-friendly mode" },
];

export function ThemeSwitcher({ withSound = true }: { withSound?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [muted, setMutedState] = useState(false);

  useEffect(() => setMutedState(isMuted()), []);

  return (
    <div className="flex items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Color theme"
        className="flex rounded-full bg-surface-2 p-1 shadow-card"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={theme === o.value}
            title={o.title}
            onClick={() => setTheme(o.value)}
            className={`rounded-full px-2.5 py-1 text-sm transition-all ${
              theme === o.value
                ? "bg-surface shadow-card scale-105"
                : "opacity-60 hover:opacity-100"
            }`}
          >
            <span aria-hidden>{o.icon}</span>
            <span className="sr-only">{o.title}</span>
          </button>
        ))}
      </div>
      {withSound && (
        <button
          title={muted ? "Unmute sounds" : "Mute sounds"}
          aria-label={muted ? "Unmute sounds" : "Mute sounds"}
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
          className="rounded-full bg-surface-2 p-2 text-sm shadow-card transition-transform hover:scale-110"
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}
    </div>
  );
}
