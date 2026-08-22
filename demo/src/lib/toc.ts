/**
 * Site-side helpers around the build-time ToC that rehype-sections (from the
 * package pipeline, `numbering: 'sections'`) writes into
 * `remarkPluginFrontmatter.toc`. The sidebar and the in-page jump list read
 * THIS — never Astro's own `headings`, whose `text` would carry the injected
 * section number.
 */
import type { TocData } from 'astro-inkstone/lib/rehype-sections';

export type { TocData, TocEntry } from 'astro-inkstone/lib/rehype-sections';

export const EMPTY_TOC: TocData = { entries: [] };

/** Narrowing helper: pull the typed ToC out of remarkPluginFrontmatter. */
export function getToc(remarkPluginFrontmatter: Record<string, unknown>): TocData {
  const toc = remarkPluginFrontmatter['toc'];
  if (toc && typeof toc === 'object' && Array.isArray((toc as TocData).entries)) {
    return toc as TocData;
  }
  return EMPTY_TOC;
}
