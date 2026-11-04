# Architecture: the target shape

_Designed 2026-11-04. Since 2026-11-05 this is the actual structure of this repo, built up day by day (`docs/AGENDA.md`)._

**In short:** one repo with one Next.js app. Inside it is a framework-free **Claude core**, and everything uses it: the web routes, the lesson labs, the evals and the MCP server.

## Structure
Add each folder when the course reaches it; don't create empty ones up front.

```
ccdv-coach/
├─ src/
│  ├─ app/                     Next.js routes only, kept thin
│  │  ├─ (study)/today · coach · practice · labs · notes · insights · settings
│  │  └─ api/
│  │     ├─ chat/route.ts      POST → SSE: runs the agent, streams events
│  │     ├─ uploads/route.ts   image/PDF → Files API
│  │     └─ mcp/route.ts       the notes MCP server over HTTP (remote transport)
│  ├─ features/                UI slices: chat, notes, practice, labs, insights
│  ├─ shared/                  UI kit, SSE reader, wire contracts (Zod)
│  ├─ server/                  Next-side wiring: import "server-only", builds the core with db + tracer
│  └─ core/                    the Claude program: plain TypeScript, no Next.js or React
│     ├─ llm/                  client, pinned models + per-task routing (model, effort, thinking),
│     │                        retries, streaming, cost, tracing
│     ├─ prompts/v1/           versioned prompt files
│     ├─ schemas/              Zod: flashcard, quiz, router decision, memory fact
│     ├─ tools/                each tool = definition + handler + risk (read / write / destructive)
│     ├─ agent/                router (workflow), loop (turn + budget caps, approval pause), subagents
│     ├─ context/              builds each request: stable prefix (tools, system) cached,
│     │                        per-user memory after it; prune, compact
│     ├─ memory/               per-user facts: store interface; a file locally, a DB when deployed
│     ├─ study/                the domain: notes, decks, quiz results, weak topics
│     ├─ security/             untrusted-content wrapping, secret redaction, approval policy
│     ├─ multimodal/           image/PDF → content blocks (base64, URL, file_id)
│     ├─ batch/                Message Batches (nightly deck generation)
│     └─ mcp/                  createNotesServer(): tools, resources, prompts
├─ labs/                       lesson experiments, one per lesson (predict & break)
├─ evals/                      datasets, graders (code + LLM judge), runner
├─ bin/                        mcp-stdio.ts, nightly-batch.ts
├─ docs/                       requirements, trust boundaries, platform table, decisions
├─ .claude/                    settings (permissions, hooks), agents/, skills/, rules/
├─ .mcp.json                   project-scoped MCP config (committed)
├─ .github/workflows/ci.yml    typecheck, tests and evals on every PR
├─ CLAUDE.md
└─ LEARNING.md
```

**Why one package and not a monorepo:** you only deploy one thing, the web app. Labs, evals and the MCP server run locally with `tsx`. If a second deployable ever appears, move `src/core` to `packages/core`; the import rules make that a move, not a rewrite. An example would be a worker for agent runs that outlive a serverless request.

## Five design rules
1. **Pass the core its dependencies** (`llm`, stores, tracer) instead of having it import them. Then labs, evals, the MCP server and Next.js can all reuse it, unit tests can use a fake LLM, and Bedrock or Vertex means writing one adapter.
2. **Imports go one way, checked by lint** (ESLint `import/no-restricted-paths` or `eslint-plugin-boundaries`):
   - `app → features → shared`
   - Next.js code reaches `core` only through `src/server`
   - `core` never imports Next.js, React or the UI
3. **Put `import "server-only"` in `src/server/`, never in `core/`.** It throws under plain Node, so labs, evals and the MCP server would crash.
4. **The server stores the conversation history, not the browser.**
   - The client can't fake assistant or tool turns, or change thinking blocks.
   - The agent loop can pause for an approval and resume afterwards.
5. **Treat prompts, schemas and model IDs as versioned data.**
   - One Zod schema per output, with the JSON Schema generated from it, so the two can't drift apart.
   - Prompts live in `prompts/v1/`, and model IDs are pinned in one file.
   - Every trace line records the model and the prompt version, so evals can compare versions.

## Where each exam domain lives
| Domain (weight) | Code | What you see in the app |
|---|---|---|
| Applications & Integration (33.1%) | `core/llm`, `core/multimodal`, `api/chat` | streaming chat, stop button, uploads, clear errors |
| Model Selection & Optimization (16.8%) | `llm/models.ts`, `llm/cost.ts`, `context/` caching, `core/batch` | cost + cache panel, model picker, nightly decks |
| Agents & Workflows (14.7%) | `core/agent` | a router for simple requests, the agent for open-ended ones, approve/deny cards |
| Prompt & Context Engineering (11.0%) | `prompts`, `schemas`, `context`, `memory` | flashcards and quizzes, long sessions that stay fast, "remembers my exam date" |
| Tools & MCPs (10.6%) | `core/tools`, `core/mcp` + `bin/mcp-stdio.ts` + `api/mcp` | the same notes in the chat and inside Claude Code |
| Security & Safety (8.1%) | `core/security`, `src/server`, server-side history | approval gate, per-user data, injection-test notes |
| Claude Code (3.1%) | `CLAUDE.md`, `.claude/`, `.mcp.json`, `claude -p` in CI | how you build the app |
| Eval, Testing & Debugging (2.6%) | `evals/`, `llm/trace`, fake-LLM unit tests | traces page, pass rate per prompt version |

- **One MCP server, two transports:** stdio for Claude Code, and HTTP through `api/mcp`. That's the exam's "stdio vs remote" topic in practice. Once deployed, the Messages API's MCP connector can also use the HTTP one.
- **The Agent SDK stays in `labs/`.** It runs Claude Code's harness, which fits a background worker better than a chat request.

## Build order, following the course
For each item, build a lab first (predict & break), then the app feature.
1. **Course 1:** `core/llm` and the streaming chat.
2. **Course 2:**
   - flashcards (prompts + schemas)
   - tools, the agent loop and approval cards
   - context management and memory
   - the router and a subagent
   - uploads and batch
3. **Course 3:** the `.claude/` config and hooks, the MCP server (stdio + HTTP), a Skill.
4. **Course 4:**
   - caching, the cost panel, model routing and budgets
   - evals, traces and CI
   - injection tests, and retries with a fallback
5. **Course 5:** docs (requirements, trust boundaries, platform table), pinned versions, README, deployment.

## FSD (Feature-Sliced Design): not used
FSD splits the frontend into layers (`app → pages → widgets → features → entities → shared`). Imports only go downward, and each slice has a public API. This app in FSD would look like this:
```
src/app/       providers, global styles (not Next.js routing)
src/pages/     chat, notes, flashcards, progress
src/widgets/   chat-window, flashcard-deck, cost-panel
src/features/  send-message, approve-tool-call, upload-file, generate-deck
src/entities/  message, note, flashcard, memory-fact
src/shared/    UI kit, API client, SSE reader
app/           Next.js routing, re-exporting src/pages
pages/         empty, so Next.js doesn't treat src/pages as the Pages Router
```
FSD has no place for the Claude core.

**Pros**
- Clear rules for where code goes. One-way imports, checked by its linter Steiger, prevent tangled dependencies.
- A public API per slice keeps code encapsulated and makes refactors safer.
- Slices are named after user actions, so the folders read like the product.
- Some companies use it widely, so it's worth knowing if your team does.

**Cons for this project**
- **It only covers the frontend.** What the exam tests (agent loop, tools, prompts, memory, evals, MCP) is server code, so you'd need a second architecture anyway.
- **It clashes with Next.js.**
  - FSD's `app` and `pages` names collide with Next.js's folders, hence the workaround above.
  - Its folders don't separate server code from client code. That separation is what keeps the API key safe.
- **It's too heavy for about 5 pages and one developer.** The classic time sink is deciding "is this a feature, an entity or a widget?" FSD's own newer guidance (v2.1) moved toward keeping code in pages until it's actually reused.
- **You're still learning Next.js.** Learn its own conventions first; FSD on top hides them behind re-exports.
- **Its main payoff doesn't apply here.** That payoff is consistency across a team, and this is a solo project. It also earns no exam points.

**Decision:** don't use FSD here. The structure above keeps its three good ideas (slices by feature, a public API per module through `index.ts`, one-way imports checked by lint) for both the UI and the core. If your job uses FSD and you want the practice, apply it only to the UI (`features/` + `shared/`), never to `core/`. The UI only reaches the core through `src/server` and the API, so you can change that decision later without much cost.

## Next.js notes
- **Route handlers stay thin:** read the request → call `src/server` → stream the result back.
- **The key stays on the server:**
  - put it in `.env` (Next loads it for server code; the labs read it with dotenv) and never give it the `NEXT_PUBLIC_` prefix
  - put `import "server-only"` in `src/server/`
  - the Anthropic SDK also refuses to run in a browser unless `dangerouslyAllowBrowser` is set
- **Streaming:** `EventSource` can't send a POST, so read the SSE stream with `fetch` and a `ReadableStream` reader. Never save a turn the user stopped or a stream that dropped.
- **Serverless limits:**
  - A function has a maximum duration, so keep agent loops bounded. Long tasks go to Batch, a background job or Managed Agents.
  - The filesystem doesn't persist, so memory and notes need a DB once deployed: a SQLite file locally, a hosted DB after that.
- **Per-user data:** a simple user picker (a cookie with a userId) is enough for scoping. Real login is Next.js practice, not exam practice.
- **Top-level await in labs** (the first run's Day 1 error): `labs/package.json` holds `{ "type": "module" }`, which makes only the labs ESM. Checked on 2026-11-05: tsx runs it, and tsc accepts it under Next's tsconfig.
- **Claude Code memory is tied to the folder you start it from**, so keep starting it from the repo root.

## Setup (done 2026-11-05)
- `npx create-next-app@latest ccdv-coach --ts --eslint --tailwind --app --src-dir --import-alias "@/*" --use-npm` gave Next.js 16.4.5, React 19 and Tailwind 4, plus an `AGENTS.md` that `next dev` keeps up to date.
- Added: `@anthropic-ai/sdk`, `zod`, `dotenv`, and `tsx` (dev); `labs/package.json`; `CLAUDE.md`, `docs/`, `LEARNING.md`.
- `server-only` isn't installed. Next 16 handles it, and the bundled docs say installing it is optional.
- Next's `tsconfig.json` includes every `.ts` file, so `npx tsc --noEmit` checks the labs and the app together.
- Not yet: `.env` (the user copies the key on Day 1), and every folder under `src/` beyond the starter's `src/app/`. Those arrive day by day.
