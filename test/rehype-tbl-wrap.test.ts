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
