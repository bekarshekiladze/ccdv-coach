import Anthropic from "@anthropic-ai/sdk";
import { NotesStore } from "../study/notes";
import z from "zod";

// How much harm a call can do. Shown on the tool cards today; Day 5's approval gate acts on it.
export type Risk = "read" | "write" | "destructive";

export type ToolContext = { userId: string; notes: NotesStore };

export type AppTool = {
  definition: Anthropic.Tool;
  risk: Risk;
  // The string it returns is what Claude gets back as the tool_result.
  run: (input: unknown, ctx: ToolContext) => Promise<string>;
};

// One Zod schema per input (design rule 5): the JSON Schema is generated, so the two can't drift.
export const toInputSchema = (
  schema: z.ZodObject,
): Anthropic.Tool.InputSchema => {
  // Gives back { $schema, type: "object", properties, required, additionalProperties: false }
  const json = z.toJSONSchema(schema);
  // $schema only labels the JSON Schema version; the API just needs the schema itself.
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
};
