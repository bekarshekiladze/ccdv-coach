// 1b, streaming
// - Concept: you get the text in pieces as it's generated, instead of one response at the end.
// - API: client.messages.stream({ ...same params }). You don't await this one.
// - Live text: .on("text", (delta) => …) gets each piece. Use process.stdout.write, not console.log, so the pieces stay on one line.
// - The full result: await stream.finalMessage() gives you the same Message object as in 1a.
// - Use a prompt with a longer answer, like "Explain streaming in 5 sentences", so you can see the text arrive.

import { client, MODEL } from "../client";

const resStream = client.messages.stream({
  model: MODEL,
  max_tokens: 1024,
  messages: [
    {
      role: "user",
      content: "Give me random response, which will be a stream of text",
    },
  ],
});

resStream.on("text", (text) => {
  process.stdout.write(text);
});

const finalMessage = await resStream.finalMessage();


console.log("\n\n\n");
console.log({ finalMessage });
console.log({ finalMessageContent: finalMessage.content });

process.stdout.write(
  finalMessage.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join(""),
);



// 1. With .stream(), does finalMessage() still give you stop_reason and usage?  
// - Yes, finalMessage() still provides stop_reason and usage, just like the plain call. You can access these properties from the finalMessage object after the streaming is complete.

// 2. Do the input tokens differ between the plain call and the streamed call for the same prompt? 
// - No, the input tokens should be the same for both the plain call and the streamed call if the prompt is identical. The difference lies in how the output is received, but the input remains consistent.

// 3. What would tsc say about res.content[0].text without narrowing? 
// - would throw an error because res.content is an array of blocks, and TypeScript cannot guarantee that the first block has a .text property without checking its type. You would need to narrow the type by filtering for blocks where block.type === "text" before accessing .text to avoid a type error.