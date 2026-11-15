import Anthropic from "@anthropic-ai/sdk";
import { client, MODEL } from "../client";
import { DeckResponse, prompt } from "./flashcard";

const deckTool: Anthropic.Tool = {
  name: "record_deck",
  description:
    "Record the flashcard deck. Always use this tool to return the cards.",
  input_schema: {
    type: "object",
    properties: {
      cards: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The question, at least 5 characters.",
            },
            answer: { type: "string", description: "A short, correct answer." },
            domain: {
              type: "string",
              enum: [
                "agents",
                "api",
                "tools",
                "prompting",
                "security",
                "models",
              ],
            },
          },
          required: ["question", "answer", "domain"],
          additionalProperties: false,
        },
      },
    },
    required: ["cards"],
    additionalProperties: false,
  },
  strict: true,
};

const t0 = performance.now();
const res = await client.messages.create({
  model: MODEL,
  max_tokens: 4096,
  tools: [deckTool],
  tool_choice: { type: "tool", name: deckTool.name },
  messages: [{ role: "user", content: prompt }],
});
const ms = Math.round(performance.now() - t0);

// Trace before the checks, so a run that fails one still shows its blocks, time and tokens.
console.log(
  `stop_reason=${res.stop_reason} blocks=${res.content.map((b) => b.type).join(",")} time=${ms}ms`,
);
console.log(
  `tokens: in=${res.usage.input_tokens} out=${res.usage.output_tokens}`,
);

// 1. A forced call ends with "tool_use". max_tokens would mean the call was cut off.
if (res.stop_reason !== "tool_use") {
  throw new Error(`Expected stop_reason "tool_use", got "${res.stop_reason}"`);
}

// 2. Find the call by type and name, not content[0].
const call = res.content.find((b) => b.type === "tool_use");
if (!call || call.name !== deckTool.name) {
  throw new Error(`No ${deckTool.name} call in the response`);
}
console.log("typeof call.input:", typeof call.input);

// 3. Zod. Only result.data goes downstream.
const result = DeckResponse.safeParse(call.input);
if (!result.success) {
  throw new Error(
    `Zod rejected the deck:\n${JSON.stringify(result.error.issues, null, 2)}`,
  );
}

console.log(JSON.stringify(result.data, null, 2));
// - The success signal flips: in 3b a good answer ended with end_turn. Here it's tool_use, because the call itself is the answer.
// - There's no JSON.parse step. The SDK hands you input as an object. Your typeof line will confirm it.
// - No tool_result goes back, because the script stops here. If the conversation continued, this tool_use would need a result like in 2b, or the next call would fail with a 400.

// 1. Which blocks came back, and what was the stop_reason? Was there a thinking block or any text before the tool call?
// Seen: only the 'tool_use' block came back, with no thinking block and no text before it. stop_reason was 'tool_use'.

// 2. What did typeof call.input print, and did Zod pass? Of the three 3b checks (stop_reason, JSON.parse, Zod), which could still fail here?
// Seen: typeof call.input printed "object", and Zod passed.
// Seen: JSON.parse isn't needed anymore (call.input is already an object). stop_reason can still fail if max_tokens is not enough, and so can Zod: strict mode can't enforce min 5 characters, and the schema has no minimum card count, so { cards: [] } is schema-valid but fails Zod.

// 3. Run it twice: the time and output tokens of each run. How do they compare with your 3b runs?
// Seen: 3c: 1st in=765 out=162; 2nd in=765 out=220. 3b: 1st in=574 out=364; 2nd in=574 out=522.
// Seen: 3c used fewer output tokens than 3b (no thinking block; 3b had one) and more input tokens (the tool definition counts as input).
