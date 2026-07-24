import { NextRequest, NextResponse } from "next/server";
import { getGame } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Serves question images uploaded with the set (stored as data URLs in the game). */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ pin: string; id: string }> }
) {
  const { pin, id } = await ctx.params;
  const game = getGame(pin);
  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });

  const dataUrl = game.images.get(id);
  if (!dataUrl) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const match = /^data:([a-z0-9.+/-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return NextResponse.json({ error: "Unsupported image encoding" }, { status: 415 });

  const body = Buffer.from(match[2], "base64");
  return new NextResponse(body, {
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(body.byteLength),
      // Image ids are unique per game, so clients can cache aggressively.
      "Cache-Control": "public, max-age=21600, immutable",
    },
  });
}
