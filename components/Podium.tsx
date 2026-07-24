"use client";

import { PlayerPublic } from "@/lib/types";

const MEDALS = ["🥇", "🥈", "🥉"];
const HEIGHTS = ["h-48 sm:h-64", "h-36 sm:h-48", "h-28 sm:h-36"];
const DELAYS = ["1.2s", "0.6s", "0s"];

export function Podium({ top3 }: { top3: PlayerPublic[] }) {
  // Render order: 2nd, 1st, 3rd (classic podium layout).
  const slots = [top3[1], top3[0], top3[2]];
  const meta = [
    { medal: MEDALS[1], height: HEIGHTS[1], delay: DELAYS[1], place: 2 },
    { medal: MEDALS[0], height: HEIGHTS[0], delay: DELAYS[0], place: 1 },
    { medal: MEDALS[2], height: HEIGHTS[2], delay: DELAYS[2], place: 3 },
  ];

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {slots.map((p, i) =>
        p ? (
          <div key={p.id} className="flex w-28 flex-col items-center sm:w-44">
            <div
              className="anim-pop mb-3 text-center"
              style={{ animationDelay: `calc(${meta[i].delay} + 0.9s)` }}
            >
              <div className="text-4xl sm:text-5xl" aria-hidden>
                {meta[i].medal}
              </div>
              <div className="mt-1 max-w-full truncate text-lg font-bold sm:text-2xl">{p.name}</div>
              <div className="font-mono text-sm text-mut sm:text-base">
                {p.score.toLocaleString()} pts
              </div>
            </div>
            <div
              className={`anim-podium w-full rounded-t-2xl shadow-pop ${meta[i].height} ${
                meta[i].place === 1
                  ? "bg-gradient-to-b from-gold to-brand"
                  : meta[i].place === 2
                    ? "bg-gradient-to-b from-brand to-brand-2"
                    : "bg-gradient-to-b from-brand-2 to-brand"
              } flex items-start justify-center pt-3 text-3xl font-black text-white sm:text-5xl`}
              style={{ animationDelay: meta[i].delay }}
            >
              {meta[i].place}
            </div>
          </div>
        ) : (
          <div key={`empty-${i}`} className="w-28 sm:w-44" />
        )
      )}
    </div>
  );
}
