/**
 * note-source.ts — where a note's frontmatter sits in its source file.
 *
 * The CMS (astro-inkbrush) offers in-place editing on any element stamped
 * `data-wiki-src="start-end"`. Body blocks get their stamp from
 * rehype-wiki-blocks; the title and description do not — they are
 * frontmatter, rendered by the layout rather than by the markdown pipeline,
 * so the pipeline never sees them. The layout therefore stamps the page head
 * itself with the frontmatter's line range: hover the title, ✎, and the YAML
 * opens in the same editor as any paragraph. Line numbers are absolute file
 * lines — the coordinates the CMS's block endpoint reads and patches.
 */
import { readFileSync } from 'node:fs';

const NOTES_DIR = new URL('../content/notes/', import.meta.url);

/** "1-N" spanning the frontmatter of `src/content/notes/<id>/index.mdx`; undefined when the file has none */
export function frontmatterRange(noteId: string): string | undefined {
  let source: string;
  try {
    source = readFileSync(new URL(`${noteId}/index.mdx`, NOTES_DIR), 'utf8');
  } catch {
    return undefined;
  }
  const lines = source.split('\n');
  if (lines[0] !== '---') return undefined;
  const close = lines.indexOf('---', 1);
  return close > 0 ? `1-${close + 1}` : undefined;
}
