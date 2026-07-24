import { NextRequest, NextResponse } from "next/server";

// Demo credentials for the teacher account.
const TEACHER_USERNAME = "lexvex";
const TEACHER_PASSWORD = "gawk67";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.username === TEACHER_USERNAME && body.password === TEACHER_PASSWORD) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
}
