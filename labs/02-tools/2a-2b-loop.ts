// Lab 2a–2b: two tools and the agentic loop.
//
// Big picture: Claude can't run your code. It can only ASK for a tool (a tool_use block).
// Your code does the work and REPORTS back (a tool_result block), and that repeats until
// Claude stops asking. The file has four parts, in the order a run uses them:
//   ① notes   – the "world" the tools change
//   ② tools   – the menu Claude reads to decide what to ask for
//   ③ runTool – the hands that do what was asked
//   ④ agent   – the loop: ask → run → report → repeat (10 turns max)

import Anthropic from "@anthropic-ai/sdk"; // types only: Anthropic.Tool, .MessageParam, .ToolResultBlockParam
import { client, MODEL } from "../client"; // shared client (reads ANTHROPIC_API_KEY from .env) + model id

// ① The world the tools change. A plain array, so it lives only while the script runs.
const notes: string[] = [];

// ② The menu. Claude picks tools ONLY from these words (names, descriptions, schemas);
//    it never sees the code in ③. Resent on every call, because the API remembers nothing.
const tools: Anthropic.Tool[] = [
  {
    name: "save_note", // comes back as tool_use.name, the key runTool (③) switches on
    // what it does + when to use it + when NOT to: Claude's main signal for picking it
    description:
      "Save a short note for the user. Use when the user asks to remember, note or write something down. Do not use it to answer questions.",
    // the argument contract, in JSON Schema (the same format as Day 2's output_config.format)
    input_schema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          // a field description steers WHAT Claude writes into that field
          description:
            "The note itself, one short sentence in the user's words.",
        },
      },
      // list only what the call can't work without; over-requiring makes Claude invent values
      required: ["text"],
      additionalProperties: false, // no extra keys; strict mode needs this on every object
    },
    // the API generates the input INSIDE the schema, so tool_use.input always matches it
    strict: true,
  },
  {
    name: "search_notes",
    // "Use before answering…" makes Claude look things up instead of guessing
    description:
      "Find saved notes that contain a keyword (case-insensitive). Use before answering any question about what the user saved earlier.",
    input_schema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          // an example value is the clearest hint for what to send
          description: 'One word to look for, e.g. "exam".',
        },
      },
      required: ["keyword"],
      additionalProperties: false,
    },
    strict: true,
  },
];

// TypeScript copies of the two input schemas: the API enforces the JSON, these only inform the compiler.
type SaveNoteInput = { text: string };
type SearchNotesInput = { keyword: string };

// ③ The hands. Claude asked for a tool by name; this runs the real code. The returned string
//    becomes the tool_result: it's ALL Claude learns about what happened, so make it informative.
function runTool(name: string, input: unknown): string {
  if (name === "save_note") {
    // a safe cast only because strict: true guarantees this shape (without strict: validate with Zod)
    const { text } = input as SaveNoteInput;
    notes.push(text);
    return `Note saved: "${text}"`; // echoes what was stored, so Claude can quote it back
  }
  if (name === "search_notes") {
    const { keyword } = input as SearchNotesInput;
    const hits = notes.filter((note) =>
      note.toLowerCase().includes(keyword.toLowerCase()),
    );
    return `Found ${hits.length} notes: ${hits.join(", ")}`; // 0 hits is a real answer, not an error
  }
  // a name that isn't on the menu: the loop (④) catches this and reports it with is_error
  throw new Error(`Unknown tool: ${name}`);
}

// Budget guard: without a cap, a confused model could keep asking (and billing) forever.
const MAX_TURNS = 10;

// ④ The loop. One iteration = one API call = one turn. It ends when Claude stops asking.
async function agent(userText: string): Promise<string> {
  // The transcript. The API is stateless, so the WHOLE array goes out on every turn;
  // each tool round adds two entries: assistant (the asks) + user (the results).
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userText },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048, // a per-turn cap; Haiku 5.5's default thinking spends from it too
      tools, // the menu (②), sent every time
      messages,
      // tool_choice: { type: "auto", disable_parallel_tool_use: true },
    });

    // trace: WHY the turn ended + WHAT came back (e.g. "thinking,tool_use")
    console.log(
      `\n[turn ${turn}] stop_reason=${res.stop_reason} blocks=${res.content.map((b) => b.type).join(",")} in=${res.usage.input_tokens} out=${res.usage.output_tokens}`,
    );

    // Keep Claude's reply exactly as received: the results below need their tool_use ids
    // in history, and thinking blocks must go back unchanged.
    messages.push({ role: "assistant", content: res.content });

    // The only exit: anything but "tool_use" means Claude has stopped asking
    // (end_turn = done; a max_tokens cut-off lands here too, not handled yet).
    if (res.stop_reason !== "tool_use") {
      return res.content
        .filter((b) => b.type === "text") // keep text blocks only; thinking is left out
        .map((b) => b.text)
        .join("");
    }

    // Claude asked for one or more tools. Every tool_use needs exactly one tool_result,
    // or the next call fails with a 400.
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of res.content) {
      if (block.type !== "tool_use") continue; // thinking and text blocks aren't requests
      console.log(`  → ${block.name}(${JSON.stringify(block.input)})`); // the ask
      try {
        const output = runTool(block.name, block.input);
        console.log(`  ← ${output}`); // the report
        results.push({
          type: "tool_result",
          tool_use_id: block.id, // the receipt number: pairs this result with its request
          content: output,
        });
      } catch (e) {
        // A failed tool is news for Claude, not a crash: it can retry, switch tools or explain.
        const message = e instanceof Error ? e.message : String(e);
        console.log(`  ✗ ${message}`);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: message,
          is_error: true, // marks a failure, so Claude won't take the text as a real result
        });
      }
    }
    // Send ALL results back in ONE user message (splitting them discourages parallel calls).
    // The API has only two roles, so everything that isn't Claude (you, your tools) is "user".
    messages.push({ role: "user", content: results });
  }
  // Out of turns with no final answer: fail loudly, so it can't pass as a normal reply.
  throw new Error(`Agent hit the turn limit (${MAX_TURNS})`);
}

// The run. This task needs both tools, in order: save first, then search for what was saved.
const answer = await agent(
  "Remember that my exam is in December, then tell me what notes mention 'exam'.",
);
console.log("\nFinal answer:\n" + answer);
// ① after the run: proof that a tool really changed the world
console.log("Notes store:", notes);

// 1. How many turns did it take, and which tool ran in which turn? Did Claude call save_note and search_notes in separate turns or both in one?
// Seen: It took 3 turns.
// Seen: save_note ran in the first turn, search_notes ran in the second turn.
// Seen: they came in separate turns: each turn returned one tool_use, our code ran it and sent the result back, then Claude asked for the next one.

// 2. Look at the blocks list on each turn: was there a thinking or text block before the tool_use? What was the stop_reason of the last turn?
// Seen: blocks in the first turn were "thinking" and "tool_use"
// Seen: stop_reason was "end_turn" in the last turn.

// 3. What did the final answer say, and what is in the notes store? Did the search find the note saved in the same run?
// Seen: The final answer: "I saved the note "My exam is in December." The only note that mentions "exam" is that one."
// Seen: Notes store: [ 'My exam is in December.' ]
// Seen: yes, the search found the note saved earlier in the same run.

// 4. Task "Save a note that Lab 3c is done, and search my notes for 'exam'." (temporary). On turn 1: how many tool_use blocks, and for which tools? How many turns in total, and the in= of each turn?
// Seen: its 2 tool use blocks together in one turn.  → save_note({"text":"Lab 3c is done."}) ← Note saved: "Lab 3c is done." → search_notes({"keyword":"exam"}) ← Found 0 notes:
// Seen: it was 2 turns in total 1:in=584 out=103; 2:in=767 out=31

// 5. The same task + tool_choice: { type: "auto", disable_parallel_tool_use: true } (temporary). How many tool_use blocks per turn now, how many turns in total, and the in= of each turn?
// Seen: now is single tool_use per turn, so save_note and search_notes are in separate turns. 1:in=584 out=53; 2:659 out=49 3:in=724 out=33

// Predict & break (setup: line 15 starts with one saved note, line 163 asks "When is my exam?")
// 6. Run as is (clear description), then with the search_notes description → "Searches notes." (temporary). Did Claude call search_notes each time, how many turns, and was the answer right?
// Seen: Claude searched it on first turn, found the note about the exam, and the answer was correct.

// 7. First line of the search_notes branch in runTool → throw new Error("Notes database is offline."); (temporary). What did the ✗ line show, did Claude retry, how many turns, and what did the final answer say?
// Seen: The ✗ line showed "Notes database is offline." didnt retry, and the final answer indicated the failure to access the notes database.

// 8a. Line 105 → tool_choice: { type: "tool", name: "search_notes" }, (temporary). How many turns, which blocks per turn, and how did the run end?
// Seen: 2 turns, tool_use and text blocks each turn.

// 8b. The same line → tool_choice: { type: "none" }, (temporary). Any tool_use blocks? What did the answer say?
// Seen: There is only one turns with reason=end_turn. block=thinking. final answer empty string.
