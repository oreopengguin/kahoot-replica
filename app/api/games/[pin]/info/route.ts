import { NextRequest, NextResponse } from "next/server";
import { getGame } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public pre-join info so the join screen can validate a PIN. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found — check your PIN" }, { status: 404 });
  return NextResponse.json({
    pin: game.pin,
    setTitle: game.setTitle,
    phase: game.phase,
    locked: game.locked,
    nicknameGenerator: game.settings.nicknameGenerator,
    lateJoin: game.settings.lateJoin,
    playerCount: [...game.players.values()].filter((p) => !p.kicked).length,
  });
}
