import { NextRequest, NextResponse } from "next/server";
import { getGame, joinGame } from "@/lib/store";
import { isNicknameAllowed } from "@/lib/names";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found — check your PIN" }, { status: 404 });

  let body: { nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nickname = String(body.nickname ?? "");
  if (!isNicknameAllowed(nickname)) {
    return NextResponse.json({ error: "Please pick a friendlier nickname" }, { status: 400 });
  }

  const result = joinGame(game, nickname);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ playerId: result.playerId, token: result.token });
}
