// Next: extra-fetch.ts, one raw HTTP call without the SDK:
// - Setup: import "dotenv/config", then fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers, body }).
// - Headers:
//   - x-api-key: from process.env.ANTHROPIC_API_KEY; never print it
//   - anthropic-version: 2023-06-01
//   - content-type: application/json
// - Body: JSON.stringify({ model, max_tokens, messages }), then print res.status and await res.json().
// - Then break it: use a wrong model name.

import "dotenv/config";
import { MODEL } from "../client";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new Error("ANTHROPIC_API_KEY is not set");
}

fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "MODEL",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: "Give me a random response, which will be a stream of text.",
      },
    ],
  }),
})
  .then(async (res) => {
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", data);
  })
  .catch((err) => {
    console.error("Error:", err);
  });

// - Does fetch throw on a 404, or do you have to check res.ok yourself? 
// - not throwing, returning status 404 and a JSON body with error message

// - Name three things the SDK did for you that you now have to write by hand. 
// - 1.making the HTTP request, 2. parsing the JSON response, 3. typed responses (e.g., res.content is an array of blocks, so you narrow by type before you read .text).
