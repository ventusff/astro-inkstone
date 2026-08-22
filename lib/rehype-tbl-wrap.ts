/**
 * rehype-tbl-wrap — give every markdown table its own scroll box, and the
 * markup it needs to survive being re-laid-out as cards.
 *
 * Emits `<div class="tbl-wrap [wide|wide-narrow]"><div class="tbl-scroll">`
 * around the table and tags it `.tbl`. Six-or-more-column tables get `.wide`,
 * four-or-five-column ones `.wide-narrow`: below a container width those two
 * turn into one-card-per-row (see the `@container tbl` block in
 * styles/base.css), while two- and three-column tables stay tables, which is
 * what they should be.
 *
 * Two things the stylesheet cannot do for itself, and so are done here:
 *
 *   1. `data-label` on every body cell — the column's own header text, so the
 *      card form can print "field — value" with `td::before{content:attr()}`.
 *      Written at build time — no client JS required.
 *   2. Explicit ARIA roles on the whole table. Changing `display` away from
 *      `table` strips the implicit roles, and with them every row/column
 *      relationship a screen reader has — a card grid would be announced as an
 *      undifferentiated pile of text. `role="table"` etc. put them back, and
 *      they are correct in the table form too, so they are unconditional.
 *
 * The first cell of each body row is `role="rowheader"`: the writing
 * convention is that a table's first column is the row's key (term, name,
 * id), and it is what the card form uses as the card's title.
 */
import type { Element, Root } from 'hast';

type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;

const WIDE_AT = 6;
/** Narrow-container threshold: a desktop column fits five columns, a phone
 *  does not — from four columns up the table should reflow into cards rather
 *  than squeeze every cell down to a couple of words. Separate class names so
 *  the stylesheet can pick by container width. */
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
        props['role'] = i === 0 ? 'rowheader' : 'cell';
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
          if (cols >= WIDE_AT) wrapperClasses.push('wide');
          else if (cols >= WIDE_AT_NARROW) wrapperClasses.push('wide-narrow');
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
