import { NextRequest, NextResponse } from "next/server";
import { getGame, hostAction, HostAction } from "@/lib/store";

export const dynamic = "force-dynamic";

const ACTIONS: HostAction[] = ["start", "next", "skip", "lock", "unlock", "kick", "end"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ pin: string }> }) {
  const { pin } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  let body: { token?: string; action?: string; playerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.token !== game.hostToken) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const action = body.action as HostAction;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result = hostAction(game, action, body.playerId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
