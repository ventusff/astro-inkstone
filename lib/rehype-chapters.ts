/**
 * rehype-chapters — build-time chapter numbering + ToC extraction: the
 * "chapters" numbering preset (parts, appendices, § cross-references).
 *
 * Runs before rehype-katex (heading text still carries raw TeX in
 * `span.math-inline`) and walks the MDX-flavored hast tree (mdxJsxFlowElement
 * nodes survive until JSX compilation).
 *
 *  1. `<Part title="Partitioning" />` starts a numbered part; the plugin
 *     injects `num` ("PART III") for the Part component to render, and adds
 *     a group row to the ToC. `<Part appendix />` switches to letters (§A,
 *     §B, …; its banner is `title` or the `appendixLabel` option) and is
 *     terminal: a numbered part after an appendix is an error. Attributes
 *     the plugin consumes (Part `title`/`appendix`, Hero `tocLabel`/`id`)
 *     must be static — a JSX expression value is an error.
 *  2. h2 headings get chapter numbers, injected as `<span class="num">`:
 *       - page without parts:            §1, §2, …
 *       - inside part k:                 §k.1, §k.2, …
 *       - inside the appendix:           §A, §B, …
 *       - a hub chapter page (frontmatter `part: k`, no Part markers):
 *                                        §k.1, §k.2, …
 *       - before the first part:         unnumbered
 *     Frontmatter `chapters: false` switches numbering off for the page.
 *  3. Every h2/h3 gets its id (heading-core.assignHeadingId) and a ToC row
 *     unless marked `notoc`; `toc="…"` labels the row.
 *  4. In-page links whose text is `§` (or `§§`) get the target's number (or
 *     number + label).
 *  5. `<Hero tocLabel="…" />` adds an unnumbered ToC row (id "intro").
 *  6. The ToC tree is exposed as `remarkPluginFrontmatter.toc`.
 */
import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';

import type { TocData, TocItem } from './toc-types.ts';

import {
  type AnyNode,
  assignHeadingId,
  headingText,
  letter,
  numberNode,
  roman,
  slugify,
  takeHeadingAttrs,
} from './heading-core.ts';

export { roman, slugify };

/* ------------------------------------------------------------------ */
/* structural types for the MDX JSX nodes the transform reads          */
interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  /** a string literal, a bare flag (null/undefined), or an expression node */
  value?: string | null | { type: string; value?: string };
}
interface MdxJsxFlowElement {
  type: 'mdxJsxFlowElement';
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: unknown[];
}

/** Read a consumed attribute: a string literal or a bare flag (`true`).
 *  An expression value is an error — the plugin runs at build time and
 *  cannot evaluate JSX, so consumed metadata must be static. */
function jsxAttr(node: MdxJsxFlowElement, name: string, where: string): string | boolean | undefined {
  const attr = node.attributes.find(
    (a) => a.type === 'mdxJsxAttribute' && a.name === name,
  );
  if (!attr) return undefined;
  if (attr.value === null || attr.value === undefined) return true; // bare flag
  if (typeof attr.value === 'string') return attr.value;
  throw new Error(
    `${where}: <${node.name}> attribute ${name}={…} is a JSX expression — build-time metadata must be a static string`,
  );
}

interface AstroVFileData {
  astro?: { frontmatter?: Record<string, unknown> };
}

export interface ChaptersOptions {
  /** banner text for an untitled `<Part appendix />`. Default 'Appendix' */
  appendixLabel?: string;
}

/* ------------------------------------------------------------------ */
export function rehypeChapters(options: ChaptersOptions = {}) {
  const appendixLabel = options.appendixLabel ?? 'Appendix';
  return function transform(tree: Root, file: VFile): void {
    const where = file.path ?? '(unknown file)';
    const fm = ((file.data as AstroVFileData).astro ??= {}).frontmatter ?? {};
    const fmPart = typeof fm['part'] === 'number' ? (fm['part'] as number) : null;
    const numbering = fm['chapters'] !== false;

    const items: TocItem[] = [];
    const numbers: Record<string, string> = {};
    const usedIds = new Set<string>();

    let partIdx = 0; // current part number (0 = before first part)
    let inAppendix = false;
    let chapterIdx = 0; // h2 counter within current context
    let sawPart = false;

    /* ---- pass 1: parts, headings, ids, numbers, toc ---- */
    const walk = (nodes: AnyNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'mdxJsxFlowElement') {
          const jsx = node as unknown as MdxJsxFlowElement;
          if (jsx.name === 'Part') {
            sawPart = true;
            const isAppendix = jsxAttr(jsx, 'appendix', where) === true;
            const title = String(jsxAttr(jsx, 'title', where) ?? '');
            if (isAppendix) {
              inAppendix = true;
            } else {
              if (inAppendix) {
                throw new Error(
                  `${where}: a numbered <Part> follows an appendix — appendix parts must come last on the page`,
                );
              }
              partIdx += 1;
            }
            chapterIdx = 0;
            // appendix banner text = its title (or appendixLabel); parts get PART <roman>
            const num = isAppendix ? title || appendixLabel : `PART ${roman(partIdx)}`;
            jsx.attributes.push({ type: 'mdxJsxAttribute', name: 'num', value: num });
            items.push({ kind: 'group', num, label: isAppendix ? '' : title });
            continue;
          }
          if (jsx.name === 'Hero') {
            const tocLabel = jsxAttr(jsx, 'tocLabel', where);
            if (typeof tocLabel === 'string' && tocLabel !== '') {
              const explicit = jsxAttr(jsx, 'id', where);
              const id = typeof explicit === 'string' && explicit !== '' ? explicit : 'intro';
              // the Hero id is a page anchor like any heading id: it goes
              // through the same used-id set, so a duplicate is an error
              assignHeadingId({ id }, tocLabel, usedIds, where);
              const idAttr = jsx.attributes.find((a) => a.type === 'mdxJsxAttribute' && a.name === 'id');
              if (idAttr) idAttr.value = id;
              else jsx.attributes.push({ type: 'mdxJsxAttribute', name: 'id', value: id });
              items.push({ kind: 'entry', depth: 2, id, num: '', label: tocLabel });
            }
          }
          // descend into JSX children (e.g. headings inside <Grid>)
          if (node.children) walk(node.children);
          continue;
        }

        if (node.type === 'element') {
          const el = node as unknown as Element;
          // GFM's footnote section carries a screen-reader-only heading; it is
          // neither a chapter nor a ToC row
          if (el.tagName === 'section' && el.properties?.['dataFootnotes'] !== undefined) continue;
          if (el.tagName === 'h2' || el.tagName === 'h3') {
            const props = (el.properties ??= {});
            const { tocLabel, notoc } = takeHeadingAttrs(props);
            const text = headingText(el);
            const id = assignHeadingId(props, text, usedIds, where);

            let num = '';
            if (el.tagName === 'h2' && numbering) {
              chapterIdx += 1;
              if (inAppendix) num = `§${letter(chapterIdx)}`;
              else if (sawPart && partIdx > 0) num = `§${partIdx}.${chapterIdx}`;
              else if (!sawPart && fmPart !== null) num = `§${fmPart}.${chapterIdx}`;
              else if (!sawPart) num = `§${chapterIdx}`;
              // (sawPart && partIdx === 0) → heading before first part: unnumbered
            }
            if (num !== '') {
              numbers[id] = num;
              el.children.unshift(numberNode(num));
            }
            if (!notoc) {
              items.push({ kind: 'entry', depth: el.tagName === 'h2' ? 2 : 3, id, num, label: tocLabel ?? text });
            }
            continue;
          }
        }
        if (node.children) walk(node.children);
      }
    };
    walk(tree.children as unknown as AnyNode[]);

    /* ---- pass 2: `[§](#anchor)` reference substitution ---- */
    const fixRefs = (nodes: AnyNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'element') {
          const el = node as unknown as Element;
          if (el.tagName === 'a') {
            const href = el.properties?.['href'];
            const only = el.children.length === 1 ? el.children[0] : undefined;
            if (
              typeof href === 'string' &&
              href.startsWith('#') &&
              only?.type === 'text' &&
              (only.value === '§' || only.value === '§§')
            ) {
              const target = href.slice(1);
              const num = numbers[target];
              if (num === undefined) {
                throw new Error(
                  `${where}: reference link [${only.value}](#${target}) points to an anchor with no computed number`,
                );
              }
              if (only.value === '§') only.value = num;
              else {
                const entry = items.find((i) => i.kind === 'entry' && i.id === target);
                only.value =
                  entry && entry.kind === 'entry' ? `${num} ${entry.label}` : num;
              }
            }
          }
        }
        if (node.children) fixRefs(node.children);
      }
    };
    fixRefs(tree.children as unknown as AnyNode[]);

    /* ---- expose ---- */
    const toc: TocData = { items, numbers };
    const astroData = (file.data as AstroVFileData).astro!;
    astroData.frontmatter = { ...fm, toc };
  };
}
