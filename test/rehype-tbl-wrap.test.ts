import assert from 'node:assert/strict';
import { test } from 'node:test';
import { h } from 'hastscript';
import type { Element, Root } from 'hast';

import { rehypeTblWrap } from '../lib/rehype-tbl-wrap.ts';

const table = (cols: number, rows = 1, extra: Record<string, unknown> = {}) =>
  h('table', [
    h('thead', [h('tr', Array.from({ length: cols }, (_, i) => h('th', `H${i}`)))]),
    h('tbody', Array.from({ length: rows }, () => h('tr', Array.from({ length: cols }, (_, i) => h('td', extra, `v${i}`))))),
  ]);
const wrap = (t: Element): Element => {
  const tree = { type: 'root', children: [t] } as unknown as Root;
  rehypeTblWrap()(tree);
  return tree.children[0] as Element;
};
const classes = (el: Element): string[] => (el.properties?.['className'] as string[]) ?? [];

test('the wrapper pair, and the card classes by column count', () => {
  const w = wrap(table(6));
  assert.deepEqual(classes(w), ['tbl-wrap', 'wide']);
  const scroll = w.children[0] as Element;
  assert.deepEqual(classes(scroll), ['tbl-scroll']);
  assert.equal((scroll.children[0] as Element).tagName, 'table');
  assert.deepEqual(classes(wrap(table(4))), ['tbl-wrap', 'wide-narrow']);
  assert.deepEqual(classes(wrap(table(3))), ['tbl-wrap']);
});

test('roles and data-label on every body cell; a spanning table has no card form', () => {
  const w = wrap(table(6));
  const t = (w.children[0] as Element).children[0] as Element;
  assert.equal(t.properties?.['role'], 'table');
  const body = t.children[1] as Element;
  const row = body.children[0] as Element;
  const cells = row.children as Element[];
  assert.equal(cells[0]!.properties?.['role'], 'rowheader');
  assert.equal(cells[1]!.properties?.['role'], 'cell');
  assert.equal(cells[1]!.properties?.['data-label'], 'H1');
  const spanning = wrap(table(6, 1, { colSpan: 2 }));
  assert.deepEqual(classes(spanning), ['tbl-wrap']);
});

test('rowspan="0" spans all remaining rows per HTML — the table has no card form', () => {
  for (const rowSpan of ['0', 0]) {
    const w = wrap(table(6, 2, { rowSpan }));
    assert.deepEqual(classes(w), ['tbl-wrap']);
  }
});

type Jsx = { type: 'mdxJsxFlowElement' | 'mdxJsxTextElement'; name: string; attributes: unknown[]; children: unknown[] };
const jsx = (name: string, attributes: Record<string, unknown>, children: unknown[], text = false): Jsx => ({
  type: text ? 'mdxJsxTextElement' : 'mdxJsxFlowElement',
  name,
  attributes: Object.entries(attributes).map(([n, value]) => ({ type: 'mdxJsxAttribute', name: n, value })),
  children,
});
const wrapAny = (node: unknown): Element => {
  const tree = { type: 'root', children: [node] } as unknown as Root;
  rehypeTblWrap()(tree);
  return tree.children[0] as Element;
};

test('a <table> written by hand in MDX gets the same frame as a Markdown table', () => {
  const row = (cells: unknown[]) => jsx('tr', {}, cells);
  const t = jsx('table', { class: 'tbl' }, [
    jsx('thead', {}, [row([jsx('th', {}, [{ type: 'text', value: 'Name' }]), jsx('th', {}, [{ type: 'text', value: 'Size' }])])]),
    { type: 'text', value: '\n' },
    jsx('tbody', {}, [row([jsx('td', {}, [jsx('b', {}, [{ type: 'text', value: 'a' }], true)]), jsx('td', { colspan: '1' }, [{ type: 'text', value: '1' }])])]),
  ]);
  const w = wrapAny(t);
  assert.deepEqual(classes(w), ['tbl-wrap']);
  const table = (w.children[0] as Element).children[0] as Element;
  assert.equal(table.type, 'element');
  assert.equal(table.tagName, 'table');
  assert.deepEqual(classes(table), ['tbl']);
  assert.equal(table.properties?.['role'], 'table');
  const body = table.children[2] as Element;
  const cells = (body.children[0] as Element).children as Element[];
  assert.equal(cells[0]!.properties?.['role'], 'rowheader');
  assert.equal((cells[0]!.children[0] as Element).tagName, 'b');
  assert.equal(cells[1]!.properties?.['colSpan'], 1);
  assert.equal(cells[1]!.properties?.['data-label'], 'Size');
});

test('a hand-written table holding an expression or a component is left as it is', () => {
  const expr = jsx('table', {}, [jsx('tbody', {}, [jsx('tr', {}, [jsx('td', {}, [{ type: 'mdxTextExpression', value: 'x' }])])])]);
  assert.equal((wrapAny(expr) as unknown as Jsx).type, 'mdxJsxFlowElement');
  const component = jsx('table', {}, [jsx('tbody', {}, [jsx('Row', {}, [])])]);
  assert.equal((wrapAny(component) as unknown as Jsx).type, 'mdxJsxFlowElement');
  const dynamic = jsx('table', { class: { type: 'mdxJsxAttributeValueExpression', value: 'c' } }, []);
  assert.equal((wrapAny(dynamic) as unknown as Jsx).type, 'mdxJsxFlowElement');
});
