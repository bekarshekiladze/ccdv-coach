"use client";

import type { DeckResult } from "@/server";
import { useState } from "react";

const MARK = { ok: "✓", failed: "✗", skipped: "–" } as const;

const PracticePage = () => {
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<DeckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(body?.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(body as DeckResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-4 mx-auto p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className="flex-1 px-3 py-2 border rounded"
          placeholder="Topic, e.g. prompt caching"
        />
        <button disabled={loading} className="px-4 border rounded">
          {loading ? "…" : "Make 5 cards"}
        </button>
      </form>
      {error && <p className="text-red-600">{error}</p>}
      {result && (
        <>
          <p className="font-mono text-sm">
            stop_reason {MARK[result.checks.stop]} · parse{" "}
            {MARK[result.checks.parse]} · Zod {MARK[result.checks.zod]}
          </p>

          {result.issues.length > 0 && (
            <ul className="text-red-600 text-sm">
              {result.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}

          <ol className="space-y-3 pl-5 list-decimal">
            {result.cards.map((card, i) => (
              <li key={i}>
                <p className="font-semibold">{card.question}</p>
                <p>{card.answer}</p>
                <p className="text-gray-500 text-xs">{card.domain}</p>
              </li>
            ))}
          </ol>

          <dl className="gap-x-4 grid grid-cols-2 p-3 border rounded font-mono text-sm">
            <dt>model</dt> <dd>{result.model}</dd>
            <dt>prompt_version</dt> <dd>{result.promptVersion}</dd>
            <dt>stop_reason</dt> <dd>{result.stopReason}</dd>
            <dt>cards</dt> <dd>{result.cards.length}</dd>
            <dt>input tokens</dt> <dd>{result.usage.input_tokens}</dd>
            <dt>output tokens</dt> <dd>{result.usage.output_tokens}</dd>
            <dt>time</dt> <dd>{result.ms} ms</dd>
          </dl>
        </>
      )}
    </main>
  );
};

export default PracticePage;
