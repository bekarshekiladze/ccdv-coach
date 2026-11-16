import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type Note = { id: string; text: string; createdAt: string };

/**
 * Tools and pages only depend on this shape, not on *how* notes are saved.
 * Today it's one JSON file per user; once the app is deployed, it'll be a database.
 */
export type NotesStore = {
  list: (userId: string) => Promise<Note[]>;
  add: (userId: string, text: string) => Promise<Note>;
  search: (userId: string, keyword: string) => Promise<Note[]>;
};

/**
 * Builds a NotesStore that keeps each user's notes in `<dir>/<userId>.json`.
 * The folder comes in from outside (design rule 1), so labs and tests can use their own.
 */
export const createFileNotesStore = (dir: string): NotesStore => {
  const fileFor = (userId: string) => {
    // Safety check against "path traversal" (an id like "../../secrets"): only letters, digits, _ and -.
    if (!/^[\w-]+$/.test(userId)) throw new Error(`Invalid user id: ${userId}`);
    return join(dir, `${userId}.json`);
  };

  const list = async (userId: string): Promise<Note[]> => {
    try {
      return JSON.parse(await readFile(fileFor(userId), "utf-8")) as Note[];
    } catch (e) {
      // "ENOENT" = no such file: a new user, so no notes yet. Any other error is a real problem.
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw e;
    }
  };

  // Read the whole list → add one note → write it all back. If two saves ran at the same
  // moment, the second write would wipe out the first one's note (a database fixes this later).
  const add = async (userId: string, text: string): Promise<Note> => {
    const notes = await list(userId);
    const note: Note = {
      id: randomUUID(),
      text,
      createdAt: new Date().toISOString(),
    };
    notes.push(note);
    // writeFile can't create folders, so make sure the folder exists first.
    await mkdir(dir, { recursive: true });
    await writeFile(fileFor(userId), JSON.stringify(notes, null, 2));
    return note;
  };

  const search = async (userId: string, keyword: string): Promise<Note[]> => {
    const k = keyword.toLowerCase();
    return (await list(userId)).filter((n) => n.text.toLowerCase().includes(k));
  };

  return { list, add, search };
};
