import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LABEL_GAPS_SHARE, LABEL_GAP_SHARE, LABEL_MIN_PX, LABEL_PX, columnGaps, detourBelow, labelLayouts, labelLines, portFractions, renderFlowDiagram, routeBetween, segmentPoint, segmentsByLength, sidesOf, toneColor, wrapLabel } from '../lib/flow-diagram.ts';
import { estimateTextWidth } from '../lib/text-width.ts';

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

test('a wire past boxes of its own row goes under the row, bottom to bottom', () => {
  assert.deepEqual(detourBelow(box(0, 0), box(400, 0), 60, 40), [[50, 40], [50, 76], [450, 76], [450, 40]]);
  assert.deepEqual(sidesOf(box(0, 0), box(400, 0), 0, true), { from: 'bottom', to: 'bottom' });
});

test('segmentsByLength and segmentPoint: segments longest first, a point along one, and which way it runs', () => {
  const segs = segmentsByLength([[50, 0], [50, 10], [60, 10], [60, 200], [60, 200]]);
  assert.deepEqual(segs.map((s) => [s.length, s.horizontal]), [[190, false], [10, false], [10, true]]);
  assert.deepEqual(segmentPoint(segs[0]!), { x: 60, y: 105, horizontal: false, length: 190 });
  assert.deepEqual(segmentPoint(segmentsByLength([[0, 10], [100, 10]])[0]!, 0.25), { x: 25, y: 10, horizontal: true, length: 100 });
});

test('labelLines: one line above or below a horizontal segment, beside a vertical one on either side', () => {
  const one = { px: LABEL_PX, lines: ['go'] };
  assert.deepEqual(labelLines({ x: 50, y: 10, horizontal: true }, 1, one), { anchor: 'middle', lines: [{ x: 50, y: 3, text: 'go' }] });
  assert.deepEqual(labelLines({ x: 50, y: 10, horizontal: true }, -1, one), { anchor: 'middle', lines: [{ x: 50, y: 26, text: 'go' }] });
  assert.deepEqual(labelLines({ x: 60, y: 105, horizontal: false }, 1, one), { anchor: 'start', lines: [{ x: 68, y: 109, text: 'go' }] });
  assert.deepEqual(labelLines({ x: 60, y: 105, horizontal: false }, -1, one), { anchor: 'end', lines: [{ x: 52, y: 109, text: 'go' }] });
});

test('labelLines: wrapped lines stack upward above a segment, downward below it, centred beside one', () => {
  const two = { px: LABEL_PX, lines: ['a', 'b'] };
  assert.deepEqual(labelLines({ x: 0, y: 100, horizontal: true }, 1, two).lines.map((l) => l.y), [80, 93]);
  assert.deepEqual(labelLines({ x: 0, y: 100, horizontal: true }, -1, two).lines.map((l) => l.y), [116, 129]);
  assert.deepEqual(labelLines({ x: 0, y: 100, horizontal: false }, 1, two).lines.map((l) => l.y), [97.5, 110.5]);
  assert.deepEqual(labelLines({ x: 0, y: 100, horizontal: true }, 0, two).lines.map((l) => l.y), [97.5, 110.5], 'on the wire, centred on it');
});

test('wrapLabel breaks Latin at spaces and full-width text between any two characters', () => {
  assert.deepEqual(wrapLabel('Cannot be used', 1000, LABEL_PX), ['Cannot be used']);
  assert.deepEqual(wrapLabel('Cannot be used', 46, LABEL_PX), ['Cannot', 'be used']);
  assert.deepEqual(wrapLabel('载荷变了', 22, LABEL_PX), ['载荷', '变了']);
  assert.equal(wrapLabel('Durch messbare Größen ersetzen', 30, LABEL_PX), null, 'a word wider than the room');
  assert.equal(wrapLabel('a b c d', 5, LABEL_PX), null, 'more than three lines');
});

test('labelLayouts: best first, shrinking only when wrapping is not enough, always one to draw', () => {
  const wide = labelLayouts('Cannot be used', 1000);
  assert.deepEqual(wide[0], { px: LABEL_PX, lines: ['Cannot be used'] });
  const narrow = labelLayouts('Cannot be used', 46);
  assert.deepEqual(narrow[0], { px: LABEL_PX, lines: ['Cannot', 'be used'] });
  const sentence = 'Rund um den Lippenrand ist der Spalt nirgends größer als 0,5 mm und der Generator läuft';
  const many = labelLayouts(sentence, 100);
  assert.equal(many.length, 2, 'more than three lines at the smallest size, then the narrowest three-line setting');
  assert.equal(many[0]?.px, LABEL_MIN_PX);
  assert.ok((many[0]?.lines.length ?? 0) > 3);
  assert.ok(many[0]!.lines.every((l) => estimateTextWidth(l, LABEL_MIN_PX) <= 100));
  const none = labelLayouts('Niemand gleicht ab', 10);
  assert.equal(none.length, 1);
  assert.equal(none[0]?.px, LABEL_MIN_PX);
  assert.deepEqual(none[0]?.lines, ['Niemand', 'gleicht', 'ab']);
});

test('estimateTextWidth counts full-width characters as one em, others about 0.59', () => {
  assert.equal(estimateTextWidth('abcd', 11), 26);
  assert.equal(estimateTextWidth('经 tailnet', 11), 11 + 6.5 * 8);
  assert.equal(estimateTextWidth('한글', 11), 22);
  assert.equal(estimateTextWidth('カナ', 11), 22);
  assert.equal(estimateTextWidth('ｱ', 11), 6.5);
  assert.equal(estimateTextWidth('䷀ꀀ𠀀', 11), 33);
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
  // a lane track and its gap, then box, gap, box; the labelled wire widens its gap to the label's width plus 16px
  assert.match(html, /grid-template-columns:max-content var\(--flow-col-gap\) minmax\(0, 1fr\) max\(var\(--flow-col-gap\), min\(23px, 25%\)\) minmax\(0, 1fr\)"/);
  assert.match(html, /class="flow-lane" style="grid-column:1;grid-row:1;color:var\(--color-accent2\)"/);
  assert.match(html, /class="flow-head" style="grid-row:2"/);
  assert.match(html, /data-node="x" style="grid-column:3 \/ span 1;grid-row:1;border-color:var\(--color-accent\)"><b>a &lt;b&gt;<\/b><small>one<\/small><small>two<\/small><span class="tag" style="color:var\(--color-accent\)">who<\/span>/);
  assert.match(html, /class="flow-node ghost mono" data-node="y" style="grid-column:5 \/ span 1;grid-row:1"/);
  assert.match(html, /<svg class="flow-wires" aria-hidden="true"><defs><\/defs><\/svg>/);
  // no ids in the markup: any number of diagrams share a page (arrowheads are made per diagram when it mounts)
  assert.doesNotMatch(html, /\sid="/);
  const data = JSON.parse(html.match(/data-flow="([^"]+)"/)![1]!.replace(/&quot;/g, '"'));
  assert.deepEqual(data, { lanes: true, rows: [['x', 1], ['y', 1]], edges: [{ from: 'x', to: 'y', label: 'l', off: true }] });
});

test('columnGaps: a labelled wire between neighbouring boxes of one row asks its gap for the label\'s width', () => {
  const node = (id: string, col: number, row = 1, span = 1) => ({ id, title: id, col, row, span });
  const spec = {
    cols: 4,
    nodes: [node('a', 1), node('b', 2, 1, 2), node('c', 4), node('d', 1, 2), node('e', 3, 2)],
    edges: [
      { from: 'b', to: 'a', label: 'Rendering' },
      { from: 'b', to: 'c', label: 'Rund um den Lippenrand ist der Spalt nirgends größer als ein halber Millimeter' },
      { from: 'd', to: 'e', label: 'skipped: not neighbours' },
      { from: 'a', to: 'd', label: 'skipped: not one row' },
      { from: 'c', to: 'e' },
    ],
  };
  const gaps = columnGaps(spec);
  assert.deepEqual(gaps.slice(0, 2), [Math.ceil(estimateTextWidth('Rendering', LABEL_PX)) + 16, 0]);
  assert.ok(gaps[2]! > 150, 'a sentence asks for more than the share; the grid caps it');
  // two gaps ask, so each gets half of LABEL_GAPS_SHARE, LABEL_GAP_SHARE at most
  const each = Math.min(LABEL_GAP_SHARE, LABEL_GAPS_SHARE / 2);
  assert.match(renderFlowDiagram(spec), new RegExp(`max\\(var\\(--flow-col-gap\\), min\\(${gaps[2]}px, ${each}%\\)\\)`));
});

test('renderFlowDiagram: a span covers its boxes and the gaps between them', () => {
  const html = renderFlowDiagram({ cols: 3, nodes: [{ id: 'w', title: 'w', col: 1, row: 1, span: 3 }], edges: [] });
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\) var\(--flow-col-gap\) minmax\(0, 1fr\) var\(--flow-col-gap\) minmax\(0, 1fr\)"/);
  assert.match(html, /data-node="w" style="grid-column:1 \/ span 5;/);
});

test('renderFlowDiagram: many widened gaps split the share between them', () => {
  const nodes = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, title: 'n', col: i + 1, row: 1 }));
  const edges = nodes.slice(1).map((n, i) => ({ from: `n${i}`, to: n.id, label: 'internationalization' }));
  const html = renderFlowDiagram({ cols: 6, nodes, edges });
  assert.equal(html.match(/min\(\d+px, 10%\)/g)?.length, 5, 'five gaps, 50% between them');
});

test('columnGaps: a blank label asks for nothing', () => {
  const spec = { cols: 2, nodes: [{ id: 'a', title: 'a', col: 1, row: 1 }, { id: 'b', title: 'b', col: 2, row: 1 }], edges: [{ from: 'a', to: 'b', label: '  ' }] };
  assert.deepEqual(columnGaps(spec), [0]);
});
