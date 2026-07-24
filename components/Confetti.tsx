"use client";

import { useEffect, useState } from "react";

const COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#9333ea", "#f59e0b"];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  shape: number;
}

export function Confetti({ pieces = 120 }: { pieces?: number }) {
  const [items, setItems] = useState<Piece[]>([]);

  // Generated client-side after mount: keeps render pure and SSR deterministic.
  useEffect(() => {
    setItems(
      Array.from({ length: pieces }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 2.5 + Math.random() * 2.5,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        shape: i % 3,
      }))
    );
  }, [pieces]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {items.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
            borderRadius: p.shape === 0 ? "50%" : p.shape === 1 ? "2px" : "0",
            clipPath: p.shape === 2 ? "polygon(50% 0, 100% 100%, 0 100%)" : undefined,
          }}
        />
      ))}
    </div>
  );
}
