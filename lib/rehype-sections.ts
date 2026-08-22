/**
 * rehype-sections — build-time section numbering + ToC extraction.
 * This is the "sections" numbering preset; the alternative "chapters" preset
 * (parts, appendices, § cross-references) lives in ./rehype-chapters.ts —
 * pick one per site via siteMarkdown({ numbering }).
 *
 * One rule, applied to the page's own headings: h2 gets `1, 2, 3…`, h3 gets
 * `<h2>.<n>`. The number is injected as `<span class="num">` (the source MDX
 * stays number-free — numbering comes from position, and a hand-typed
 * coordinate goes stale silently). Headings without an id get a slug.
 *
 * The computed ToC is written to `remarkPluginFrontmatter.toc`, and that is
 * what the sidebar and the in-page jump list read. Astro's own `headings`
 * array is deliberately NOT used downstream: its `text` is collected from the
 * rendered heading and would contain the injected number.
 *
 * Order matters: this must run BEFORE `rehypeWikiBlocks` (which stamps final
 * top-level blocks with their source line range and therefore has to be last),
 * and before `rehypeTblWrap` is irrelevant either way.
 */
import type { Element, Root, Text } from 'hast';

import { headingText, slugify } from './heading-core';

export { slugify }; // compatibility re-export: this module has always been its import site

/*
 * The sections preset's ToC shapes are inlined here. ./toc-types.ts belongs
 * to the chapters preset (TocItem / items / numbers) — the two structures
 * share names but not shape, so each preset stays self-contained.
 */
export interface TocEntry {
  depth: 2 | 3;
  /** heading anchor id */
  id: string;
  /** printed section number: '1', '1.2' */
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

type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;


export function rehypeSections() {
  return function transform(tree: Root, file: { data: unknown }): void {
    const entries: TocEntry[] = [];
    const used = new Set<string>();
    let h2 = 0;
    let h3 = 0;

    for (const node of tree.children as unknown as AnyNode[]) {
      if (node.type !== 'element') continue;
      const el = node as unknown as Element;
      const depth = el.tagName === 'h2' ? 2 : el.tagName === 'h3' ? 3 : 0;
      if (depth === 0) continue;

      const label = headingText(el);
      let num: string;
      if (depth === 2) {
        h2 += 1;
        h3 = 0;
        num = String(h2);
      } else {
        // an h3 before any h2 has no parent to hang off — leave it unnumbered
        if (h2 === 0) continue;
        h3 += 1;
        num = `${h2}.${h3}`;
      }

      const props = (el.properties ??= {});
      let id = typeof props['id'] === 'string' ? props['id'] : '';
      if (!id) {
        id = slugify(label);
        let n = 2;
        while (used.has(id)) id = `${slugify(label)}-${n++}`;
        props['id'] = id;
      }
      used.add(id);

      el.children.unshift({
        type: 'element',
        tagName: 'span',
        properties: { className: ['num'], 'aria-hidden': 'true' },
        children: [{ type: 'text', value: num }],
      } as Element);

      entries.push({ depth: depth as 2 | 3, id, num, label });
    }

    const astro = ((file.data as AstroVFileData).astro ??= {});
    const toc: TocData = { entries };
    astro.frontmatter = { ...(astro.frontmatter ?? {}), toc };
  };
}

export const EMPTY_TOC: TocData = { entries: [] };

/** Narrowing helper: pull the typed ToC out of remarkPluginFrontmatter.
 *  (Reader for the sections preset; the chapters preset has its own getToc
 *  in lib/toc.ts.) */
export function getTocFromFrontmatter(remarkPluginFrontmatter: Record<string, unknown>): TocData {
  const toc = remarkPluginFrontmatter['toc'];
  if (toc && typeof toc === 'object' && Array.isArray((toc as TocData).entries)) {
    return toc as TocData;
  }
  return EMPTY_TOC;
}

/** Compatibility alias. Same name as the chapters preset's getToc in
 *  lib/toc.ts but a different return shape; they are imported from different
 *  subpaths and never collide. */
export const getToc = getTocFromFrontmatter;
