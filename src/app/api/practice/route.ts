import { generateDeck, client, MODEL, APIError } from "@/server";

export async function POST(req: Request) {
  const { topic } = await req.json().catch(() => ({}));
  if (typeof topic !== "string" || topic.trim() === "" || topic.length > 100) {
    return Response.json(
      { error: "Topic must be 1-100 characters" },
      { status: 400 },
    );
  }

  try {
    const result = await generateDeck({ client, model: MODEL }, topic.trim());
    return Response.json(result);
  } catch (error) {
    if (error instanceof APIError) {
      return Response.json(
        { error: error.message },
        { status: error.status ?? 502 },
      );
    }
    return Response.json(
      { error: "Unexpected server error occurred" },
      { status: 500 },
    );
  }
}
