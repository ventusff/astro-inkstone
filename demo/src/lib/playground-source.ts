/**
 * The source island of a note page in a PLAYGROUND build: the page carries
 * its own source for the browser-local playground, in a
 * `<script type="application/json" data-inkbrush-source>` in the head
 * holding `{ file, source }` — the note's repo-relative path and the full
 * file text, frontmatter included. It comes from the same file, in the same
 * build, as the page's block stamps, so the two cannot skew across deploys.
 */
import { readFileSync } from 'node:fs';

export interface NoteSource {
  /** repo-relative source path (the editor head shows it; the vfile path) */
  file: string;
  /** the full file text, frontmatter included */
  source: string;
}

export function readNoteSource(entry: { id: string; filePath?: string | undefined }): NoteSource {
  if (!entry.filePath) throw new Error(`notes/${entry.id}: no file path on the collection entry`);
  return { file: entry.filePath, source: readFileSync(entry.filePath, 'utf8') };
}

/** the island's body: JSON with every `<` escaped, so the source can never
 *  close the script element (`</script`) or open a comment (`<!--`) */
export function noteSourceIsland(src: NoteSource): string {
  return JSON.stringify(src).replace(/</g, '\\u003c');
}
