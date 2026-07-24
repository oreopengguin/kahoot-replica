import { NextRequest, NextResponse } from "next/server";
import { gameReport, getGame } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  if (sp.get("token") !== game.hostToken) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const report = gameReport(game);

  if (sp.get("format") === "csv") {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [
      ["Rank", "Nickname", "Score", "Correct", "Answered", "Accuracy %"].join(","),
      ...report.players.map((p) =>
        [p.rank, esc(p.name), p.score, p.correctCount, p.answeredCount, p.accuracy].join(",")
      ),
      "",
      ["Question", "Type", "Answered", "Correct", "Accuracy %", "Avg time (s)"].join(","),
      ...report.questions.map((q) =>
        [esc(q.text), q.type, q.answered, q.correct, q.accuracy, (q.avgTimeMs / 1000).toFixed(1)].join(",")
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="report-${pin}.csv"`,
      },
    });
  }

  return NextResponse.json(report);
}
