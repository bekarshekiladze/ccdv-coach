import { client, MODEL } from "./client";

const res = await client.messages.create({
  // Top level await works because of package.json "type": "module" in labs/package.json
  model: MODEL,
  max_tokens: 1024,
  messages: [{ role: "user", content: "say hi" }],
});
console.log({ res });
console.log("=============================================================");
console.log(res.content);

// TIP: if you want explanation of each property of response, simply type "res." and observe desired response intellisense in your IDE.

// My observation: each time, output tokens differ, because answer is of different length, but is always correct.

//  res.content is always an array, but not every item is a text block. It's an array of content blocks, and the type field tells you which kind each one is.

// ┌────────────────────────────────────────────┬────────────────────────────────┬────────────────────────────────────────────────┐
// │                    type                    │          Other fields          │                When you get it                 │
// ├────────────────────────────────────────────┼────────────────────────────────┼────────────────────────────────────────────────┤
// │ text                                       │ text, citations (usually null) │ the normal answer                              │
// ├────────────────────────────────────────────┼────────────────────────────────┼────────────────────────────────────────────────┤
// │ thinking                                   │ thinking, signature            │ thinking turned on (Day 2)                     │
// ├────────────────────────────────────────────┼────────────────────────────────┼────────────────────────────────────────────────┤
// │ redacted_thinking                          │ data                           │ some thinking blocks come back encrypted       │
// ├────────────────────────────────────────────┼────────────────────────────────┼────────────────────────────────────────────────┤
// │ tool_use                                   │ id, name, input                │ Claude wants to call one of your tools (Day 3) │
// ├────────────────────────────────────────────┼────────────────────────────────┼────────────────────────────────────────────────┤
// │ server_tool_use, web_search_tool_result, … │ varies                         │ server-side tools like web search              │
// └────────────────────────────────────────────┴────────────────────────────────┴────────────────────────────────────────────────┘

// So a text block also carries citations, not just type and text.

// Possible error codes:
// ┌────────┬──────────────────────────────────────────┬───────────────┐
// │ Status │                 Meaning                  │  What to do   │
// ├────────┼──────────────────────────────────────────┼───────────────┤
// │ 400    │ bad request (e.g. a malformed parameter) │ fix your code │
// ├────────┼──────────────────────────────────────────┼───────────────┤
// │ 401    │ ?                                        │ fix           │
// ├────────┼──────────────────────────────────────────┼───────────────┤
// │ 404    │ not found (e.g. a wrong model name)      │ fix           │
// ├────────┼──────────────────────────────────────────┼───────────────┤
// │ 429    │ rate limited, too many requests          │ retry later   │
// ├────────┼──────────────────────────────────────────┼───────────────┤
// │ 529    │ API overloaded                           │ retry later   │
// ├────────┼──────────────────────────────────────────┼───────────────┤
// │ 5xx    │ server error                             │ retry later   │
// └────────┴──────────────────────────────────────────┴───────────────┘
