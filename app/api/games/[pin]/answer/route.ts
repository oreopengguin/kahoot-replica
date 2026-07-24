import { NextRequest, NextResponse } from "next/server";
import { authPlayer, getGame, submitAnswer } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  let body: {
    playerId?: string;
    token?: string;
    choices?: number[];
    text?: string;
    sliderValue?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const player = authPlayer(game, String(body.playerId ?? ""), String(body.token ?? ""));
  if (!player) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const result = submitAnswer(game, player, {
    choices: body.choices,
    text: body.text,
    sliderValue: body.sliderValue,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
