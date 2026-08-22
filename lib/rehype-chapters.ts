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
 *  5. Every `<Hero>`'s effective id (its `id` attribute, default "intro")
 *     is reserved in the page's id space; `tocLabel="…"` additionally adds
 *     an unnumbered ToC row.
 *  6. The ToC tree is exposed as `remarkPluginFrontmatter.toc`.
 */
import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';

import type { TocData, TocItem } from './toc-types.ts';

import {
  type AnyNode,
  assignHeadingId,
  headingText,
  jsxAttr,
  letter,
  type MdxJsxFlowElement,
  numberNode,
  reserveHeroId,
  roman,
  slugify,
  takeHeadingAttrs,
} from './heading-core.ts';

export { roman, slugify };

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
    // `part` prints into every chapter number of the page, so a value that
    // is not a positive integer is a frontmatter error, not data
    const fmPartRaw = fm['part'];
    let fmPart: number | null = null;
    if (fmPartRaw !== undefined) {
      if (typeof fmPartRaw !== 'number' || !Number.isInteger(fmPartRaw) || fmPartRaw < 1) {
        throw new Error(
          `${where}: frontmatter part must be a positive integer (the chapter's 1-based position in its hub), got ${String(fmPartRaw)}`,
        );
      }
      fmPart = fmPartRaw;
    }
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
              // the switch to letters resets the counter once: a further
              // appendix Part continues the letter sequence (§C after §B),
              // it does not restart at §A
              if (!inAppendix) {
                inAppendix = true;
                chapterIdx = 0;
              }
            } else {
              if (inAppendix) {
                throw new Error(
                  `${where}: a numbered <Part> follows an appendix — appendix parts must come last on the page`,
                );
              }
              partIdx += 1;
              chapterIdx = 0;
            }
            // appendix banner text = its title (or appendixLabel); parts get PART <roman>
            const num = isAppendix ? title || appendixLabel : `PART ${roman(partIdx)}`;
            jsx.attributes.push({ type: 'mdxJsxAttribute', name: 'num', value: num });
            items.push({ kind: 'group', num, label: isAppendix ? '' : title });
            continue;
          }
          if (jsx.name === 'Hero') {
            // every Hero's effective id — the component default `intro`
            // included — is reserved, ToC-labelled or not, so no heading
            // can end up sharing the Hero's anchor
            const id = reserveHeroId(jsx, usedIds, where);
            const tocLabel = jsxAttr(jsx, 'tocLabel', where);
            if (typeof tocLabel === 'string' && tocLabel !== '') {
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
