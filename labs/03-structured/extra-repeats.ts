import Anthropic from "@anthropic-ai/sdk";
import { Deck, DeckResponse, prompt, systemPrompt } from "./flashcard";
import { client, MODEL } from "../client";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const NATIVE = process.argv.includes("--native");

type Outcome = "ok" | "parse" | "zod" | "cut";

const runOnce = async (): Promise<{
  outcome: Outcome;
  outputTokens: number;
  raw: string;
}> => {
  const conversation: Anthropic.MessageParam[] = [
    { role: "user", content: prompt },
  ];

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: NATIVE ? undefined : systemPrompt,
    messages: conversation,
    output_config: NATIVE
      ? { format: zodOutputFormat(DeckResponse) }
      : undefined,
  });

  const raw = res.content.find((b) => b.type === "text")?.text ?? "";

  if (res.stop_reason !== "end_turn") {
    return {
      outcome: "cut",
      outputTokens: res.usage?.output_tokens ?? 0,
      raw: raw,
    };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      outcome: "parse",
      outputTokens: res.usage?.output_tokens ?? 0,
      raw: raw,
    };
  }

  const result = NATIVE
    ? DeckResponse.safeParse(parsed)
    : Deck.safeParse(parsed);

  if (!result.success) {
    return {
      outcome: "zod",
      outputTokens: res.usage?.output_tokens ?? 0,
      raw: raw,
    };
  }

  return {
    outcome: "ok",
    outputTokens: res.usage?.output_tokens ?? 0,
    raw: raw,
  };
};

const RUNS = 10;
const tally: Record<Outcome, number> = { ok: 0, parse: 0, zod: 0, cut: 0 };
const tokens: number[] = [];

for (let i = 0; i < RUNS; i++) {
  const r = await runOnce();
  tally[r.outcome]++;
  tokens.push(r.outputTokens);
  console.log(
    `Run ${i + 1}: outcome=${r.outcome}, outputTokens=${r.outputTokens}`,
  );
  if (r.outcome !== "ok") {
    console.log("Raw output:", r.raw.slice(0, 120));
  }
}

console.log("Tally:", tally);
console.log("Output token range:", Math.min(...tokens), Math.max(...tokens));

// 4. Ten runs (wrap Steps 4–7 in a loop): how many JSON.parse failures and how many Zod failures out of 10? You'll compare this number with 3b.
// seen: or regular run, (no artificial constraints), 10/10 ok runs.
// seen: with "system" prompt commented out, 10/10 parse failures (JSON.parse fails every time).
// seen: with example line deleted, it was 10/10 okay runs.

// 5. Native JSON, 10 runs (`--native`, no system line): tally (ok / parse / zod / cut) and output token range?
// Seen: Tally: { ok: 10, parse: 0, zod: 0, cut: 0 }; Output token range: 304 562

// 6. Compare with 3a without the system line (10/10 parse failures): what made the difference, and did any run come back non-ok?
// Seen: 10/10 ok (native) vs 10/10 parse failures (3a). Same prompt, and neither had a format instruction, so the only difference is output_config.format: the API generates within the schema, so the text is always parseable JSON, with nothing around it to break JSON.parse. Zod also passed 10/10, so the min/enum hints in the descriptions were followed too. No run came back non-ok.
