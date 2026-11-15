import "server-only";
import { join } from "node:path";
import { type AgentRequest, runAgent } from "@/core/agent/loop";
import { MODEL, client } from "@/core/llm/client";
import { createFileNotesStore } from "@/core/study/notes";
import { noteTools } from "@/core/tools/note-tools";

// reexports
export { APIError, client, MODEL } from "@/core/llm/client";
export { loadPrompt } from "@/core/prompts";
export { generateDeck } from "@/core/study/generate-deck";
export type { DeckResult } from "@/core/study/generate-deck";

// Until Day 5's user picker, everyone is the same local user.
export const DEFAULT_USER = "local";

// One store for the whole server: data/notes/<userId>.json (gitignored).
export const notesStore = createFileNotesStore(
  join(process.cwd(), "data", "notes"),
);

// The coach's agent with its tools and stores wired in. Routes call this, not runAgent.
export const runCoachAgent = (request: AgentRequest) =>
  runAgent(
    {
      client,
      model: MODEL,
      tools: noteTools,
      ctx: { userId: DEFAULT_USER, notes: notesStore },
    },
    request,
  );
