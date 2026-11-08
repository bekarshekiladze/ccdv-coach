import { styleText } from "node:util";
import { client, MODEL } from "../client";

for (let i = 0; i < 5; i++) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: "Name one fruit and say why in one sentence.",
      },
    ],
  });
  const answer = res.content.find((block) => block.type === "text")?.text;
  console.log(answer);
  console.log(styleText("dim", `Output tokens: ${res.usage.output_tokens}`));
}

// Question:  are the 5 answers identical, and what does that mean for a test that checks answer === "Apple"?

// Example output:

// Bananas are a great choice because they're rich in potassium, which supports muscle function and heart health.
// Output tokens: 33
// Apple, because it's crisp, sweet, and packed with fiber and vitamin C, making it both delicious and nutritious.
// Output tokens: 43
// Banana, because it's a convenient, portable source of potassium and natural energy.
// Output tokens: 27
// Apple, because it's crisp, versatile, and packed with fiber and vitamin C.
// Output tokens: 31
// Banana, because it's a convenient, portable source of potassium and natural sugars that makes a quick, healthy snack.
// Output tokens: 40
