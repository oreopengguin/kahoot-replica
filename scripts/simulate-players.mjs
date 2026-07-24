// Headless stress test: create a game, join N bots, run the full game via host API.
const BASE = "http://localhost:3000";
const N = Number(process.argv[2] ?? 60);

const set = {
  id: "stress", title: "Stress Test", description: "", coverEmoji: "🔥",
  createdAt: 1, updatedAt: 1,
  questions: [
    { id: "s1", type: "quiz", text: "Q1: pick A", choices: ["A", "B", "C", "D"], correct: [0], multiSelect: false, timeLimit: 10, points: "standard" },
    { id: "s2", type: "quiz", text: "Q2: pick B or C", choices: ["A", "B", "C", "D"], correct: [1, 2], multiSelect: false, timeLimit: 10, points: "double" },
    { id: "s3", type: "truefalse", text: "Q3: true?", choices: ["True", "False"], correct: [0], multiSelect: false, timeLimit: 10, points: "standard" },
  ],
};

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
async function get(path) {
  const res = await fetch(BASE + path, { cache: "no-store" });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const t0 = Date.now();
const game = await post("/api/games", { set, settings: { autoAdvance: true, streakBonus: true } });
const { pin, hostToken } = game.data;
console.log(`game created pin=${pin}`);

// Join N bots concurrently.
const joins = await Promise.all(
  Array.from({ length: N }, (_, i) => post(`/api/games/${pin}/join`, { nickname: `Bot${i}` }))
);
const bots = joins.filter((j) => j.status === 200).map((j) => j.data);
console.log(`joined ${bots.length}/${N} bots in ${Date.now() - t0}ms`);
if (bots.length !== N) {
  console.log("JOIN FAILURES:", joins.filter((j) => j.status !== 200).slice(0, 3));
}

// Everyone polls once (marks them active), then host starts.
await Promise.all(bots.map((b) => get(`/api/games/${pin}/state?playerId=${b.playerId}&token=${b.token}`)));
await post(`/api/games/${pin}/host`, { token: hostToken, action: "start" });

// Bot loop: poll + answer until podium. autoAdvance moves phases along.
async function runBot(b) {
  let answered = new Set();
  for (let i = 0; i < 600; i++) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    const { status, data: s } = await get(`/api/games/${pin}/state?playerId=${b.playerId}&token=${b.token}`);
    if (status !== 200) return { error: status };
    if (s.phase === "podium" || s.phase === "ended") return { rank: s.finalRank, score: s.me?.score ?? 0 };
    if (s.phase === "answering" && !s.answered && s.question && !answered.has(s.question.index)) {
      const idx = Math.floor(Math.random() * s.question.choices.length);
      const r = await post(`/api/games/${pin}/answer`, { playerId: b.playerId, token: b.token, choices: [idx] });
      if (r.status === 200) answered.add(s.question.index);
    }
  }
  return { error: "timeout" };
}

const results = await Promise.all(bots.map(runBot));
const ok = results.filter((r) => !r.error);
const errs = results.filter((r) => r.error);
console.log(`finished: ${ok.length} bots completed, ${errs.length} errors, total ${(Date.now() - t0) / 1000}s`);

// Report sanity.
const rep = await get(`/api/games/${pin}/report?token=${hostToken}`);
const top = rep.data.players.slice(0, 3).map((p) => `${p.rank}. ${p.name} ${p.score}`);
console.log(`report players=${rep.data.players.length} questions=${rep.data.questions.length}`);
console.log("podium:", top.join(" | "));
const answeredCounts = rep.data.questions.map((q) => q.answered);
console.log("answers per question:", answeredCounts.join(", "));
