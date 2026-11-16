import { APIError, client, loadPrompt, MODEL, runCoachAgent } from "@/server";

// - Return: new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }).
// - Imports come from @/server, never straight from core.

export async function POST(req: Request) {
  const { message, think } = await req.json().catch(() => ({}));
  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  // Load before streaming: a missing prompt is a server bug, so let it fail as a plain 500.
  const prompt = loadPrompt("coach");
  if (!prompt.text) {
    return Response.json({ error: "Prompt not found" }, { status: 500 });
  }
  const isThinkingEnabled = think === true;
  const thinking = isThinkingEnabled
    ? ({ type: "adaptive", display: "summarized" } as const)
    : ({ type: "disabled" } as const);

  const effort = isThinkingEnabled ? "high" : "medium";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // the browser is gone (Stop or a dropped connection): nobody to send to
        }
      };

      // claude streams call
      try {
        const agent = runCoachAgent({
          params: {
            system: prompt.text,
            max_tokens: isThinkingEnabled ? 8000 : 2048,
            thinking,
            output_config: { effort },
          },
          messages: [{ role: "user", content: message }],
          signal: req.signal, // Stop closes the connection, which aborts the Claude call
        });

        // Each loop event becomes one SSE event; "done" also carries the Inspector data.
        for await (const event of agent) {
          if (event.type === "done") {
            send("done", {
              model: event.model,
              stop_reason: event.stop_reason,
              usage: event.usage,
              turns: event.turns,
              prompt_version: prompt.id,
              thinking_mode: isThinkingEnabled
                ? "adaptive · high"
                : "disabled · medium",
              thinking_tokens: event.usage.thinking_tokens,
            });
          } else {
            send(event.type, event);
          }
        }
      } catch (error) {
        if (req.signal.aborted) return; // Stop: not an error, and the partial turn is dropped
        console.error(error);
        // The 200 is already sent, so the error travels as an event.
        send(
          "error",
          error instanceof APIError
            ? { status: error.status, message: error.message }
            : { status: 500, message: "Unexpected server error occurred" },
        );
      } finally {
        try {
          controller.close(); // Always end the response, success or error.
        } catch {
          // already closed by the disconnect
        }
      }
    },
  });

  // Returned right away; start() keeps running and fills the body.
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

// Predict & break
// 1. Set max_tokens: 5 in route.ts. What text appears? What does the Inspector show for stop_reason and output tokens? Does the stream end with done or error?
// - it returned the answer what fits within 5 tokens. The Inspector shows stop_reason as "max_tokens" and output tokens as 5. The stream ends with "done".

// 2. Use a wrong model name (e.g. claude-nope). What is the HTTP status in DevTools → Network? Which status ends up inside the error event? Which code path in the page shows it: the !res.ok branch or handleEvent?
// - http status is still 200. in error event ends up with status 404. The handleEvent would handle this error, through the "error" event branch.

// 3. Stop the dev server mid-answer (Ctrl+C while it's streaming; use a long prompt so you have time). What happens to the half answer on screen? Does an error appear, and which part of the page code catches it? Is anything saved?
// - The first half is shown on the screen. appears "network error" red error text. it would be catched by trycatch block in page.tsx, where reader tries to read from the stream and fails. Nothing is saved in the Inspector since the "done" event never arrives.

// 4. budget_tokens on Haiku 5.5: thinking { type: "enabled", budget_tokens: 1024 }, think on. HTTP status in DevTools → Network, the status and message on the page, and which page code path showed it (!res.ok or the "error" event)?
// Seen: In the browser, chat returns error 400. In network tab, its still 200. The error event carries status 400 and the message from the server. The message is unformatted, but it reads as "thinking type enabled is not supported for this model (Haiku 5.5), Use thinking type adaptive and output_config.effort to control thinking behavior"

// 5. Think on + max_tokens: 300, the Alice/Bob puzzle from Lab 10. stop_reason, thinking tokens vs output tokens, and how much of the thinking box and of the answer appeared? Did the stream end with done or error?
// Seen: stop reason obviously is max_tokens. Only the thinking text was displayed. It showed only part of the answer where tokens were enough for the model to generate. It was ended with "done".
