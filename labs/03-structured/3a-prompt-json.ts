import { client, MODEL } from "../client";
import Anthropic from "@anthropic-ai/sdk";
import { Deck, prompt, systemPrompt } from "./flashcard";

const conversation: Anthropic.MessageParam[] = [];

const MAX_ATTEMPTS = 1;

conversation.push({
  role: "user",
  content: prompt,
});

for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
  console.log(`Attempt ${attempt + 1}...`);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: conversation,
  });

  const raw = res.content.find((b) => b.type === "text")?.text ?? "";
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("Not JSON:", raw.slice(0, 200));
    continue;
  }

  const result = Deck.safeParse(parsed);

  if (result.success) {
    console.log(result.data);
    console.log(res.usage);
    break;
  }

  console.error(result.error.issues);
  console.log(res.usage);
}

// 1. The normal run: does it pass on the first attempt? How many output tokens does it use? (Log res.usage.)
// seen: with attempt 3 and .min(500) for the question field, it didnt passed validation and used 138 input and 356 output tokens.

// 2. Delete the system line: which layer fails, JSON.parse (Step 6) or Zod (Step 7)? What extra text shows up in raw?
// seen: JSON.parse failed because the output was not valid JSON without the system prompt.

// 3. Delete the <example> but keep system: does domain stay inside the enum? Does Zod catch anything?
// seen: with attempt 3 and .min(500) for the question field, the Zod validation still catches questions that are too short. `message: 'Too small: expected string to have >=500 characters'`.

// 4. → see extra-repeats.ts.
