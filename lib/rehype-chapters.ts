/**
 * rehype-chapters — build-time auto numbering + ToC extraction.
 *
 * Runs BEFORE rehype-katex (so heading text still carries raw TeX in
 * `span.math-inline` nodes) and understands the MDX-flavored hast tree
 * (mdxJsxFlowElement nodes survive until JSX compilation).
 *
 * Responsibilities:
 *  1. `<Part title="Partitioning" zh="第三部" />` markers start a numbered
 *     part; the plugin injects a computed `num` attribute ("III") so the
 *     Part component renders "PART III · Partitioning". `<Part appendix …/>`
 *     switches to letter numbering (§A, §B, …).
 *  2. h2 headings get chapter numbers:
 *       - page without parts:          §1, §2, …
 *       - inside part k:               §k.1, §k.2, …
 *       - inside the appendix part:    §A, §B, …
 *       - a chapter page of a hub note, with frontmatter `part: k` (and no
 *         Part markers):               §k.1, §k.2, …
 *       - before the first part:       unnumbered
 *     The number is injected as `<span class="num">…</span>`; headings in
 *     the source MDX stay number-free (numbering is never hardcoded).
 *  3. Headings without an explicit id get a slug.
 *  4. In-page reference links with literal text `§` (or `§§`) get their text
 *     replaced by the target's computed number (or number + label).
 *  5. `<Hero tocLabel="…" />` contributes an unnumbered ToC row (id "intro").
 *  6. The full ToC tree is exposed via `remarkPluginFrontmatter.toc`.
 */
import type { Element, Root } from 'hast';
import type { VFile } from 'vfile';

import type { TocData, TocItem } from './toc-types';

import { type AnyNode, headingText, slugify } from './heading-core';

export { slugify }; // compatibility re-export: this module has always been its import site

/* ------------------------------------------------------------------ */
/* minimal structural types for MDX JSX nodes (avoid extra deps)      */
interface MdxJsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value?: string | null | { type: string; value?: string };
}
interface MdxJsxFlowElement {
  type: 'mdxJsxFlowElement';
  name: string | null;
  attributes: MdxJsxAttribute[];
  children: unknown[];
}


/* ------------------------------------------------------------------ */
const ROMAN = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
  'XVII',
  'XVIII',
  'XIX',
  'XX',
] as const;

export function roman(n: number): string {
  return ROMAN[n] ?? String(n);
}

function letter(n: number): string {
  return String.fromCharCode(64 + n); // 1 → A
}

function jsxAttr(node: MdxJsxFlowElement, name: string): string | boolean | undefined {
  const attr = node.attributes.find(
    (a) => a.type === 'mdxJsxAttribute' && a.name === name,
  );
  if (!attr) return undefined;
  if (attr.value === null || attr.value === undefined) return true; // bare flag
  if (typeof attr.value === 'string') return attr.value;
  return attr.value.value;
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
            const isAppendix = jsxAttr(jsx, 'appendix') === true;
            const title = String(jsxAttr(jsx, 'title') ?? '');
            if (isAppendix) {
              inAppendix = true;
            } else {
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
            const tocLabel = jsxAttr(jsx, 'tocLabel');
            if (typeof tocLabel === 'string' && tocLabel !== '') {
              const id = String(jsxAttr(jsx, 'id') ?? 'intro');
              if (!jsxAttr(jsx, 'id')) {
                jsx.attributes.push({ type: 'mdxJsxAttribute', name: 'id', value: id });
              }
              items.push({ kind: 'entry', depth: 2, id, num: '', label: tocLabel });
              usedIds.add(id);
            }
          }
          // descend into JSX children (e.g. headings inside <Grid>)
          if (node.children) walk(node.children);
          continue;
        }

        if (node.type === 'element') {
          const el = node as unknown as Element;
          if (el.tagName === 'h2' || el.tagName === 'h3') {
            el.properties ??= {};
            const props = el.properties;
            const label0 = props['dataToc'];
            const notoc = props['dataNotoc'] !== undefined;
            delete props['dataToc'];
            delete props['dataNotoc'];

            const text = headingText(el);
            let id = typeof props['id'] === 'string' ? props['id'] : '';
            if (id === '') {
              const base = slugify(text);
              id = base;
              let i = 2;
              while (usedIds.has(id)) id = `${base}-${i++}`;
              props['id'] = id;
            }
            usedIds.add(id);

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
              el.children.unshift({
                type: 'element',
                tagName: 'span',
                properties: { className: ['num'] },
                children: [{ type: 'text', value: num }],
              });
            }
            if (!notoc) {
              items.push({
                kind: 'entry',
                depth: el.tagName === 'h2' ? 2 : 3,
                id,
                num,
                label: typeof label0 === 'string' && label0 !== '' ? label0 : text,
              });
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
                  `[rehype-chapters] ${file.path ?? ''}: reference link [${only.value}](#${target}) ` +
                    `points to an anchor with no computed number`,
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
