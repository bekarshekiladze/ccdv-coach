# Decisions

**decided** = agreed by the user · **recommended** = proposed by Claude, waiting for the user · **open** = not decided yet.

### 1. Two tracks: course scripts and a web app (decided, 2026-11-04)
This was the user's idea.
- **Course track:** one script per plan step.
- **Web track:** "Study Coach", a Next.js app (the user is learning Next.js). It is also the capstone that should cover all 8 exam domains.

Why: each script isolates one concept, while the app trains integration (server-side key, streaming UI, approval gates, per-user data). The course track never waits for the web track.

### 2. No long-lived second branch (recommended, 2026-11-04)
The user first proposed a `webify` branch next to `master`. A branch that never merges back needs merges from master forever, shows only one track at a time, and isn't how real teams work. Use short-lived feature branches that merge back instead.

### 3. Repo layout: a new repo in the target shape (decided by the user, 2026-11-05)
`ccdv-coach` is one Next.js app with `labs/` and `src/core` (`docs/ARCHITECTURE.md`). The earlier options were a `web/` folder in notes-agent, a separate repo next to it, or a long-lived branch. They were dropped when the user chose to restart from Day 1 (#14). `../notes-agent` stays as the archive of the first run.

### 4. No FSD (Feature-Sliced Design) (recommended, 2026-11-04)
- FSD covers only the frontend, and the exam-relevant code is server-side.
- It collides with Next.js's `app/` and `pages/` folders, and its folders don't separate server code from client code.
- It's heavy for about 5 pages and one developer.

Keep its three good ideas: slices by feature, a public API per module, and one-way imports checked by lint. Exception: if the user's job uses FSD, apply it to the UI only, never to `core/`. Details are in `docs/ARCHITECTURE.md`.

### 5. One package, not a monorepo (recommended)
There is only one deployable, the web app. Labs, evals and the MCP server run locally with `tsx`. Move `src/core` to `packages/core` when a second deployable appears, such as a worker for long agent runs.

### 6. The official `@anthropic-ai/sdk` in the app, not the Vercel AI SDK (recommended)
Wrappers hide content blocks, `stop_reason` and the tool loop, which the exam tests. Knowing when to pick a framework is exam material; building with one isn't.

### 7. A framework-free Claude core, reached from Next.js only through `src/server` (recommended)
The core gets its dependencies passed in (llm, stores, tracer). Then labs, evals, the MCP server and Next.js can all reuse it, unit tests can use a fake LLM, and Bedrock or Vertex means writing one adapter.

### 8. `import "server-only"` goes in `src/server/`, never in `core/` (recommended)
`server-only` throws under plain Node, so labs, evals and the MCP server would crash.

### 9. The server owns the conversation history (recommended)
The browser can't fake assistant or tool turns, or change thinking blocks. The agent loop can also pause for an approval and resume.

### 10. Prompts, schemas and model IDs are versioned data (recommended)
- One Zod schema per output, with the JSON Schema generated from it.
- Prompts in `prompts/v1/`, and model IDs pinned in one file.
- Every trace line records the model and the prompt version.

### 11. Least privilege in the Agent SDK (decided in Step 7c, 2026-11-04)
- `tools`: what exists for the model.
- `allowedTools`: what runs without asking.
- `permissionMode: "dontAsk"`: deny everything else.
- `settingSources: []`: don't load personal settings.

`allowedTools` alone does not restrict anything (checked in the SDK 0.3.318 types).

### 12. Test model `claude-haiku-5-5` (decided, plan doc)
Cheap while testing; Step 4 compares it with Sonnet and Opus.

### 13. Don't edit the plan doc unless asked (decided by the user, 2026-10-30)

### 14. Restart from Day 1 in the new repo (decided by the user, 2026-11-05)
The first run reached Day 5 with scripts only. The user chose to start over with the two-track plan: every day now has a lab and an app block (`docs/AGENDA.md`), and the lessons are read again. The plan doc's Daily agenda ticks still show the first run.

### 15. A fresh LEARNING.md (decided, 2026-11-05)
Writing the rules yourself is part of learning, so this run starts empty. The first run's rules stay in `../notes-agent/LEARNING.md`, to compare against after each day.

### 16. Scaffold choices (decided, 2026-11-05)
`create-next-app` 16.4.5 with TypeScript, ESLint, Tailwind, the App Router, a `src/` directory, the `@/*` alias and npm. `.env` is shared by Next (server code) and the labs (dotenv).

### 17. Labs: a folder per plan step, a file per sub-step (decided by the user, 2026-11-05)
Refines #1. Example: `labs/01-messages/1a-plain.ts`.
- **Folders** follow the plan's steps and are added when the course reaches them: `01-messages`, `02-tools`, `03-structured`, `04-caching`, `05-mcp`, `06-security`, `07-agents`, `08-context`, `09-evals`, `10-add-ons`.
- **Files** start with the sub-step they cover: `1b-stream.ts`, or `2a-2b-loop.ts` when one file covers two. A file for a whole step, or for one of Step 10's unlettered items, uses the bare number: `5-mcp-server.ts`, `10-thinking.ts`. Lesson extras are `extra-<name>.ts`.
- A sub-step that only extends another file stays in it: 1d's error handling lives in `1c-chat.ts`.
- **Shared files** stay in `labs/`: `client.ts`, `check-key.ts`, `package.json` (ESM for every subfolder), and later `data/`. Step files import `../client`.
- **Why:** a step's files stay together, each file holds one concept so a run tests only that, and the step number in the file name keeps editor tabs and Ctrl+P clear.
- **Cost:** one more folder level and longer run commands. Run from the repo root, because dotenv looks for `.env` in the current folder.
- The plan's Guide keeps one flat file per step (`src/01-stream.ts`, where 1b replaces 1a's call). This layout is a repo convention, not the plan's.

### 18. A `day-N` branch per day, merged with `--no-ff` (decided, 2026-11-08)
Refines #2. Each day gets a short-lived `day-N` branch off `master`. At the end of the day it merges with `git merge --no-ff day-N` and is deleted with `git branch -d`.
- **Why `--no-ff`:** the merge commit groups each day's commits, so `git log --graph` shows one bubble per day, and a whole day can be reverted with `git revert -m 1 <merge>`.
- **Cost:** one extra merge commit per day. The branch is `master` (no remote yet), so nothing is pushed.
