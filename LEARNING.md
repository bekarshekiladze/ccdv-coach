# LEARNING

Decision rules ("use X when…, not Y") from each day of this run. Scenario questions test exactly these.

- Write them yourself, at the end of each day.
- Add "seen: …" only for results you observed, with the model and date.

## Day 1: Foundations, Step 1, first streaming chat

### Messages API

- Rule: find the text block in `content` (`find(b => b.tyupe === "text")`), not `content[0].text`. `content` is a list of blocks.
- Rule: check `stop_reason` after every call. Hitting `max_tokens` is a 200 with a cut-off answer, not an error.
- Rule: the API is stateless, so resent the whole history every turn. If a call fails, pop the user turn you just pushed.

### Sampling and prompting

- Rule: test answers for a property (names a fruit, parses as JSON), not an exact string. The same prompt can give different answers.
  seen: claude-haiku-5-5: 5 runs of extra-repeats -> 2x Apple, 3x Banana, 27-043 output tokens.
- Rule use few-shot examples when the format or labels matter, and cover every label. A single example can pull answers toward its own label.

### Streaming and errors

- Rule: stream when a person is watching the answer. Use a plain call for short or background jobs. Register `.on("text")` before `await finalMessage()`.
- Rule: validate input before the stream starts, while a real 4xx status is still possible. After the stream starts, the status is fixed at 200, so send failures as an `error` event in the stream.
- Rule: `fetch` doesn't throw on 4xx/5xx; it throws only on network failure. Check `res.ok` (true for 200–299). It catches every non-2xx, not only your own 400.
- Rule: catch SDK errors with `instanceof APIError`, not `err: any`. Expect `status` to be missing (a connection error has none).
