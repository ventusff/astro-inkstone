import assert from 'node:assert/strict';
import { test } from 'node:test';

import { estimateLabelWidth, labelAnchor, portFractions, renderFlowDiagram, routeBetween, sidesOf, toneColor } from '../lib/flow-diagram.ts';

const box = (x: number, y: number, w = 100, h = 40) => ({ x, y, w, h });

test('routeBetween: the grid rows decide the direction, the boxes only the coordinates', () => {
  // same row, very different heights: still a level line, inside both boxes
  assert.deepEqual(routeBetween(box(0, 0, 100, 40), box(300, 0, 100, 160), 0), [[100, 20], [300, 20]]);
  assert.deepEqual(routeBetween(box(300, 0, 100, 160), box(0, 0, 100, 40), 0), [[300, 20], [100, 20]]);
  // next row, columns overlap: straight down the shared width
  assert.deepEqual(routeBetween(box(100, 0, 200, 40), box(0, 100, 200, 40), 1), [[150, 40], [150, 100]]);
  // next row, columns apart: across in the gap right above the target, off its middle
  assert.deepEqual(routeBetween(box(0, 0), box(300, 200), 2, 40), [[50, 40], [50, 186], [350, 186], [350, 200]]);
  // a row up: mirrored
  assert.deepEqual(routeBetween(box(300, 200), box(0, 0), -2, 40), [[350, 200], [350, 54], [50, 54], [50, 40]]);
});

test('two wires meeting one side of a box get their own points, ordered so they do not cross', () => {
  assert.deepEqual(portFractions([300]), [0.5]);
  assert.deepEqual(portFractions([500, 100]), [2 / 3, 1 / 3]);
  // two sources above one target: one enters a third of the way along, the other two thirds — no shared stretch
  const target = box(100, 200, 300, 40);
  const left = routeBetween(box(0, 0), target, 1, 40, { from: 0.5, to: 1 / 3 });
  const right = routeBetween(box(400, 0), target, 1, 40, { from: 0.5, to: 2 / 3 });
  assert.notDeepEqual(left.at(-1), right.at(-1));
  assert.deepEqual(sidesOf(box(0, 0), target, 1), { from: 'bottom', to: 'top' });
  assert.deepEqual(sidesOf(box(500, 0), box(0, 0), 0), { from: 'left', to: 'right' });
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
