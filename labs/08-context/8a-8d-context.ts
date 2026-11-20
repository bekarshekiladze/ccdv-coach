import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { client, MODEL } from "../client";

type Note = { date: string; text: string };
const notes: Note[] = JSON.parse(
  readFileSync(new URL("../data/notes.json", import.meta.url), "utf-8"),
);

const tools: Anthropic.Tool[] = [
  {
    name: "search_notes",
    description:
      "Find notes that contain a keyword (case-insensitive). Returns every matching note in full, with its date. Use before answering any question about the user's notes.",
    input_schema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: 'One word to look for, e.g. "cache".',
        },
      },
      required: ["keyword"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "list_notes",
    description:
      "List every note from one month, in full, oldest first. Use when the user asks about a period rather than a topic.",
    input_schema: {
      type: "object",
      properties: {
        month: {
          type: "string",
          description: 'The month as YYYY-MM, e.g. "2026-10".',
        },
      },
      required: ["month"],
      additionalProperties: false,
    },
    strict: true,
  },
];

// ③ The hands. Every result carries the full notes, like real search output: that's the bulk.
const format = (hits: Note[]) =>
  `Found ${hits.length} note(s): \n${hits.map((n) => `- ${n.date}: ${n.text}`).join("\n")}`;

function runTool(name: string, input: unknown): string {
  if (name === "search_notes") {
    const { keyword } = input as { keyword: string };
    const k = keyword.toLowerCase();
    return format(notes.filter((n) => n.text.toLowerCase().includes(k)));
  }
  if (name === "list_notes") {
    const { month } = input as { month: string };
    return format(notes.filter((n) => n.date.startsWith(month)));
  }

  throw new Error(`Unknown tool: ${name}`);
}

// Everythin a call sends besides the messages. CountTokens gets the same object,
// so the count is exactly what create() wil be billed for.
const base = {
  model: MODEL,
  system:
    "You are a study assistant for the user's exam notes. Look things up with the tools before answering. Answer in at most 3 sentences.",
  tools,
  // Off for this lab: Haiku 5.5 binds each thinking block to everything sent before it,
  // so 8b-8c's edits to old turns would make those blocks invalid (a 400).
  thinking: { type: "disabled" as const },
};

const fmt = (n: number) => n.toLocaleString("en-US");

// What did the last step add? Tool results, or text(the last answer + the new question).
const lastAdded = (history: Anthropic.MessageParam[]) => {
  const content = history.at(-1)?.content;
  const isResults =
    Array.isArray(content) && content.some((b) => b.type === "tool_result");
  return isResults ? "tool_result" : "text";
};

// 8b. Prune: the newest `keepLast` tool results stay in full; older ones shrink to a
// one-line placeholder. The block itself stays, with its tool_use_id: every tool_use
// needs its tool_result, so deleting the block instead would be a 400.

const PRUNE = process.argv.includes("--prune");

function pruneOldToolResults(
  messages: Anthropic.MessageParam[],
  keepLast = 3,
): Anthropic.MessageParam[] {
  const total = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b) => b.type === "tool_result").length;

  let toPrune = total - keepLast; // the oldest ones: results sit in the time order

  // New messages in a new array: `history` itself stays complete.
  return messages.map((msg) => {
    // Tool results only every live in user messsages.
    if (msg.role !== "user" || typeof msg.content === "string") {
      return msg;
    }

    return {
      ...msg,
      content: msg.content.map((block) => {
        if (block.type !== "tool_result" || toPrune <= 0) {
          return block;
        }
        toPrune--;
        const firstLine =
          typeof block.content === "string" ? block.content.split("\n")[0] : "";
        return { ...block, content: `[pruned: ${firstLine}]` };
      }),
    };
  });
}

let calls = 0;
let billed = 0; // input tokens summed over every call: the session's real input cost
let prevCount = 0; // the previous call's count, to show what each step added

//8c. Compact: past BUDGET, summarize everything except the last KEEP_QUESTIONS questions
// and restart the history from that summary. Unlike pruning, this rewrites 'history' for
// good: whatever the summary leaves out is gone.
const COMPACT = process.argv.includes("--compact");
const BUDGET = 3_000; // about half of 8a's final context(6.168)
const KEEP_QUESTIONS = 2; // the latest few questions stay word for word

// The summarizer reads plain text, so flatten the old turns into a transcript.
function toTranscript(messages: Anthropic.MessageParam[]): string {
  return messages
    .flatMap((m) => {
      if (typeof m.content === "string") {
        return [`${m.role}:${m.content}`];
      }
      return m.content.map((b) => {
        if (b.type === "text") {
          return `${m.role}:${b.text}`;
        }
        if (b.type === "tool_use") {
          return `${m.role} called ${b.name}(${JSON.stringify(b.input)})`;
        }
        if (b.type === "tool_result") {
          return `tool result: ${typeof b.content === "string" ? b.content : ""}`;
        }
        return "";
      });
    })
    .join("\n");
}

async function compactIfNeeded(history: Anthropic.MessageParam[]) {
  if (history.length === 0) return; // before Q1 there's nothing to count or compact
  const sent = PRUNE ? pruneOldToolResults(history) : history;
  const { input_tokens } = await client.messages.countTokens({
    ...base,
    messages: sent,
  });
  if (input_tokens <= BUDGET) return;

  // Cut where a question starts, so no tool_use gets split from its tool_result.
  const starts = history.flatMap((m, i) =>
    m.role === "user" && typeof m.content === "string" ? [i] : [],
  );
  if (starts.length <= KEEP_QUESTIONS) return;
  const cut = starts[starts.length - KEEP_QUESTIONS];
  const old = history.slice(0, cut);
  const kept = history.slice(cut);

  // One extra model call: compaction isn't free.
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    messages: [
      {
        role: "user",
        content: `Summarize the decisions and facts so far in under 200 words.\n\n<conversation>\n${toTranscript(old)}\n</conversation>`,
      },
    ],
  });
  calls++;
  billed += res.usage.input_tokens;
  const summary = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // The summary rides in the first kept question, so the history still starts with a user turn.
  kept[0] = {
    role: "user",
    content: `Summary of our conversation so far:\n${summary}\n\n${kept[0].content as string}`,
  };
  history.splice(0, history.length, ...kept); // same array, new contents

  const after = await client.messages.countTokens({
    ...base,
    messages: PRUNE ? pruneOldToolResults(history) : history,
  });
  console.log(
    `  ✂ compacted ${cut} messages: ${fmt(input_tokens)} → ${fmt(after.input_tokens)} tokens\n  summary: ${summary.replaceAll("\n", " ")}`,
  );
  prevCount = after.input_tokens; // so the next jump shows only the new question
}

// ④ The Step 2 loop on a shared history, with a token count before every call (8a).

async function agent(history: Anthropic.MessageParam[]): Promise<string> {
  for (let turn = 1; turn <= 10; turn++) {
    // 8b: count and sent the same copy. Pruned only with --prune.
    const sent = PRUNE ? pruneOldToolResults(history) : history;

    // Count first: same request, no model run. 8c will use this number to decide.
    const { input_tokens } = await client.messages.countTokens({
      ...base,
      messages: sent,
    });

    const delta = input_tokens - prevCount; // below 0 when pruning cut more than the step added
    console.log(
      ` [call ${++calls}] ${fmt(input_tokens)} tokens(${delta >= 0 ? "+" : ""}${fmt(delta)} ${lastAdded(history)})`,
    );
    prevCount = input_tokens;
    const res = await client.messages.create({
      ...base,
      max_tokens: 1024,
      messages: sent,
    });

    billed += res.usage.input_tokens;
    history.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      return res.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
    }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const output = runTool(block.name, block.input);
      console.log(
        `  → ${block.name}(${JSON.stringify(block.input)}) ← ${output.split("\n")[0]}`,
      );
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: output,
      });
    }
    history.push({ role: "user", content: results });
  }

  throw new Error("Agent hit the turn limit (10)");
}

// The session: 10 questions in a row on one shared history, like on long chat.
// Q10 repeats Q1, to check what the context still holds (it matters once 8b-8c cut it).
const questions = [
  "Where exactly do tool_result blocks have to go?",
  "What did I note about streaming?",
  "What have I written about structured output and JSON?",
  "What do my notes say about extended thinking?",
  "Show me everything I wrote in September 2026.",
  "What did I learn about prompt caching?",
  "What did I note about MCP?",
  "When is my exam, and how did my practice exams go?",
  "Analyze all my notes from October 2026: the main topics and what I should review.",
  "Back to my first question: where exactly do tool_result blocks have to go?",
];

// 8d. Isolate: a big sub-task runs in a fresh messages array, like a subagent. Its tool
// results never enter the main history: only the question and the final answer come back.
const ISOLATE = process.argv.includes("--isolate");
const BIG_TASK = 8; // Q9, the October analysis: the session's biggest tool result

async function runIsolated(task: string): Promise<string> {
  const mainCount = prevCount;
  prevCount = 0; //the sub-task's jumps start from zero: it has its own context
  console.log(" ⤷ isolated: fresh messages array, no history");
  const answer = await agent([{ role: "user", content: task }]);
  prevCount = mainCount; // back to the main context
  return answer;
}

const history: Anthropic.MessageParam[] = [];

for (const [i, question] of questions.entries()) {
  if (COMPACT) await compactIfNeeded(history);

  console.log(`\nQ${i + 1}: ${question}`);
  if (ISOLATE && i === BIG_TASK) {
    const answer = await runIsolated(question);
    // Only the outcome joins the main history: one question, one plain-text answer.
    history.push(
      { role: "user", content: question },
      { role: "assistant", content: answer },
    );
    console.log(`A${i + 1}: ${answer}`);
    continue;
  }
  history.push({ role: "user", content: question });
  console.log(`A${i + 1}: ${await agent(history)}`);
}

const mode =
  [PRUNE && "--prune", COMPACT && "--compact", ISOLATE && "--isolate"]
    .filter(Boolean)
    .join(" ") || "no flags";

console.log(
  `\nSession (${mode}): ${calls} calls · final context ${fmt(prevCount)} tokens · billed input ${fmt(billed)} tokens`,
);

// 8a. Measure (no flags)
// 1. Which kind of step added more tokens, tool results or text? Which call had the biggest jump, and which tool call caused it?
// Seen: its clearly tool results, which adds more tokens.  probably the Q5 had the biggest jump due to the extensive content from September 2026.

// 2. From the last line: final context and billed input. Why is billed input so much bigger than the final context?
// Seen: No doubt, billed input includes all tokens sent to the model, including repeated context and tool results, which makes it much larger than the final context retained.

// 3. Q10 repeats Q1: did Claude answer from the history or search again? (the baseline for 8b–8c)
// Seen: Seemingly it answered from the history rather than searching again, as it could recall the context from Q1.

// =============================================

// 8b. Prune (--prune)
// 1. Final context and billed input vs 8a: how much did each drop?
// Seen: in 8a: "final context 6,168 tokens · billed input 52,111 tokens", in 8b: "context 4,702 tokens · billed input 45,015 tokens" - its surprisingly  similar.

// 2. Some calls now show a negative jump. How can a step that adds tool results shrink the context?
// Seen: I imagine that previous tool results, which were too large, got pruned and then new request wanst big enough to override the reduction, resulting in a negative jump in context size.

// 3. Q10: did it search again this time? If it answered from history, what was left to answer from?
// Seen: It did respond from the history, rather than searching.

// =============================================

// 8c. Compact (--compact)
// 1. How many ✂ lines? Final context and billed input vs 8a and 8b?
// Seen: there is 4 cut lines. Final context  2,442 tokens · billed input 40,384 tokens. from 8a:"final context 6,214 tokens · billed input 52,170 tokens";
//  from 8b: "final context 4,656 tokens · billed input 44,660 tokens"

// 2. Q10: searched again, or answered from history?
// Seen: It answered from the history, similar to 8a and 8b, without performing a new search.

// 3. Read the last summary: what did it keep about tool_result placement, and what got lost?
// Seen: It kept the essential placement of tool results that were necessary for answering the questions, but some of the less critical tool results were lost due to compaction, reducing the overall context size.

// =============================================

// 8d. Isolate (--isolate)
// 1. Q9's [call] lines restart small: the sub-task's biggest count vs the main context at Q8's last call?
// Seen:1,691 tokens is biggest count of Q9 and Q8's - 4,459 tokens(+137 text)

// 2. Final context and billed input vs 8a (no flags)?
// Seen: "final context 5,409 tokens · billed input 47,136 tokens"; for 8a: "final context 6,328 tokens · billed input 52,278 tokens". About −15% / −10%: small, because only Q10 came after Q9, and Q10 had to search again (+492), since the 10-02 note left with the isolated October list.

// 3. A9 vs 8a's A9: same quality? Anything missing that only earlier questions knew?
// Seen: Both correct. The isolated A9 is shorter and saw only October, so it misses what the main run knew from earlier questions: the 11-06 note (72%, context management and MCP transports still weak).

// "A9: Your October 2026 notes center on Claude tool use and the API around it: the tool-use loop, tool_result placement, tool descriptions, tool_choice, and parallel calls. Other main topics are prompt caching, streaming (saving assistant turns after the stream finishes), MCP (tools, resources, prompts), and context-window management (pruning vs. compaction)."

// VS:

// A9: Here is the same analysis of your October 2026 notes, from the 13 entries I pulled earlier:
// 1. **Tool use (10-01 to 10-13):** the tool loop, tool_result placement, tool descriptions, strict mode, parallel calls, tool_choice, and error handling. Review the tool_result placement rule and tool_choice, since both are on your 10-27 weak-spot list and tool_choice was a miss on practice exam 1.
// 2. **Prompt caching (10-15):** stable content first, cache_control breakpoints, and cache invalidation. This was a miss on practice exam 1, so it needs another pass.
// 3. **Streaming and state (10-17):** only pushing the assistant turn into history after finalMessage resolves. This is on your weak-spot list, so reread it.
// 4. **Context management and MCP (10-20 to 10-30):** compaction versus pruning, the growing input-token cost, and MCP basics. Context management was your weakest area on practice exam 1 and is still weak on 11-06, so finish the context lab and reread the 10-30 note.
// Your 10-27 note also says to reread the weak spots (HTTP status versus content checks, import type versus value imports, assistant turn placement, and tool_result placement) before every practice exam.

// =============================================

// Predict & break: no management vs --prune vs --prune --compact
// 1. Tokens: final context and billed input for all three (8a, 8b from your 8c notes, this run). Which saved most, and what did it cost?
// Seen: no management 6,328 / 52,278 (17 calls); --prune 4,656 / 44,660; --prune --compact 3,067 / 43,929 (22 calls). Final context −52%, but billed input only −16%, barely below pruning alone: the 4 summary calls and Q8's new search ate most of the saving.

// 2. Quality: A10 in each run. Which still has all four placement facts (very next user message, all results in one message, before any text, missing = 400)?
// Seen: All three runs have all four. But Q1 never searched (A1 called it a question about Claude's own tools), so every A10 came from the 10-02 note in Q9's October list, still in full as the newest result. With --isolate that list was gone, so Q10 searched again.

// 3. After a ✂ line, did Claude search again for something it had already seen earlier? Which question?
// Seen: Yes, Q8: it searched "exam" (+625 tokens) where the other runs answered from history. The exam date (09-15) had come from Q5's September list, and no summary kept it.
