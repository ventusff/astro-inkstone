/**
 * rehype-tbl-wrap — give every table in the content its own scroll box, and
 * the markup it needs to be re-laid-out as cards. Markdown tables arrive as
 * hast elements; a `<table>` written by hand in MDX arrives as JSX and is
 * normalized to elements first (see `fromJsx`).
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
import { h } from 'hastscript';
import type { Element, Root } from 'hast';

type AnyNode = { type: string; children?: AnyNode[] } & Record<string, unknown>;
type JsxAttribute = { type: 'mdxJsxAttribute'; name: string; value?: string | null | { type: string } };
type JsxNode = AnyNode & { name?: string | null; attributes?: Array<{ type: string }> };

const isJsx = (node: AnyNode | undefined, name?: string): boolean =>
  !!node &&
  (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
  (!name || (node as JsxNode).name === name);

/**
 * A `<table>` written by hand in MDX is a JSX subtree, not a hast element.
 * When every tag is a plain HTML tag and every attribute a literal, the
 * subtree becomes the element tree the wrapper works on, so the author gets
 * the same frame, roles and card form as a Markdown table. A component, an
 * expression attribute or an expression child anywhere inside leaves the
 * table as it is: the stylesheet's own-scroll-box fallback covers it.
 */
function fromJsx(node: AnyNode): AnyNode | null {
  if (node.type === 'text' || node.type === 'comment') return node;
  if (node.type === 'element' || isJsx(node)) {
    const children: AnyNode[] = [];
    for (const c of node.children ?? []) {
      const converted = fromJsx(c);
      if (!converted) return null;
      children.push(converted);
    }
    if (node.type === 'element') return { ...node, children };
    const jsx = node as JsxNode;
    if (!jsx.name || !/^[a-z][a-z0-9]*$/.test(jsx.name)) return null;
    const props: Record<string, string | boolean> = {};
    for (const attr of jsx.attributes ?? []) {
      if (attr.type !== 'mdxJsxAttribute') return null;
      const { name, value } = attr as JsxAttribute;
      if (value !== null && value !== undefined && typeof value !== 'string') return null;
      props[name] = value ?? true;
    }
    return h(jsx.name, props, children as never) as unknown as AnyNode;
  }
  return null;
}

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

/** true when any cell spans rows or columns (rowspan="0" spans all
 *  remaining rows of its row group per HTML, so 0 counts as spanning) */
function hasSpans(table: Element): boolean {
  let found = false;
  const walk = (node: AnyNode): void => {
    if (found) return;
    if (isEl(node, 'td') || isEl(node, 'th')) {
      const props = (node as unknown as Element).properties ?? {};
      const span = (v: unknown): number => (typeof v === 'string' || typeof v === 'number' ? Number(v) : 1);
      const rows = span(props['rowSpan']);
      if (rows === 0 || rows > 1 || span(props['colSpan']) > 1) found = true;
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
        let child = children[i];
        if (!child) continue;
        if (isJsx(child, 'table')) {
          const converted = fromJsx(child);
          if (converted) children[i] = child = converted;
        }
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
