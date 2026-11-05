import Anthropic from "@anthropic-ai/sdk";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { client, MODEL } from "../client";
import { styleText } from "node:util";

const messages: Anthropic.MessageParam[] = [];

const rl = createInterface({
  input,
  output,
});

// No relation to lesson my convenience, but this is a nice way to handle Ctrl+C gracefully
rl.on("SIGINT", () => {
  console.log("\nExiting chat...");
  rl.close();
  process.exit(0);
});
// ----------------------------------------------------------------------------------------

while (true) {
  const userInput = await rl.question("> ");
  if (userInput.trim().toLowerCase() === "exit") {
    console.log("Exiting chat...");
    rl.close();
    break;
  }
  messages.push({ role: "user", content: userInput });

  try {
    const response = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      messages: messages,
    });

    response.on("text", (text) => {
      process.stdout.write(text);
    });

    const finalMessage = await response.finalMessage();

    messages.push({ role: "assistant", content: finalMessage.content });
    console.log(
      styleText(
        "dim",
        `\nTokens: in ${finalMessage.usage.input_tokens} · out ${finalMessage.usage.output_tokens}\nreason: ${finalMessage.stop_reason}\n`,
      ),
    );
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("\nAPI Error: ", error.status, error.message);
    } else {
      console.error("\nUnexpected Error:", error);
    }
    messages.pop(); // Remove the last user message if the request fails
  }
}

// 1. What happens to input_tokens from turn to turn?
// - it increases with each user message, ever user types same question every time, the input_tokens count will increase because the chat keeps sending the entire conversation history. Each new user message adds to the total number of tokens processed by the model, which includes both the user's input and the assistant's responses.

// 2. If you comment out the line that pushes the assistant reply, what does Claude answer to "what did I just ask you?"?
// - it will answer, because user messages are still part of the conversation history, and the model can reference them to provide a response.

// 3. What do you get if two user messages end up next to each other with no assistant turn between them: an error or an answer?
// - an answer

// =================================================
// Then break it on purpose. Predict each one first:

// 1. Change the model to a wrong name, such as claude-haiku-9. Which status do you get, and which class?
// - 404 Not Found, and the class is Anthropic.APIError

// 2. Set max_tokens: 5. Is it an error? What's the stop_reason, and what text do you see?
// - I only see the first 5 tokens of the assistant's response, and the stop_reason is "max_tokens". The model stops generating text because it reached the maximum token limit specified in the request.

// 3. Press Enter on an empty line, which sends content: "". Error or answer?
// - Its error, because the model expects some content to process. Sending an empty string may result in a validation error or an unexpected response from the API, depending on how the SDK handles such cases.

// 4. SDK fact for the exam: the SDK already retries 408, 409, 429 and 5xx on its own, 2 times by default. Look in your IDE at the client option that changes this. Which errors does it never retry?

// ============

// ABOUT ERRORS:

// Background: when a call fails, the SDK sometimes tries it again by itself before it gives you an error. You don't write that retry code; it's built in.

// Part A: which setting controls it?
// It's the maxRetries option on the client. The default is 2, which means 1 try plus up to 2 retries:
// new Anthropic({ maxRetries: 0 })   // never retry
// You can also set it for one call, as a second argument: client.messages.create({...}, { maxRetries: 5 }). I asked you to find it in your IDE by typing new Anthropic({ and looking at the suggestions.

// Part B: which errors does it never retry?
// The SDK retries only errors where waiting and trying again could help:
// - 408 (timeout)
// - 409 (conflict)
// - 429 (rate limit)
// - 5xx server errors, including 529 (overloaded)
// - network failures

// It never retries the errors where the request itself is wrong, because the same request would fail the same way every time:

// ┌────────┬────────────────────────┐
// │ Status │  Example in your code  │
// ├────────┼────────────────────────┤
// │ 400    │ empty content: ""      │
// ├────────┼────────────────────────┤
// │ 401    │ wrong key              │
// ├────────┼────────────────────────┤
// │ 403    │ key without permission │
// ├────────┼────────────────────────┤
// │ 404    │ wrong model name       │
// ├────────┼────────────────────────┤
// │ 413    │ request too large      │
// └────────┴────────────────────────┘
