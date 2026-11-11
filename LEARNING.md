# LEARNING

Decision rules ("use X when…, not Y") from each day of this run. Scenario questions test exactly these.

- Write them yourself, at the end of each day.
- Add "seen: …" only for results you observed, with the model and date.

## Day 1: Foundations, Step 1, first streaming chat

### Messages API

- Rule: find the text block in `content` (`find(b => b.type === "text")`), not `content[0].text`. `content` is a list of blocks.
- Rule: check `stop_reason` after every call. Hitting `max_tokens` is a 200 with a cut-off answer, not an error.
- Rule: the API is stateless, so resend the whole history every turn. If a call fails, pop the user turn you just pushed.

### Sampling and prompting

- Rule: test answers for a property (names a fruit, parses as JSON), not an exact string. The same prompt can give different answers.
  seen: claude-haiku-5-5: 5 runs of extra-repeats -> 2x Apple, 3x Banana, 27-043 output tokens.
- Rule use few-shot examples when the format or labels matter, and cover every label. A single example can pull answers toward its own label.

### Streaming and errors

- Rule: stream when a person is watching the answer. Use a plain call for short or background jobs. Register `.on("text")` before `await finalMessage()`.
- Rule: validate input before the stream starts, while a real 4xx status is still possible. After the stream starts, the status is fixed at 200, so send failures as an `error` event in the stream.
- Rule: `fetch` doesn't throw on 4xx/5xx; it throws only on network failure. Check `res.ok` (true for 200–299). It catches every non-2xx, not only your own 400.
- Rule: catch SDK errors with `instanceof APIError`, not `err: any`. Expect `status` to be missing (a connection error has none).

## Day 2: Prompting craft and extended thinking

### Structured output: prompt-only JSON (Lab 3a)

- Rule: treat model text as untrusted input. Check it in three layers: `stop_reason` → `JSON.parse` in try/catch (into `unknown`, not `any`) → Zod `safeParse`. Only `result.data` goes downstream.
- Rule: with prompt-only JSON, the format instruction ("only a JSON array, no prose, no code fences") is what makes `JSON.parse` work. Keep it in `system`; don't rely on the example alone.
  seen: claude-haiku-5-5, 2026-11-09, extra-repeats 10× each: normal → 10/10 ok; system line removed → 10/10 parse failures; `<example>` removed (domains still listed in `<fields>`) → 10/10 ok.
- Rule: valid JSON can still have the wrong shape. Zod catches the content rules the parser can't (length, enum, missing fields).
  seen: claude-haiku-5-5, 2026-11-09, 3a with `question` at `.min(500)`: JSON parsed, Zod rejected it ("Too small: expected string to have >=500 characters"); 138 input / 356 output tokens.
- Rule: measure reliability with first-attempt counts over many runs, with no retry. A retry turns failures into passes and hides them.

### Structured output: native JSON (Lab 3b)

- Rule: use `output_config.format` (JSON schema) when the output must parse, not a format instruction in the prompt. The API generates within the schema, so fences and prose can't appear.
  seen: claude-haiku-5-5, 2026-11-09, 3b with no system line: parsed and passed Zod (single run).
  seen: claude-haiku-5-5, 2026-11-11, extra-repeats 10×, no system line: native → 10/10 ok (304–562 output tokens); 3a → 10/10 parse failures.
- Rule: the schema root must be an object. Wrap a list in a field (`{ cards: [...] }`), not a top-level array.
- Rule: when the prompt's example and the schema disagree, the schema wins. Keep the example consistent with the schema anyway.
  seen: claude-haiku-5-5, 2026-11-09, 3b: the prompt's example was an array, the output was `{ cards: [...] }`.
- Rule: keep Zod after native JSON. It guarantees the shape, not every rule: `zodOutputFormat` (SDK 1.4.0) turns `min(5)` and `z.enum` into description text only.
  seen: SDK 1.4.0, 2026-11-09, local converter check (no API call): `question` → `"{minLength: 5}"`, `domain` → `"{enum: [...]}"` as descriptions.
- Rule: native JSON doesn't switch off thinking. Find the text block by `type`, not `content[0]`.
  seen: claude-haiku-5-5, 2026-11-09, 3b: a thinking block was still in `res.content`.
- Rule: expect extra latency on the first call with a new schema (it gets compiled).
  seen: claude-haiku-5-5, 2026-11-09, 3b: the first call was around 25% slower than the next ones; times without `output_config` were generally faster than with it.

### Structured output in the app (`/practice`)

- Rule: with native JSON, treat Zod length/enum limits as hints the model reads (they become description text), so the model usually meets them instead of Zod catching them. Use `.refine` (never sent to the model) or a check after the call for rules the model must not see or game.
  seen: claude-haiku-5-5, 2026-11-10, `/practice` with `question` at `.min(500)`: stop_reason ✓ · parse ✓ · Zod ✓, and the questions grew into long word problems. In 3a (no schema sent) the same rule failed Zod.
  seen: SDK 1.4.0, 2026-11-10, local converter check (no API call): `.min(500)` → description `"{minLength: 500}"`; a `.refine` doesn't appear in the schema at all.
- Rule: keep HTTP statuses for request failures (400 bad input, the upstream status, 502 when the upstream never answered). Report failed checks on the model's output as 200 + data, not 4xx/5xx.
- Rule: share server types with client components through `import type`, never a value import. Types are erased at compile time, so `server-only` never reaches the browser bundle.

### Thinking (Lab 10 + coach)

- Rule: on Haiku 5.5, control thinking with `thinking: { type: "adaptive" }` + `output_config.effort`, not `budget_tokens`.
  seen: claude-haiku-5-5, 2026-11-11, coach with `{ type: "enabled", budget_tokens: 1024 }` → 400 "thinking type enabled is not supported for this model"; HTTP stayed 200, it arrived as the `error` event.
- Rule: `thinking: { type: "disabled" }` works only with effort low/medium/high. `xhigh`/`max` need thinking on.
  seen: claude-haiku-5-5, 2026-11-10, Lab 10 `off + max` → 400.
- Rule: with thinking on, size `max_tokens` for thinking + answer. Thinking spends the budget first, and a cut-off answer still ends with `done`, so check `stop_reason`.
  seen: claude-haiku-5-5, 2026-11-11, coach, think on, `max_tokens: 300`, Alice/Bob puzzle → stop_reason max_tokens, thinking shown, answer cut, stream ended with done.
