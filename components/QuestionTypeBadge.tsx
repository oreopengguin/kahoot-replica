import { QuestionType } from "@/lib/types";

/** Human-readable label for a question's type, shown before/while answering. */
export function questionTypeInfo(type: QuestionType, multiSelect: boolean): { icon: string; label: string } {
  if (type === "quiz" && multiSelect) return { icon: "☑️", label: "Multi-select — choose ALL correct answers" };
  switch (type) {
    case "quiz":
      return { icon: "🔘", label: "Multiple choice — pick one" };
    case "truefalse":
      return { icon: "⚖️", label: "True or false" };
    case "typeanswer":
      return { icon: "⌨️", label: "Type your answer" };
    case "slider":
      return { icon: "🎚️", label: "Slider — guess the number" };
    case "poll":
      return { icon: "📊", label: "Poll — no wrong answers" };
  }
}

export function QuestionTypeBadge({
  type,
  multiSelect,
  size = "md",
  className = "",
}: {
  type: QuestionType;
  multiSelect: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { icon, label } = questionTypeInfo(type, multiSelect);
  const isMulti = type === "quiz" && multiSelect;
  const sizing =
    size === "lg" ? "px-5 py-2 text-lg" : size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-bold shadow-card ${sizing} ${
        isMulti ? "bg-gold text-white" : "bg-brand-soft text-brand"
      } ${className}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
