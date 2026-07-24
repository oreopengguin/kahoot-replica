import { NextRequest, NextResponse } from "next/server";
import { createGame } from "@/lib/store";
import { QuestionSet } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { set?: QuestionSet; settings?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const set = body.set;
  if (!set || !Array.isArray(set.questions) || set.questions.length === 0) {
    return NextResponse.json(
      { error: "A question set with at least one question is required" },
      { status: 400 }
    );
  }
  if (set.questions.length > 500) {
    return NextResponse.json({ error: "Too many questions (max 500)" }, { status: 400 });
  }
  for (const q of set.questions) {
    if (typeof q.text !== "string" || !Array.isArray(q.choices) || !Array.isArray(q.correct)) {
      return NextResponse.json({ error: "Malformed question in set" }, { status: 400 });
    }
  }

  const { pin, hostToken } = createGame(set, body.settings ?? {});
  return NextResponse.json({ pin, hostToken });
}
