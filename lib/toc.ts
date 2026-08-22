/** Build-time helpers for rendering ToC labels (server-side KaTeX).
 *  Belongs to the "chapters" numbering preset (./rehype-chapters.ts); the
 *  "sections" preset's ToC reader lives in ./rehype-sections.ts. */
import katex from 'katex';

import type { TocData } from './toc-types.ts';

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
