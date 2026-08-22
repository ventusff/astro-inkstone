/**
 * rehype-sections — build-time section numbering + ToC extraction: the
 * "sections" numbering preset. The alternative "chapters" preset (parts,
 * appendices, § cross-references) is ./rehype-chapters.ts — a site picks one
 * via siteMarkdown({ numbering }).
 *
 * Every h2/h3 on the page, at any depth of the tree (headings inside MDX
 * containers included), gets: its id (heading-core.assignHeadingId), a
 * number injected as `<span class="num">` — h2 `1, 2, 3…`, h3 `<h2>.<n>` —
 * and a ToC row. Source headings stay number-free. An h3 before the first h2
 * has no parent number: it keeps its id and its ToC row and is left
 * unnumbered. The heading attributes of remark-heading-attrs are honoured:
 * `toc="…"` labels the row, `notoc` drops it.
 *
 * The ToC is written to `remarkPluginFrontmatter.toc`; the sidebar and the
 * in-page jump list read that. Astro's own `headings` array carries the
 * injected numbers in its `text` and is not used downstream.
 *
 * Order: runs before `rehypeWikiBlocks`, which must be last.
 */
import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';

import { type AnyNode, assignHeadingId, headingText, numberNode, slugify, takeHeadingAttrs } from './heading-core.ts';

export { slugify };

export interface TocEntry {
  depth: 2 | 3;
  /** heading anchor id */
  id: string;
  /** printed section number: '1', '1.2'; '' for an unnumbered heading */
  num: string;
  /** heading text, without the number */
  label: string;
}

export interface TocData {
  entries: TocEntry[];
}

interface AstroVFileData {
  astro?: { frontmatter?: Record<string, unknown> };
}

export function rehypeSections() {
  return function transform(tree: Root, file: VFile): void {
    const entries: TocEntry[] = [];
    const used = new Set<string>();
    const where = file.path ?? '(unknown file)';
    let h2 = 0;
    let h3 = 0;

    const walk = (nodes: AnyNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'element') {
          const el = node as unknown as Element;
          // GFM's footnote section carries a screen-reader-only heading
          if (el.tagName === 'section' && el.properties?.['dataFootnotes'] !== undefined) continue;
          const depth = el.tagName === 'h2' ? 2 : el.tagName === 'h3' ? 3 : 0;
          if (depth !== 0) {
            const props = (el.properties ??= {});
            const { tocLabel, notoc } = takeHeadingAttrs(props);
            const text = headingText(el);
            const id = assignHeadingId(props, text, used, where);

            let num = '';
            if (depth === 2) {
              h2 += 1;
              h3 = 0;
              num = String(h2);
            } else if (h2 > 0) {
              h3 += 1;
              num = `${h2}.${h3}`;
            }
            if (num) el.children.unshift(numberNode(num));
            if (!notoc) entries.push({ depth: depth as 2 | 3, id, num, label: tocLabel ?? text });
            continue;
          }
        }
        if (node.children) walk(node.children);
      }
    };
    walk(tree.children as unknown as AnyNode[]);

    const astro = ((file.data as AstroVFileData).astro ??= {});
    const toc: TocData = { entries };
    astro.frontmatter = { ...(astro.frontmatter ?? {}), toc };
  };
}

export const EMPTY_TOC: TocData = { entries: [] };

/** The sections ToC out of remarkPluginFrontmatter; EMPTY_TOC when absent. */
export function getTocFromFrontmatter(remarkPluginFrontmatter: Record<string, unknown>): TocData {
  const toc = remarkPluginFrontmatter['toc'];
  if (toc && typeof toc === 'object' && Array.isArray((toc as TocData).entries)) {
    return toc as TocData;
  }
  return EMPTY_TOC;
}

/** Same reader under the name the chapters preset uses (lib/toc.ts); the two
 *  are imported from different subpaths. */
export const getToc = getTocFromFrontmatter;
