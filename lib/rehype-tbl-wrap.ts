/**
 * rehype-tbl-wrap — give every markdown table its own scroll box, and the
 * markup it needs to be re-laid-out as cards.
 *
 * Emits `<div class="tbl-wrap [wide|wide-narrow]"><div class="tbl-scroll">`
 * around the table and tags it `.tbl`. Six-or-more-column tables get `.wide`,
 * four-or-five-column ones `.wide-narrow`: below a container width those two
 * become one card per row (the `@container tbl` block in styles/base.css);
 * two- and three-column tables stay tables. A table with a spanning cell
 * (rowspan / colspan) has no card form: it is wrapped and scrolls only.
 *
 * Written into the markup because a stylesheet cannot:
 *   1. `data-label` on every body cell — its column's header text, printed
 *      in the card form by `td::before { content: attr(data-label) }`;
 *   2. explicit ARIA roles on every part of the table, so the row/column
 *      relationships survive the card form's non-table display.
 *
 * The row header of a body row is its `<th>` when it has one, else its first
 * cell (a table's first column is the row's key); the card form uses it as
 * the card's title.
 */
import type { Element, Root } from 'hast';

type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;

/** from this many columns the table reflows into cards below the wide threshold */
const WIDE_AT = 6;
/** from this many columns it reflows below the narrow threshold */
const WIDE_AT_NARROW = 4;

const isEl = (node: AnyNode | undefined, tag?: string): boolean =>
  !!node && node.type === 'element' && (!tag || (node as unknown as Element).tagName === tag);

/** child elements of `node` whose tagName is in `tags` */
function kids(node: AnyNode, tags: string[]): Element[] {
  const out: Element[] = [];
  for (const c of node.children ?? [])
    if (isEl(c) && tags.includes((c as unknown as Element).tagName)) out.push(c as unknown as Element);
  return out;
}

/** plain text of a subtree — headers may hold `<code>`/`<strong>` */
function textOf(node: AnyNode): string {
  if (node.type === 'text') return String((node as { value?: unknown }).value ?? '');
  let s = '';
  for (const c of node.children ?? []) s += textOf(c);
  return s;
}

/** true when any cell spans rows or columns */
function hasSpans(table: Element): boolean {
  let found = false;
  const walk = (node: AnyNode): void => {
    if (found) return;
    if (isEl(node, 'td') || isEl(node, 'th')) {
      const props = (node as unknown as Element).properties ?? {};
      const span = (v: unknown): number => (typeof v === 'string' || typeof v === 'number' ? Number(v) : 1);
      if (span(props['rowSpan']) > 1 || span(props['colSpan']) > 1) found = true;
      return;
    }
    for (const c of node.children ?? []) walk(c);
  };
  walk(table as unknown as AnyNode);
  return found;
}

/** column count = cells in the first row that has any */
function columnCount(table: Element): number {
  let n = 0;
  const walk = (node: AnyNode): boolean => {
    if (isEl(node, 'tr')) {
      n = kids(node, ['th', 'td']).length;
      return true;
    }
    for (const c of node.children ?? []) if (walk(c)) return true;
    return false;
  };
  walk(table as unknown as AnyNode);
  return n;
}

/** roles on every part of the table + `data-label` on every body cell */
function annotate(table: Element): void {
  (table.properties ??= {})['role'] = 'table';

  const sections = kids(table as unknown as AnyNode, ['thead', 'tbody', 'tfoot']);
  const labels: string[] = [];
  // pass 1 — the column names, from the header row(s)
  for (const head of sections.filter((s) => s.tagName === 'thead'))
    for (const row of kids(head as unknown as AnyNode, ['tr']))
      kids(row as unknown as AnyNode, ['th', 'td']).forEach((cell, i) => {
        const text = textOf(cell as unknown as AnyNode).trim();
        if (text) labels[i] ??= text;
      });

  // pass 2 — roles everywhere, labels on the body
  for (const section of sections) {
    (section.properties ??= {})['role'] = 'rowgroup';
    const header = section.tagName === 'thead';
    for (const row of kids(section as unknown as AnyNode, ['tr'])) {
      (row.properties ??= {})['role'] = 'row';
      kids(row as unknown as AnyNode, ['th', 'td']).forEach((cell, i) => {
        const props = (cell.properties ??= {});
        if (header) {
          props['role'] = 'columnheader';
          return;
        }
        props['role'] = cell.tagName === 'th' || i === 0 ? 'rowheader' : 'cell';
        const label = labels[i];
        if (label) props['data-label'] = label;
      });
    }
  }
}

export function rehypeTblWrap() {
  return function transform(tree: Root): void {
    const walk = (node: AnyNode): void => {
      const children = node.children;
      if (!children) return;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child) continue;
        if (isEl(child, 'table')) {
          const table = child as unknown as Element;
          const props = (table.properties ??= {});
          const cls = props['className'];
          const classes = Array.isArray(cls) ? cls.map(String) : [];
          if (!classes.includes('tbl')) classes.push('tbl');
          props['className'] = classes;
          annotate(table);

          const wrapperClasses = ['tbl-wrap'];
          const cols = columnCount(table);
          if (!hasSpans(table)) {
            if (cols >= WIDE_AT) wrapperClasses.push('wide');
            else if (cols >= WIDE_AT_NARROW) wrapperClasses.push('wide-narrow');
          }
          children[i] = {
            type: 'element',
            tagName: 'div',
            properties: { className: wrapperClasses },
            children: [
              {
                type: 'element',
                tagName: 'div',
                properties: { className: ['tbl-scroll'] },
                children: [table],
              },
            ],
          } as unknown as AnyNode;
          continue; // do not descend into the table we just wrapped
        }
        walk(child);
      }
    };
    walk(tree as unknown as AnyNode);
  };
}
