"use client";

import { LiveQuestion } from "@/lib/types";
import { ANSWER_BG, ANSWER_FG, ANSWER_TEXT, AnswerShape, SHAPE_NAMES } from "./AnswerShape";

/**
 * The answer choices as shown after the correct answer is revealed: correct
 * answers keep their full color and gain a ring, wrong answers drop to a
 * neutral "dimmed" card. Dimming uses theme tokens rather than opacity so the
 * labels stay legible on a projector in every theme.
 *
 * When a vote `distribution` is passed (host view), each card also fills
 * proportionally and shows how many players picked it.
 */
export function RevealChoices({
  question,
  correct,
  distribution,
  myChoices,
  size = "lg",
}: {
  question: LiveQuestion;
  correct: number[];
  distribution?: number[];
  myChoices?: number[];
  size?: "lg" | "sm";
}) {
  const isPoll = question.type === "poll";
  const max = Math.max(1, ...(distribution ?? [0]));
  const choices = question.choices
    .map((text, index) => ({ text, index }))
    .filter((c) => c.text.trim());
  const large = size === "lg";

  return (
    <div className={`grid gap-2 ${large ? "gap-3 sm:grid-cols-2" : "grid-cols-1"}`}>
      {choices.map(({ text, index }) => {
        // Polls have no wrong answers, so nothing is dimmed.
        const isRight = isPoll || correct.includes(index);
        const count = distribution?.[index];
        const mine = myChoices?.includes(index) ?? false;
        const fill = count !== undefined ? (count / max) * 100 : 0;

        return (
          <div
            key={index}
            className={`relative overflow-hidden rounded-2xl shadow-card transition-all ${
              isRight
                ? `${ANSWER_BG[index]} ${ANSWER_FG[index]} ring-4 ring-ink/60${large ? " scale-[1.02]" : ""}`
                : "bg-surface-2 text-mut"
            }`}
          >
            {count !== undefined && count > 0 && (
              <div
                className={`absolute inset-y-0 left-0 ${isRight ? "bg-black/25" : "bg-ink/10"}`}
                style={{ width: `${fill}%` }}
                aria-hidden
              />
            )}
            <div
              className={`relative flex items-center gap-3 ${large ? "px-5 py-4 text-xl sm:text-2xl" : "px-3 py-2 text-base"} font-black`}
            >
              <AnswerShape
                index={index}
                className={`${large ? "h-6 w-6" : "h-4 w-4"} shrink-0 ${isRight ? "" : `${ANSWER_TEXT[index]} opacity-60`}`}
              />
              <span className="sr-only">{SHAPE_NAMES[index % 4]}: </span>
              <span className="min-w-0 flex-1 break-words leading-tight">{text}</span>
              {mine && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 ${large ? "text-sm" : "text-[11px]"} font-bold ${
                    isRight ? "bg-black/25" : "bg-ink/10"
                  }`}
                >
                  your answer
                </span>
              )}
              {isRight && !isPoll && (
                <span className={large ? "text-2xl" : "text-lg"} aria-label="Correct answer">
                  ✓
                </span>
              )}
              {count !== undefined && (
                <span className={`shrink-0 font-mono ${large ? "text-2xl" : "text-base"}`}>
                  {count}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
