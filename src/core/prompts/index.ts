import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every prompt the app has. Add a name or a version here when you add its file.
export type PromptName = "coach" | "deck";
export type PromptVersion = "v1";

export type Prompt = {
  id: string; // "coach@v1": shown in the Inspector, later written to every trace line
  text: string; // the file's contents, sent as `system`
};

export function loadPrompt(
  name: PromptName,
  version: PromptVersion = "v1",
): Prompt {
  const id = `${name}@${version}`;
  const file = join(
    process.cwd(),
    "src",
    "core",
    "prompts",
    version,
    `${name}.md`,
  );
  const text = readFileSync(file, "utf-8").trim();
  return { id, text };
}
