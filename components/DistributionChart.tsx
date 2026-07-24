"use client";

import { RevealInfo, QuestionType } from "@/lib/types";
import { ANSWER_BG, ANSWER_FG, AnswerShape } from "./AnswerShape";

/** Bar chart of how many players picked each answer, shown on reveal. */
export function DistributionChart({
  reveal,
  type,
  choices,
}: {
  reveal: RevealInfo;
  type: QuestionType;
  choices: string[];
}) {
  const openEnded = type === "typeanswer" || type === "slider";
  const labels = openEnded ? ["Correct", "Incorrect"] : choices;
  const colors = openEnded ? ["bg-ok", "bg-bad"] : ANSWER_BG;
  const max = Math.max(1, ...reveal.distribution);

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {reveal.distribution.map((count, i) => {
        const isCorrect = openEnded ? i === 0 : reveal.correct.includes(i);
        const h = Math.max(8, (count / max) * 160);
        return (
          <div key={i} className="flex w-16 flex-col items-center sm:w-24">
            <div className="mb-1 text-lg font-bold">{count}</div>
            <div
              className={`anim-grow-bar w-10 rounded-t-lg sm:w-14 ${colors[i % colors.length]} ${
                type !== "poll" && !isCorrect ? "opacity-30" : ""
              }`}
              style={{ height: `${h}px`, animationDelay: `${i * 0.08}s` }}
              role="img"
              aria-label={`${labels[i] ?? `Choice ${i + 1}`}: ${count} answers${isCorrect && type !== "poll" ? " (correct)" : ""}`}
            />
            <div
              className={`mt-2 flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${colors[i % colors.length]} ${openEnded ? "text-white" : ANSWER_FG[i % 4]}`}
            >
              {openEnded ? (
                <span className="text-sm font-black">{i === 0 ? "✓" : "✗"}</span>
              ) : (
                <AnswerShape index={i} className="h-4 w-4" />
              )}
            </div>
            {type !== "poll" && isCorrect && (
              <div className="mt-1 text-xs font-bold text-ok">✓</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
