// The four answer identities: color + distinct shape (shapes matter in
// colorblind mode). Index 0–3 = triangle, diamond, circle, square.

export const ANSWER_BG = ["bg-a0", "bg-a1", "bg-a2", "bg-a3"];
export const ANSWER_FG = ["text-a0fg", "text-a1fg", "text-a2fg", "text-a3fg"];
export const SHAPE_NAMES = ["Triangle", "Diamond", "Circle", "Square"];

export function AnswerShape({ index, className = "h-6 w-6" }: { index: number; className?: string }) {
  const common = { className, fill: "currentColor", "aria-hidden": true as const };
  switch (index % 4) {
    case 0:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3 22 20H2z" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 2 22 12 12 22 2 12z" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      );
  }
}
