import z from "zod";

export const Domain = z.enum([
  "agents",
  "api",
  "tools",
  "prompting",
  "security",
  "models",
]);

export const FlashCard = z.object({
  question: z.string().min(5),
  answer: z.string().min(1),
  domain: Domain,
});

export const Deck = z.array(FlashCard).min(1);
export const DeckResponse = z.object({ cards: Deck });

// types

export type FlashCard = z.infer<typeof FlashCard>;
export type Deck = z.infer<typeof Deck>;
export type DeckResponse = z.infer<typeof DeckResponse>;

// schemas
export const deckResponseJsonSchema = z.toJSONSchema(DeckResponse);
