// ============================================================
// IMPORTS AND DEPENDENCIES
// ============================================================
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { client, MODEL } from "../client";

// ============================================================
// TYPE DEFINITIONS
// ============================================================
// Question: defines a test question with validation
type Question = { name: string; prompt: string; expected: RegExp };
// Setting: defines a thinking/output configuration variant to test
type Setting = {
  label: string;
  thinking: Anthropic.ThinkingConfigParam;
  effort: NonNullable<Anthropic.OutputConfig["effort"]>;
};
// Row: defines a result record from one API call
type Row = {
  question: string;
  setting: string;
  stop: string;
  blocks: string;
  correct: boolean;
  thinkTok: number;
  outTok: number;
  costUSD: number;
  ms: number;
  thinkChars: number;
  answer: string;
};

// ============================================================
// TEST QUESTIONS
// ============================================================
// Simple/quick question for baseline testing
const EASY_QUESTION: Question = {
  name: "easy",
  prompt: "What is capital of Georgia (the country)?",
  expected: /Answer:\W*Tbilisi\b/,
};

// Complex logic puzzle for deep reasoning testing
const HARD_QUESTION: Question = {
  name: "hard",
  prompt:
    "Alice is twice as old as Bob was when Alice was as old as Bob is now. Bob is 30. How old is Alice?",
  expected: /Answer:\W*40\b/,
};

// Test suite: all questions to run
const QUESTIONS: Question[] = [EASY_QUESTION, HARD_QUESTION];

// ============================================================
// BASELINE SETTINGS (run on all questions)
// ============================================================
// Run on both questions.
const SETTINGS: Setting[] = [
  { label: "off", thinking: { type: "disabled" }, effort: "medium" },
  {
    label: "low",
    thinking: { type: "adaptive", display: "summarized" },
    effort: "low",
  },
  {
    label: "high",
    thinking: { type: "adaptive", display: "summarized" },
    effort: "high",
  },
];

// ============================================================
// EXTRA SETTINGS (run on hard question only)
// ============================================================
// Run on the hard question only.
const EXTRAS: Setting[] = [
  { label: "high, no display", thinking: { type: "adaptive" }, effort: "high" },
  { label: "off + max", thinking: { type: "disabled" }, effort: "max" },
];

// ============================================================
// PRICING CONSTANTS
// ============================================================
// Haiku 5.5 prices in USD per million tokens (prompts up to 100K tokens).
const INPUT_PRICE_PER_M = 0.1;
const OUTPUT_PRICE_PER_M = 0.5;

// ============================================================
// API SYSTEM PROMPT
// ============================================================
const SYSTEM =
  "Answer the question. End your reply with exactly one line: Answer: <answer>";

// ============================================================
// API CALL HANDLER
// ============================================================
// Calls Claude with given question and setting, captures metrics
const ask = async (q: Question, s: Setting): Promise<Row> => {
  const t0 = performance.now();

  try {
    // Make the API request with thinking and output settings
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      thinking: s.thinking,
      output_config: { effort: s.effort },
      messages: [{ role: "user", content: q.prompt }],
    });

    // Calculate elapsed time
    const ms = Math.round(performance.now() - t0);

    // Extract thinking content blocks
    const thinkingText = res.content
      .flatMap((b) => (b.type === "thinking" ? [b.thinking] : []))
      .join("\n");
    // Extract final answer text
    const answer = res.content.find((b) => b.type === "text")?.text ?? "";

    // Calculate cost in USD
    const cost =
      (res.usage.input_tokens * INPUT_PRICE_PER_M +
        res.usage.output_tokens * OUTPUT_PRICE_PER_M) /
      1_000_000;

    // Package result into a Row
    return {
      question: q.name,
      setting: s.label,
      stop: String(res.stop_reason),
      blocks: res.content.map((b) => b.type).join(","),
      correct: q.expected.test(answer),
      thinkTok: res.usage.output_tokens_details?.thinking_tokens ?? 0,
      outTok: res.usage.output_tokens,
      costUSD: Number(cost.toFixed(6)),
      ms,
      thinkChars: thinkingText.length,
      answer: answer.trim().slice(-30),
    };
  } catch (err) {
    // Handle API errors gracefully by returning error Row
    if (!(err instanceof APIError)) throw err;
    return {
      question: q.name,
      setting: s.label,
      stop: `error ${err.status}`,
      blocks: "",
      correct: false,
      thinkTok: 0,
      outTok: 0,
      costUSD: 0,
      ms: Math.round(performance.now() - t0),
      thinkChars: 0,
      answer: err.message.slice(0, 60),
    };
  }
};

// ============================================================
// MAIN EXECUTION: Run tests and collect results
// ============================================================
const rows: Row[] = [];

// Run baseline settings on all questions
for (const q of QUESTIONS) {
  for (const s of SETTINGS) {
    console.log(`running ${q.name} / ${s.label}...`);
    rows.push(await ask(q, s));
  }
}

// Run extra settings on hard question only
for (const s of EXTRAS) {
  console.log(`running ${HARD_QUESTION.name} / ${s.label}...`);
  rows.push(await ask(HARD_QUESTION, s));
}

// Display all results as a table
console.table(rows);

// - off / low / high: on each question, does correct change? How do thinkTok, ms and costUSD grow?
// Seen: No, they are all correct

// - easy / low: does blocks include thinking?
// Seen: In the current test, blocks don't include thinking

// - high, no display: thinkChars vs thinkTok.
// Seen: no think chars, as expected from no display setting. but thinkTok still counts the tokens used for thinking

// - off + max: the stop status and the error message.
// Seen: error 400. Thats because, on efforts xhigh and max, the request requires thinking on, on request it fails if thinking is disabled.

// - Any summarized row: is thinkChars much smaller than you'd expect from thinkTok?
// Seen: thinkChars is somewhat different sizes compared to thinkTok, different in each case.

// - One closing line, as the plan asks: when is high effort worth the extra cost?
// Seen: High effort is worth it when the increase in thinkTok and ms leads to a higher likelihood of correct answers, but it comes at the cost of increased costUSD.
