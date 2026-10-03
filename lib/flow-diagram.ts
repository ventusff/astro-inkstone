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
  edges: FlowEdge[];
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

/** the longest segment of a polyline and where along it (`t`, 0.5 = the middle) its label goes */
export function labelAnchor(pts: Pt[], t = 0.5): { x: number; y: number; horizontal: boolean; length: number } {
  let best = -1;
  let p: Pt = pts[0] ?? [0, 0];
  let q: Pt = pts[1] ?? p;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i] ?? p;
    const b = pts[i + 1] ?? q;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > best) { best = len; p = a; q = b; }
  }
  const horizontal = Math.abs(q[0] - p[0]) > Math.abs(q[1] - p[1]);
  return {
    x: p[0] + (q[0] - p[0]) * t + (horizontal ? 0 : 8),
    y: p[1] + (q[1] - p[1]) * t + (horizontal ? -7 : 4),
    horizontal,
    length: Math.max(best, 0),
  };
}

/** a label's width estimated from its characters (CJK 11px, others 6.5px at the 11px label size) */
export function estimateLabelWidth(text: string): number {
  return [...text].reduce((w, ch) => w + (/[　-鿿＀-￯]/.test(ch) ? 11 : 6.5), 0);
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
  const laneCol = spec.lanes ? 1 : 0;
  const columns = `${spec.lanes ? 'max-content ' : ''}repeat(${spec.cols}, minmax(0, 1fr))`;
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
    const style = `grid-column:${n.col + laneCol} / span ${n.span ?? 1};grid-row:${n.row}${color && n.tone !== 'plain' ? `;border-color:${color}` : ''}`;
    const lines = (n.lines ?? []).map((l) => `<small>${esc(l)}</small>`).join('');
    const tag = n.tag ? `<span class="tag"${color ? ` style="color:${color}"` : ''}>${esc(n.tag)}</span>` : '';
    parts.push(`<div class="${cls}" data-node="${esc(n.id)}" style="${style}"><b>${esc(n.title)}</b>${lines}${tag}</div>`);
  }
  const wires = '<svg class="flow-wires" aria-hidden="true"><defs>'
    + '<marker id="flow-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--color-ink-faint)"/></marker>'
    + '<marker id="flow-ar-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--color-accent3)"/></marker>'
    + '</defs></svg>';
  const data = esc(JSON.stringify({ lanes: !!spec.lanes, rows: spec.nodes.map((n) => [n.id, n.row]), edges: spec.edges }));
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
  /** colour → arrowhead marker id; a marker per colour, made the first time a wire needs it */
  const markers = new Map<string, string>();
  const markerFor = (color: string): string => {
    const known = markers.get(color);
    if (known) return known;
    const id = `flow-ar-${Math.random().toString(36).slice(2, 9)}`;
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
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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
        'marker-end': `url(#${e.off ? 'flow-ar-off' : color ? markerFor(color) : 'flow-ar'})`,
      });
      if (color) path.style.stroke = color;
      wires.append(path);
      if (!e.label) continue;
      // the label goes at the middle of the longest segment, else a quarter in from either end;
      // where every spot lands on a box or a heading, or the gap is narrower than the words, it is left out
      const label = svgEl('text', { class: `lbl${e.off ? ' off' : ''}` }, e.label);
      wires.append(label);
      let placedLabel = false;
      for (const t of [0.5, 0.25, 0.75]) {
        const at = labelAnchor(pts, t);
        label.setAttribute('x', String(at.x));
        label.setAttribute('y', String(at.y));
        label.setAttribute('text-anchor', at.horizontal ? 'middle' : 'start');
        if (at.horizontal && at.length < Math.max(estimateLabelWidth(e.label), label.getComputedTextLength()) + 12) break;
        const b = label.getBBox();
        const box = { x: b.x - 2, y: b.y - 2, w: b.width + 4, h: b.height + 4 };
        if (!blocks.some((r) => overlaps(box, r))) { placedLabel = true; break; }
      }
      if (!placedLabel) label.remove();
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
