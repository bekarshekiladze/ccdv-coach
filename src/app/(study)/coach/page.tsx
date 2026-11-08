"use client";

import { useState } from "react";

type Usage = { input_tokens: number; output_tokens: number };
type DoneInfo = { model: string; stop_reason: string | null; usage: Usage };

const CoachPage = () => {
  const [input, setInput] = useState(""); // what's typed in the box
  const [answer, setAnswer] = useState(""); // the text so far
  const [info, setInfo] = useState<DoneInfo | null>(null); // Inspector data, filled by "done"
  const [error, setError] = useState<string | null>(null); // filled by "error" or a failed fetch
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setAnswer("");
    setInfo(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
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
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleEvent({ event, data }: { event: string; data: unknown }) {
    if (event === "text") {
      const { delta } = data as { delta: string };
      setAnswer((prev) => prev + delta);
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
        <button disabled={loading} className="px-4 border rounded">
          {loading ? "…" : "Send"}
        </button>
      </form>
      <p className="whitespace-pre-wrap">{answer}</p>
      {error && <p className="text-red-600">{error}</p>}
      {info && (
        <dl className="gap-x-4 grid grid-cols-2 p-3 border rounded font-mono text-sm">
          <dt>model</dt> <dd>{info.model}</dd>
          <dt>stop_reason</dt> <dd>{info.stop_reason}</dd>
          <dt>input tokens</dt> <dd>{info.usage.input_tokens}</dd>
          <dt>output tokens</dt>
          <dd>{info.usage.output_tokens}</dd>
        </dl>
      )}
    </main>
  );
};

export default CoachPage;
