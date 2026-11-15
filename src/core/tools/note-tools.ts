import z from "zod";
import { AppTool, toInputSchema } from "./types";

// .describe("…") becomes the field's "description" in the JSON Schema: Claude reads it as a hint.
const SaveNoteInput = z.object({
  text: z
    .string()
    .describe("The note itself, one short sentence in the user's words."),
});

const SearchNotesInput = z.object({
  keyword: z.string().describe('One word to look for, e.g. "exam".'),
});

export const saveNote: AppTool = {
  risk: "write",
  definition: {
    name: "save_note",
    // Claude decides when to call a tool mostly from this text,
    // so it says when to use it *and* when not to.
    description:
      "Save a short note for the user. Use when the user asks to remember, note or write something down. Do not use it to answer questions.",
    input_schema: toInputSchema(SaveNoteInput),
    // The API guarantees that Claude's input matches input_schema: no missing or extra fields.
    strict: true,
  },
  run: async (input, { userId, notes }) => {
    // strict guarantees the shape; parse() also types it
    const { text } = SaveNoteInput.parse(input);
    // The schema only says "a string", so "" or "   " would pass it.
    if (!text.trim()) {
      throw new Error("The note is empty");
    }
    const note = await notes.add(userId, text.trim());
    return `Note saved: "${note.text}"`;
  },
};

export const searchNotes: AppTool = {
  risk: "read",
  definition: {
    name: "search_notes",
    // "Use before answering…" nudges Claude to look things up instead of guessing.
    description:
      "Find saved notes that contain a keyword (case-insensitive). Use before answering any question about what the user saved earlier.",
    input_schema: toInputSchema(SearchNotesInput),
    strict: true,
  },
  run: async (input, { userId, notes }) => {
    const { keyword } = SearchNotesInput.parse(input);
    const hits = await notes.search(userId, keyword);
    if (hits.length === 0) {
      // Finding nothing is a normal answer, not an error: is_error is for when the tool itself broke.
      return `No notes contain "${keyword}"`;
    }
    return `Found ${hits.length} note(s):\n${hits.map((n) => `- ${n.text}`).join("\n")}`;
  },
};

export const noteTools: AppTool[] = [saveNote, searchNotes];
