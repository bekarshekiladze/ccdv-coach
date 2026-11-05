# CLAUDE.md

Exam-prep project for **CCDV-F (Claude Certified Developer – Foundations)**, run as two tracks in one repo:
- **Labs** (`labs/`): a folder per plan step and a script per sub-step, for predict & break.
- **Study Coach** (`src/`): a Next.js app that grows with the course and becomes the capstone covering all 8 exam domains.

Restarted from Day 1 on 2026-11-05. The first run (Days 1–5, scripts only) is archived in `../notes-agent`.

@AGENTS.md

## Start of every session
1. Read **Progress** (bottom of this file) and today's section in `docs/AGENDA.md`.
2. Before planning a new day, re-read the live plan doc; it can change.
3. Look up the rest as needed:

| File | What's in it |
|---|---|
| `docs/AGENDA.md` | this run's day-by-day plan: lessons, lab, app block, predict & break, check |
| `docs/CCDV-F.md` | the exam, domains and weights, the 5 courses, the plan's schedule and steps |
| `docs/ROADMAP.md` | the two tracks, capstone criteria per domain, the Study Coach vision and its levels |
| `docs/ARCHITECTURE.md` | the structure of `src/`, design rules, the FSD decision, Next.js notes |
| `docs/DECISIONS.md` | what's decided and what's still open |
| `docs/BACKLOG.md` | work that didn't fit its day, plus project items |
| `LEARNING.md` | the rules learned in this run, with evidence |

## Plan doc and course
- Plan: **CCDV-F Mini Project: TypeScript Claude Agent**, https://claude.ai/artifact/AbDQPkycoW9jGptdFeY8r2 (Claude Docs id `4da92e10-41ac-46b0-b7a9-fb56e7dc297f`). Tabs: *Guide* (the 11 build steps, with code) and *Daily agenda*. Its tick boxes still show the first run; this run is tracked in `docs/AGENDA.md`. Read it with the Claude Docs tools (load the docs skill first). **Never edit it unless the user asks.**
- Official prep path: https://anthropic-partners.skilljar.com/path/claude-certified-developer-foundations

## How we work
- Daily loop: reread yesterday's rules → Learn → Lab → App → Predict & break → Check → rules into `LEARNING.md`, Progress updated, commit.
- The user writes the labs and the app code. Give hints first (concept → API name → signature → shape), and full code only when asked or when the user is still stuck.
- Lesson passages or screenshots: explain concisely, in plain words, with an example tied to this repo.
- Say which parts come from the plan doc and which are your own suggestions.
- Experiments: give predictions first. The user runs the scripts that call the API and pastes the output; then compare.
- Type-check after every `.ts`/`.tsx` edit: `npx tsc --noEmit`.
- `LEARNING.md` format: "Rule: use X when…, not Y", plus "seen: …" only for results actually observed (with model and date).
- After each day, offer a short quiz on the user's own code.
- The app block is time-boxed to 45 min. What doesn't fit goes to `docs/BACKLOG.md`, never into the next day's course time.
- Commit at the end of every day: uncommitted files were lost in the first run.

## Conventions
- Next.js 16 (App Router, `src/`, Turbopack), React 19, TypeScript, Tailwind 4, ESLint. Before writing Next.js code, check the bundled docs in `node_modules/next/dist/docs/` (see AGENTS.md).
- App: `npm run dev` (http://localhost:3000), `npm run build`, `npm run lint`. Imports inside `src/` use `@/`.
- Labs: a folder per plan step, a file per sub-step (`labs/01-messages/1a-plain.ts`). Add a folder when the course reaches its step. Naming rules: `docs/DECISIONS.md` #17.
  - Run from the repo root: `npx tsx labs/01-messages/1b-stream.ts`.
  - Shared files stay in `labs/` (`client.ts`, `check-key.ts`, later `data/`), so step files import `../client`.
  - `labs/package.json` (`{ "type": "module" }`) makes only the labs ESM, subfolders included, so top-level await works.
  - Labs load `.env` with `import "dotenv/config"`, which looks in the current folder: one more reason to run from the repo root.
  - Labs never import from `src/`, and `src/` never imports from `labs/`.
- `src/core/` is framework-free: no `next`, `react` or `server-only` imports, and no dotenv (entry points load env). Next.js code reaches it through `src/server/`. Details: `docs/ARCHITECTURE.md`.
- `.env` holds `ANTHROPIC_API_KEY`. Next loads it for server code; the labs read it with dotenv. It's gitignored (`.env*`). Never print, log or commit it, and never use a `NEXT_PUBLIC_` prefix.
- Model while testing: `claude-haiku-5-5`.
- Packages: `@anthropic-ai/sdk` 1.4, zod 4, dotenv, tsx (dev). Add `@anthropic-ai/claude-agent-sdk` on Day 5.
- Windows: a Node `Assertion failed … UV_HANDLE_CLOSING` message after a crash is harmless.

## Progress
_Last updated 2026-11-05. Update at the end of every day._

| Day | State |
|---|---|
| 0 | done: Next.js starter, SDK + zod + dotenv + tsx, `labs/package.json`, docs |
| 1 | next: Foundations, Step 1, and the first streaming chat (`docs/AGENDA.md`) |
| 2–13 | not started |

- **Exam date:** not recorded yet.
