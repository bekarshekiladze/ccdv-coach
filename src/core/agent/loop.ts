import Anthropic from "@anthropic-ai/sdk";
import type { AppTool, Risk, ToolContext } from "../tools/types";

type Usage = {
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number; // a slice of output_tokens, not extra: thinking is billed as output
};

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | {
      type: "tool_use";
      id: string;
      name: string;
      input: unknown;
      risk: Risk | null; // null: not on the menu
    }
  // same id as its tool_use, so the UI knows which card to fill in
  | { type: "tool_result"; id: string; output: string; is_error: boolean }
  | {
      type: "done";
      model: string;
      stop_reason: string | null;
      turns: number;
      usage: Usage;
    };

// Passed in, not imported (design rule 1), so labs, evals and tests can bring their own.
export type AgentDeps = {
  client: Anthropic;
  model: string;
  tools: AppTool[];
  ctx: ToolContext;
};

// Request = everything that changes with each message the user sends.
export type AgentRequest = {
  // the per-request settings, sent with every call of the loop
  params: Pick<
    Anthropic.MessageCreateParamsNonStreaming,
    "system" | "max_tokens" | "thinking" | "output_config"
  >;
  messages: Anthropic.MessageParam[]; // the history so far, ending with the new user message
  maxTurns?: number;
  signal?: AbortSignal; // aborts when the user presses Stop or the connection drops
};

export async function* runAgent(
  { client, model, tools, ctx }: AgentDeps,
  { params, messages: history, maxTurns = 10, signal }: AgentRequest,
): AsyncGenerator<AgentEvent> {
  const messages = [...history]; // our own copy: only complete turns get in
  const byName = new Map(tools.map((t) => [t.definition.name, t]));
  const usage: Usage = {
    input_tokens: 0,
    output_tokens: 0,
    thinking_tokens: 0,
  };

  for (let turn = 1; turn <= maxTurns; turn++) {
    const stream = client.messages.stream(
      { ...params, model, tools: tools.map((t) => t.definition), messages },
      { signal },
    );

    // Forward text and thinking as they arrive. (A generator can't yield inside
    // .on() callbacks, so it reads the raw events with for await.)
    for await (const event of stream) {
      // message_start, content_block_start/stop, message_delta are bookkeeping; content comes in deltas
      if (event.type !== "content_block_delta") continue;
      if (event.delta.type === "text_delta") {
        yield { type: "text", delta: event.delta.text };
      } else if (event.delta.type === "thinking_delta") {
        // empty text unless params.thinking has display: "summarized"
        yield { type: "thinking", delta: event.delta.thinking };
      }
    }

    // Only a finished message gets past here. Stop or a dropped connection throws
    // above, so a partial turn never reaches `messages` (the dropped-stream rule).
    const res = await stream.finalMessage();
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    usage.thinking_tokens +=
      res.usage.output_tokens_details?.thinking_tokens ?? 0;
    // the whole content, thinking blocks included: they must go back unchanged on the next turn
    messages.push({ role: "assistant", content: res.content });

    // end_turn is the normal finish, but max_tokens and refusal end up here too.
    // `done` carries the stop_reason, so the UI can tell them apart.
    if (res.stop_reason !== "tool_use") {
      yield {
        type: "done",
        model: res.model,
        stop_reason: res.stop_reason,
        turns: turn,
        usage,
      };
      return;
    }

    // One tool at a time, on purpose: two writes to the same notes file must not race.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      signal?.throwIfAborted(); // after Stop, start no new side effects
      const tool = byName.get(block.name);
      yield {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input,
        risk: tool?.risk ?? null,
      };

      let output: string;
      let is_error = false;
      try {
        if (!tool) throw new Error(`Unknown tool: ${block.name}`);
        output = await tool.run(block.input, ctx);
      } catch (e) {
        output = e instanceof Error ? e.message : String(e); // news for Claude, not a crash
        is_error = true;
      }
      yield { type: "tool_result", id: block.id, output, is_error }; // for the UI
      results.push({
        // for Claude: tool_use_id pairs this result with its request
        type: "tool_result",
        tool_use_id: block.id,
        content: output,
        is_error,
      });
    }
    messages.push({ role: "user", content: results }); // all results in ONE message
  }
  throw new Error(`Agent hit the turn limit (${maxTurns})`);
}
