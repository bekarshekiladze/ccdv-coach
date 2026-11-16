"use client";

import { useRef, useState } from "react";

type Usage = { input_tokens: number; output_tokens: number };
type DoneInfo = {
  model: string;
  prompt_version: string;
  stop_reason: string | null;
  usage: Usage;
  turns: number;
  thinking_mode: string;
  thinking_tokens: number;
};
// One tool call, filled in two steps: "tool_use" creates it, "tool_result" completes it.
type ToolCall = {
  id: string;
  name: string;
  risk: string | null;
  input: unknown;
  output?: string;
  is_error?: boolean;
};

const CoachPage = () => {
  const [input, setInput] = useState(""); // what's typed in the box
  const [answer, setAnswer] = useState(""); // the text so far
  const [info, setInfo] = useState<DoneInfo | null>(null); // Inspector data, filled by "done"
  const [error, setError] = useState<string | null>(null); // filled by "error" or a failed fetch
  const [loading, setLoading] = useState(false);
  const [think, setThink] = useState(false);
  const [thinkingText, setThinkingText] = useState(""); // the thinking summary so far
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]); // filled by tool_use / tool_result
  const [stopped, setStopped] = useState(false); // true after Stop
  const abortRef = useRef<AbortController | null>(null); // lets Stop cancel the running fetch

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setAnswer("");
    setInfo(null);
    setError(null);
    setLoading(true);
    setThinkingText("");
    setToolCalls([]);
    setStopped(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input, think }),
        signal: controller.signal, // abort() closes the connection; the server notices
      });

      if (!res.ok) {
        // only your 400 lands here: the check before streaming
        const body = await res.json();
        setError(body.error);
        return;
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read(); // waits for the next piece from the pipe
        if (done) break; // the route called controller.close()
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const parts = buffer.split("\n\n"); // "\n\n" = the end of an event
        buffer = parts.pop() || ""; // keep the last incomplete part in the buffer
        for (const part of parts) {
          if (part.trim()) {
            handleEvent(parseEvent(part));
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setStopped(true); // Stop isn't an error
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleEvent({ event, data }: { event: string; data: unknown }) {
    if (event === "text") {
      const { delta } = data as { delta: string };
      setAnswer((prev) => prev + delta);
    } else if (event === "thinking") {
      const { delta } = data as { delta: string };
      setThinkingText((prev) => prev + delta);
    } else if (event === "tool_use") {
      const { id, name, risk, input } = data as ToolCall;
      setToolCalls((prev) => [...prev, { id, name, risk, input }]);
    } else if (event === "tool_result") {
      const { id, output, is_error } = data as {
        id: string;
        output: string;
        is_error: boolean;
      };
      setToolCalls((prev) =>
        prev.map((call) =>
          call.id === id ? { ...call, output, is_error } : call,
        ),
      );
    } else if (event === "done") {
      setInfo(data as DoneInfo);
    } else if (event === "error") {
      const { status, message } = data as {
        status: number | null;
        message: string;
      };
      setError(`${status ?? "?"}: ${message}`);
    }
  }

  function parseEvent(raw: string) {
    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim();
      } else if (line.startsWith("data:")) {
        data = line.slice("data:".length).trim();
      }
    }
    return { event, data: data ? JSON.parse(data) : null };
  }

  return (
    <main className="space-y-4 mx-auto p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="Ask something…"
        />
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={think}
            onChange={(e) => setThink(e.target.checked)}
          />
          think
        </label>
        <button disabled={loading} className="px-4 border rounded">
          {loading ? "…" : "Send"}
        </button>
        {loading && (
          <button
            type="button" // not a submit button: clicking Stop never sends the form
            onClick={() => abortRef.current?.abort()}
            className="px-4 border rounded"
          >
            Stop
          </button>
        )}
      </form>
      {thinkingText && (
        <details open className="p-3 border rounded text-gray-500 text-sm">
          <summary>thinking (summary)</summary>
          <p className="whitespace-pre-wrap">{thinkingText}</p>
        </details>
      )}
      {toolCalls.map((call) => (
        <div
          key={call.id}
          className="flex gap-2 px-3 py-2 border rounded font-mono text-sm"
        >
          <span className="font-semibold">{call.name}</span>
          <span className="text-gray-500">{call.risk ?? "unknown"}</span>
          <span className={call.is_error ? "text-red-600" : "text-gray-500"}>
            {call.output === undefined
              ? "running…"
              : call.is_error
                ? "error"
                : "done"}
          </span>
        </div>
      ))}
      <p className="whitespace-pre-wrap">{answer}</p>
      {stopped && (
        <p className="text-gray-500 text-sm">
          Stopped. The server dropped this turn.
        </p>
      )}
      {error && <p className="text-red-600">{error}</p>}
      {info && (
        <dl className="gap-x-4 grid grid-cols-2 p-3 border rounded font-mono text-sm">
          <dt>model</dt> <dd>{info.model}</dd>
          <dt>prompt_version</dt> <dd>{info.prompt_version}</dd>
          <dt>stop_reason</dt> <dd>{info.stop_reason}</dd>
          <dt>turns</dt> <dd>{info.turns}</dd>
          <dt>input tokens</dt> <dd>{info.usage.input_tokens}</dd>
          <dt>output tokens</dt>
          <dd>{info.usage.output_tokens}</dd>
          <dt>thinking</dt> <dd>{info.thinking_mode}</dd>
          <dt>thinking tokens</dt> <dd>{info.thinking_tokens}</dd>
        </dl>
      )}
      {toolCalls.length > 0 && (
        <details open className="p-3 border rounded font-mono text-sm">
          <summary>tool calls ({toolCalls.length})</summary>
          {toolCalls.map((call) => (
            <div key={call.id} className="mt-2">
              <p>
                {call.name}({JSON.stringify(call.input)})
              </p>
              <p className={call.is_error ? "text-red-600" : "text-gray-500"}>
                → {call.output ?? "…"}
              </p>
            </div>
          ))}
        </details>
      )}
    </main>
  );
};

export default CoachPage;
