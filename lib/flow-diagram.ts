/**
 * FlowDiagram — a box-and-arrow diagram that can never overflow its boxes.
 *
 * The boxes are HTML: a CSS grid of `.flow-node` elements that size
 * themselves to their text and wrap long words, in whatever font the site
 * renders with. The arrows are the only SVG, and they are drawn *after*
 * layout from the measured positions of the boxes, then redrawn whenever
 * the grid resizes or the fonts finish loading. A hand-positioned
 * `<svg><text>` diagram breaks the moment a font is wider than the one it
 * was drawn against; this one has no positions to break.
 *
 * Three ways in:
 *   - `<FlowDiagram spec={…} />` in MDX — the component renders the boxes
 *     at build time (`renderFlowDiagram`) and `mountFlowDiagrams` draws the
 *     arrows in the browser;
 *   - `diagram(host, spec)` from a demo module — builds the same markup in
 *     the browser and returns handles (redraw, a path through nodes for an
 *     animated marker, destroy);
 *   - `svgTextOverflows(root)` — a probe for pages that still carry
 *     hand-drawn SVG: every `<text>` whose box leaves its `<svg>` viewport.
 */

import { estimateTextWidth, isWide } from './text-width.ts';

export type FlowTone = 'colleague' | 'admin' | 'machine' | 'blocked' | 'plain';

export interface FlowNode {
  id: string;
  title: string;
  /** small lines under the title */
  lines?: string[];
  /** a short tag at the bottom (who owns this step) */
  tag?: string;
  /** border and tag color: a semantic tone, or any CSS color string */
  tone?: FlowTone | string;
  /** grid column, 1-based; with lanes, column 1 is the lane label */
  col: number;
  /** grid row, 1-based */
  row: number;
  /** columns spanned */
  span?: number;
  /** dashed border, transparent — for rules and notes */
  ghost?: boolean;
  /** small lines in the mono font — for routes, paths, commands */
  mono?: boolean;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  /** a broken link: dashed, in the blocked tone */
  off?: boolean;
  dashed?: boolean;
  /** the wire's colour: a semantic tone, or any CSS color string (default: faint ink) */
  tone?: FlowTone | string;
}

export interface FlowSpec {
  /** columns the boxes occupy (the lane label column is extra) */
  cols: number;
  /** row labels; lane i labels row i+1 */
  lanes?: Array<{ text: string; tone?: FlowTone | string }>;
  /** a small heading occupying a whole row of its own */
  heads?: Array<{ row: number; text: string }>;
  nodes: FlowNode[];
  /** the wires; a diagram of boxes alone leaves it out */
  edges?: FlowEdge[];
}

export type Pt = [number, number];
export interface Rect { x: number; y: number; w: number; h: number }

const TONES: Record<FlowTone, string> = {
  colleague: 'var(--color-accent2)',
  admin: 'var(--color-accent)',
  machine: 'var(--color-accent4)',
  blocked: 'var(--color-accent3)',
  plain: 'var(--color-line)',
};

/** a tone name → its token; anything else is taken as a CSS color */
export function toneColor(tone: FlowTone | string | undefined): string | undefined {
  if (!tone) return undefined;
  return (TONES as Record<string, string>)[tone] ?? tone;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The polyline between two boxes. Which way it goes is decided by where the
 * boxes sit in the grid (`rows`: the target's row minus the source's), never
 * guessed from their measured sizes — a tall box and a short one on the same
 * row are still on the same row.
 *
 *   - same row: a level line between the facing edges;
 *   - another row, columns overlapping: a straight vertical inside the width
 *     the two boxes share;
 *   - another row, columns apart: out of the source's near edge, across in
 *     the gap right before the target's row (`gap` is the grid's row gap; the
 *     crossing keeps off its middle, where a lane separator runs), into the
 *     target's near edge.
 *
 * `at` places the ends along the sides they touch, as fractions (0.5 = the
 * middle): when several wires leave or enter one side of a box, each gets
 * its own point (`portFractions`), so two wires never share a stretch of line.
 */
export function routeBetween(a: Rect, b: Rect, rows: number, gap = 34, at: { from: number; to: number } = { from: 0.5, to: 0.5 }): Pt[] {
  if (rows === 0) {
    // a level line needs one height inside both boxes: the shared band, placed by the target's fraction
    const top = Math.max(a.y, b.y);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    const y = top + (bottom - top) * at.to;
    return a.x < b.x ? [[a.x + a.w, y], [b.x, y]] : [[a.x, y], [b.x + b.w, y]];
  }
  const down = rows > 0;
  const sy = down ? a.y + a.h : a.y;
  const ty = down ? b.y : b.y + b.h;
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  if (right - left > 16) {
    const x = left + (right - left) * at.to;
    return [[x, sy], [x, ty]];
  }
  const sx = a.x + a.w * at.from;
  const tx = b.x + b.w * at.to;
  const my = down ? ty - gap * 0.35 : ty + gap * 0.35;
  return [[sx, sy], [sx, my], [tx, my], [tx, ty]];
}

/**
 * A wire between two boxes on one row with other boxes of that row in
 * between: out of the source's bottom, along the gap under the row
 * (`rowBottom` is the lowest edge of that row's boxes), into the target's
 * bottom — so it never runs through the boxes it passes.
 */
export function detourBelow(a: Rect, b: Rect, rowBottom: number, gap = 34, at: { from: number; to: number } = { from: 0.5, to: 0.5 }): Pt[] {
  const sx = a.x + a.w * at.from;
  const tx = b.x + b.w * at.to;
  const y = rowBottom + gap * 0.4;
  return [[sx, a.y + a.h], [sx, y], [tx, y], [tx, b.y + b.h]];
}

/** which side of each box an edge touches, from the grid rows and the columns */
export type Side = 'top' | 'bottom' | 'left' | 'right';
export function sidesOf(a: Rect, b: Rect, rows: number, detour = false): { from: Side; to: Side } {
  if (detour) return { from: 'bottom', to: 'bottom' };
  if (rows === 0) return a.x < b.x ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
  return rows > 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
}

/**
 * Spread the wires that meet one side of one box: `ends` lists, per wire, the
 * coordinate of its far end along that side (x for top and bottom, y for left
 * and right). Wires are ordered by it so they do not cross at the box, and
 * spaced evenly: one wire 0.5, two 1/3 and 2/3, and so on.
 */
export function portFractions(ends: number[]): number[] {
  const order = ends.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
  const out = new Array<number>(ends.length);
  order.forEach(([, i], k) => { out[i] = (k + 1) / (ends.length + 1); });
  return out;
}

/** the segments of a polyline, longest first, each as its two ends, whether it runs horizontally, and its length */
export function segmentsByLength(pts: Pt[]): Array<{ p: Pt; q: Pt; horizontal: boolean; length: number }> {
  const out: Array<{ p: Pt; q: Pt; horizontal: boolean; length: number }> = [];
  for (let i = 0; i + 1 < pts.length; i += 1) {
    const p = pts[i] as Pt;
    const q = pts[i + 1] as Pt;
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (length > 0) out.push({ p, q, horizontal: Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]), length });
  }
  return out.sort((a, b) => b.length - a.length);
}

/** the point `t` along a segment (0.5 = the middle), with the segment's direction and length */
export function segmentPoint(seg: { p: Pt; q: Pt; horizontal: boolean; length: number }, t = 0.5): { x: number; y: number; horizontal: boolean; length: number } {
  return { x: seg.p[0] + (seg.q[0] - seg.p[0]) * t, y: seg.p[1] + (seg.q[1] - seg.p[1]) * t, horizontal: seg.horizontal, length: seg.length };
}

/** the label's font size, the smallest it may shrink to, and the most lines it may wrap into */
export const LABEL_PX = 11;
export const LABEL_MIN_PX = 9;
export const LABEL_MAX_LINES = 3;

/** a label set at one font size, broken into lines */
export interface LabelLayout { px: number; lines: string[] }

/**
 * The words of a label as the pieces a line may break between: a run of
 * characters between spaces, or a single full-width character (Han, kana and
 * Hangul break between any two). `space` says whether a space precedes it.
 */
function pieces(text: string): Array<{ text: string; space: boolean }> {
  const out: Array<{ text: string; space: boolean }> = [];
  let space = false;
  let run = '';
  const flush = () => { if (run) { out.push({ text: run, space }); space = false; run = ''; } };
  for (const ch of text.trim()) {
    if (/\s/.test(ch)) { flush(); space = true; continue; }
    if (isWide(ch)) { flush(); out.push({ text: ch, space }); space = false; continue; }
    run += ch;
  }
  flush();
  return out;
}

/**
 * The label broken greedily into lines no wider than `maxWidth` at font size
 * `px`, or null when a piece alone is wider or it takes more than `maxLines`.
 */
export function wrapLabel(text: string, maxWidth: number, px: number, maxLines = LABEL_MAX_LINES): string[] | null {
  const lines: string[] = [];
  for (const p of pieces(text)) {
    if (estimateTextWidth(p.text, px) > maxWidth) return null;
    const last = lines[lines.length - 1];
    const joined = last === undefined ? p.text : last + (p.space ? ' ' : '') + p.text;
    if (last !== undefined && estimateTextWidth(joined, px) <= maxWidth) lines[lines.length - 1] = joined;
    else lines.push(p.text);
  }
  return lines.length <= maxLines ? lines : null;
}

/** the narrowest setting of a label in at most LABEL_MAX_LINES lines at font size `px`, and its widest line's width */
export function narrowestWrap(text: string, px: number): { lines: string[]; width: number } {
  let lo = 0;
  let hi = estimateTextWidth(text, px);
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (wrapLabel(text, mid, px)) hi = mid; else lo = mid;
  }
  const lines = wrapLabel(text, hi, px) ?? [text];
  return { lines, width: Math.max(...lines.map((l) => estimateTextWidth(l, px))) };
}

/**
 * The ways to set a label in `room` px of width, best first: at each size from
 * LABEL_PX down to LABEL_MIN_PX, the fewest lines up to LABEL_MAX_LINES that
 * fit; when none does, at LABEL_MIN_PX as many lines as it takes to fit (a
 * sentence of a label); last, whatever fits or not, the narrowest LABEL_MAX_LINES-line
 * setting at LABEL_MIN_PX, so there is always one to draw.
 */
export function labelLayouts(text: string, room: number): LabelLayout[] {
  const out: LabelLayout[] = [];
  for (let px = LABEL_PX; px >= LABEL_MIN_PX; px -= 1) {
    const lines = wrapLabel(text, room, px);
    if (lines) out.push({ px, lines });
  }
  if (out.length === 0) {
    const lines = wrapLabel(text, room, LABEL_MIN_PX, Number.POSITIVE_INFINITY);
    if (lines) out.push({ px: LABEL_MIN_PX, lines });
  }
  out.push({ px: LABEL_MIN_PX, lines: narrowestWrap(text, LABEL_MIN_PX).lines });
  return out;
}

/** the most of the diagram's width, in percent, one widened column gap takes, and all of them together */
export const LABEL_GAP_SHARE = 25;
export const LABEL_GAPS_SHARE = 50;

/**
 * The width, in px, each gap between neighbouring columns asks for (index i is
 * the gap after column i + 1): a wire joining two boxes of one row across that
 * gap runs straight through it and carries its label there, so the gap asks
 * for the label's narrowest setting at LABEL_PX plus the 12px a level label
 * keeps from the wire's ends and its 2px padding on each side; 0 where no
 * labelled wire crosses. The grid grants it between the stylesheet's column
 * gap and an even split of LABEL_GAPS_SHARE of the diagram's width among the
 * gaps that ask, LABEL_GAP_SHARE at most each.
 */
export function columnGaps(spec: FlowSpec): number[] {
  const gaps = new Array<number>(Math.max(spec.cols - 1, 0)).fill(0);
  const byId = new Map(spec.nodes.map((n) => [n.id, n]));
  for (const e of spec.edges ?? []) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!e.label?.trim() || !a || !b || a.row !== b.row) continue;
    const [left, right] = a.col < b.col ? [a, b] : [b, a];
    const after = left.col + (left.span ?? 1) - 1;
    if (right.col !== after + 1 || after < 1 || after > gaps.length) continue;
    const need = Math.ceil(narrowestWrap(e.label, LABEL_PX).width) + 16;
    gaps[after - 1] = Math.max(gaps[after - 1] ?? 0, need);
  }
  return gaps;
}

/**
 * A label's lines placed at a segment point. Along a horizontal segment the
 * block is centred on the point's x: above it (`side` 1) or below it (-1),
 * 7px off, or on it (0), the block centred on the wire, whose stroke the
 * words' halo hides. Beside a vertical segment it starts 8px to the right (1)
 * or ends 8px to the left (-1), the block centred on the point. Baselines are
 * `y`; `anchor` is the SVG text-anchor.
 */
export function labelLines(
  at: { x: number; y: number; horizontal: boolean },
  side: 1 | 0 | -1,
  layout: LabelLayout,
): { anchor: 'middle' | 'start' | 'end'; lines: Array<{ x: number; y: number; text: string }> } {
  const n = layout.lines.length;
  const lh = Math.round(layout.px * 1.2);
  const centred = at.y + Math.round(layout.px * 0.35) - ((n - 1) * lh) / 2;
  if (at.horizontal) {
    const first = side === 1 ? at.y - 7 - (n - 1) * lh : side === -1 ? at.y + 7 + Math.round(layout.px * 0.8) : centred;
    return { anchor: 'middle', lines: layout.lines.map((text, i) => ({ x: at.x, y: first + i * lh, text })) };
  }
  const first = centred;
  return {
    anchor: side === 1 ? 'start' : 'end',
    lines: layout.lines.map((text, i) => ({ x: at.x + 8 * (side || 1), y: first + i * lh, text })),
  };
}

export const pathOf = (pts: Pt[]): string =>
  pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

/**
 * The diagram's HTML: a grid of boxes plus the (still empty) wire layer.
 * The spec travels along in `data-flow` so the browser can draw the wires.
 * Build-time (the component) and run-time (`diagram()`) render through
 * this one function, so the two never drift.
 */
export function renderFlowDiagram(spec: FlowSpec): string {
  // Column gaps are grid tracks of their own, so each can widen for the label
  // of a wire that crosses it: box column c sits on grid column 2c - 1 (+ 2 with
  // a lane column and the gap after it), and a span of s boxes covers 2s - 1 tracks.
  const laneCol = spec.lanes ? 2 : 0;
  const asks = columnGaps(spec);
  const share = Math.min(LABEL_GAP_SHARE, LABEL_GAPS_SHARE / Math.max(1, asks.filter((a) => a > 0).length));
  const gap = (ask: number) => (ask > 0 ? `max(var(--flow-col-gap), min(${ask}px, ${+share.toFixed(2)}%))` : 'var(--flow-col-gap)');
  const tracks: string[] = spec.lanes ? ['max-content', gap(0)] : [];
  asks.forEach((ask) => tracks.push('minmax(0, 1fr)', gap(ask)));
  tracks.push('minmax(0, 1fr)');
  const columns = tracks.join(' ');
  const parts: string[] = [];
  for (const h of spec.heads ?? []) {
    parts.push(`<div class="flow-head" style="grid-row:${h.row}">${esc(h.text)}</div>`);
  }
  spec.lanes?.forEach((lane, i) => {
    const color = toneColor(lane.tone);
    parts.push(`<div class="flow-lane" style="grid-column:1;grid-row:${i + 1}${color ? `;color:${color}` : ''}">${esc(lane.text)}</div>`);
  });
  for (const n of spec.nodes) {
    const color = toneColor(n.tone);
    const cls = `flow-node${n.ghost ? ' ghost' : ''}${n.mono ? ' mono' : ''}`;
    const style = `grid-column:${2 * n.col - 1 + laneCol} / span ${2 * (n.span ?? 1) - 1};grid-row:${n.row}${color && n.tone !== 'plain' ? `;border-color:${color}` : ''}`;
    const lines = (n.lines ?? []).map((l) => `<small>${esc(l)}</small>`).join('');
    const tag = n.tag ? `<span class="tag"${color ? ` style="color:${color}"` : ''}>${esc(n.tag)}</span>` : '';
    parts.push(`<div class="${cls}" data-node="${esc(n.id)}" style="${style}"><b>${esc(n.title)}</b>${lines}${tag}</div>`);
  }
  // the arrowheads are made in the browser with the wires, one id per diagram (see markerFor)
  const wires = '<svg class="flow-wires" aria-hidden="true"><defs></defs></svg>';
  const data = esc(JSON.stringify({ lanes: !!spec.lanes, rows: spec.nodes.map((n) => [n.id, n.row]), edges: spec.edges ?? [] }));
  return `<div class="flow-grid" data-flow="${data}" style="grid-template-columns:${columns}">${wires}${parts.join('')}</div>`;
}

export interface FlowHandle {
  root: HTMLElement;
  wires: SVGSVGElement;
  /** redraw the wires from the boxes' current positions */
  redraw(): void;
  /** the polyline through these boxes in order — for an animated marker */
  pathThrough(ids: string[]): string;
  destroy(): void;
}

interface FlowData { lanes: boolean; rows: Array<[string, number]>; edges: FlowEdge[] }

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

/** draw (and keep drawing) the wires of one rendered `.flow-grid` */
/** diagrams mounted on this page so far: numbers each one's arrowhead ids */
let mounted = 0;

export function mountFlowDiagram(root: HTMLElement): FlowHandle {
  const data = JSON.parse(root.dataset['flow'] ?? '{}') as FlowData;
  const layer = root.querySelector<SVGSVGElement>('svg.flow-wires');
  if (!layer) throw new Error('flow diagram: wire layer missing');
  // a binding typed non-null: closures below do not inherit a narrowing from the check above
  const wires: SVGSVGElement = layer;
  const defs = wires.querySelector('defs');
  const nodes = new Map<string, HTMLElement>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-node]')) nodes.set(el.dataset['node'] ?? '', el);

  const rowOf = new Map(data.rows);
  const rect = (id: string): Rect => {
    const el = nodes.get(id);
    if (!el) throw new Error(`flow diagram: no node "${id}"`);
    const r = el.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
  };
  const rowsBetween = (from: string, to: string) => (rowOf.get(to) ?? 0) - (rowOf.get(from) ?? 0);
  /** boxes of the same row as `from` and `to` that sit between them: a level wire would run through these */
  const between = (from: string, to: string): Rect[] => {
    if (rowsBetween(from, to) !== 0) return [];
    const a = rect(from);
    const b = rect(to);
    const lo = Math.min(a.x + a.w, b.x + b.w);
    const hi = Math.max(a.x, b.x);
    return data.rows
      .filter(([id, row]) => id !== from && id !== to && row === rowOf.get(from))
      .map(([id]) => rect(id))
      .filter((r) => r.x < hi && r.x + r.w > lo);
  };
  /** the lowest edge of the boxes on `id`'s row */
  const rowBottom = (id: string): number =>
    Math.max(...data.rows.filter(([, row]) => row === rowOf.get(id)).map(([n]) => { const r = rect(n); return r.y + r.h; }));
  /**
   * Where every edge meets its two boxes: the wires on one side of one box are
   * spread along it (`portFractions`), ordered by where their other end lies.
   */
  const ports = (): Map<FlowEdge, { from: number; to: number }> => {
    const groups = new Map<string, Array<{ edge: FlowEdge; end: 'from' | 'to'; far: number }>>();
    for (const e of data.edges) {
      const a = rect(e.from);
      const b = rect(e.to);
      const side = sidesOf(a, b, rowsBetween(e.from, e.to), between(e.from, e.to).length > 0);
      const along = (r: Rect, s: Side) => (s === 'top' || s === 'bottom' ? r.x + r.w / 2 : r.y + r.h / 2);
      for (const [end, id, s, far] of [['from', e.from, side.from, along(b, side.from)], ['to', e.to, side.to, along(a, side.to)]] as const) {
        const key = `${id}\u0000${s}`;
        groups.set(key, [...(groups.get(key) ?? []), { edge: e, end, far }]);
      }
    }
    const out = new Map<FlowEdge, { from: number; to: number }>();
    for (const e of data.edges) out.set(e, { from: 0.5, to: 0.5 });
    for (const members of groups.values()) {
      const fr = portFractions(members.map((m) => m.far));
      members.forEach((m, i) => { const at = out.get(m.edge); if (at) at[m.end] = fr[i] ?? 0.5; });
    }
    return out;
  };
  /** the route of one edge: grid rows decide the direction, the measured boxes the coordinates */
  const route = (from: string, to: string, at?: { from: number; to: number }): Pt[] => {
    const gap = Number.parseFloat(getComputedStyle(root).rowGap) || 34;
    if (between(from, to).length) return detourBelow(rect(from), rect(to), rowBottom(from), gap, at);
    return routeBetween(rect(from), rect(to), rowsBetween(from, to), gap, at);
  };
  /** colour → arrowhead marker id; a marker per colour, made the first time a wire needs it,
   *  under an id no other diagram on the page carries */
  const markers = new Map<string, string>();
  const diagramId = (mounted += 1);
  const markerFor = (color: string): string => {
    const known = markers.get(color);
    if (known) return known;
    const id = `flow-ar-${diagramId}-${markers.size}`;
    const m = svgEl('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
    m.append(svgEl('path', { d: 'M0 0L10 5L0 10z', fill: color }));
    defs?.append(m);
    markers.set(color, id);
    return id;
  };
  /** what a label must not land on: the boxes and the row headings */
  const obstacles = (): Rect[] => {
    const o = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>('[data-node], .flow-head')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };
    });
  };
  const overlapArea = (a: Rect, b: Rect) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  /** a label's box, padded 2px */
  const labelBox = (label: SVGTextElement): Rect => {
    const b = label.getBBox();
    return { x: b.x - 2, y: b.y - 2, w: b.width + 4, h: b.height + 4 };
  };
  /**
   * Write a label's lines into its <text> at font size `px`, shift them as
   * little as keeps the box (padded 2px) inside the diagram, `width` by
   * `height`, and return the box and how far, in px, the lines moved.
   */
  const setLabel = (label: SVGTextElement, laid: ReturnType<typeof labelLines>, px: number, width: number, height: number): { box: Rect; moved: number } => {
    label.replaceChildren(...laid.lines.map((l) => svgEl('tspan', { x: l.x, y: l.y }, l.text)));
    label.setAttribute('text-anchor', laid.anchor);
    label.style.fontSize = px === LABEL_PX ? '' : `${px}px`;
    const b = labelBox(label);
    const into = (lo: number, size: number, room: number) => (lo < 0 ? -lo : lo + size > room ? Math.max(room - (lo + size), -lo) : 0);
    const dx = into(b.x, b.w, width);
    const dy = into(b.y, b.h, height);
    if (!dx && !dy) return { box: b, moved: 0 };
    for (const ts of label.children) {
      ts.setAttribute('x', String(Number(ts.getAttribute('x')) + dx));
      ts.setAttribute('y', String(Number(ts.getAttribute('y')) + dy));
    }
    return { box: labelBox(label), moved: Math.hypot(dx, dy) };
  };

  function redraw(): void {
    for (const c of [...wires.children]) if (c !== defs) c.remove();
    if (data.lanes) {
      const byRow = new Map<number, Rect[]>();
      for (const [id, row] of data.rows) byRow.set(row, [...(byRow.get(row) ?? []), rect(id)]);
      const rows = [...byRow.entries()].sort((p, q) => p[0] - q[0]).map(([, rs]) => rs);
      for (let i = 0; i < rows.length - 1; i += 1) {
        const above = rows[i] ?? [];
        const below = rows[i + 1] ?? [];
        const y = (Math.max(...above.map((r) => r.y + r.h)) + Math.min(...below.map((r) => r.y))) / 2;
        wires.append(svgEl('line', { x1: 0, x2: root.clientWidth, y1: y, y2: y, class: 'sep' }));
      }
    }
    const placed = ports();
    const blocks = obstacles();
    for (const e of data.edges) {
      const pts = route(e.from, e.to, placed.get(e));
      const color = e.off ? undefined : toneColor(e.tone);
      const path = svgEl('path', {
        d: pathOf(pts),
        class: `wire${e.off ? ' off' : ''}${e.dashed ? ' dashed' : ''}`,
        'marker-end': `url(#${markerFor(e.off ? 'var(--color-accent3)' : (color ?? 'var(--color-ink-faint)'))})`,
      });
      if (color) path.style.stroke = color;
      wires.append(path);
      if (!e.label?.trim()) continue;
      // Every label is drawn. Spots, in order: the segments longest first; on each, the middle, then a
      // quarter in from either end; above, below, then on a horizontal segment; right, then left of a
      // vertical one.
      // At each spot the settings `labelLayouts` gives for the room there are tried best first, each
      // pulled inside the diagram where it would cross an edge. The first that fits the room, lands on
      // no box, heading or label drawn before it, and (beside a vertical segment, where a shift would
      // cross the wire) did not have to move is kept; when none does, the one that covers the least
      // of them, then moved the least, is.
      const label = svgEl('text', { class: `lbl${e.off ? ' off' : ''}` });
      wires.append(label);
      const width = root.clientWidth;
      const height = root.clientHeight;
      let best: { cost: number; set: () => Rect } | undefined;
      spots: for (const seg of segmentsByLength(pts)) for (const t of [0.5, 0.25, 0.75]) {
        const at = segmentPoint(seg, t);
        for (const side of at.horizontal ? ([1, -1, 0] as const) : ([1, -1] as const)) {
          const room = at.horizontal ? at.length - 12 : side === 1 ? width - at.x - 10 : at.x - 10;
          for (const layout of labelLayouts(e.label, room)) {
            const set = () => setLabel(label, labelLines(at, side, layout), layout.px, width, height).box;
            const { box, moved } = setLabel(label, labelLines(at, side, layout), layout.px, width, height);
            const covered = blocks.reduce((a, r) => a + overlapArea(box, r), 0);
            const tall = box.h > height;
            const fits = box.w - 4 <= Math.max(room, 0) && !tall;
            if (covered === 0 && fits && (at.horizontal || moved === 0)) { best = undefined; break spots; }
            // taller than the diagram leaves it whatever the shift, so that ranks last
            const cost = (tall ? 1e9 : 0) + covered * 1000 + moved + (fits ? 0 : 1);
            if (!best || cost < best.cost) best = { cost, set };
          }
        }
      }
      const box = best ? best.set() : labelBox(label);
      blocks.push(box);
    }
  }

  const ro = new ResizeObserver(() => redraw());
  ro.observe(root);
  document.fonts?.ready.then(() => redraw(), () => undefined);
  redraw();

  return {
    root,
    wires,
    redraw,
    pathThrough: (ids) => {
      let out = '';
      for (let i = 0; i < ids.length - 1; i += 1) {
        const a = ids[i];
        const b = ids[i + 1];
        if (!a || !b) continue;
        const pts = route(a, b);
        out += out ? pts.map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join('') : pathOf(pts);
      }
      return out;
    },
    destroy: () => {
      ro.disconnect();
      root.remove();
    },
  };
}

/** mount every rendered diagram under `scope` that is not mounted yet */
export function mountFlowDiagrams(scope: ParentNode = document): FlowHandle[] {
  const out: FlowHandle[] = [];
  for (const root of scope.querySelectorAll<HTMLElement>('.flow-grid[data-flow]:not([data-flow-mounted])')) {
    root.dataset['flowMounted'] = '1';
    out.push(mountFlowDiagram(root));
  }
  return out;
}

/** build a diagram inside `host` in the browser (demo modules) */
export function diagram(host: HTMLElement, spec: FlowSpec): FlowHandle {
  const wrap = document.createElement('div');
  wrap.innerHTML = renderFlowDiagram(spec);
  const root = wrap.firstElementChild as HTMLElement;
  host.append(root);
  root.dataset['flowMounted'] = '1';
  return mountFlowDiagram(root);
}

/**
 * Hand-drawn SVG that overflows: every `<text>` whose rendered box leaves
 * its `<svg>` viewport. For probes and page checks on sites that still
 * carry positioned diagrams.
 */
export function svgTextOverflows(scope: ParentNode = document): Array<{ svg: SVGSVGElement; text: SVGTextElement; by: number }> {
  const out: Array<{ svg: SVGSVGElement; text: SVGTextElement; by: number }> = [];
  for (const svg of scope.querySelectorAll('svg')) {
    const vb = svg.viewBox.baseVal;
    const width = vb.width || svg.clientWidth;
    const height = vb.height || svg.clientHeight;
    if (!width || !height) continue;
    for (const text of svg.querySelectorAll('text')) {
      const b = text.getBBox();
      const by = Math.max(b.x + b.width - (vb.x + width), (vb.x) - b.x, b.y + b.height - (vb.y + height), vb.y - b.y);
      if (by > 1) out.push({ svg, text, by });
    }
  }
  return out;
}
