/**
 * heading-core — what the two numbering presets (rehype-chapters /
 * rehype-sections) share: the anchor slug, the visible heading text, the
 * heading-attribute contract and the id assignment rule.
 *
 * `slugify` is the single source of truth for anchor ids: both presets, the
 * wikilink anchor rule and any site-side anchor derivation use this one
 * implementation, so a `[[note#anchor]]` always lands on the id the heading
 * actually carries.
 */
import type { Element, Properties, Text } from 'hast';

export type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[\s·/]+/g, '-')
      .replace(/[^\p{L}\p{N}-]+/gu, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section'
  );
}

/**
 * Visible heading text before a section number is injected. Inline math is
 * kept verbatim as `$tex$`, so a ToC label preserves the raw TeX.
 */
export function headingText(node: Element): string {
  let out = '';
  const walk = (n: AnyNode): void => {
    if (n.type === 'text') {
      out += (n as unknown as Text).value;
      return;
    }
    const el = n as unknown as Element;
    const cls = el.properties?.['className'];
    const classes = Array.isArray(cls) ? cls : [];
    if (n.type === 'element' && classes.includes('math-inline')) {
      let tex = '';
      for (const c of el.children ?? []) if (c.type === 'text') tex += c.value;
      out += `$${tex}$`;
      return;
    }
    for (const c of n.children ?? []) walk(c as AnyNode);
  };
  for (const c of node.children) walk(c as unknown as AnyNode);
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * The heading attributes written by remark-heading-attrs (`toc="…"`,
 * `notoc`), read and removed from the element in one step so they never
 * reach the HTML.
 */
export function takeHeadingAttrs(props: Properties): { tocLabel: string | undefined; notoc: boolean } {
  const label = props['dataToc'];
  const notoc = props['dataNotoc'] !== undefined;
  delete props['dataToc'];
  delete props['dataNotoc'];
  return { tocLabel: typeof label === 'string' && label !== '' ? label : undefined, notoc };
}

/**
 * The id of a heading: an explicit id is kept and must be unique on the
 * page (two headings with the same explicit id would split one anchor
 * between two targets, so that is an error); a generated id is the slug of
 * the text, suffixed `-2`, `-3`, … when the slug is already taken.
 */
export function assignHeadingId(props: Properties, text: string, used: Set<string>, where: string): string {
  const explicit = typeof props['id'] === 'string' ? props['id'] : '';
  if (explicit) {
    if (used.has(explicit)) {
      throw new Error(`${where}: duplicate heading id "#${explicit}" — explicit ids must be unique on a page`);
    }
    used.add(explicit);
    return explicit;
  }
  const base = slugify(text);
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  props['id'] = id;
  used.add(id);
  return id;
}

/** `<span class="num">…</span>`, the injected section number */
export function numberNode(num: string): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: { className: ['num'] },
    children: [{ type: 'text', value: num }],
  };
}

/** 1 → I, 4 → IV, 21 → XXI … (1–3999) */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999) return String(n);
  const table: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [value, glyph] of table) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/** 1 → A, 26 → Z, 27 → AA, 28 → AB … (spreadsheet column letters) */
export function letter(n: number): string {
  if (!Number.isInteger(n) || n < 1) return String(n);
  let out = '';
  let rest = n;
  while (rest > 0) {
    rest -= 1;
    out = String.fromCharCode(65 + (rest % 26)) + out;
    rest = Math.floor(rest / 26);
  }
  return out;
}
