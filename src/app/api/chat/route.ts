import { APIError, client, MODEL } from "@/server";

// - Return: new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } }).
// - Imports come from @/server, never straight from core.

export async function POST(req: Request) {
  const { message } = await req.json().catch(() => ({}));
  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // claude streams call
      try {
        const claude = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          messages: [{ role: "user", content: message }],
        });

        // Pass each piece of text on to the browser as it arrives.
        claude.on("text", (delta) => {
          send("text", { delta });
        });

        //  Wait for the end, then send the Inspector data.
        const final = await claude.finalMessage();

        send("done", {
          model: final.model,
          stop_reason: final.stop_reason,
          usage: final.usage,
        });
      } catch (error) {
        // The 200 is already sent, so the error travels as an event.
        send(
          "error",
          error instanceof APIError
            ? { status: error.status, message: error.message }
            : { status: 500, message: "Unexpected server error occurred" },
        );
      } finally {
        controller.close(); // Always end the response, success or error.
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
