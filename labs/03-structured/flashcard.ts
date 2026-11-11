import z from "zod";

export const FlashCard = z.object({
  question: z.string().min(5),
  answer: z.string(),
  domain: z.enum(["agents", "api", "tools", "prompting", "security", "models"]),
});

export const Deck = z.array(FlashCard).min(1);

export const DeckResponse = z.object({ cards: z.array(FlashCard).min(1) });

export type Deck = z.infer<typeof Deck>;

export const systemPrompt =
  "reply with only a JSON array, no prose, no code fences.";

export const prompt = `
<task>: make 3 CCDV-F flashcards </task>
<fields>: question (min 5 chars), answer, domain (agents, api, tools, prompting, security, models) </fields>
<example>: [{"question": "What is an API?", "answer": "A set of rules for interacting with software.", "domain": "api"}] </example>
`;
