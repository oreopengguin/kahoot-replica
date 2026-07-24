# ⚡ LexVex Sonion Quiz App

A free, full-featured live quiz platform — build question sets, host live games with a 6-digit
PIN, and play with your whole class in real time. Every feature is free: no player caps, no
locked question types, no paywalled reports.

Built with Next.js (App Router), React 19, TypeScript, and Tailwind CSS v4.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- **Teacher login:** username `lexvex`, password `gawk67` → build sets and host games.
- **Players:** open the site on any device and enter the game PIN — no account needed.

## Features

### For teachers
- **Question set editor** — unlimited sets, unlimited questions, autosave, reordering,
  duplication, validation warnings, cover emoji, per-question image URLs and emoji.
- **Five question types** — quiz (1–4 correct answers, optional select-all-that-apply mode),
  true/false, type-the-answer (with alternative accepted spellings), slider (guess a number,
  with tolerance and partial credit), and poll (no points).
- **Per-question tuning** — time limits from 5s to 240s; standard, double, or no points.
- **Game options** — shuffle questions and/or answers, auto-advance, answer-streak bonus,
  nickname generator, late joining, podium finale, lock/unlock lobby, kick players.
- **Live host controls** — skip countdown, skip to results, end early, live answer counter.
- **Reports** — per-player and per-question accuracy and timing after every game, viewable
  in-app or downloadable as CSV.
- **Import/export** — share question sets as JSON files.

### For players
- Join in two taps with a PIN and nickname (or a fun generated one).
- Big colored answer buttons with **distinct shapes**, speed-based scoring up to 1,000 points
  (2,000 on double), streak bonuses, live rank after every question, and a podium finale.
- Rejoin instantly after a page refresh — sessions survive reloads.

### For everyone
- **Three themes:** light, dark, and a colorblind-friendly high-contrast mode (Okabe–Ito
  palette; answer buttons are distinguished by shape as well as color).
- Sound effects and lobby music synthesized in the browser (mutable, no audio files).
- Fully responsive — phones, tablets, laptops, projectors.
- 400-player games. A 150-bot full game runs clean in under a minute:
  ```bash
  node scripts/simulate-players.mjs 150
  ```

## How scoring works

Correct answers earn up to 1,000 points (2,000 on double-points questions), scaled by speed:
answering instantly earns full points, and points fall linearly to 50% at the buzzer.
With streak bonus on, each consecutive correct answer adds +100 × streak (capped at +500).
Sliders give full points within the tolerance and partial credit for near misses.

## Architecture (short version)

- Question sets live in the teacher's browser (`localStorage`).
- Live games live in server memory; clients poll ~0.6s for state. One Node process holds all
  game state — run it with `next start` (or `next dev`) on a single instance.
- See [HANDOFF.md](HANDOFF.md) for the full tour, including what to change for a
  multi-instance/serverless deployment.

## Deploying

The app is a standard Next.js app. **Important:** live games are held in one server process,
so deploy somewhere that runs a persistent Node server (Railway, Render, Fly.io, a VPS, or
Vercel with a single always-on compute instance). On Vercel's default serverless platform,
API routes may hit different instances — swap `lib/store.ts` to Redis first (notes in
HANDOFF.md).
