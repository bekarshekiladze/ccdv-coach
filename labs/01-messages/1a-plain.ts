// 1a, a plain call that prints only the answer text
// - Concept: res.content is an array of blocks, so you narrow by type before you read .text.
// - Shape: go through res.content, keep the blocks where block.type === "text", and join their .text.
// - Also print res.stop_reason and res.usage (input_tokens, output_tokens).
// - Type check: try res.content[0].text without narrowing and see what tsc says.

import { client, MODEL } from "../client";

const resPlain = await client.messages.create({
  model: MODEL,
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "Give me random response, which will be a stream of text",
    },
  ],
});

console.log("======================Plain Response=========================");
console.log(
  resPlain.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join(""),
);
console.log("Stop reason:", resPlain.stop_reason);
console.log("Usage:", resPlain.usage);
console.log("======================Plain Response=========================");
console.log("\n\n\n");
