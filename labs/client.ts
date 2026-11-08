import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

export const client = new Anthropic(); // reads ANTHROPIC_API_KEY
export const MODEL = "claude-haiku-5-5" as const; // cheap while testing; try Sonnet/Opus later
