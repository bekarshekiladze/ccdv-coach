import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DeckResponse, prompt } from "./flashcard";
import { client, MODEL } from "../client";

const fmt = zodOutputFormat(DeckResponse);

const startTime = performance.now();

const res = await client.messages.create({
  model: MODEL,
  max_tokens: 2048,
  messages: [{ role: "user", content: prompt }],
  output_config: { format: fmt },
});

const endTime = performance.now();
console.log(`Elapsed time: ${endTime - startTime} ms`);

if (res.stop_reason !== "end_turn") {
  throw new Error("Stopped early: " + res.stop_reason);
}

const raw = res.content.find((b) => b.type === "text")?.text ?? "";

// check json validity
let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch {
  throw new Error("Not JSON: " + raw.slice(0, 200));
}

// check schema validity
const result = DeckResponse.safeParse(parsed);
if (!result.success) {
  console.log(res.usage);
  throw new Error(
    "Schema validation failed: " + JSON.stringify(result.error.issues, null, 2),
  );
} else {
  const data = result.data.cards;
  console.log("Parsed data:", data);
  console.log("Usage:", res.usage);
}

// Print content block types to see what kinds of messages are present
console.log(
  "Content block types:",
  res.content.map((b) => b.type),
);

// Predict before running (write these under a comment block in 3b)

// 1. With no system line, does 3b pass JSON.parse? (3a failed 10/10 here.)
// Seen: It returns answers without the system line just fine. My assumption is that, the output_config replaces the need for suggesting the shape in system prompt. Not the whole system prompt.

// 2. Is the first call slower than the second? By roughly how much?
// Seen: The first call was around 25% slower than the next ones.

// 3. Is there still a thinking block in res.content?
// Seen: There still appears to be a thinking block in res.content.

// 4.  your prompt's <example> shows an array, but the schema forces an object. Which one wins?
//  Seen:schema wins: output was { cards: [...] } despite the array example; the API restricts generation to the schema, and Zod passing confirms it

// 5. Compare the two elapsed times.
// Seen: times without the "output_config" are generally faster than with it.
