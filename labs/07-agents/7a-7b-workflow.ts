import { readFileSync } from "node:fs";
import { client, MODEL } from "../client";
import Anthropic from "@anthropic-ai/sdk";
import z from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

//  ①The world: the 31 sample notes, reloaded before every run so both versions start equal.
type Note = { date: string; text: string };
const load = (): Note[] =>
  JSON.parse(
    readFileSync(new URL("../data/notes.json", import.meta.url), "utf-8"),
  );
let notes = load();

// ② The hands, shared by both versions. Saving stays in memory only.
function searchNotes(keyword: string): string {
  const k = keyword.toLowerCase();
  const hits = notes.filter((n) => n.text.toLowerCase().includes(k));
  return `Found ${hits.length} note(s):\n${hits.map((n) => `- ${n.date}: ${n.text}`).join("\n")}`;
}

function saveNote(text: string): string {
  notes.push({ date: new Date().toISOString().split("T")[0], text });
  return `Saved.: ${notes.length} notes now.`;
}

// Both versions report the same numbers, so they compare line by line.
type Run = {
  route: string;
  answer: string;
  calls: number;
  input: number;
  output: number;
  ms: number;
};

const base = {
  model: MODEL,
  max_tokens: 1024,
  thinking: { type: "disabled" as const },
};

const textOf = (res: Anthropic.Message) =>
  res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

function meter() {
  const start = performance.now();
  const totals = { calls: 0, input: 0, output: 0 };
  return {
    track(res: Anthropic.Message) {
      totals.calls++;
      totals.input += res.usage.input_tokens;
      totals.output += res.usage.output_tokens;
    },
    done: (route: string, answer: string): Run => ({
      route,
      answer,
      ...totals,
      ms: Math.round(performance.now() - start),
    }),
  };
}

//  ③ 7a. Workflow: one classify call, then a fixed handler. No loop, no tool choice by Claude.

const Route = z.object({
  route: z.enum(["note", "question", "other"]),
  keyword: z
    .string()
    .describe(
      'For a question: one word to search the notes for, e.g. "cache". Otherwise "".',
    ),
});

async function workflow(message: string): Promise<Run> {
  const m = meter();

  // Step 1: classify. Native JSON, so the route is always one of the three.
  const cls = await client.messages.create({
    ...base,
    system:
      "Classify the user's message for a study-notes app. note: they want something saved. question: they ask about their notes or study topics. other: anything else.",
    messages: [{ role: "user", content: message }],
    output_config: { format: zodOutputFormat(Route) },
  });
  m.track(cls);
  const { route, keyword } = Route.parse(JSON.parse(textOf(cls)));

  // Step 2: your code picks the handler. Claude only filled in the slots.
  if (route === "note") {
    return m.done(route, saveNote(message)); // plain code: no second call
  }
  if (route === "other") {
    return m.done(route, "I only save notes and answer questions about them."); // fixed reply
  }
  const found = searchNotes(keyword); // code runs the one search, not Claude
  const res = await client.messages.create({
    ...base,
    system: "Answer from the notes given. At most 3 sentences.",
    messages: [
      {
        role: "user",
        content: `My notes:\n${found}\n\nQuestion: ${message}`,
      },
    ],
  });
  m.track(res);
  return m.done(route, textOf(res));
}

//  ④ 7b. Agent: the agentic loop. Claude picks the tools, how many, and in what order.
const tools: Anthropic.Tool[] = [
  {
    name: "search_notes",
    description:
      "Find the user's notes that contain a keyword (case-insensitive). Use before answering any question about their notes.",
    input_schema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: 'One word, e.g. "cache".' },
      },
      required: ["keyword"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "save_note",
    description:
      "Save a note for the user. Use only when they ask to remember, note or save something.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The note, in the user's words." },
      },
      required: ["text"],
      additionalProperties: false,
    },
    strict: true,
  },
];

async function agent(message: string): Promise<Run> {
  const m = meter();
  const used = new Set<string>(); // which routes Clause chose, by the tools it called
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: message },
  ];

  for (let turn = 1; turn <= 10; turn++) {
    const res = await client.messages.create({
      ...base,
      system:
        "you are a study assistant for the user's exam notes. Use the tools when they help. Answer in at most 3 sentences.",
      tools,
      messages,
    });
    m.track(res);
    messages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      return m.done([...used].sort().join("+") || "other", textOf(res));
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") {
        continue;
      }
      const input = block.input as { keyword?: string; text?: string };
      const output =
        block.name === "save_note"
          ? saveNote(input.text ?? "")
          : searchNotes(input.keyword ?? "");
      used.add(block.name === "save_note" ? "note" : "question");
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: output,
      });
    }
    messages.push({ role: "user", content: results });
  }
  throw new Error("Agent hit the turn limit (10)");
}

// ⑤ The same inputs for both. The last two need more than one fixed route.
const inputs = [
  { message: "Remember: the exam room opens at 8:30.", expected: "note" },
  { message: "Save this: tool_choice none forbids tools.", expected: "note" },
  { message: "What did I write about prompt caching?", expected: "question" },
  { message: "How did my practice exams go?", expected: "question" },
  {
    message: "I keep forgetting the tool_choice options. What were they?",
    expected: "question",
  },
  { message: "What's the weather like today?", expected: "other" },
  {
    message:
      "Note that MCP transports are my weak spot, and tell me what I wrote about MCP.",
    expected: "note+question",
  },
  {
    message:
      "Compare what I wrote about pruning with what I wrote about compaction.",
    expected: "question",
  },
];

const versions = { workflow, agent };
const totals = {
  workflow: { calls: 0, input: 0, output: 0, ms: 0, wrong: 0 },
  agent: { calls: 0, input: 0, output: 0, ms: 0, wrong: 0 },
};

for (const { message, expected } of inputs) {
  console.log(`\n"${message}" (expected: ${expected})`);
  for (const [name, run] of Object.entries(versions)) {
    notes = load(); // a fresh copy: one version's saves don't leak into the other's searches
    const r = await run(message);
    const ok = r.route === expected;
    const t = totals[name as keyof typeof totals];
    t.calls += r.calls;
    t.input += r.input;
    t.output += r.output;
    t.ms += r.ms;
    if (!ok) t.wrong += 1;

    console.log(
      ` ${name.padEnd(8)} ${ok ? "✓" : "✗"} ${r.route.padEnd(13)} ${r.calls} calls · ${r.input}/${r.output} tokens in/out · ${r.ms} ms `,
    );
    console.log(`           ${r.answer.replaceAll("\n", " ")}`);
  }
}

console.log("\nTotals:");
for (const [name, t] of Object.entries(totals)) {
  console.log(
    `  ${name.padEnd(8)} ${t.wrong} wrong · ${t.calls} calls · ${t.input}/${t.output} tokens in/out · ${t.ms} ms `,
  );
}


// 7a–7b. Workflow vs agent
// 1. Totals: calls, tokens and time for each. Which is cheaper and faster, and by how much?
// Seen: 
//  workflow 1 wrong · 13 calls · 4385/703 tokens in/out · 17304 ms 
//   agent    2 wrong · 14 calls · 10283/1157 tokens in/out · 25111 ms 
// - The workflow is cheaper and faster: 2.3× fewer input tokens and 1.45× less time, with fewer mistakes too.
//   The agent resends its two tool definitions on every call (the weather line: 577 tokens in vs 374 for the classify call),
//   and the note and other routes cost the workflow one call, because plain code handles them.

// 2. Which inputs did each get wrong (✗)? Why can the workflow never get the mixed one right?
// Seen: Both got the mixed one wrong ("Note that MCP transports… and tell me what I wrote about MCP"): both only answered, nothing was saved.
// The workflow can't get it right by design: the classifier returns exactly one route, so only one handler ever runs.
// The agent could have called save_note too, but didn't. Its second miss was the tool_choice question: it answered "other",
// took it as a question about the API instead of the notes, and asked permission instead of searching (like Q1 in Lab 8).

// 3. The pruning-vs-compaction compare: how many calls did each make, and whose answer covered both?
// Seen: 2 calls each, and both answers covered both topics with the same content (compaction appears only in the 10-20 note).
// The workflow's single search was enough here, because the 10-20 note mentions both words; it cost 582 input tokens vs the agent's 1,561.