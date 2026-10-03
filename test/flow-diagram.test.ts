import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateLabelWidth, labelAnchor, renderFlowDiagram, routeBetween, toneColor } from '../lib/flow-diagram.ts';

const box = (x: number, y: number, w = 100, h = 40) => ({ x, y, w, h });

test('routeBetween: same row → facing edges at the shared height; different rows → bottom, across, top', () => {
  assert.deepEqual(routeBetween(box(0, 0), box(200, 4, 100, 60)), [[100, 27], [200, 27]]);
  assert.deepEqual(routeBetween(box(200, 0), box(0, 0)), [[200, 20], [100, 20]]);
  assert.deepEqual(routeBetween(box(0, 0), box(300, 200)), [[50, 40], [50, 120], [350, 120], [350, 200]]);
  assert.deepEqual(routeBetween(box(0, 200), box(0, 0)), [[50, 200], [50, 40]]);
});

test('labelAnchor sits above the longest horizontal segment, beside a vertical one', () => {
  const h = labelAnchor([[0, 10], [100, 10]]);
  assert.deepEqual([h.x, h.y, h.horizontal, h.length], [50, 3, true, 100]);
  const v = labelAnchor([[50, 0], [50, 10], [60, 10], [60, 200]]);
  assert.equal(v.horizontal, false);
  assert.equal(v.length, 190);
  assert.deepEqual([v.x, v.y], [68, 109]);
});

test('estimateLabelWidth counts CJK wider than Latin', () => {
  assert.equal(estimateLabelWidth('abcd'), 26);
  assert.equal(estimateLabelWidth('经 tailnet'), 11 + 6.5 * 8);
});

test('toneColor maps names to tokens and passes CSS colors through', () => {
  assert.equal(toneColor('admin'), 'var(--color-accent)');
  assert.equal(toneColor('#123456'), '#123456');
  assert.equal(toneColor(undefined), undefined);
});

test('renderFlowDiagram: grid columns, lane column, node placement, escaped text, spec in data-flow', () => {
  const html = renderFlowDiagram({
    cols: 2,
    lanes: [{ text: 'A', tone: 'colleague' }],
    heads: [{ row: 2, text: 'later' }],
    nodes: [
      { id: 'x', title: 'a <b>', lines: ['one', 'two'], tag: 'who', tone: 'admin', col: 1, row: 1 },
      { id: 'y', title: 'y', col: 2, row: 1, span: 1, ghost: true, mono: true },
    ],
    edges: [{ from: 'x', to: 'y', label: 'l', off: true }],
  });
  assert.match(html, /grid-template-columns:max-content repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(html, /class="flow-lane" style="grid-column:1;grid-row:1;color:var\(--color-accent2\)"/);
  assert.match(html, /class="flow-head" style="grid-row:2"/);
  assert.match(html, /data-node="x" style="grid-column:2 \/ span 1;grid-row:1;border-color:var\(--color-accent\)"><b>a &lt;b&gt;<\/b><small>one<\/small><small>two<\/small><span class="tag" style="color:var\(--color-accent\)">who<\/span>/);
  assert.match(html, /class="flow-node ghost mono" data-node="y" style="grid-column:3 \/ span 1;grid-row:1"/);
  assert.match(html, /<svg class="flow-wires" aria-hidden="true"><defs><marker id="flow-ar"/);
  const data = JSON.parse(html.match(/data-flow="([^"]+)"/)![1]!.replace(/&quot;/g, '"'));
  assert.deepEqual(data, { lanes: true, rows: [['x', 1], ['y', 1]], edges: [{ from: 'x', to: 'y', label: 'l', off: true }] });
});
