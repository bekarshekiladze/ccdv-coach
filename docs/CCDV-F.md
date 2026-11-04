# CCDV-F: exam and prep context

_Snapshot of the plan doc on 2026-11-04 (Guide tab rev 67, Daily agenda tab rev 32). The live doc is the source of truth: re-read it before planning a new day._

## The exam
- **Claude Certified Developer – Foundations (CCDV-F)**, by Anthropic.
- Scenario questions ("A team sees X. What should they do?"). They test decision rules, which is why `LEARNING.md` collects "use X when…, not Y".
- Practice exams, per the plan: 53 questions, 120 minutes, timed. Book the real exam once you score 80%+ consistently.
- Exam date: not recorded yet.

## Domains and weights
Weights are from the Tutorials Dojo CCDV-F study guide, as cited in the plan.

| Domain | Weight | Plan steps that train it |
|---|---|---|
| Applications & Integration | 33.1% | 1, 10, 11 |
| Model Selection & Optimization | 16.8% | 4 |
| Agents & Workflows | 14.7% | 2, 7 |
| Prompt & Context Engineering | 11.0% | 3, 8 |
| Tools & MCPs | 10.6% | 2, 5, 10 |
| Security & Safety | 8.1% | 6, 11 |
| Claude Code | 3.1% | 6 |
| Eval, Testing & Debugging | 2.6% | 9 |

## Where things live
- **Plan doc:** "CCDV-F Mini Project: TypeScript Claude Agent", https://claude.ai/artifact/AbDQPkycoW9jGptdFeY8r2
  - Claude Docs id `4da92e10-41ac-46b0-b7a9-fb56e7dc297f`.
  - Tab **Guide** (tab `29ca836f-da6f`, body `cba87eff-e511`): setup, the 11 build steps with code, experiments, lesson extras and checklists, the 13-day sync table, sources.
  - Tab **Daily agenda** (tab `9308aaef-eed7`, body `92964348-ba17`): timed tick-off blocks per day (preview, read, build, extras, predict & break, check).
  - Read it with the Claude Docs tools. The user doesn't want it edited unless they ask.
- **Official prep path** (Anthropic Partner Academy on Skilljar): https://anthropic-partners.skilljar.com/path/claude-certified-developer-foundations
  - Lessons are reading (no video), with "Watch Out" notes and Checkpoint quizzes. The content sits in a SCORM iframe; Claude can read it through Claude in Chrome when the user is logged in.
- **Before Day 1**, the prep path recommends 9 free Anthropic Academy courses. Do *Building with the Claude API*, *Introduction to Model Context Protocol* and *Claude Code in Action* properly; skim *Claude 101*, *Claude Code 101*, *Claude Platform 101*, *AI Fluency*, *AI Capabilities and Limitations* and *MCP Advanced Topics*.
- **Setup** (from the plan): Node 20+, an API key from the Claude Console, a few dollars of credit. The whole project should cost well under $5 with a small model.

## The five official courses
Reading times are from the course modules.

| # | Course | Reading | Lessons, in order |
|---|---|---|---|
| 1 | MSO Foundations | ~59 min | Orientation · How LLMs Behave · Models & Reasoning · Prompting Modes · Technical Substrate · Wrap-up |
| 2 | Production-Grade Prompting, Agents & Tool-use | ~209 min | Orientation · Prompting Craft · Extended Thinking · Tool-use and Schema Design · Streaming Responses · Context Engineering · Agent Construction · Agent Memory · Cumulative Debug Task · Multimodal and Batch Ingestion · Wrap-up |
| 3 | Claude Code, MCP & Integration | ~142 min | Permission Modes & Human Gates · Durable Project Context · Packaging Workflows · MCP Servers · Enterprise Integration · Cumulative Integration Task · Key Takeaways |
| 4 | Production Engineering, Evals & Security | ~211 min | Module Introduction · Evals & Judges · Testing & Tracing · Failure Handling & Model Selection · Cost & Orchestration · Security · Cumulative Task · Key Takeaways |
| 5 | Accelerators & IP Contribution | ~139 min | Module Introduction · Packaging for Reuse · Contributing Back · Requirements & Lifecycle · Deployment & Versioning · Comparing Platforms · Trust Boundaries · Cumulative Task · Key Takeaways |

Courses 2–5 each end with a cumulative task (Days 5, 8, 11 and 13).

## The daily loop (~2–2.5 h)
1. **Start:** 5 min rereading yesterday's `LEARNING.md` rules.
2. **Learn** (40–70 min): the day's official lessons. Write down every decision rule ("use X when…, not Y").
3. **Build** (~60 min): the matching plan step in TypeScript. When a lesson shows Python, rewrite it in TS.
4. **Break** (10 min): predict the result first, then make it fail on purpose.
5. **Check** (10 min): the lesson's Watch Out notes and Checkpoint quiz; ask Claude to quiz you on your own code; tick the checklist.
6. **End:** add today's rules to `LEARNING.md` and update Progress in `CLAUDE.md`.

## The schedule
This is the plan's schedule. This run adds an app block to each day: see `docs/AGENDA.md`.

| Day | Course: lessons | Build (plan steps) |
|---|---|---|
| 1 | 1: all 6 sections | Setup, `check-key.ts`; Step 1a–1d. Extras: same prompt 5× (non-determinism), zero/one/multi-shot, one raw `fetch` call |
| 2 | 2: Orientation, Prompting Craft, Extended Thinking | 3a prompt-only JSON + Zod; 3b native JSON outputs; Step 10 thinking (with/without, low/high effort). P&B: 3a vs 3b 10× each, a strict Zod rule on 3b, a budget above `max_tokens` |
| 3 | 2: Tool-use and Schema Design, Streaming Responses | 2a–2b tools + loop; 3c forced tool + `strict`, `strict` on the note tools. Extras: parallel tool calls, `disable_parallel_tool_use`, a dropped stream is never saved. P&B: vague vs clear descriptions, a tool that throws, `tool_choice` force/none |
| 4 | 2: Context Engineering, Agent Construction | 8a–8d measure, prune, compact, isolate; 7a–7b workflow vs agent. P&B: none vs pruning vs pruning + compaction |
| 5 | 2: Agent Memory, Cumulative Debug Task | 8e memory file + `remember_fact`; 7c Agent SDK + subagent + restricted tools. Extras: own loop vs Agent SDK vs Managed Agents table; approval before deleting a note. Course task |
| 6 | 2: Multimodal and Batch Ingestion, Wrap-up | Step 10 vision/PDF: one image as base64, URL and `file_id`; a multi-page PDF. 4c: 10 questions via the Batch API vs throttled real-time calls |
| 7 | 3: Permission Modes & Human Gates, Durable Project Context, Packaging Workflows | Permission modes (default, `acceptEdits`, plan), a `deny` rule for `.env`, `claude -p`; 6c PreToolUse block + PostToolUse `npx tsc --noEmit`; a `.claude/rules` file + a project subagent; a Skill (plugin-style, with a custom command) |
| 8 | 3: MCP Servers, Enterprise Integration, Cumulative Integration Task, Key Takeaways | Step 5 MCP server (Inspector, Claude Code, a resource + a prompt). Extras: project vs user scope, stdio vs remote, the GitHub MCP server, tokens via env vars (6d). Course task |
| 9 | 4: Module Introduction, Evals & Judges, Testing & Tracing | 9a–9b 10-case dataset, code + model graders, pass rate; calibrate the judge on 10 labeled answers; 9c `traces.jsonl` |
| 10 | 4: Failure Handling & Model Selection, Cost & Orchestration | 4a–4b caching + cost function, compare two models; 9d drills + retries (backoff, jitter, timeouts, fallback). Extras: the deciding constraint for three tasks; a token budget per agent run |
| 11 | 4: Security, Cumulative Task, Key Takeaways | 6a injection test + two defenses; minimal secure config for a fetch-and-write agent. Course task |
| 12 | 5: Module Introduction, Packaging for Reuse, Contributing Back, Requirements & Lifecycle | 11a `REQUIREMENTS.md`; 11b package + README (assumptions, sample audit log, license check) |
| 13 | 5: Deployment & Versioning, Comparing Platforms, Trust Boundaries, Cumulative Task, Key Takeaways | 11c pin model + prompt versions, the evals to rerun before an upgrade; 11d platform table (API vs Bedrock vs Vertex, incl. identity and data residency); 11e trust-boundary diagram + integration map. Course task |
| 14 | practice | first full timed practice exam (53 questions, 120 min); list every miss by domain |
| 15 | practice | redo the experiments for the two weakest domains; reread `LEARNING.md` |
| 16+ | practice | more practice exams until 80%+ consistently, then book the exam |

## The plan's build steps
"Focus" is the plan's "What the exam checks here" line where the step has one. Otherwise it summarizes the step's experiments and lesson extras.

| Step | What you build | Focus |
|---|---|---|
| 1 | Messages API: 1a plain call, 1b streaming, 1c multi-turn REPL, 1d errors | content blocks vs strings, `stop_reason` values, statelessness, when to stream, retry (429, 529, 5xx) vs fix (400, 401, 404) |
| 2 | Tools + the agentic loop: 2a two tools, 2b the loop, 2c experiments | the most important step: tool_result pairing, `is_error`, turn cap, descriptions, `tool_choice`, parallel calls, required fields, dropped streams, MCP tools in the same loop |
| 3 | Structured output with Zod: 3a prompt-only, 3b native JSON, 3c forced tool + `strict`, 3d experiments | output is untrusted input; validate against a schema; handle failures before data reaches downstream systems |
| 4 | Prompt caching + cost: 4a cache a big prefix, 4b cost function, 4c experiments (cache miss, order, 3 models, Batch API) | what to cache, cache order rules, reading `usage`, model choice by quality/latency/cost, batch vs real time |
| 5 | A small MCP server: 5a Inspector, 5b Claude Code, 5c resource + prompt | client vs server roles, tools/resources/prompts, stdio vs remote, MCP vs custom tool vs Skill |
| 6 | Security, Claude Code, React UI: 6a injection, 6b CLAUDE.md + `-p`, 6c blocking hook, 6d secrets, 6e UI (optional) | permission modes, settings hierarchy, rules files + subagents, PostToolUse hook, minimal secure config |
| 7 | Agents: 7a workflow, 7b agent, 7c Agent SDK, 7d experiments | workflow vs agent, coordinator/subagent, Agent SDK vs custom loop, self-hosted vs Anthropic-hosted, frameworks (LangGraph, Strands, PydanticAI: know when, don't build) |
| 8 | Context: 8a measure, 8b prune, 8c compact, 8d isolate, 8e memory | drift and bloat, prune vs compact vs isolate, why tool output is the biggest consumer |
| 9 | Evals + tracing: 9a dataset, 9b graders, 9c traces, 9d debugging drills | judge calibration, test levels, retries done right |
| 10 | Add-ons: vision/PDF, extended thinking, a Skill, version pinning | effort calibration, input encodings (base64, URL, Files API), PDF token cost, nightly batch |
| 11 | Ship it: 11a requirements, 11b package, 11c versioning, 11d platforms, 11e trust boundaries | assumptions, audit log, rights before review, identity and data residency, integration map |

## Sources the plan cites
- Tutorials Dojo CCDV-F study guide (domains and weights)
- Claude API docs: tool use; defining tools
