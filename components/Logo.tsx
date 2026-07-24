import Link from "next/link";

export function Logo({ size = "md", link = true }: { size?: "sm" | "md" | "lg"; link?: boolean }) {
  const cls =
    size === "lg"
      ? "text-4xl sm:text-5xl"
      : size === "sm"
        ? "text-lg"
        : "text-2xl";
  const inner = (
    <span className={`font-black tracking-tight ${cls} select-none`}>
      <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">
        LexVex
      </span>{" "}
      <span className="text-ink">Sonion</span>
      <span className="ml-1 align-middle" aria-hidden>
        ⚡
      </span>
    </span>
  );
  return link ? (
    <Link href="/" className="inline-block transition-transform hover:scale-105">
      {inner}
    </Link>
  ) : (
    inner
  );
}
