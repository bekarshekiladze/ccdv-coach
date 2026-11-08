import Anthropic, { APIError } from "@anthropic-ai/sdk";

export const client = new Anthropic(); // reads ANTHROPIC_API_KEY
export const MODEL = "claude-haiku-5-5" as const; // cheap while testing; try Sonnet/Opus later
export { APIError };
