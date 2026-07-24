import { NextRequest, NextResponse } from "next/server";
import { authPlayer, getGame, hostSnapshot, playerSnapshot } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const role = sp.get("role");

  if (role === "host") {
    if (sp.get("token") !== game.hostToken) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return NextResponse.json(hostSnapshot(game));
  }

  const playerId = sp.get("playerId") ?? "";
  const token = sp.get("token") ?? "";
  const player = authPlayer(game, playerId, token);
  if (!player) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  return NextResponse.json(playerSnapshot(game, player));
}
