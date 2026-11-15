import { Suspense } from "react";
import { DEFAULT_USER, notesStore } from "@/server";

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// The shell renders at once; the list reads a file and the URL, so it streams in
// behind <Suspense> (cacheComponents requires that for request-time data).
export default function NotesPage({ searchParams }: Props) {
  return (
    <main className="space-y-4 mx-auto p-6 max-w-2xl">
      <h1 className="font-semibold text-xl">Notes</h1>
      <Suspense fallback={<p className="text-gray-500">Loading notes…</p>}>
        <NoteList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function NoteList({ searchParams }: Props) {
  const { q } = await searchParams;
  const keyword = typeof q === "string" ? q.trim() : "";
  const notes = keyword
    ? await notesStore.search(DEFAULT_USER, keyword)
    : await notesStore.list(DEFAULT_USER);

  return (
    <>
      {/* a plain GET form: submitting loads /notes?q=… */}
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={keyword}
          placeholder="Search notes…"
          className="flex-1 px-3 py-2 border rounded"
        />
        <button className="px-4 border rounded">Search</button>
      </form>
      {notes.length === 0 ? (
        <p className="text-gray-500">
          {keyword
            ? `No notes contain "${keyword}".`
            : "No notes yet. Ask the coach to remember something."}
        </p>
      ) : (
        <ul className="space-y-2">
          {[...notes].reverse().map((note) => (
            <li key={note.id} className="p-3 border rounded">
              <p>{note.text}</p>
              <p className="text-gray-500 text-xs">{note.createdAt}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
