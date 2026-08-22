/**
 * heading-core — shared core of the two numbering presets (rehype-chapters /
 * rehype-sections).
 *
 * `slugify` is the single source of truth for anchor ids across the whole
 * family: wikilinks' `slugifyAnchor`, both presets' heading ids, and any
 * site-side anchor derivation must all use this one implementation. Two
 * copies drift eventually, and the cost of drift is a silent broken link —
 * a [[wikilink]] jumping to an anchor that doesn't exist.
 *
 * `headingText` returns the visible heading text before section numbers are
 * injected; inline math is preserved verbatim as `$tex$` so ToC labels keep
 * their raw TeX (for headings without math it behaves like a plain text
 * collector).
 */
import type { Element, Text } from 'hast';

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
