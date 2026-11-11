import type Anthropic from "@anthropic-ai/sdk";
import { DeckResponse, FlashCard } from "../schemas/flashcard";
import { loadPrompt } from "../prompts";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export type Check = "ok" | "failed" | "skipped";

export type DeckResult = {
  checks: { stop: Check; parse: Check; zod: Check };
  cards: FlashCard[];
  issues: string[];
  stopReason: string | null;
  model: string;
  promptVersion: string;
  usage: { input_tokens: number; output_tokens: number };
  ms: number;
};

export type DeckDeps = { client: Anthropic; model: string };

export const generateDeck = async (
  { client, model }: DeckDeps,
  topic: string,
): Promise<DeckResult> => {
  const prompt = loadPrompt("deck");
  const t0 = performance.now();

  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system: prompt.text,
    messages: [{ role: "user", content: `<topic>${topic}</topic>` }],
    output_config: { format: zodOutputFormat(DeckResponse) },
  });

  const base = {
    stopReason: res.stop_reason,
    model: res.model,
    promptVersion: prompt.id,
    usage: {
      input_tokens: res.usage.input_tokens,
      output_tokens: res.usage.output_tokens,
    },
    ms: Math.round(performance.now() - t0),
  };

  if (base.stopReason !== "end_turn") {
    return {
      ...base,
      checks: { stop: "failed", parse: "skipped", zod: "skipped" },
      cards: [],
      issues: [
        `stop_reason was ${res.stop_reason}, so the JSON may be incomplete`,
      ],
    };
  }

  const raw = res.content.find((b) => b.type === "text")?.text?.trim() ?? "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ...base,
      checks: { stop: "ok", parse: "failed", zod: "skipped" },
      cards: [],
      issues: [`Not JSON: ${raw.slice(0, 200)}`],
    };
  }

  const result = DeckResponse.safeParse(parsed);
  if (!result.success) {
    return {
      ...base,
      checks: { stop: "ok", parse: "ok", zod: "failed" },
      cards: [],
      issues: result.error.issues.map(
        (i) => `${i.path.join(".")}: ${i.message}`,
      ),
    };
  }

  return {
    ...base,
    checks: { stop: "ok", parse: "ok", zod: "ok" },
    cards: result.data.cards,
    issues: [],
  };
};
