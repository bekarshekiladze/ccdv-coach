import Anthropic from "@anthropic-ai/sdk";

export function pruneOldToolResults(
  messages: Anthropic.MessageParam[],
  keepLast = 3,
): Anthropic.MessageParam[] {
  const total = messages
    .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
    .filter((b) => b.type === "tool_result").length;
  let toPrune = total - keepLast; // the oldest one: results sit in time order

  return messages.map((msg) => {
    // Tool results only ever live in user messages
    if (msg.role !== "user" || typeof msg.content === "string") {
      return msg;
    }
    return {
      ...msg,
      content: msg.content.map((block) => {
        if (block.type !== "tool_result" || toPrune <= 0) {
          return block;
        }
        toPrune--;
        const firstLine =
          typeof block.content === "string" ? block.content.split("\n")[0] : "";
        return { ...block, content: `[pruned: ${firstLine}]` };
      }),
    };
  });
}
