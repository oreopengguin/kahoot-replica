# HANDOFF — LexVex Sonion Quiz App

This document lets anyone (human or AI) with zero context pick the project up and keep going.

## What this is

A Kahoot-style live quiz web app ("LexVex Sonion Quiz App") built as a Next.js app. Teachers
sign in, build question sets, and host live games; students join with a 6-digit PIN from any
device and answer in real time. Free of every Kahoot paywall: 400-player games, all question
types, reports, etc. The GitHub repo is `oreopengguin/kahoot-replica` (repo/folder name stays
"kahoot replica"; the product name is "LexVex Sonion Quiz App").

- Teacher credentials: username `lexvex`, password `gawk67`
  (hardcoded in `app/api/auth/route.ts`).
- Run locally: `npm install && npm run dev` → http://localhost:3000 (Node 18+; built on 26).
- Verify quickly: `npm run build` (must pass), then
  `node scripts/simulate-players.mjs 60` with the dev server running — expect
  "60 bots completed, 0 errors".

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
(via `@tailwindcss/postcss`; theme tokens defined with `@theme inline` in `app/globals.css`).
No other runtime dependencies. No database.

## Architecture

**Two data domains, deliberately separate:**

1. **Question sets** — client-side only, in the teacher's browser `localStorage`
   (`lib/sets.ts`, key `lexvex.sets.v1`). Sample sets are seeded on first dashboard visit
   (`seedSampleSets`, guarded by `lexvex.seeded.v1`). Import/export as JSON. Nothing about
   sets ever touches the server until the teacher hosts a game, at which point the whole set
   is POSTed and snapshotted into the game.

2. **Live games** — server-side, in-memory (`lib/store.ts`). A `globalThis`-pinned Map of
   PIN → Game survives dev HMR. Games are garbage-collected 6h after creation or 30min after
   ending. **This means one Node process must own all state** — fine for `next dev` /
   `next start` on one instance. For serverless/multi-instance deployment, replace the Map
   access inside `lib/store.ts` with Redis (every mutation goes through functions in that one
   file; snapshots are pure functions of the Game object, so the swap is contained).

**Realtime = polling.** Clients poll `GET /api/games/[pin]/state` every ~600ms
(`usePoll` in `lib/client.ts`). Phase timers are advanced lazily in `tick()` on every store
access — there are no server-side setTimeouts, so state stays correct no matter when a poll
arrives. 150 concurrent simulated players complete a full game with 0 errors.

**Game phase machine** (`lib/store.ts`):
`lobby → intro (5s) → answering (question timeLimit) → reveal → scoreboard → intro … → podium/ended`.
- `answering` ends early when every *active* player answered (active = polled within 30s —
  generous because phones lock and background tabs throttle; see `ACTIVE_WINDOW_MS`).
- `reveal → scoreboard → next` are host-driven (`action: "next"`), or timed when the
  `autoAdvance` setting is on.
- Host actions: `start | next | skip | lock | unlock | kick | end`
  (POST `/api/games/[pin]/host`, guarded by `hostToken`).

**Scoring** (in `submitAnswer`): base 1000 (double 2000, none 0) × speed factor
(1 − elapsed/timeLimit/2, i.e. full → 50% at the buzzer), + streak bonus
(min(streak,5) × 100) when enabled. Slider: full points within tolerance, partial credit
fading to zero at 25% of range beyond it, halved. Multi-select quiz: all-or-nothing.
Type answer: normalized (trim/lowercase/collapse-spaces) match against `acceptedAnswers`.

**Auth model (intentionally simple):** teacher "session" is a localStorage flag after the
server validates credentials; player/host identity is per-game random tokens returned at
join/create and stored in `sessionStorage` (survives refresh, dies with tab). There are no
accounts and no personal data.

## File map

```
app/
  page.tsx                  Landing: PIN join box + feature grid
  login/page.tsx            Teacher sign-in (POSTs /api/auth)
  dashboard/page.tsx        Set library: create/edit/duplicate/delete/import/export + HostModal (game settings)
  editor/[id]/page.tsx      Question set editor (all 5 types, validation, autosave)
  host/[pin]/page.tsx       Host screen: lobby/intro/answering/reveal/scoreboard/podium + report + CSV
  play/page.tsx             Player: join flow + answer pads + results + final screen
  api/auth/route.ts         Teacher credential check
  api/games/route.ts        POST create game
  api/games/[pin]/info      Public pre-join info (validates PIN, exposes nicknameGenerator etc.)
  api/games/[pin]/join      POST join (nickname checks: profanity, dupes, length, lock, cap)
  api/games/[pin]/state     GET polled snapshots (host or player view)
  api/games/[pin]/answer    POST submit answer
  api/games/[pin]/host      POST host actions
  api/games/[pin]/report    GET report (JSON or ?format=csv)
lib/
  types.ts                  All shared types (Question, GameSettings, snapshots)
  store.ts                  THE game engine (state machine, scoring, snapshots, reports)
  sets.ts                   localStorage set CRUD + sample sets + JSON import validation
  client.ts                 fetch helper, usePoll hook, teacher/player/host session helpers
  names.ts                  Nickname generator + profanity filter (client + server)
  sounds.ts                 WebAudio synth SFX + lobby music (no assets)
components/
  ThemeProvider/Switcher    3 themes: light / dark / colorblind (data-theme on <html>)
  AnswerShape.tsx           The 4 answer identities (color classes + SVG shapes)
  Podium.tsx, Confetti.tsx, DistributionChart.tsx, TimerRing.tsx, Logo.tsx
scripts/
  simulate-players.mjs      Bot harness: creates a game, joins N bots, plays a full game
```

## Theming

Three themes switched by `data-theme` on `<html>`, persisted at `lexvex.theme`, FOUC-guarded
by an inline script in `app/layout.tsx`. All colors are CSS variables in `app/globals.css`,
mapped to Tailwind utilities via `@theme inline` (e.g. `bg-surface`, `text-mut`, `bg-a0`).
Colorblind mode uses the Okabe–Ito palette and relies on the per-answer SVG shapes
(triangle/diamond/circle/square) so color is never the only signal. Answer colors 0–3 =
`--a0..--a3` with paired `--aNfg` foregrounds (choice 2 in colorblind mode is yellow with
dark text).

## Design language

Playful-but-clean: rounded-3xl cards, `shadow-card`/`shadow-pop`, gradient brand
(`from-brand to-brand-2`), font-black headings, springy `anim-pop`/`anim-slide-up`
keyframes (all defined in globals.css, honoring `prefers-reduced-motion`). Sounds are
synthesized in `lib/sounds.ts` — host gets lobby music + countdown ticks + reveal stings;
players get select/correct/wrong/podium cues; mute toggle in ThemeSwitcher persists.

## Known limitations / next steps (ranked)

1. **Multi-instance deployment**: swap `lib/store.ts` Map for Redis (all access already
   funnels through this file). Until then deploy on a single persistent Node instance.
2. Teacher sets are per-browser. A future server-side store (with real accounts) would let
   teachers roam devices. Import/export JSON is the current workaround.
3. No websockets — polling is simple and proven here, but SSE/WS would cut latency and load.
4. Question types not yet implemented from Kahoot's full roster: puzzle (drag-to-order),
   pin-answer-on-image, brainstorm, word cloud. The `QuestionType` union + editor + pads +
   `submitAnswer` are the four places to extend.
5. Team mode (shared team scores) and a solo practice mode would be natural additions.
6. `confirm()`-free UX is done (inline two-step confirms); the editor could still use
   drag-and-drop reordering (currently ↑/↓ buttons).

## Testing recipes

- **Full-game smoke test:** `node scripts/simulate-players.mjs 60` (dev server running).
- **Manual two-tab test:** host in one browser tab (sign in → dashboard → Host), join from a
  second tab/phone at `/play?pin=XXXXXX`. Note: browsers throttle *background* tabs, so when
  testing in one window keep the player tab visible or the 30s activity window may mark it
  idle (host can always Skip).
- **Build gate:** `npm run build` must pass with zero type errors.

## Conventions & gotchas

- Repo folder name contains a space ("kahoot replica") — quote paths in shell commands.
- `.claude/` is gitignored on purpose (per project owner) — don't commit it.
- Git history should show `oreopengguin <oreopengguin@gmail.com>` as the sole author;
  don't add other authors/co-author trailers to commits.
- Route handler params are async in Next 16: `ctx: { params: Promise<{ pin: string }> }`.
- `lib/store.ts` mutates a `globalThis` singleton — never import it into client components
  (client code talks only through `/api/*`).
- Time limits are seconds in `Question.timeLimit`; all engine math is in ms.
