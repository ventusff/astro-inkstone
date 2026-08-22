/** Build-time helpers for rendering ToC labels (server-side KaTeX).
 *  Belongs to the "chapters" numbering preset (./rehype-chapters.ts); the
 *  "sections" preset's ToC reader lives in ./rehype-sections.ts. */
import katex from 'katex';

import type { TocData, TocEntry } from './toc-types.ts';
import type { TocData as SectionsTocData } from './rehype-sections.ts';

const escapeHtml = (s: string): string =>
  s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/**
 * Render a ToC label to HTML: inline `$…$` runs become KaTeX, the rest is
 * escaped text. Used by the sidebar (labels are author-controlled).
 */
export function renderTocLabel(label: string): string {
  return label.replace(/\$([^$]+)\$|([^$]+)/g, (_m, tex: string | undefined, plain: string | undefined) => {
    if (tex !== undefined) {
      return katex.renderToString(tex, { throwOnError: false, output: 'htmlAndMathml' });
    }
    return escapeHtml(plain ?? '');
  });
}

/** Narrowing helper: get the typed ToC out of remarkPluginFrontmatter. */
export function getToc(remarkPluginFrontmatter: Record<string, unknown>): TocData {
  const toc = remarkPluginFrontmatter['toc'];
  if (toc && typeof toc === 'object' && 'items' in toc) return toc as TocData;
  return { items: [], numbers: {} };
}

/** One row of the in-page jump list (components/LocalToc.astro). */
export interface LocalTocRow {
  id: string;
  /** printed number; '' for an unnumbered heading */
  num: string;
  label: string;
}

/**
 * The in-page jump list of either ToC shape: every depth-two entry,
 * numbered or not (an unnumbered chapter page still gets its jump list).
 * Group rows and depth-three entries belong to the sidebar, not here.
 */
export function localTocRows(toc: TocData | SectionsTocData): LocalTocRow[] {
  return 'entries' in toc
    ? toc.entries.filter((e) => e.depth === 2).map(({ id, num, label }) => ({ id, num, label }))
    : toc.items
        .filter((i): i is TocEntry => i.kind === 'entry' && i.depth === 2)
        .map(({ id, num, label }) => ({ id, num, label }));
}
