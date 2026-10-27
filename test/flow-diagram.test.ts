import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LABEL_GAPS_SHARE, LABEL_GAP_SHARE, LABEL_MIN_PX, LABEL_PX, columnGaps, detourAcross, detourBelow, dodges, gutterWires, keyBox, keySpot, detourBeside, freeColumns, labelLayouts, labelLines, portFractions, renderFlowDiagram, routeBetween, runsThrough, runsUnderLastRow, segmentPoint, segmentsByLength, sidesOf, stripLanes, toneColor, wireShape, wrapLabel } from '../lib/flow-diagram.ts';
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
  const shape = wireShape(box(0, 0), box(400, 0), 0, 40, 40, [box(200, 0)], [0, 500], [22, 22]);
  assert.deepEqual(shape.sides, { from: 'bottom', to: 'bottom' });
  assert.deepEqual(shape.path(), [[50, 40], [50, 56], [450, 56], [450, 40]]);
});

test('runsThrough: a segment through the inside of a box, not one along or short of its edge', () => {
  assert.equal(runsThrough([[50, 0], [50, 200]], box(0, 80)), true);
  assert.equal(runsThrough([[100, 0], [100, 200]], box(0, 80)), false, 'along the edge');
  assert.equal(runsThrough([[50, 0], [50, 80]], box(0, 80)), false, 'ends at the edge');
  assert.equal(runsThrough([[0, 100], [300, 100]], box(100, 80)), true);
});

test('a wire down one column past a box of a row in between goes down the free column gap beside them', () => {
  // three rows in one column, the middle box in the way; the next column's boxes leave the gap 100–140 free
  const a = box(0, 0);
  const mid = box(0, 80);
  const b = box(0, 160);
  const right = [box(140, 0), box(140, 80), box(140, 160)];
  assert.deepEqual(freeColumns(a, b, [mid, ...right], [0, 240]), [[100, 140]]);
  const shape = wireShape(a, b, 2, 40, 40, [mid, ...right], [0, 240], [22, 22]);
  assert.deepEqual(shape.sides, { from: 'right', to: 'right' });
  assert.deepEqual(shape.strip, [100, 140]);
  assert.deepEqual(shape.path(), [[100, 20], [120, 20], [120, 180], [100, 180]]);
  assert.ok([mid, ...right].every((r) => !runsThrough(shape.path(), r)));
  assert.deepEqual(detourBeside(b, a, 120, { from: 0.25, to: 0.75 }), [[100, 170], [120, 170], [120, 30], [100, 30]]);
  // empty columns at the edge of the boxes: the 48px next to them
  assert.deepEqual(freeColumns(a, b, [box(0, 80, 240)], [0, 400]), [[240, 288]]);
  // one column, nothing beside it: down the middle of the gutter to the right
  assert.deepEqual(wireShape(a, b, 2, 40, 40, [mid], [0, 100], [22, 22]).path(), [[100, 20], [111, 20], [111, 180], [100, 180]]);
});

test('the shape is chosen for where the ports put the ends, not only for the middles', () => {
  // A and B span the width; under A, L on the left and R on the right leave a gap in the middle
  const a = box(0, 0, 240);
  const b = box(0, 160, 240);
  const others = [box(0, 80), box(140, 80)];
  assert.deepEqual(wireShape(a, b, 2, 40, 40, others, [0, 240], [22, 22]).path(), [[120, 40], [120, 160]]);
  // a third of the way along B's top the straight wire would cross L: it moves to just past L's side, down the gap
  const at = { from: 0.5, to: 1 / 3 };
  const shape = wireShape(a, b, 2, 40, 40, others, [0, 240], [22, 22], at);
  assert.ok(others.every((r) => !runsThrough(shape.path(at), r)));
  assert.deepEqual(shape.sides, { from: 'bottom', to: 'top' });
  assert.deepEqual(shape.path(at), [[106, 40], [106, 160]]);
});

test('a wire to a box of another column runs down the gap between them when its own column is blocked', () => {
  // erect (row 1, column 1) to session (row 3, column 2), a box under erect and one above session
  const erect = box(0, 0);
  const session = box(140, 160);
  const others = [box(0, 80), box(140, 80), box(140, 0)];
  const shape = wireShape(erect, session, 2, 40, 40, others, [0, 240], [22, 22]);
  assert.deepEqual(shape.sides, { from: 'right', to: 'left' });
  assert.deepEqual(shape.path(), [[100, 20], [120, 20], [120, 180], [140, 180]]);
});

test('a heading is an obstacle: a wire across its words goes around it', () => {
  // two columns of boxes, rows 1 and 3; the heading of row 2 runs from the left edge past the middle of column 1
  const a = box(0, 0);
  const b = box(0, 160);
  const heading = box(0, 105, 80, 17);
  const right = [box(140, 0), box(140, 160)];
  assert.equal(runsThrough(routeBetween(a, b, 2, 40), heading), true, 'straight down column 1 crosses the words');
  const shape = wireShape(a, b, 2, 40, 40, [heading, ...right], [0, 240], [22, 22]);
  assert.ok(![heading, ...right].some((r) => runsThrough(shape.path(), r)));
  assert.deepEqual(shape.path(), [[86, 40], [86, 160]], 'straight down, 6px past the end of the words');
  // a heading as wide as the boxes leaves only the gutters; column 2's boxes stand between column 1 and the right one
  const wide = box(0, 105, 240, 17);
  assert.deepEqual(wireShape(a, b, 2, 40, 40, [wide, ...right], [0, 240], [22, 22]).path(), [[0, 20], [-11, 20], [-11, 180], [0, 180]]);
});

test('a wire back up one column, past a box, runs down the gutter, inside the wire layer', () => {
  const top = box(0, 0, 300);
  const mid = box(0, 80, 300);
  const bottom = box(0, 160, 300);
  const gutter = 22;
  const shape = wireShape(bottom, top, -2, 40, 200, [mid], [0, 300], [gutter, gutter]);
  assert.deepEqual(shape.sides, { from: 'right', to: 'right' });
  assert.deepEqual(shape.strip, [300, 300 + gutter]);
  const xs = shape.path().map(([x]) => x);
  // the layer spans -gutter … 300 + gutter; an 18px key disc centred on the wire clears the boxes and stays inside
  assert.ok(Math.max(...xs) - 9 >= 300 && Math.max(...xs) + 9 <= 300 + gutter);
});

test('a wire into a box under a heading that covers the source\'s whole edge goes down a free column, then under the words', () => {
  // the heading reaches past cameras' bottom edge; the free column between cameras and surface leads down past it
  const cameras = box(140, 0);
  const features = box(0, 160);
  const heading = box(0, 105, 236, 17);
  const others = [box(0, 0), heading, box(140, 160), box(260, 160)];
  const shape = wireShape(cameras, features, 2, 40, 40, others, [0, 360], [22, 22]);
  assert.ok(!others.some((r) => runsThrough(shape.path(), r)));
  assert.deepEqual(shape.sides, { from: 'right', to: 'top' });
  assert.deepEqual(shape.strip, [240, 260]);
  assert.deepEqual(shape.path(), [[240, 20], [250, 20], [250, 146], [50, 146], [50, 160]]);
  assert.deepEqual(detourAcross(features, cameras, -2, 250, 40, { from: 0.5, to: 0.5 }, true), [[50, 160], [50, 146], [250, 146], [250, 20], [240, 20]], 'early: the same way back up');
});

test('dodges: just past either side of each obstacle, inside the range, nearest first', () => {
  assert.deepEqual(dodges([box(0, 0, 80, 17), box(140, 0)], 0, 300, 50), [86, 134, 246]);
  assert.deepEqual(dodges([box(0, 0, 300, 17)], 0, 300, 50), [], 'an obstacle across the whole range leaves no way past');
});

test('a wire from one group into the next passes the heading beside its words', () => {
  // cameras (column 2) to features (column 1, the next group); the heading runs from the left edge past the middle of column 2
  const cameras = box(140, 0);
  const features = box(0, 160);
  const heading = box(0, 105, 200, 17);
  const others = [box(0, 0), heading, box(140, 160)];
  const shape = wireShape(cameras, features, 2, 40, 40, others, [0, 240], [22, 22]);
  assert.ok(!others.some((r) => runsThrough(shape.path(), r)));
  // down the part of cameras' bottom past the words, across under them, into features' top
  assert.deepEqual(shape.path(), [[206, 40], [206, 146], [50, 146], [50, 160]]);
});

test('gutterWires: wires joining rows past a box that spans every column; two or more widen the gutter', () => {
  const nodes = [1, 2, 3, 4].map((row) => ({ id: `n${row}`, title: 'n', col: 1, row }));
  assert.equal(gutterWires({ cols: 1, nodes, edges: [{ from: 'n1', to: 'n2' }, { from: 'n4', to: 'n1' }] }), 1);
  assert.doesNotMatch(renderFlowDiagram({ cols: 1, nodes, edges: [{ from: 'n4', to: 'n1' }] }), /--flow-gutter-lanes/);
  const three = { cols: 1, nodes, edges: [{ from: 'n1', to: 'n3' }, { from: 'n4', to: 'n2' }, { from: 'n4', to: 'n1' }] };
  assert.equal(gutterWires(three), 3);
  assert.match(renderFlowDiagram(three), /style="grid-template-columns:minmax\(0, 1fr\);--flow-gutter-lanes:4"/);
  // two columns, a box in one of them between the rows: the other column is a way past it
  assert.equal(gutterWires({ cols: 2, nodes: [...nodes, { id: 'x', title: 'x', col: 2, row: 1 }], edges: [{ from: 'n1', to: 'n3' }] }), 0);
});

test('keySpot: on the wire where it is clear, beside it on a lead where it is not, never on a box', () => {
  const area = { x: 0, y: 0, w: 400, h: 300 };
  const never = () => false;
  // a free run of wire: the middle of its longest segment
  assert.deepEqual(keySpot([[50, 0], [50, 200]], [], never, area), { x: 50, y: 100, at: [50, 100] });
  // a wire down an 18px gap between two columns of boxes, rows 0–100 and 140–240: the disc fits in the row gap
  const boxes = [box(0, 0, 100, 100), box(118, 0, 100, 100), box(0, 140, 100, 100), box(118, 140, 100, 100)];
  const inGap = keySpot([[109, 50], [109, 190]], boxes, never, area);
  assert.equal(inGap.x, 109);
  assert.ok(inGap.y - 9 >= 100 && inGap.y + 9 <= 140, 'between the rows');
  // a 14px gap whose only clear stretch, the row gap, already holds a key: the disc moves beside the wire on a lead, still in the row gap
  const narrow = [box(0, 0, 100, 100), box(114, 0, 100, 100), box(0, 140, 100, 100), box(114, 140, 100, 100)];
  const taken = keyBox(107, 120);
  const off = keySpot([[107, 50], [107, 190]], [...narrow, taken], never, area);
  const ob = keyBox(off.x, off.y);
  assert.ok(![...narrow, taken].some((b) => ob.x < b.x + b.w && ob.x + ob.w > b.x && ob.y < b.y + b.h && ob.y + ob.h > b.y), 'clear of the boxes and the other key');
  assert.notDeepEqual([off.x, off.y], off.at, 'joined to the wire by a lead');
  assert.equal(off.at[0], 107);
  // another key already on the clear stretch: the disc goes elsewhere
  const first = keySpot([[50, 0], [50, 200]], [], never, area);
  const second = keySpot([[50, 0], [50, 200]], [keyBox(first.x, first.y)], never, area);
  const a = keyBox(first.x, first.y);
  const b = keyBox(second.x, second.y);
  assert.ok(a.y + a.h <= b.y || b.y + b.h <= a.y || a.x + a.w <= b.x || b.x + b.w <= a.x);
});

test('stripLanes: wires sharing a free column are spread across it, left-hand boxes on the left', () => {
  assert.deepEqual(stripLanes([0, 30], [500]), [15]);
  assert.deepEqual(stripLanes([0, 30], [600, 100]), [20, 10]);
});

test('runsUnderLastRow: two boxes of the last row joined past another of its boxes', () => {
  const nodes = [{ id: 'a', title: 'A', col: 1, row: 1 }, { id: 'b', title: 'B', col: 2, row: 1 }, { id: 'c', title: 'C', col: 3, row: 1 }];
  assert.equal(runsUnderLastRow({ cols: 3, nodes, edges: [{ from: 'c', to: 'a' }] }), true);
  assert.equal(runsUnderLastRow({ cols: 3, nodes, edges: [{ from: 'a', to: 'b' }] }), false);
  assert.equal(runsUnderLastRow({ cols: 3, nodes: [...nodes, { id: 'd', title: 'D', col: 1, row: 2 }], edges: [{ from: 'c', to: 'a' }] }), false, 'not the last row');
  assert.match(renderFlowDiagram({ cols: 3, nodes, edges: [{ from: 'c', to: 'a' }] }), /class="flow-grid under"/);
});

test('a wire across rows and columns turns right after its own row when the gap before the target is blocked', () => {
  const a = box(0, 0);
  const b = box(300, 160);
  const blocker = box(0, 80);
  assert.equal(runsThrough(routeBetween(a, b, 2, 40), blocker), true);
  const shape = wireShape(a, b, 2, 40, 40, [blocker], [0, 400], [22, 22]);
  assert.deepEqual(shape.sides, { from: 'bottom', to: 'top' });
  assert.deepEqual(shape.path(), [[50, 40], [50, 54], [350, 54], [350, 160]]);
  // with nothing in the way, the direct route
  assert.deepEqual(wireShape(a, b, 2, 40, 40, [], [0, 400], [22, 22]).path(), routeBetween(a, b, 2, 40));
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
